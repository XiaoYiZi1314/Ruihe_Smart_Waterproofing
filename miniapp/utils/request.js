const app = getApp();
const { interpretHttpError } = require('./http-error');

function applyHttpError(res, url, hasToken, reject) {
  const verdict = interpretHttpError(res.statusCode, url, hasToken, res.data);

  if (verdict.type === 'session') {
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    wx.reLaunch({ url: '/pages/login/login' });
    reject(new Error(verdict.message));
    return;
  }

  wx.showToast({
    title: verdict.message || '请求失败',
    icon: 'none'
  });
  reject(new Error(verdict.message || '请求失败'));
}

/**
 * 封装的HTTP请求方法
 * @param {Object} options 请求配置
 * @returns {Promise}
 */
function request(options) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    const header = {
      'Content-Type': 'application/json'
    };
    if (token) {
      header.Authorization = `Bearer ${token}`;
    }

    wx.request({
      url: app.globalData.apiBaseUrl + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
          return;
        }
        applyHttpError(res, options.url, !!token, reject);
      },
      fail: (err) => {
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
        reject(err);
      }
    });
  });
}

module.exports = {
  get: (url, data) => request({ url, method: 'GET', data }),
  post: (url, data) => request({ url, method: 'POST', data }),
  put: (url, data) => request({ url, method: 'PUT', data }),
  delete: (url, data) => request({ url, method: 'DELETE', data }),
  upload
};

/**
 * 上传文件
 * @param {string} filePath - 本地临时文件路径
 * @returns {Promise<string>} 服务器文件 URL
 */
function upload(filePath) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    const header = {};
    if (token) {
      header.Authorization = `Bearer ${token}`;
    }

    wx.uploadFile({
      url: app.globalData.apiBaseUrl + '/api/upload/image',
      filePath,
      name: 'file',
      header,
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (res.statusCode === 200 && data.success) {
            resolve(data.data.url);
            return;
          }
          applyHttpError(
            { statusCode: res.statusCode, data },
            '/api/upload/image',
            !!token,
            reject
          );
        } catch (e) {
          wx.showToast({ title: '上传失败', icon: 'none' });
          reject(new Error('上传失败'));
        }
      },
      fail: () => {
        wx.showToast({ title: '网络请求失败', icon: 'none' });
        reject(new Error('网络请求失败'));
      }
    });
  });
}
