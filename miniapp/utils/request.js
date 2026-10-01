const session = require('./session');
const { normalizeResources } = require('./resources');
const app = getApp();
const { interpretHttpError } = require('./http-error');

function createRequestError(message, details = {}) {
  const error = new Error(message || '请求失败');
  Object.assign(error, details);
  return error;
}

function applyHttpError(res, url, snapshot, reject, options = {}) {
  if (!session.isCurrent(snapshot)) {
    reject(createRequestError('会话已切换，请重试', { type: 'session', url })); return;
  }
  if (res.data && res.data.code === 'PASSWORD_CHANGE_REQUIRED') {
    wx.reLaunch({ url: '/pages/worker/profile/index' });
    reject(createRequestError(res.data.message, {
      type: 'session',
      code: res.data.code,
      statusCode: res.statusCode,
      url
    }));
    return;
  }
  const verdict = interpretHttpError(res.statusCode, url, !!snapshot.token, res.data);

  if (verdict.type === 'session') {
    session.clear(snapshot);
    const globalData = app && app.globalData;
    if (globalData) globalData.loginNotice = '登录已过期，请重新登录';
    wx.reLaunch({ url: '/pages/login/login' });
    reject(createRequestError(verdict.message, {
      type: 'session',
      statusCode: res.statusCode,
      url,
      response: res.data
    }));
    return;
  }

  if (!options.silentToast) {
    wx.showToast({
      title: verdict.message || '请求失败',
      icon: 'none'
    });
  }
  reject(createRequestError(verdict.message || '请求失败', {
    type: 'http',
    statusCode: res.statusCode,
    url,
    response: res.data
  }));
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
        if (!session.isCurrent(snapshot)) {
          reject(createRequestError('会话已切换，请重试', { type: 'session', url: options.url }));
          return;
        }
        if (res.statusCode === 200) {
          resolve(normalizeResources(res.data));
          return;
        }
        applyHttpError(res, options.url, snapshot, reject, options);
      },
      fail: (err) => {
        if (!options.silentToast) {
          wx.showToast({
            title: '网络请求失败',
            icon: 'none'
          });
        }
        reject(createRequestError('网络请求失败', {
          type: 'network',
          url: options.url,
          cause: err
        }));
      }
    });
  });
}

module.exports = {
  get: (url, data, options = {}) => request({ url, method: 'GET', data, ...options }),
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
        if (!session.isCurrent(snapshot)) {
          reject(createRequestError('会话已切换，请重试', { type: 'session', url: '/api/upload/' + kind }));
          return;
        }
        try {
          const data = JSON.parse(res.data);
          if (res.statusCode === 200 && data.success) {
            resolve(data.data.url);
            return;
          }
          applyHttpError(
            { statusCode: res.statusCode, data },
            '/api/upload/' + kind,
            snapshot,
            reject
          );
        } catch (e) {
          wx.showToast({ title: '上传失败', icon: 'none' });
          reject(new Error('上传失败'));
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络请求失败', icon: 'none' });
        reject(createRequestError('网络请求失败', {
          type: 'network',
          url: '/api/upload/' + kind,
          cause: err
        }));
      }
    });
  });
}
