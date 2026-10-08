const assert = require('assert');
const { parseRegisterPayload, BOOKING_SOURCES } = require('../src/utils/orderRegister');
const { orderFilter } = require('../src/utils/orderFilter');
const {
  parseCalledAt,
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

async function fillWorkbook(names, records) {
  const workbook = await buildImportTemplate(names);
  const sheet = workbook.getWorksheet('工单');
  records.forEach((record, index) => {
    const row = index + 2;
    sheet.getCell(`A${row}`).value = record[0];
    sheet.getCell(`B${row}`).value = record[1];
    sheet.getCell(`C${row}`).value = record[2];
    sheet.getCell(`D${row}`).value = record[3];
    sheet.getCell(`E${row}`).value = record[4];
    sheet.getCell(`F${row}`).value = record[5];
    sheet.getCell(`G${row}`).value = record[6];
    sheet.getCell(`H${row}`).value = record[7];
    sheet.getCell(`I${row}`).value = record[8];
  });
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
