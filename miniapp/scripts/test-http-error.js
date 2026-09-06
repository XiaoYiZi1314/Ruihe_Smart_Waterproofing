const assert = require('assert');
const { interpretHttpError, isAuthLoginUrl } = require('../utils/http-error');

assert.strictEqual(isAuthLoginUrl('/api/auth/worker-login'), true);
assert.strictEqual(isAuthLoginUrl('/api/worker/orders'), false);

const loginFail = interpretHttpError(
  401,
  '/api/auth/worker-login',
  false,
  { success: false, message: '账号或密码错误' }
);
assert.deepStrictEqual(loginFail, { type: 'error', message: '账号或密码错误' });

const loginFailWithStaleToken = interpretHttpError(
  401,
  '/api/auth/worker-login',
  true,
  { success: false, message: '该账号未设置密码，请联系管理员重置' }
);
assert.deepStrictEqual(loginFailWithStaleToken, {
  type: 'error',
  message: '该账号未设置密码，请联系管理员重置'
});

const expired = interpretHttpError(
  401,
  '/api/worker/orders',
  true,
  { success: false, message: 'Token无效或已过期' }
);
assert.deepStrictEqual(expired, { type: 'session', message: '未授权' });

const unauthenticated = interpretHttpError(
  401,
  '/api/worker/orders',
  false,
  { success: false, message: '未提供认证token' }
);
assert.deepStrictEqual(unauthenticated, {
  type: 'error',
  message: '未提供认证token'
});

const badRequest = interpretHttpError(
  400,
  '/api/auth/worker-login',
  false,
  { success: false, message: '请输入手机号和密码' }
);
assert.deepStrictEqual(badRequest, { type: 'error', message: '请输入手机号和密码' });

console.log('http-error tests passed');
