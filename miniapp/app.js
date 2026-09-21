const session = require('./utils/session');
const { getApiBaseUrl } = require('./utils/environment');

App({
  onLaunch() {
    console.log('瑞和防水小程序启动');
    this.globalData.apiBaseUrl = getApiBaseUrl();
    this.sessionReady = this.checkToken();
  },

  onShow() {},
  onHide() {},

  checkToken() {
    const snapshot = session.capture();
    if (!snapshot.token) return Promise.resolve(false);
    return new Promise(resolve => {
      wx.request({
        url: this.globalData.apiBaseUrl + '/api/auth/me',
        method: 'GET',
        timeout: 15000,
        header: { Authorization: 'Bearer ' + snapshot.token },
        success: res => {
          // An old request must never overwrite or invalidate a newer session.
          if (!session.isCurrent(snapshot)) return resolve(false);
          if (res.statusCode === 200 && res.data.success) {
            session.updateUser(res.data.data);
            const pages = getCurrentPages();
            const currentPath = pages.length ? pages[pages.length - 1].route : '';
            const user = res.data.data;
            if (user.role === 'worker' && currentPath && currentPath !== 'pages/login/login') {
              const destination = user.must_change_password ? 'pages/worker/profile/index' : 'pages/worker/orders/list';
              if (!currentPath.startsWith('pages/worker/') || (user.must_change_password && currentPath !== destination)) {
                wx.reLaunch({ url: '/' + destination });
              }
            }
            resolve(true);
          } else {
            if (res.statusCode === 401) session.clear(snapshot);
            // Server/network errors are not proof that credentials expired.
            resolve(false);
          }
        },
        fail: () => resolve(false)
      });
    });
  },

  globalData: {
    userInfo: null,
    apiBaseUrl: getApiBaseUrl(),
    serviceKeyword: ''
  }
});
