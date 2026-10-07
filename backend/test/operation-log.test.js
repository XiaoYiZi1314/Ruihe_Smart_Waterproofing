const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(file, deps) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    module, exports: module.exports, console: { error() {} },
    require(name) {
      if (!(name in deps)) throw Error('Unexpected dependency: ' + name);
      return deps[name];
    }
  });
  return module.exports;
}

function loadLog(query) {
  return load('utils/operationLog.js', {
    '../config/database': { query: query || (async () => [[]]) }
  });
}

test('the action filter only lists admin-side operations', () => {
  const log = loadLog();
  const values = log.actionOptions().map(item => item.value);
  assert.ok(values.includes('assign'));
  assert.ok(values.includes('register_order'));
  assert.ok(!values.includes('urge'));
  assert.ok(!values.includes('create_order'));
  assert.ok(!values.includes('accept'));
  assert.equal(log.actionLabel('urge'), '催单');
  assert.equal(log.actionOptions().length, Object.keys(log.ADMIN_ACTION_LABELS).length);
});

test('logOperation writes admin and system actions, not customer or worker ones', async () => {
  const queries = [];
  const log = loadLog(async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('SELECT role')) return [[{ role: params[0] === 1 ? 'admin' : 'customer' }]];
    return [{ affectedRows: 1 }];
  });

  await log.logOperation({ user_id: 9, role: 'customer', action: 'urge', detail: '客户催单' });
  await log.logOperation({ user_id: 8, role: 'worker', action: 'accept', detail: '已接受工单' });
  await log.logOperation({ user_id: 1, role: 'admin', action: 'assign', detail: '工单已指派' });
  await log.logOperation({ user_id: null, action: 'update_config', detail: '系统维护' });
  await log.logOperation({ user_id: 1, action: 'cancel', detail: '工单已取消' });

  const inserts = queries.filter(item => item.sql.includes('INSERT INTO operation_logs'));
  assert.equal(inserts.length, 3);
  assert.equal(inserts[0].params[2], 'assign');
  assert.equal(inserts[1].params[0], null);
  assert.equal(inserts[2].params[2], 'cancel');
  assert.ok(queries.some(item => item.sql.includes('SELECT role') && item.params[0] === 1));
});

test('admin log list is scoped to administrators and system rows', () => {
  const log = loadLog();
  assert.match(log.adminLogScopeSql(), /u\.role = 'admin'/);
  assert.match(log.adminLogScopeSql(), /ol\.user_id IS NULL/);
});
