require('dotenv').config();

module.exports = {
  appId: process.env.WECHAT_APPID,
  appSecret: process.env.WECHAT_SECRET,
  loginUrl: 'https://api.weixin.qq.com/sns/jscode2session'
};
