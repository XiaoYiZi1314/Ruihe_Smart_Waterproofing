/**
 * 把 HTTP 错误分成两类：
 * - session：已登录态失效，应清 token 并回登录页
 * - error：业务失败（含登录账号密码错误），应展示服务端文案
 */
function isAuthLoginUrl(url) {
  return /\/api\/auth\/(login|worker-login|admin-login)(\?|$)/.test(url || '');
}

function interpretHttpError(statusCode, url, hasToken, body) {
  const message = (body && body.message) || '请求失败';

  if (statusCode === 401) {
    if (hasToken && !isAuthLoginUrl(url)) {
      return { type: 'session', message: '未授权' };
    }
    return { type: 'error', message: message || '未授权' };
  }

  return { type: 'error', message };
}

module.exports = {
  isAuthLoginUrl,
  interpretHttpError
};
