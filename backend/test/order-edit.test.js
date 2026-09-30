const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const State = require('../src/utils/orderStateMachine');
const Log = require('../src/utils/orderChangeLog');
const { orderFilter } = require('../src/utils/orderFilter');

function load(file, deps) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), { module, exports: module.exports, console, process: { env: {} }, Buffer, Promise, Date, Math, Number, String, Object, Array, JSON, Error, Set, Map, Boolean,
    require(name) { if (!(name in deps)) throw Error('Unexpected dependency: ' + name); return deps[name]; } });
  return module.exports;
}
const admin = { id: 1, role: 'admin', nickname: '客服小王' };
function baseOrder(extra = {}) {
  return { id: 42, order_no: 'RH42', user_id: 7, worker_id: 8, service_id: 3, status: 'completed', revision: 2, correction_count: 0,
    contact_name: '张三', contact_phone: '13800000000', full_address: '上海市浦东新区某路1号', remark: '预约时间：2026-10-01 上午 08-12\n漏水',
    expected_price: '500.00', door_fee: '50.00', material_fee: '100.00', labor_fee: '200.00', final_price: '350.00', estimated_time: new Date(2026, 9, 1, 9, 0, 0),
    appointment_date: '2026-10-01', appointment_slot: '上午 08-12', created_at: new Date(2026, 8, 28, 10, 0, 0), confirmed_at: new Date(2026, 8, 28, 12, 0, 0),
    started_at: new Date(2026, 9, 1, 9, 30, 0), completed_at: new Date(2026, 9, 1, 11, 0, 0), finished_at: new Date(2026, 9, 2, 8, 0, 0), ...extra };
}
function fixture(order, { worker = { id: 9, role: 'worker', status: 'active', worker_status: 'working', nickname: '李师傅' }, failOn, request, pendingRequest } = {}) {
  const sql = []; const calls = []; const notes = [];
  const connection = {
    async beginTransaction() { calls.push('begin'); }, async commit() { calls.push('commit'); }, async rollback() { calls.push('rollback'); }, release() { calls.push('release'); },
    async query(query, params) {
      sql.push({ query, params });
      if (failOn && query.includes(failOn)) throw new Error('boom');
      if (query.startsWith('SELECT * FROM work_orders')) return [order ? [order] : []];
      if (query.startsWith('SELECT id, order_no, worker_id, status FROM work_orders')) return [order ? [order] : []];
      if (query.startsWith('SELECT id FROM work_orders')) return [[{ id: 42 }]];
      if (query.startsWith('SELECT * FROM users')) return [worker ? [worker] : []];
      if (query.startsWith('SELECT id FROM services')) return [[{ id: Number(params[0]) }]];
      if (query.startsWith('SELECT id, name FROM services')) return [[{ id: 3, name: '防水补漏' }, { id: 4, name: '外墙防水' }]];
      if (query.startsWith('SELECT nickname, username')) return [[{ nickname: '客服小王' }]];
      if (query.startsWith('SELECT id, nickname FROM users')) return [[{ id: 8, nickname: '王师傅' }, { id: 9, nickname: '李师傅' }]];
      if (query.startsWith('SELECT * FROM order_change_requests')) return [request ? [request] : []];
      if (query.startsWith('SELECT id FROM order_change_requests')) return [pendingRequest ? [{ id: 1 }] : []];
      if (query.includes('COUNT(*) AS total, COALESCE(MAX(sort_order)')) return [[{ total: 2, last: 1 }]];
      if (query.startsWith('SELECT * FROM work_order_images')) return [[{ id: 5, image_url: '/api/upload/file/x' }]];
      if (query.startsWith('INSERT')) return [{ insertId: 11 }];
      return [{ affectedRows: 1 }];
    }
  };
  const db = { async getConnection() { return connection; }, async query(...args) { return connection.query(...args); } };
  const edit = load('utils/orderEdit.js', { '../config/database': db, './orderChangeLog': Log, './attachments': { async assertOwned(conn, id, urls) { if (urls[0] === 'bad') throw Object.assign(new Error('附件不属于当前用户或格式错误'), { status: 403 }); } },
    './realtime': { async notifyOrderChange() {}, notifyAdmins() {} }, './notification': { async logNotification(...args) { notes.push(args); } } });
  const workflow = load('utils/orderWorkflow.js', { '../config/database': db, './orderStateMachine': State, './realtime': { notifyOrderChange: async () => {} }, './orderChangeLog': Log });
  return { edit, workflow, sql, calls, notes };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const logInsert = f => f.sql.filter(s => s.query.startsWith('INSERT INTO order_change_logs'));
const rowsOf = f => logInsert(f).flatMap(s => s.params[0]);

test('planEdit validates fields and only returns real changes', () => {
  const { edit } = fixture(baseOrder());
  const order = baseOrder();
  assert.deepEqual(JSON.parse(JSON.stringify(edit.planEdit(order, { contact_name: '  李四 ', contact_phone: '13800000000' }))), { contact_name: '李四' });
  assert.throws(() => edit.planEdit(order, { contact_phone: '123' }), e => e.status === 400);
  assert.throws(() => edit.planEdit(order, { contact_name: '张三' }), /没有变化/);
  assert.throws(() => edit.planEdit(order, { status: 'pending' }), /不支持修改字段/);
  assert.throws(() => edit.planEdit(order, { expected_price: -1 }), e => e.status === 400);
  assert.throws(() => edit.planEdit(order, {}), e => e.status === 400);
});
test('fee changes recompute final price and need all three fees', () => {
  const { edit } = fixture(baseOrder());
  const plan = JSON.parse(JSON.stringify(edit.planEdit(baseOrder(), { labor_fee: 250.5 })));
  assert.equal(plan.labor_fee, 250.5); assert.equal(plan.final_price, 400.5);
  assert.throws(() => edit.planEdit(baseOrder({ door_fee: null, material_fee: null, labor_fee: null, final_price: null }), { labor_fee: 10 }), /同时填写/);
});
test('appointment needs both parts and keeps the remark line in sync', () => {
  const { edit } = fixture(baseOrder());
  assert.throws(() => edit.planEdit(baseOrder(), { appointment_slot: null }), /同时/);
  assert.throws(() => edit.planEdit(baseOrder(), { appointment_slot: '半夜 00-01' }), e => e.status === 400);
  const plan = JSON.parse(JSON.stringify(edit.planEdit(baseOrder(), { appointment_date: '2026-10-03', appointment_slot: '下午 13-18' })));
  assert.equal(plan.remark, '预约时间：2026-10-03 下午 13-18\n漏水');
  assert.equal(edit.withAppointmentLine('漏水', '2026-10-03', '下午 13-18'), '预约时间：2026-10-03 下午 13-18\n漏水');
  assert.equal(edit.withAppointmentLine('预约时间：x\n漏水', null, null), '漏水');
  const remarkOnly = JSON.parse(JSON.stringify(edit.planEdit(baseOrder(), { remark: '预约时间：2099-01-01 上午 08-12\n漏水严重' })));
  assert.equal(remarkOnly.remark, '预约时间：2026-10-01 上午 08-12\n漏水严重');
  assert.equal(remarkOnly.appointment_date, undefined);
});
test('time fields must fit the status and stay chronological', () => {
  const { edit } = fixture(baseOrder());
  assert.throws(() => edit.planEdit(baseOrder({ status: 'in_progress', completed_at: null, finished_at: null }), { finished_at: '2026-10-02 08:00:00' }), /不能设置/);
  assert.throws(() => edit.planEdit(baseOrder(), { started_at: '2026-10-05 09:00:00' }), /不能早于/);
  assert.ok(edit.planEdit(baseOrder(), { started_at: '2026-10-01 09:40:00' }).started_at);
});

test('editOrder logs old/new values in the same transaction and bumps revision', async () => {
  const f = fixture(baseOrder({ status: 'completed' }));
  const result = await f.edit.editOrder(42, admin, { revision: 2, reason_type: 'data_entry_error', reason_note: '手机号录入错误', changes: { contact_phone: '13900001111' } }, { ip: '1.2.3.4' });
  assert.equal(result.revision, 3);
  const update = f.sql.find(s => s.query.startsWith('UPDATE work_orders'));
  assert.match(update.query, /revision = revision \+ 1/);
  assert.match(f.sql[0].query, /FOR UPDATE/);
  const rows = rowsOf(f);
  assert.equal(rows.length, 1);
  const [batch, orderId, opId, opName, role, source, action, field, label, oldValue, newValue, reasonType, reasonNote, ip] = rows[0];
  assert.deepEqual([orderId, opId, opName, source, action, field, label, oldValue, newValue, reasonType, reasonNote, ip],
    [42, 1, '客服小王', 'admin_edit', 'edit', 'contact_phone', '联系电话', '13800000000', '13900001111', 'data_entry_error', '手机号录入错误', '1.2.3.4']);
  assert.ok(f.sql.findIndex(s => s.query.startsWith('INSERT INTO order_change_logs')) > f.sql.findIndex(s => s.query.startsWith('UPDATE work_orders')));
  assert(f.calls.includes('commit')); assert(!f.calls.includes('rollback'));
  await tick();
  assert.equal(f.notes.length, 2);
  assert.deepEqual(f.notes.map(n => n[0]).sort(), [7, 8]);
});
test('editOrder rejects stale revision, missing reason and unconfirmed completed-order fee change', async () => {
  let f = fixture(baseOrder());
  await assert.rejects(f.edit.editOrder(42, admin, { revision: 1, reason_type: 'other', reason_note: '测试原因', changes: { contact_name: '李四' } }), e => e.status === 409);
  assert.equal(f.sql.some(s => s.query.startsWith('UPDATE')), false); assert(f.calls.includes('rollback'));
  f = fixture(baseOrder());
  await assert.rejects(f.edit.editOrder(42, admin, { revision: 2, changes: { contact_name: '李四' } }), e => e.status === 400);
  await assert.rejects(f.edit.editOrder(42, admin, { reason_type: 'other', reason_note: '测试原因', changes: { contact_name: '李四' } }), /版本号/);
  await assert.rejects(f.edit.editOrder(42, admin, { revision: 2, reason_type: 'customer_request', reason_note: '', changes: { labor_fee: 10 } }), /原因说明/);
  await assert.rejects(f.edit.editOrder(42, admin, { revision: 2, reason_type: 'customer_request', reason_note: '客户要求减免', changes: { labor_fee: 10 } }), /二次确认/);
  assert.equal(f.sql.some(s => s.query.startsWith('UPDATE')), false);
});
test('fee correction on a completed order records the previous amount and notifies the customer', async () => {
  const f = fixture(baseOrder());
  await f.edit.editOrder(42, admin, { revision: 2, reason_type: 'price_negotiation', reason_note: '协商减免', confirm_completed_fee: true, changes: { labor_fee: 100 } });
  const update = f.sql.find(s => s.query.startsWith('UPDATE work_orders'));
  assert.match(update.query, /price_before_correction = \?/); assert.match(update.query, /price_corrected_at = \?/);
  assert.ok(update.params.includes(350)); assert.ok(update.params.includes(250));
  const fields = rowsOf(f).map(r => [r[7], r[9], r[10]]);
  assert.deepEqual(fields.find(r => r[0] === 'final_price'), ['final_price', '350.00', '250.00']);
  await tick();
  assert.match(f.notes.find(n => n[0] === 7)[4], /350\.00 更正为 ¥250\.00/);
});
test('audit failure rolls back the business update', async () => {
  const f = fixture(baseOrder(), { failOn: 'INSERT INTO order_change_logs' });
  await assert.rejects(f.edit.editOrder(42, admin, { revision: 2, reason_type: 'other', reason_note: '测试原因', changes: { contact_name: '李四' } }));
  assert(f.calls.includes('rollback')); assert(!f.calls.includes('commit'));
});

test('status correction only follows the allowed map and needs a note', async () => {
  assert.deepEqual(fixture(baseOrder()).edit.allowedCorrections('completed').map(x => x.to), ['pending_review', 'in_progress']);
  assert.deepEqual(fixture(baseOrder()).edit.allowedCorrections('pending'), []);
  let f = fixture(baseOrder({ status: 'completed' }));
  await assert.rejects(f.edit.correctStatus(42, admin, { revision: 2, to_status: 'pending', reason_type: 'data_fix', reason_note: '测试' }), e => e.status === 409);
  await assert.rejects(f.edit.correctStatus(42, admin, { revision: 2, to_status: 'pending_review', reason_type: 'data_fix', reason_note: '' }), /原因说明/);
  const result = await f.edit.correctStatus(42, admin, { revision: 2, to_status: 'pending_review', reason_type: 'customer_complaint', reason_note: '客户投诉未验收' });
  assert.equal(result.status, 'pending_review');
  const fields = rowsOf(f).map(r => r[7]);
  assert.ok(fields.includes('status')); assert.ok(fields.includes('finished_at')); assert.ok(fields.includes('auto_complete_at'));
  assert.deepEqual(rowsOf(f).find(r => r[7] === 'status').slice(9, 11), ['已完成', '待客户确认']);
  f = fixture(baseOrder({ status: 'cancelled', cancelled_at: new Date(), cancel_reason: '客户取消' }));
  await f.edit.correctStatus(42, admin, { revision: 2, to_status: 'pending', reason_type: 'customer_request', reason_note: '客户要求恢复' });
  assert.match(f.sql.find(s => s.query.startsWith('UPDATE work_orders')).query, /cancel_reason = \?/);
  f = fixture(baseOrder({ status: 'price_negotiating', price_adjusted_at: null }));
  await f.edit.correctStatus(42, admin, { revision: 2, to_status: 'pending_review', reason_type: 'price_negotiation', reason_note: '协商结束，维持原价' });
  assert.match(f.sql.find(s => s.query.startsWith('UPDATE work_orders')).query, /price_adjusted_at = \?/);
});

test('reassign checks status, worker and records both workers', async () => {
  let f = fixture(baseOrder({ status: 'in_progress' }));
  await assert.rejects(f.edit.reassignOrder(42, admin, { revision: 2, worker_id: 8, reason_type: 'other', reason_note: '换人测试' }), /相同/);
  f = fixture(baseOrder({ status: 'pending', worker_id: null }));
  await assert.rejects(f.edit.reassignOrder(42, admin, { revision: 2, worker_id: 9, reason_type: 'other', reason_note: '换人测试' }), e => e.status === 409);
  f = fixture(baseOrder({ status: 'in_progress' }), { worker: { id: 9, status: 'inactive', worker_status: 'working' } });
  await assert.rejects(f.edit.reassignOrder(42, admin, { revision: 2, worker_id: 9, reason_type: 'other', reason_note: '换人测试' }), /停用/);
  f = fixture(baseOrder({ status: 'confirmed' }));
  await f.edit.reassignOrder(42, admin, { revision: 2, worker_id: 9, reason_type: 'customer_complaint', reason_note: '原师傅无法到场' });
  const worker = rowsOf(f).find(r => r[7] === 'worker_id');
  assert.deepEqual(worker.slice(9, 11), ['王师傅（#8）', '李师傅（#9）']);
  assert.ok(f.sql.some(s => /assign_count = GREATEST/.test(s.query)));
  await tick();
  assert.deepEqual(f.notes.map(n => n[0]).sort(), [7, 8, 9]);
  f = fixture(baseOrder({ status: 'in_progress' }));
  await f.edit.reassignOrder(42, admin, { revision: 2, worker_id: 9, reason_type: 'worker_onsite', reason_note: '原师傅临时有事' });
  const inProgressUpdate = f.sql.find(s => s.query.startsWith('UPDATE work_orders'));
  assert.match(inProgressUpdate.query, /status = 'confirmed'/);
  assert.match(inProgressUpdate.query, /started_at = NULL/);
  assert.match(inProgressUpdate.query, /confirmed_at = NULL/);
});

test('every workflow transition writes a change log inside the transaction', async () => {
  let f = fixture({ id: 42, order_no: 'RH42', user_id: 7, worker_id: 8, status: 'confirmed', confirmed_at: null });
  await f.workflow.transition(42, { id: 8, role: 'worker', nickname: '王师傅' }, 'accept', {}, { ip: '9.9.9.9' });
  let rows = rowsOf(f);
  assert.equal(rows.length, 1); assert.equal(rows[0][6], 'accept'); assert.equal(rows[0][5], 'flow'); assert.equal(rows[0][13], '9.9.9.9');
  assert.ok(f.sql.findIndex(s => s.query.startsWith('INSERT INTO order_change_logs')) > f.sql.findIndex(s => s.query.startsWith('UPDATE work_orders')));
  f = fixture({ id: 42, user_id: 7, worker_id: 8, status: 'in_progress', price_adjusted_at: null, dispute_started_at: null, door_fee: null, material_fee: null, labor_fee: null, final_price: null });
  await f.workflow.transition(42, { id: 8, role: 'worker' }, 'complete', { door_fee: 10, material_fee: 20, labor_fee: 30 });
  assert.deepEqual(rowsOf(f).filter(r => r[9] == null && ['door_fee', 'material_fee', 'labor_fee', 'final_price', 'status'].includes(r[7])).length, 4);
  f = fixture({ id: 42, user_id: 7, worker_id: 8, status: 'pending_review', auto_complete_at: new Date(Date.now() - 1000) });
  await f.workflow.transition(42, { role: 'system' }, 'auto_complete');
  assert.equal(rowsOf(f)[0][5], 'system'); assert.equal(rowsOf(f)[0][3], '系统');
  f = fixture({ id: 42, user_id: 7, worker_id: 8, status: 'confirmed' }, { failOn: 'INSERT INTO order_change_logs' });
  await assert.rejects(f.workflow.transition(42, { id: 1, role: 'admin' }, 'cancel', { reason: '重复下单' }));
  assert(f.calls.includes('rollback')); assert(!f.calls.includes('commit'));
  f = fixture({ id: 42, user_id: 7, status: 'pending' });
  await f.workflow.transition(42, { id: 1, role: 'admin' }, 'assign', { worker_id: 9, estimated_time: '2030-01-01 10:00:00' });
  assert.ok(rowsOf(f).some(r => r[7] === 'worker_id' && r[10] === '李师傅（#9）'));
});

test('worker change requests: ownership, status, one pending at a time', async () => {
  const body = { request_type: 'price', content: '现场发现墙体开裂，需增加材料', proposed_door_fee: 50, proposed_material_fee: 300, proposed_labor_fee: 200 };
  let f = fixture(baseOrder({ status: 'in_progress', worker_id: 8 }));
  await assert.rejects(f.edit.createChangeRequest(99, 42, body), e => e.status === 404);
  f = fixture(baseOrder({ status: 'completed', worker_id: 8 }));
  await assert.rejects(f.edit.createChangeRequest(8, 42, body), e => e.status === 409);
  f = fixture(baseOrder({ status: 'in_progress', worker_id: 8 }), { pendingRequest: true });
  await assert.rejects(f.edit.createChangeRequest(8, 42, body), /待处理/);
  f = fixture(baseOrder({ status: 'in_progress', worker_id: 8 }));
  await assert.rejects(f.edit.createChangeRequest(8, 42, { ...body, content: '短' }), e => e.status === 400);
  await assert.rejects(f.edit.createChangeRequest(8, 42, { ...body, proposed_labor_fee: '' }), /三项费用/);
  assert.deepEqual(JSON.parse(JSON.stringify(await f.edit.createChangeRequest(8, 42, body))), { id: 11 });
  await assert.rejects(f.edit.createChangeRequest(8, 42, { request_type: 'time', content: '客户要求改到下午上门' }), /建议上门时间/);
  assert.deepEqual(JSON.parse(JSON.stringify(await f.edit.createChangeRequest(8, 42, { request_type: 'time', content: '客户要求改到下午上门', proposed_time: '2026-10-03 14:00:00' }))), { id: 11 });
});
test('approving a request with apply updates the order and logs it; reject needs a note', async () => {
  const request = { id: 3, order_id: 42, worker_id: 8, request_type: 'price', content: '需增加材料', status: 'pending', proposed_door_fee: '50.00', proposed_material_fee: '300.00', proposed_labor_fee: '200.00', proposed_time: null };
  let f = fixture(baseOrder({ status: 'in_progress', door_fee: null, material_fee: null, labor_fee: null, final_price: null }), { request });
  await assert.rejects(f.edit.handleChangeRequest(3, admin, { decision: 'reject', note: '' }), /原因/);
  await assert.rejects(f.edit.handleChangeRequest(3, admin, { decision: 'approve', apply: true, note: '同意' }), /待客户确认/);
  f = fixture(baseOrder({ status: 'pending_review' }), { request });
  const result = await f.edit.handleChangeRequest(3, admin, { decision: 'approve', apply: true, note: '同意' });
  assert.equal(result.applied, true);
  assert.equal(result.order_id, 42);
  assert.ok(f.sql.some(s => s.query.startsWith('UPDATE work_orders') && s.query.includes('final_price = ?')));
  assert.ok(f.sql.some(s => s.query.startsWith('UPDATE order_change_requests') && s.params[0] === 'approved' && s.params[1] === 1));
  assert.ok(rowsOf(f).some(r => r[6] === 'edit' && r[11] === 'worker_onsite'));
  assert.ok(rowsOf(f).some(r => r[6] === 'request_handle'));
  f = fixture(baseOrder(), { request: { ...request, status: 'approved' } });
  await assert.rejects(f.edit.handleChangeRequest(3, admin, { decision: 'approve' }), e => e.status === 409);
});
test('image soft delete needs a reason and keeps the row', async () => {
  const f = fixture(baseOrder());
  await assert.rejects(f.edit.removeImage(42, 5, admin, { revision: 2, reason_type: 'data_fix', reason_note: '' }), /原因说明/);
  await f.edit.removeImage(42, 5, admin, { revision: 2, reason_type: 'customer_request', reason_note: '图片涉及隐私' });
  assert.ok(f.sql.some(s => /UPDATE work_order_images SET deleted_at = NOW/.test(s.query)));
  assert.equal(f.sql.some(s => /DELETE FROM work_order_images/.test(s.query)), false);
  assert.equal(rowsOf(f)[0][9], '/api/upload/file/x');
});

test('quick filters map to fixed SQL and ignore unknown values', () => {
  assert.match(orderFilter({ quick: 'dispute' }).whereClause, /price_negotiating/);
  assert.match(orderFilter({ quick: 'request' }).whereClause, /order_change_requests/);
  assert.match(orderFilter({ quick: 'urged' }).whereClause, /urge_count > 0/);
  assert.equal(orderFilter({ quick: "x'; DROP TABLE work_orders; --" }).whereClause, '1=1');
  assert.deepEqual(orderFilter({ quick: 'exception', status: 'pending' }).params, ['pending']);
});
test('log normalisation treats money/dates/empties consistently', () => {
  assert.equal(Log.sameValue('door_fee', '50.00', 50), true);
  assert.equal(Log.sameValue('remark', null, ''), true);
  assert.equal(Log.sameValue('estimated_time', new Date(2026, 9, 1, 9, 0, 0), '2026-10-01T09:00:00'), true);
  assert.equal(Log.normalize('status', 'pending_review'), '待客户确认');
  assert.deepEqual(Log.diffEntries({ door_fee: '1.00' }, { door_fee: 2 }, ['door_fee']), [{ field: 'door_fee', old_value: '1.00', new_value: '2.00' }]);
});
