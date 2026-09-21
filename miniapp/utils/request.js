const session = require('./session');
const { normalizeResources } = require('./resources');
const app = getApp();
const { interpretHttpError } = require('./http-error');

function applyHttpError(res, url, snapshot, reject) {
  if (!session.isCurrent(snapshot)) {
    reject(new Error('会话已切换，请重试')); return;
  }
  if (res.data && res.data.code === 'PASSWORD_CHANGE_REQUIRED') {
    wx.reLaunch({ url: '/pages/worker/profile/index' });
    reject(new Error(res.data.message)); return;
  }
  const verdict = interpretHttpError(res.statusCode, url, !!snapshot.token, res.data);

  if (verdict.type === 'session') {
    session.clear(snapshot);
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
    const snapshot = session.capture();
    const token = snapshot.token;
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
        if (!session.isCurrent(snapshot)) { reject(new Error('会话已切换，请重试')); return; }
        if (res.statusCode === 200) {
          resolve(normalizeResources(res.data));
          return;
        }
        applyHttpError(res, options.url, snapshot, reject);
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
function upload(filePath, kind = 'image') {
  return new Promise((resolve, reject) => {
    const snapshot = session.capture();
    const token = snapshot.token;
    const header = {};
    if (token) {
      header.Authorization = `Bearer ${token}`;
    }

    wx.uploadFile({
      url: app.globalData.apiBaseUrl + '/api/upload/' + kind,
      filePath,
      name: 'file',
      header,
      success: (res) => {
        if (!session.isCurrent(snapshot)) { reject(new Error('会话已切换，请重试')); return; }
        try {
          const data = JSON.parse(res.data);
          if (res.statusCode === 200 && data.success) {
            resolve(data.data.url);
            return;
          }
          applyHttpError(
            { statusCode: res.statusCode, data },
            '/api/upload/image',
            snapshot,
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
