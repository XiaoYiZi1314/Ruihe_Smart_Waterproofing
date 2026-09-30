const request = require('./request');
const session = require('./session');

/**
 * 微信登录（微信已不再下发真实头像昵称，资料由用户在“编辑资料”页主动填写）
 * @returns {Promise}
 */
function login() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (res.code) {
          // 调用后端登录接口
          request.post('/api/auth/login', { code: res.code })
          .then(response => {
            if (response.success) {
              // 保存token和用户信息
              session.save(response.data.token, response.data.user);
              resolve(response.data);
            } else {
              reject(new Error(response.message));
            }
          })
          .catch(err => {
            reject(err);
          });
        } else {
          reject(new Error('获取code失败'));
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

/**
 * 检查登录状态
 * @returns {Boolean}
 */
function checkLogin() {
  const token = wx.getStorageSync('token');
  return !!token;
}

/**
 * 退出登录
 */
function clearAuth() {
  session.clear();
}

function logout() {
  clearAuth();
  wx.reLaunch({ url: '/pages/login/login' });
}

module.exports = {
  login,
  checkLogin,
  clearAuth,
  logout
};
