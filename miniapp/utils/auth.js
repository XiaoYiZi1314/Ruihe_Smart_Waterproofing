const request = require('./request');

/**
 * 微信登录
 * @param {Object} userInfo 用户信息
 * @returns {Promise}
 */
function login(userInfo) {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (res.code) {
          // 调用后端登录接口
          request.post('/api/auth/login', {
            code: res.code,
            nickname: userInfo.nickName,
            avatar_url: userInfo.avatarUrl
          })
          .then(response => {
            if (response.success) {
              // 保存token和用户信息
              wx.setStorageSync('token', response.data.token);
              wx.setStorageSync('userInfo', response.data.user);
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
function logout() {
  wx.removeStorageSync('token');
  wx.removeStorageSync('userInfo');
  wx.redirectTo({
    url: '/pages/login/login'
  });
}

module.exports = {
  login,
  checkLogin,
  logout
};
