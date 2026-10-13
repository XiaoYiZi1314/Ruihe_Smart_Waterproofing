const assert = require('assert');
const { parseRegisterPayload, BOOKING_SOURCES } = require('../src/utils/orderRegister');
const { orderFilter } = require('../src/utils/orderFilter');
const ExcelJS = require('exceljs');
const {
  parseCalledAt,
  parseStatus,
  resolveWorker,
  buildImportSnapshot,
  parseImportWorkbook,
  buildImportTemplate
} = require('../src/utils/orderRegisterImport');

assert.equal(BOOKING_SOURCES.phone, '电话登记');
assert.equal(BOOKING_SOURCES.miniapp, '小程序');

const ok = parseRegisterPayload({
  contact_name: '张先生',
  contact_phone: '13800138000',
  full_address: '杭州市西湖区文三路 1 号',
  service_id: 4,
  expected_price: '200',
  appointment_date: '2026-10-08',
  appointment_slot: '上午 08-12',
  remark: '电话沟通漏水',
  called_at: '2026-10-08 09:30'
});
assert.equal(ok.contact_name, '张先生');
assert.equal(ok.expected_price, 200);
assert.match(ok.remark, /^预约时间：2026-10-08 上午 08-12/);
assert.equal(ok.called_at.toISOString(), new Date('2026-10-08T09:30:00+08:00').toISOString());

assert.throws(() => parseRegisterPayload({ contact_name: '张', contact_phone: '123', full_address: '杭州市西湖区文三路 1 号', service_id: 1 }), /手机号/);
assert.throws(() => parseRegisterPayload({
  contact_name: '张先生', contact_phone: '13800138000', full_address: '杭州市西湖区文三路 1 号',
  service_id: 1, appointment_date: '2026-10-08'
}), /同时填写/);
assert.throws(() => parseRegisterPayload({
  contact_name: '张先生', contact_phone: '13800138000', full_address: '杭州市西湖区文三路 1 号',
  service_id: 1, called_at: '2026-10-08'
}), /精确到分钟/);

const phone = orderFilter({ booking_source: 'phone' });
assert.ok(phone.whereClause.includes('booking_source = ?'));
assert.deepStrictEqual(phone.params, ['phone']);
const ignored = orderFilter({ booking_source: 'all' });
assert.ok(!ignored.whereClause.includes('booking_source'));

const now = new Date('2026-10-09T04:00:00Z');
assert.throws(() => parseCalledAt('2026-10-09 14:00', { required: true, now }), /不能晚于/);
assert.throws(() => parseCalledAt('', { required: true, now }), /请来电时间/);

assert.equal(parseStatus(''), 'pending');
assert.equal(parseStatus('已完成'), 'completed');
assert.equal(parseStatus('待指派'), 'pending');
assert.equal(parseStatus('已指派'), 'confirmed');
assert.throws(() => parseStatus('价格协商中'), /价格协商中不能直接导入/);
assert.throws(() => parseStatus('未知'), /工单状态须为/);

const workers = [
  { id: 8, nickname: '李师傅', phone: '13700137000', status: 'active' },
  { id: 9, nickname: '李师傅', phone: '13700137001', status: 'active' }
];
assert.equal(resolveWorker('13700137000', workers).id, 8);
assert.throws(() => resolveWorker('李师傅', workers), /有重名/);
assert.throws(() => resolveWorker('不存在', workers), /不存在或已停用/);
assert.throws(() => buildImportSnapshot({
  status: 'confirmed', calledAt: new Date('2026-10-08T09:30:00+08:00')
}), /请填写师傅/);

const completed = buildImportSnapshot({
  status: 'completed',
  calledAt: new Date('2026-10-08T09:30:00+08:00'),
  workerId: 8,
  finalPrice: 550,
  now: new Date('2026-10-09T04:00:00Z')
});
assert.equal(completed.status, 'completed');
assert.equal(completed.finished_at, '2026-10-08 09:30:00');
assert.equal(completed.completed_at, '2026-10-08 09:30:00');
assert.equal(completed.assigned_at, '2026-10-08 09:30:00');
assert.equal(completed.final_price, 550);
assert.equal(completed.labor_fee, 550);
assert.equal(completed.door_fee, 0);

const pendingReview = buildImportSnapshot({
  status: 'pending_review',
  calledAt: new Date('2026-10-08T09:30:00+08:00'),
  workerId: 8,
  now: new Date('2026-10-09T12:00:00+08:00')
});
assert.equal(pendingReview.completed_at, '2026-10-08 09:30:00');
assert.equal(pendingReview.auto_complete_at, '2026-10-12 12:00:00');

async function fillWorkbook(names, records, workerNames = []) {
  const workbook = await buildImportTemplate(names, workerNames);
  const sheet = workbook.getWorksheet('工单');
  records.forEach((record, index) => {
    const row = sheet.getRow(index + 2);
    record.forEach((value, col) => {
      row.getCell(col + 1).value = value;
    });
  });
  return workbook.xlsx.writeBuffer();
}

async function oldTemplateBuffer(records) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('工单');
  sheet.addRow(['来电时间', '联系人', '手机号', '服务地址', '服务项目', '预约日期', '预约时段', '期望价格', '沟通备注']);
  records.forEach(record => sheet.addRow(record));
  return workbook.xlsx.writeBuffer();
}

(async () => {
  const services = [{ id: 4, name: '卫生间防水' }];
  const buffer = await fillWorkbook(['卫生间防水'], [[
    '2026-10-08 09:30', '张先生', '13800138000', '杭州市西湖区文三路 1 号',
    '卫生间防水', '2026-10-09', '上午 08-12', '200', '漏水'
  ]]);
  const parsed = await parseImportWorkbook(buffer, { services, now });
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].body.service_id, 4);
  assert.equal(parsed.rows[0].body.contact_phone, '13800138000');
  assert.equal(parsed.rows[0].body.status, 'pending');

  const completedBuffer = await fillWorkbook(['卫生间防水'], [[
    '2026-10-08 09:30', '张先生', '13800138000', '杭州市西湖区文三路 1 号',
    '卫生间防水', '2026-10-09', '上午 08-12', '200', '漏水', '已完成', '王师傅', '550'
  ]], ['王师傅']);
  const completedParsed = await parseImportWorkbook(completedBuffer, {
    services, now, workers: [{ id: 8, nickname: '王师傅', phone: '13700137008', status: 'active' }]
  });
  assert.equal(completedParsed.errors.length, 0);
  assert.equal(completedParsed.rows[0].body.status, 'completed');
  assert.equal(completedParsed.rows[0].body.worker_id, 8);
  assert.equal(completedParsed.rows[0].body.final_price, 550);
  assert.equal(completedParsed.rows[0].body.snapshot.finished_at, '2026-10-08 09:30:00');

  const completedNoWorker = await fillWorkbook(['卫生间防水'], [[
    '2026-10-08 09:30', '张先生', '13800138000', '杭州市西湖区文三路 1 号',
    '卫生间防水', '', '', '', '', '已完成', '', ''
  ]]);
  const completedNoWorkerParsed = await parseImportWorkbook(completedNoWorker, { services, now });
  assert.equal(completedNoWorkerParsed.errors.length, 0);
  assert.equal(completedNoWorkerParsed.rows[0].body.status, 'completed');
  assert.equal(completedNoWorkerParsed.rows[0].body.worker_id, null);

  const confirmedNoWorker = await fillWorkbook(['卫生间防水'], [[
    '2026-10-08 09:30', '张先生', '13800138000', '杭州市西湖区文三路 1 号',
    '卫生间防水', '', '', '', '', '已确认', '', ''
  ]]);
  const confirmedFailed = await parseImportWorkbook(confirmedNoWorker, { services, now });
  assert.equal(confirmedFailed.errors.length, 1);
  assert.match(confirmedFailed.errors[0].message, /请填写师傅/);

  const pendingWithPrice = await fillWorkbook(['卫生间防水'], [[
    '2026-10-08 09:30', '张先生', '13800138000', '杭州市西湖区文三路 1 号',
    '卫生间防水', '', '', '', '', '待确认', '', '100'
  ]]);
  const pendingPriceFailed = await parseImportWorkbook(pendingWithPrice, { services, now });
  assert.equal(pendingPriceFailed.errors.length, 1);
  assert.match(pendingPriceFailed.errors[0].message, /最终价格仅在完工待验收或已完成/);

  const cancelledBuffer = await fillWorkbook(['卫生间防水'], [[
    '2026-10-08 09:30', '张先生', '13800138000', '杭州市西湖区文三路 1 号',
    '卫生间防水', '', '', '', '', '已取消', '', ''
  ]]);
  const cancelledParsed = await parseImportWorkbook(cancelledBuffer, { services, now });
  assert.equal(cancelledParsed.errors.length, 0);
  assert.equal(cancelledParsed.rows[0].body.status, 'cancelled');
  assert.equal(cancelledParsed.rows[0].body.snapshot.cancel_reason, '批量导入历史工单');

  const oldBuffer = await oldTemplateBuffer([[
    '2026-10-08 09:30', '张先生', '13800138000', '杭州市西湖区文三路 1 号',
    '卫生间防水', '2026-10-09', '上午 08-12', '200', '漏水'
  ]]);
  const oldParsed = await parseImportWorkbook(oldBuffer, { services, now });
  assert.equal(oldParsed.errors.length, 0);
  assert.equal(oldParsed.rows[0].body.status, 'pending');

  const template = await buildImportTemplate(['卫生间防水'], ['王师傅']);
  assert.equal(template.getWorksheet('工单').getCell('J1').value, '工单状态');
  assert.equal(template.getWorksheet('师傅').getCell('A2').value, '王师傅');

  const bad = await fillWorkbook(['卫生间防水'], [
    ['2026-10-08 09:30', '张先生', '13800138000', '杭州市西湖区文三路 1 号', '不存在的服务', '', '', '', ''],
    ['2026-10-08', '李女士', '13900139000', '杭州市西湖区文三路 2 号', '卫生间防水', '', '', '', '']
  ]);
  const failed = await parseImportWorkbook(bad, { services, now });
  assert.equal(failed.errors.length, 2);
  assert.match(failed.errors[0].message, /不存在或已下架/);
  assert.match(failed.errors[1].message, /精确到分钟/);

  console.log('order register tests passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
