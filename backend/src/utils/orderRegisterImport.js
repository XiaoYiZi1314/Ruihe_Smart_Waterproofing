const ExcelJS = require('exceljs');

const IMPORT_HEADERS = ['来电时间', '联系人', '手机号', '服务地址', '服务项目', '预约日期', '预约时段', '期望价格', '沟通备注'];
const MAX_IMPORT_ROWS = 100;
const SLOTS = ['上午 08-12', '下午 13-18', '晚上 18-20'];

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatSqlDateTime(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function cellToText(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
  }
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map(item => item.text).join('').trim();
    if (value.result != null) return cellToText(value.result);
    if (value.text != null) return String(value.text).trim();
    if (value.hyperlink && value.text == null) return String(value.hyperlink).trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  return String(value).trim();
}

function parseCalledAt(value, { required = false, now = new Date() } = {}) {
  if (value == null || value === '') {
    if (required) fail('请来电时间，精确到分钟');
    return now;
  }
  let text = value instanceof Date ? cellToText(value) : String(value).trim();
  text = text.replace('T', ' ').replace(/\//g, '-');
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
  if (!match) fail('来电时间格式应为 YYYY-MM-DD HH:mm');
  if (match[4] == null) fail('请来电时间精确到分钟，便于按实际来电顺序排列');
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || '00'}+08:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) fail('来电时间无效');
  if (date.getTime() > now.getTime() + 5 * 60 * 1000) fail('来电时间不能晚于当前时间');
  if (date.getTime() < now.getTime() - 365 * 24 * 60 * 60 * 1000) fail('来电时间不能早于一年前');
  return date;
}

function headerIndex(row) {
  const map = {};
  row.eachCell((cell, col) => {
    const name = cellToText(cell.value);
    if (name) map[name] = col;
  });
  const missing = IMPORT_HEADERS.filter(name => !map[name]);
  if (missing.length) fail(`表头缺少：${missing.join('、')}。请下载最新模板`);
  return map;
}

function parseImportSheet(sheet, { services = [], now = new Date() } = {}) {
  const serviceMap = new Map();
  for (const item of services) {
    const name = String(item.name || item).trim();
    if (name && !serviceMap.has(name)) serviceMap.set(name, Number(item.id) || item.id);
  }
  const columns = headerIndex(sheet.getRow(1));
  const errors = [];
  const rows = [];
  let seen = 0;
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const raw = {};
    for (const name of IMPORT_HEADERS) raw[name] = cellToText(row.getCell(columns[name]).value);
    const empty = IMPORT_HEADERS.every(name => !raw[name]);
    if (empty) return;
    seen += 1;
    if (seen > MAX_IMPORT_ROWS) return;
    const line = { row: number, raw };
    try {
      const called_at = parseCalledAt(raw['来电时间'], { required: true, now });
      const serviceName = raw['服务项目'];
      if (!serviceName) fail('请填写服务项目');
      const service_id = serviceMap.get(serviceName);
      if (!service_id) fail(`服务项目「${serviceName}」不存在或已下架，须与模板中的上架名称完全一致`);
      line.body = {
        called_at: formatSqlDateTime(called_at),
        calledAtDate: called_at,
        contact_name: raw['联系人'],
        contact_phone: raw['手机号'],
        full_address: raw['服务地址'],
        service_id,
        appointment_date: raw['预约日期'] ? raw['预约日期'].slice(0, 10) : '',
        appointment_slot: raw['预约时段'],
        expected_price: raw['期望价格'] === '' ? '' : raw['期望价格'],
        remark: raw['沟通备注']
      };
      rows.push(line);
    } catch (error) {
      errors.push({ row: number, message: error.message });
    }
  });
  if (seen > MAX_IMPORT_ROWS) fail(`一次最多导入 ${MAX_IMPORT_ROWS} 条`);
  if (!seen) fail('没有可导入的工单，请按模板填写');
  return { rows, errors };
}

async function parseImportWorkbook(buffer, options = {}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet('工单') || workbook.worksheets[0];
  if (!sheet) fail('Excel 中没有工单表');
  return parseImportSheet(sheet, options);
}

async function buildImportTemplate(serviceNames = []) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('工单');
  sheet.columns = IMPORT_HEADERS.map(header => ({ header, width: header === '服务地址' || header === '沟通备注' ? 28 : 16 }));
  sheet.getRow(1).font = { bold: true };
  const names = serviceNames.filter(Boolean);
  const last = Math.max(names.length + 1, 2);
  sheet.dataValidations.add('E2:E101', {
    type: 'list',
    allowBlank: true,
    formulae: [`服务项目!$A$2:$A$${last}`],
    showErrorMessage: true,
    error: '请选择上架服务项目'
  });
  sheet.dataValidations.add('G2:G101', {
    type: 'list',
    allowBlank: true,
    formulae: [`"${SLOTS.join(',')}"`],
    showErrorMessage: true,
    error: '预约时段须与日期同时填写'
  });

  const help = workbook.addWorksheet('填写说明');
  help.columns = [{ header: '说明', width: 80 }];
  [
    '导入的仍是正式电话登记工单，登记后进入待确认，之后按原流程指派。',
    '来电时间必填，精确到分钟，例如 2026-10-08 14:30。工单创建时间和工单号日期都按来电时间，避免补登打乱实际顺序。',
    '来电时间不能晚于现在，也不能早于一年前。',
    '服务项目必须与「服务项目」表中的上架名称完全一致。',
    '预约日期和预约时段要同时填写或同时留空；时段只能是：上午 08-12 / 下午 13-18 / 晚上 18-20。',
    `一次最多 ${MAX_IMPORT_ROWS} 条。有任一行错误则全部不导入。`,
    '不要改表头，不要在「工单」表里留示例数据。'
  ].forEach((text, index) => {
    help.getCell(`A${index + 2}`).value = text;
  });

  const catalog = workbook.addWorksheet('服务项目');
  catalog.columns = [{ header: '上架服务名称', width: 28 }];
  names.forEach((name, index) => {
    catalog.getCell(`A${index + 2}`).value = name;
  });
  return workbook;
}

module.exports = {
  IMPORT_HEADERS,
  MAX_IMPORT_ROWS,
  parseCalledAt,
  formatSqlDateTime,
  cellToText,
  parseImportWorkbook,
  parseImportSheet,
  buildImportTemplate
};
