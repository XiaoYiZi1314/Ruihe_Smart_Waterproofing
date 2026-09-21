const axios = require('axios');
const config = require('../config/wechat');
async function exchangeCode(code) {
  if (typeof code !== 'string' || !code) throw Object.assign(new Error('缺少微信登录凭证'), { status: 400 });
  const { data } = await axios.get(config.loginUrl, { timeout: 10000, params: {
    appid: config.appId, secret: config.appSecret, js_code: code, grant_type: 'authorization_code'
  } });
  if (!data.openid || data.errcode) throw Object.assign(new Error('微信登录凭证无效，请重试'), { status: 400 });
  return data;
}
module.exports = { exchangeCode };
