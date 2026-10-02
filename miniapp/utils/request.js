const session = require('./session');
const { normalizeResources } = require('./resources');
const app = getApp();
const { interpretHttpError } = require('./http-error');

function createRequestError(message, details = {}) {
  const error = new Error(message || '请求失败');
  Object.assign(error, details);
  return error;
}

function networkFailureMessage(err, upload = false) {
  const text = String(err && err.errMsg || '').toLowerCase();
  if (text.includes('url not in domain list')) {
    return upload
      ? '上传域名未配置，请在微信公众平台配置 uploadFile 合法域名'
      : '接口域名未配置，请检查微信公众平台合法域名';
  }
  if (text.includes('timeout')) return upload ? '上传超时，请检查网络后重试' : '请求超时，请检查网络后重试';
  if (text.includes('file not found') || text.includes('file error')) return upload ? '头像文件已失效，请重新选择头像' : '本地文件已失效，请重新选择';
  if (text.includes('abort')) return upload ? '上传已取消，请重试' : '请求已取消，请重试';
  return '网络请求失败';
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
            title: networkFailureMessage(err),
            icon: 'none'
          });
        }
        reject(createRequestError(networkFailureMessage(err), {
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
      timeout: 30000,
      success: (res) => {
        if (!session.isCurrent(snapshot)) {
          reject(createRequestError('会话已切换，请重试', { type: 'session', url: '/api/upload/' + kind }));
          return;
        }
        let data;
        try {
          data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        } catch (error) {
          const responseError = createRequestError('上传响应异常，请稍后重试', {
            type: 'upload',
            statusCode: res.statusCode,
            url: '/api/upload/' + kind,
            response: res.data,
            cause: error
          });
          wx.showToast({ title: responseError.message, icon: 'none' });
          reject(responseError);
          return;
        }
        if (res.statusCode === 200 && data && data.success) {
          resolve(data.data.url);
          return;
        }
        applyHttpError(
          { statusCode: res.statusCode, data },
          '/api/upload/' + kind,
          snapshot,
          reject
        );
      },
      fail: (err) => {
        const message = networkFailureMessage(err, true);
        wx.showToast({ title: message, icon: 'none' });
        reject(createRequestError(message, {
          type: 'network',
          url: '/api/upload/' + kind,
          cause: err
        }));
      }
    });
  });
}
