const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  DEFAULT_SECURITY_QUESTION,
  normalizeQuestion,
  normalizeAnswer,
  assertSecurityQuestion,
  assertSecurityAnswer
} = require('../src/utils/securityQuestion');

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

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

function controller({ admin, compare = async (plain, hash) => hash === `hashed-${plain}` } = {}) {
  const queries = [];
  const logs = [];
  const current = {
    id: 1,
    role: 'admin',
    username: 'admin',
    nickname: '管理员',
    password: 'hashed-OldPass12',
    token_version: 3,
    status: 'active',
    security_question: DEFAULT_SECURITY_QUESTION,
    security_answer_hash: 'hashed-2018-05-20',
    ...admin
  };
  let saved = { ...current };
  const api = load('controllers/authController.js', {
    bcryptjs: {
      compare,
      async hash(value) { return 'hashed-' + value; }
    },
    '../models/User': {
      async findById() { return saved; }
    },
    '../config/database': {
      async query(sql, params) {
        queries.push({ sql, params });
        if (sql.includes('FROM users WHERE (username=? OR phone=?)')) {
          return [[current.missing ? undefined : current].filter(Boolean)];
        }
        if (sql.startsWith('UPDATE users SET password')) {
          saved = { ...current, password: params[0], token_version: current.token_version + 1, must_change_password: 0 };
          return [{ affectedRows: 1 }];
        }
        if (sql.startsWith('UPDATE users SET security_question')) {
          saved = { ...current, security_question: params[0], security_answer_hash: params[1] };
          return [{ affectedRows: 1 }];
        }
        return [[]];
      }
    },
    '../utils/jwt': { generateToken: () => 'new-token' },
    '../utils/workerLoginLookup': {},
    '../utils/wechatIdentity': {},
    '../utils/operationLog': { logOperation(entry) { logs.push(entry); } },
    '../utils/attachments': {},
    '../utils/password': require('../src/utils/password'),
    '../utils/securityQuestion': require('../src/utils/securityQuestion')
  });
  return { api, queries, logs, current, saved };
}

test('the preset security question is the first-meeting time', () => {
  assert.equal(DEFAULT_SECURITY_QUESTION, '我和他第一次遇见的时间');
  assert.equal(normalizeQuestion(''), DEFAULT_SECURITY_QUESTION);
  assert.equal(normalizeQuestion('  自定义问题  '), '自定义问题');
  assert.equal(normalizeAnswer('  2018-05-20  '), '2018-05-20');
  assert.equal(assertSecurityQuestion('我和他第一次遇见的时间'), '我和他第一次遇见的时间');
  assert.equal(assertSecurityAnswer('2018-05-20'), '2018-05-20');
  assert.throws(() => assertSecurityAnswer(''), error => error.status === 400);
  assert.throws(() => assertSecurityQuestion('啊'.repeat(41)), error => error.status === 400);
});

test('an administrator can read the saved security question without the answer', async () => {
  const f = controller();
  const res = response();
  await f.api.getAdminSecurityQuestion({ query: { username: 'admin' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.question, '我和他第一次遇见的时间');
  assert.equal(res.body.data.security_answer_hash, undefined);
  assert.equal(res.body.data.answer, undefined);
});

test('a missing security answer is treated as unset so recovery cannot start', async () => {
  const f = controller({ admin: { security_answer_hash: null } });
  const res = response();
  await f.api.getAdminSecurityQuestion({ query: { username: 'admin' } }, res);
  assert.equal(res.statusCode, 404);
  assert.match(res.body.message, /未找到密码保护问题/);
});

test('the correct security answer resets the admin password', async () => {
  const f = controller();
  const res = response();
  await f.api.resetAdminPassword({
    body: { username: 'admin', answer: ' 2018-05-20 ', new_password: 'NewPass34' },
    ip: '127.0.0.1'
  }, res);
  assert.equal(res.statusCode, 200);
  const update = f.queries.find(item => item.sql.startsWith('UPDATE users SET password'));
  assert.equal(update.params[0], 'hashed-NewPass34');
  assert.equal(update.params[1], 1);
  assert.equal(f.logs[0].action, 'reset_password');
  assert.equal(f.logs[0].detail.includes('2018'), false);
});

test('a wrong security answer does not change the password', async () => {
  const f = controller({ compare: async () => false });
  const res = response();
  await f.api.resetAdminPassword({
    body: { username: 'admin', answer: 'wrong', new_password: 'NewPass34' },
    ip: '127.0.0.1'
  }, res);
  assert.equal(res.statusCode, 401);
  assert.match(res.body.message, /密保答案不正确/);
  assert.equal(f.queries.some(item => item.sql.startsWith('UPDATE users SET password')), false);
  assert.equal(f.logs.length, 0);
});

test('an administrator can set a custom security question after confirming the current password', async () => {
  const f = controller();
  const res = response();
  await f.api.updateSecurityQuestion({
    user: f.current,
    body: { current_password: 'OldPass12', question: '我们第一次见面的城市', answer: '杭州' },
    ip: '127.0.0.1'
  }, res);
  assert.equal(res.statusCode, 200);
  const update = f.queries.find(item => item.sql.startsWith('UPDATE users SET security_question'));
  assert.equal(update.params[0], '我们第一次见面的城市');
  assert.equal(update.params[1], 'hashed-杭州');
  assert.equal(f.logs[0].action, 'set_security_question');
});

test('the security-question routes are public for recovery and admin-only for updates', () => {
  const routes = fs.readFileSync(path.join(__dirname, '../src/routes/auth.js'), 'utf8');
  assert.match(routes, /router\.get\('\/admin-security-question', loginIpLimit, loginAccountLimit, authController\.getAdminSecurityQuestion\)/);
  assert.match(routes, /router\.post\('\/admin-reset-password', loginIpLimit, loginAccountLimit, authController\.resetAdminPassword\)/);
  assert.match(routes, /router\.put\('\/security-question', authenticateToken, requireRole\(\['admin'\]\), authController\.updateSecurityQuestion\)/);
});
