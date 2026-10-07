const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(file, deps) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    module, exports: module.exports, console: { error() {} }, Buffer,
    require(name) {
      if (!(name in deps)) throw Error('Unexpected dependency: ' + name);
      return deps[name];
    }
  });
  return module.exports;
}

function controller({ user, compareOk = true, affectedRows = 1 } = {}) {
  const queries = [];
  const logs = [];
  const current = {
    id: 1, role: 'admin', nickname: '管理员', password: 'hashed-old', token_version: 3,
    avatar_url: null, phone: null, created_at: 'x', status: 'active', must_change_password: 0,
    ...user
  };
  let saved = { ...current, password: 'hashed-new', token_version: current.token_version + 1, must_change_password: 0 };
  const api = load('controllers/authController.js', {
    bcryptjs: {
      async compare() { return compareOk; },
      async hash(value) { return 'hashed-' + value; }
    },
    '../models/User': { async findById() { return saved; } },
    '../config/database': {
      async query(sql, params) {
        queries.push({ sql, params });
        if (sql.startsWith('UPDATE users SET password')) return [{ affectedRows }];
        return [[]];
      }
    },
    '../utils/jwt': { generateToken: () => 'new-token' },
    '../utils/workerLoginLookup': {},
    '../utils/wechatIdentity': {},
    '../utils/operationLog': { logOperation(entry) { logs.push(entry); } },
    '../utils/attachments': {},
    '../utils/password': require('../src/utils/password')
  });
  return { api, queries, logs, current };
}

async function call(f, body) {
  const res = {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
  await f.api.changePassword({ user: f.current, body, ip: '127.0.0.1' }, res);
  return res;
}

test('an administrator can change password when the current password matches', async () => {
  const f = controller();
  const res = await call(f, { current_password: 'OldPass12', new_password: 'NewPass34' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.token, 'new-token');
  assert.equal(res.body.data.user.role, 'admin');
  const update = f.queries.find(item => item.sql.startsWith('UPDATE users SET password'));
  assert.deepEqual(JSON.parse(JSON.stringify(update.params)), ['hashed-NewPass34', 1, 3]);
  assert.equal(f.logs[0].action, 'change_password');
  assert.equal(f.logs[0].user_id, 1);
});

test('the password is left unchanged when the current password does not match', async () => {
  const f = controller({ compareOk: false });
  const res = await call(f, { current_password: 'wrong', new_password: 'NewPass34' });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, '原密码不正确');
  assert.equal(f.queries.length, 0);
  assert.equal(f.logs.length, 0);
});

test('a new password still needs letters, digits and at least 8 characters', async () => {
  const f = controller();
  const res = await call(f, { current_password: 'OldPass12', new_password: 'short' });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /8位以上/);
  assert.equal(f.queries.length, 0);
});
