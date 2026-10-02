const assert = require('assert');
const { parseRegisterPayload, BOOKING_SOURCES } = require('../src/utils/orderRegister');
const { orderFilter } = require('../src/utils/orderFilter');

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
  remark: '电话沟通漏水'
});
assert.equal(ok.contact_name, '张先生');
assert.equal(ok.expected_price, 200);
assert.match(ok.remark, /^预约时间：2026-10-08 上午 08-12/);

assert.throws(() => parseRegisterPayload({ contact_name: '张', contact_phone: '123', full_address: '杭州市西湖区文三路 1 号', service_id: 1 }), /手机号/);
assert.throws(() => parseRegisterPayload({
  contact_name: '张先生', contact_phone: '13800138000', full_address: '杭州市西湖区文三路 1 号',
  service_id: 1, appointment_date: '2026-10-08'
}), /同时填写/);

const phone = orderFilter({ booking_source: 'phone' });
assert.ok(phone.whereClause.includes('booking_source = ?'));
assert.deepStrictEqual(phone.params, ['phone']);
const ignored = orderFilter({ booking_source: 'all' });
assert.ok(!ignored.whereClause.includes('booking_source'));

console.log('order register tests passed');
