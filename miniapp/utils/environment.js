// Trial/release never read development overrides. Do not put credentials here.
const PRODUCTION_ORIGIN = 'https://ruihezhihui.cn';
const DEV_ORIGIN_KEY = 'ruihe_dev_api_origin';
function normalizeOrigin(value) {
  const origin = String(value || '').trim().replace(/\/$/, '');
  if (!/^https?:\/\/(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::[0-9]{1,5})?$/i.test(origin)) {
    throw new Error('开发接口地址必须是 http(s)://主机[:端口]，不能包含路径或账号密码');
  }
  return origin;
}
function getApiBaseUrl(platform = wx) {
  let version = 'release';
  try { version = platform.getAccountInfoSync().miniProgram.envVersion; } catch (_) { /* fail closed */ }
  if (version !== 'develop') return PRODUCTION_ORIGIN;
  const override = platform.getStorageSync(DEV_ORIGIN_KEY);
  return override ? normalizeOrigin(override) : PRODUCTION_ORIGIN;
}
module.exports = { PRODUCTION_ORIGIN, DEV_ORIGIN_KEY, normalizeOrigin, getApiBaseUrl };
