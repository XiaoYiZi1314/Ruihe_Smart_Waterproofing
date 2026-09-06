const app = getApp();

/**
 * 师傅端 HTTP 请求封装
 * @param {Object} options 请求配置
 * @returns {Promise} resolve 后端 data 字段
 */
function request(options) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('worker_token');

    wx.request({
      url: app.globalData.apiBaseUrl + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          resolve(res.data.data);
        } else if (res.statusCode === 401) {
          // token 过期，跳转登录
          wx.removeStorageSync('worker_token');
          wx.showModal({
            title: '登录过期',
            content: '请重新登录',
            showCancel: false,
            success: () => {
              wx.reLaunch({ url: '/pages/login/login' });
            }
          });
          reject(new Error('未授权'));
        } else {
          const msg = (res.data && res.data.message) || '请求失败';
          wx.showToast({ title: msg, icon: 'none' });
          reject(new Error(msg));
        }
      },
      fail: () => {
        wx.showToast({ title: '网络请求失败', icon: 'none' });
        reject(new Error('网络请求失败'));
      }
    });
  });
}

module.exports = {
  request,
  get: (url, data) => request({ url, method: 'GET', data }),
  post: (url, data) => request({ url, method: 'POST', data }),
  put: (url, data) => request({ url, method: 'PUT', data }),
  delete: (url, data) => request({ url, method: 'DELETE', data })
};
