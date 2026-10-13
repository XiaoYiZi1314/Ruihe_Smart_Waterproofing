const ExcelJS = require('exceljs');

const REQUIRED_HEADERS = ['来电时间', '联系人', '手机号', '服务地址', '服务项目', '预约日期', '预约时段', '期望价格', '沟通备注'];
const OPTIONAL_HEADERS = ['工单状态', '师傅', '最终价格'];
const IMPORT_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];
const MAX_IMPORT_ROWS = 100;
const SLOTS = ['上午 08-12', '下午 13-18', '晚上 18-20'];
const IMPORT_STATUS_LABELS = ['待确认', '已确认', '施工中', '完工待验收', '已完成', '已取消'];
const STATUS_ALIASES = {
  '': 'pending',
  待确认: 'pending',
  待指派: 'pending',
  pending: 'pending',
  已确认: 'confirmed',
  已指派: 'confirmed',
  confirmed: 'confirmed',
  施工中: 'in_progress',
  in_progress: 'in_progress',
  完工待验收: 'pending_review',
  待客户确认: 'pending_review',
  pending_review: 'pending_review',
  已完成: 'completed',
  completed: 'completed',
  已取消: 'cancelled',
  cancelled: 'cancelled'
};
const STATUS_REQUIRE_WORKER = new Set(['confirmed', 'in_progress', 'pending_review']);
const STATUS_ALLOW_PRICE = new Set(['pending_review', 'completed']);
const STATUS_TEXT = {
  pending: '待确认',
  confirmed: '已确认',
  in_progress: '施工中',
  pending_review: '完工待验收',
  completed: '已完成',
  cancelled: '已取消'
};

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function colLetter(index) {
  return String.fromCharCode(65 + index);
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

function parseStatus(value) {
  const text = String(value || '').trim();
  if (text === '价格协商中' || text === 'price_negotiating') {
    fail('价格协商中不能直接导入，请改为完工待验收或已完成');
  }
  const status = STATUS_ALIASES[text];
  if (!status) fail(`工单状态须为 ${IMPORT_STATUS_LABELS.join(' / ')}`);
  return status;
}

function parseMoney(value, label) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 9999999.99) fail(`${label}必须大于 0`);
  return Math.round(number * 100) / 100;
}

function resolveWorker(name, workers = []) {
  const text = String(name || '').trim();
  if (!text) return null;
  const active = workers.filter(item => item.status !== 'inactive');
  if (/^1[3-9]\d{9}$/.test(text)) {
    const found = active.filter(item => item.phone === text);
    if (!found.length) fail(`师傅手机号「${text}」不存在或已停用`);
    return found[0];
  }
  const found = active.filter(item => item.nickname === text);
  if (!found.length) fail(`师傅「${text}」不存在或已停用`);
  if (found.length > 1) fail(`师傅姓名「${text}」有重名，请改填师傅手机号`);
  return found[0];
}

function estimatedFromAppointment(date, slot, fallback) {
  if (!date) return fallback;
  const hour = slot === '下午 13-18' ? '13' : slot === '晚上 18-20' ? '18' : '08';
  const parsed = new Date(`${date}T${hour}:00:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function buildImportSnapshot({
  status = 'pending',
  calledAt,
  workerId = null,
  finalPrice = null,
  appointmentDate,
  appointmentSlot,
  now = new Date()
} = {}) {
  if (!calledAt) fail('请来电时间，精确到分钟');
  if (STATUS_REQUIRE_WORKER.has(status) && !workerId) fail(`${STATUS_TEXT[status]}工单请填写师傅`);
  if (finalPrice != null && !STATUS_ALLOW_PRICE.has(status)) fail('最终价格仅在完工待验收或已完成时填写');

  const at = formatSqlDateTime(calledAt);
  const snapshot = { status };
  if (status === 'pending') return snapshot;

  if (workerId) {
    snapshot.worker_id = workerId;
    snapshot.estimated_time = formatSqlDateTime(estimatedFromAppointment(appointmentDate, appointmentSlot, calledAt));
    snapshot.assigned_at = at;
  }
  if (workerId && (status === 'in_progress' || status === 'pending_review' || status === 'completed')) {
    snapshot.confirmed_at = at;
    snapshot.started_at = at;
  }
  if (status === 'pending_review') {
    snapshot.completed_at = at;
    snapshot.auto_complete_at = formatSqlDateTime(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000));
  }
  if (status === 'completed') {
    snapshot.completed_at = at;
    snapshot.finished_at = at;
  }
  if (status === 'cancelled') {
    snapshot.cancelled_at = at;
    snapshot.cancel_reason = '批量导入历史工单';
  }
  if (finalPrice != null) {
    snapshot.door_fee = 0;
    snapshot.material_fee = 0;
    snapshot.labor_fee = finalPrice;
    snapshot.final_price = finalPrice;
  }
  return snapshot;
}

function headerIndex(row) {
  const map = {};
  row.eachCell((cell, col) => {
    const name = cellToText(cell.value);
    if (name) map[name] = col;
  });
  const missing = REQUIRED_HEADERS.filter(name => !map[name]);
  if (missing.length) fail(`表头缺少：${missing.join('、')}。请下载最新模板`);
  return map;
}

function cellText(row, columns, name) {
  const col = columns[name];
  if (!col) return '';
  return cellToText(row.getCell(col).value);
}

function parseImportSheet(sheet, { services = [], workers = [], now = new Date() } = {}) {
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
    for (const name of IMPORT_HEADERS) raw[name] = cellText(row, columns, name);
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
      const status = parseStatus(raw['工单状态']);
      const worker = resolveWorker(raw['师傅'], workers);
      const final_price = parseMoney(raw['最终价格'], '最终价格');
      const appointment_date = raw['预约日期'] ? raw['预约日期'].slice(0, 10) : '';
      const appointment_slot = raw['预约时段'];
      const snapshot = buildImportSnapshot({
        status,
        calledAt: called_at,
        workerId: worker && worker.id,
        finalPrice: final_price,
        appointmentDate: appointment_date,
        appointmentSlot: appointment_slot,
        now
      });
      line.body = {
        called_at: formatSqlDateTime(called_at),
        calledAtDate: called_at,
        contact_name: raw['联系人'],
        contact_phone: raw['手机号'],
        full_address: raw['服务地址'],
        service_id,
        appointment_date,
        appointment_slot,
        expected_price: raw['期望价格'] === '' ? '' : raw['期望价格'],
        remark: raw['沟通备注'],
        status,
        worker_id: worker ? worker.id : null,
        worker_label: worker ? worker.nickname : '',
        final_price,
        snapshot
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

async function buildImportTemplate(serviceNames = [], workerNames = []) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('工单');
  sheet.columns = IMPORT_HEADERS.map(header => ({
    header,
    width: header === '服务地址' || header === '沟通备注' ? 28 : 16
  }));
  sheet.getRow(1).font = { bold: true };
  const names = serviceNames.filter(Boolean);
  const workers = workerNames.filter(Boolean);
  const serviceLast = Math.max(names.length + 1, 2);
  const workerLast = Math.max(workers.length + 1, 2);
  const serviceCol = colLetter(IMPORT_HEADERS.indexOf('服务项目'));
  const slotCol = colLetter(IMPORT_HEADERS.indexOf('预约时段'));
  const statusCol = colLetter(IMPORT_HEADERS.indexOf('工单状态'));
  const workerCol = colLetter(IMPORT_HEADERS.indexOf('师傅'));
  sheet.dataValidations.add(`${serviceCol}2:${serviceCol}101`, {
    type: 'list',
    allowBlank: true,
    formulae: [`服务项目!$A$2:$A$${serviceLast}`],
    showErrorMessage: true,
    error: '请选择上架服务项目'
  });
  sheet.dataValidations.add(`${slotCol}2:${slotCol}101`, {
    type: 'list',
    allowBlank: true,
    formulae: [`"${SLOTS.join(',')}"`],
    showErrorMessage: true,
    error: '预约时段须与日期同时填写'
  });
  sheet.dataValidations.add(`${statusCol}2:${statusCol}101`, {
    type: 'list',
    allowBlank: true,
    formulae: [`"${IMPORT_STATUS_LABELS.join(',')}"`],
    showErrorMessage: true,
    error: '请选择可导入的工单状态，空则为待确认'
  });
  sheet.dataValidations.add(`${workerCol}2:${workerCol}101`, {
    type: 'list',
    allowBlank: true,
    formulae: [`师傅!$A$2:$A$${workerLast}`],
    showErrorMessage: true,
    error: '请选择在职师傅，或填写师傅手机号'
  });

  const help = workbook.addWorksheet('填写说明');
  help.columns = [{ header: '说明', width: 80 }];
  [
    '导入的仍是正式电话登记工单。工单状态可空，空则为待确认，之后按原流程指派。',
    '历史已完成、已取消可直接填写对应状态，时间节点按来电时间回填，不必再走指派或完工。',
    '来电时间必填，精确到分钟，例如 2026-10-08 14:30。工单创建时间和工单号日期都按来电时间，避免补登打乱实际顺序。',
    '来电时间不能晚于现在，也不能早于一年前。',
    '服务项目必须与「服务项目」表中的上架名称完全一致。',
    '预约日期和预约时段要同时填写或同时留空；时段只能是：上午 08-12 / 下午 13-18 / 晚上 18-20。',
    `工单状态只能是：${IMPORT_STATUS_LABELS.join(' / ')}。也可用待指派、已指派、待客户确认。价格协商中不能导入。`,
    '已确认、施工中、完工待验收必须填写师傅（姓名或手机号，须与「师傅」表一致）。已完成建议填写师傅和最终价格。',
    '最终价格仅完工待验收或已完成时可填；不填则工单无最终价格。',
    '导入已指派且来电超过 24 小时未开工的，会按规则记为异常。完工待验收从导入时刻起算 3 天自动完成。',
    `一次最多 ${MAX_IMPORT_ROWS} 条。有任一行错误则全部不导入。`,
    '不要改表头，不要在「工单」表里留示例数据。旧模板没有状态列也可以继续导入，默认待确认。'
  ].forEach((text, index) => {
    help.getCell(`A${index + 2}`).value = text;
  });

  const catalog = workbook.addWorksheet('服务项目');
  catalog.columns = [{ header: '上架服务名称', width: 28 }];
  names.forEach((name, index) => {
    catalog.getCell(`A${index + 2}`).value = name;
  });

  const workerSheet = workbook.addWorksheet('师傅');
  workerSheet.columns = [{ header: '在职师傅姓名', width: 20 }];
  workers.forEach((name, index) => {
    workerSheet.getCell(`A${index + 2}`).value = name;
  });
  return workbook;
}

module.exports = {
  IMPORT_HEADERS,
  REQUIRED_HEADERS,
  OPTIONAL_HEADERS,
  MAX_IMPORT_ROWS,
  IMPORT_STATUS_LABELS,
  parseCalledAt,
  parseStatus,
  resolveWorker,
  buildImportSnapshot,
  formatSqlDateTime,
  cellToText,
  parseImportWorkbook,
  parseImportSheet,
  buildImportTemplate
};
