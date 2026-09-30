const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const { buildTimeline, correctionNotice, appointmentText } = require('../utils/order-timeline');
const fmt = value => String(value).slice(5, 16).replace('T', ' ');

test('customer timeline is sorted by time and marks only the latest step as current', () => {
  const items = buildTimeline({
    created_at: '2026-10-01T02:00:00.000Z', assigned_at: '2026-10-01T03:00:00.000Z', confirmed_at: '2026-10-01T03:30:00.000Z',
    started_at: '2026-10-02T01:00:00.000Z', completed_at: '2026-10-02T03:00:00.000Z', finished_at: '2026-10-03T03:00:00.000Z'
  }, fmt);
  assert.deepEqual(items.map(item => item.key), ['created_at', 'assigned_at', 'confirmed_at', 'started_at', 'completed_at', 'finished_at']);
  assert.deepEqual(items.map(item => item.current), [false, false, false, false, false, true]);
  assert.equal(items[0].label, '提交预约');
});
test('timeline skips empty or invalid times and shows a price correction and cancellation in order', () => {
  assert.deepEqual(buildTimeline(null, fmt), []);
  const items = buildTimeline({ created_at: '2026-10-01 10:00:00', assigned_at: null, completed_at: 'not a date', price_corrected_at: '2026-10-02 10:00:00', cancelled_at: '2026-10-03 10:00:00' }, fmt);
  assert.deepEqual(items.map(item => item.key), ['created_at', 'price_corrected_at', 'cancelled_at']);
  assert.equal(items[2].current, true);
});
test('correction notice shows previous and new amount only after a correction', () => {
  assert.equal(correctionNotice({ final_price: '250.00' }, fmt), '');
  const text = correctionNotice({ price_corrected_at: '2026-10-02 10:00:00', price_before_correction: '350.00', final_price: '250.00' }, fmt);
  assert.match(text, /由 ¥350\.00 更正为 ¥250\.00/);
  assert.match(text, /联系客服/);
});
test('appointment text prefers structured fields and falls back to the legacy remark line', () => {
  assert.equal(appointmentText({ appointment_date: '2026-10-03T00:00:00.000Z', appointment_slot: '下午 13-18', remark: '预约时间：2026-10-01 上午 08-12' }), '2026-10-03 下午 13-18');
  assert.equal(appointmentText({ remark: '预约时间：2026-10-01 上午 08-12\n漏水' }), '2026-10-01 上午 08-12');
  assert.equal(appointmentText({}), '');
});
test('booking page submits the structured appointment next to the remark line', () => {
  const source = read('pages/booking/create.js');
  assert.match(source, /appointment_date: this\.data\.dateValue/);
  assert.match(source, /appointment_slot: this\.data\.timeValue/);
  assert.match(source, /预约时间：/);
});
test('order detail uses the timeline component and the correction banner', () => {
  const json = JSON.parse(read('pages/orders/detail.json'));
  assert.equal(json.usingComponents['rh-timeline'], '/components/rh-timeline/rh-timeline');
  const wxml = read('pages/orders/detail.wxml');
  assert.match(wxml, /<rh-timeline items="\{\{timelineItems\}\}"/);
  assert.match(wxml, /wx:if="\{\{correctionNotice\}\}"/);
  assert.match(read('pages/orders/detail.js'), /correctionNotice\(order, theme\.formatTime\)/);
});
test('worker change request form is wired to existing handlers and the backend routes', () => {
  const wxml = read('pages/worker/orders/detail.wxml');
  const js = read('pages/worker/orders/detail.js');
  for (const handler of ['openChangeModal', 'closeChangeModal', 'handleChangeRequest', 'onChangeTypeChange', 'onChangeContentInput', 'onChangeFeeInput', 'onChangeProposedDateChange', 'onChangeProposedTimeChange']) {
    assert.match(wxml, new RegExp(`=\\"${handler}\\"`), `${handler} is not bound in wxml`);
    assert.match(js, new RegExp(`\\n  (async )?${handler}\\(`), `${handler} is not defined in js`);
  }
  assert.match(js, /\/api\/worker\/orders\/\$\{this\.data\.id\}\/change-requests/);
  assert.match(js, /proposed_time/);
  assert.match(wxml, /disabled="\{\{submitting \|\| hasPendingRequest\}\}"/);
  assert.match(wxml, /changeTypes\[changeTypeIndex\]\.value === 'time'/);
});
test('design system preview includes rh-timeline', () => {
  const json = JSON.parse(read('pages/dev/design-system.json'));
  assert.equal(json.usingComponents['rh-timeline'], '/components/rh-timeline/rh-timeline');
  assert.match(read('pages/dev/design-system.wxml'), /<rh-timeline items="\{\{demoTimeline\}\}"/);
});
