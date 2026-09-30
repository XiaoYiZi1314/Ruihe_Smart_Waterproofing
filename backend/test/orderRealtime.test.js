const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const State = require('../src/utils/orderStateMachine');

function fixture({ status = 'confirmed', commitFails = false, deliveryFails = false } = {}) {
  const calls = [];
  const events = [];
  const connection = {
    async beginTransaction() { calls.push('begin'); },
    async commit() { if (commitFails) throw Error('commit failed'); calls.push('commit'); },
    async rollback() { calls.push('rollback'); },
    release() { calls.push('release'); },
    async query(sql) {
      if (sql.startsWith('SELECT * FROM users')) {
        return [[{ id: 8, role: 'worker', status: 'active' }]];
      }
      if (sql.startsWith('SELECT * FROM work_orders')) {
        return [[{ id: 42, worker_id: 8, user_id: 7, status, confirmed_at: null }]];
      }
      calls.push('update'); return [{ affectedRows: 1 }];
    }
  };
  const deps = {
    './orderChangeLog': require('../src/utils/orderChangeLog'), '../config/database': { getConnection: async () => connection },
    './orderStateMachine': State,
    './realtime': { async notifyOrderChange(id, nextStatus, extra) {
      assert(calls.includes('commit'), 'must not broadcast uncommitted state');
      events.push({ id, status: nextStatus, action: extra.action });
      if (deliveryFails) throw Error('socket unavailable');
    } }
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/utils/orderWorkflow.js'), 'utf8'), {
    module, exports: module.exports, require: name => {
      assert(name in deps, 'Unexpected dependency ' + name); return deps[name];
    }, console: { error() {} }
  });
  return { workflow: module.exports, calls, events };
}

for (const [action, status] of [['accept', 'confirmed'], ['start', 'in_progress'],
  ['reject', 'pending'], ['complete', 'pending_review']]) {
  test(`${action} publishes the committed state exactly once`, async () => {
    const f = fixture({ status: action === 'complete' ? 'in_progress' : 'confirmed' });
    const data = action === 'reject' ? { reason: 'test' } :
      { door_fee: 1, material_fee: 2, labor_fee: 3 };
    const result = await f.workflow.transition(42, { id: 8, role: 'worker' }, action, data);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(result.status, status);
    assert.deepEqual(f.events, [{ id: 42, status, action }]);
    assert(!f.calls.includes('rollback'));
  });
}

test('failed validation and failed commits never publish state changes', async () => {
  for (const options of [{ status: 'cancelled' }, { commitFails: true }]) {
    const f = fixture(options);
    await assert.rejects(f.workflow.transition(42, { id: 8, role: 'worker' }, 'start'));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.events, []);
    assert(f.calls.includes('rollback'));
  }
});

test('socket delivery failure cannot roll back a committed order or fail its HTTP operation', async () => {
  const f = fixture({ deliveryFails: true });
  const result = await f.workflow.transition(42, { id: 8, role: 'worker' }, 'start');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(result.status, 'in_progress');
  assert.equal(f.events.length, 1);
  assert(!f.calls.includes('rollback'));
  assert(f.calls.includes('release'));
});
