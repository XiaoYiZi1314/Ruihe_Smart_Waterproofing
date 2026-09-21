const auth = require('../../utils/auth');
const request = require('../../utils/request');
const app = getApp();
const session = require('../../utils/session');

Page({
  data: {
    loading: false,
    // 登录模式：customer = 客户微信登录，worker = 师傅账号登录
    mode: 'customer',
    workerPhone: '',
    workerPassword: '',
    workerLoading: false
  },

  onLoad(options = {}) {
    if (options.mode === 'worker') this.setData({ mode: 'worker' });
    // 检查是否已登录
    if (auth.checkLogin()) {
      const snapshot = session.capture();
      Promise.resolve(app.sessionReady).then(() => {
        if (!this._unloaded && session.isCurrent(snapshot) && auth.checkLogin()) this.routeByRole();
      });
    }
  },

  onUnload() { this._unloaded = true; },

  /**
   * 按角色路由
   */
  routeByRole() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    if (userInfo.role === 'worker') {
      wx.reLaunch({ url: userInfo.must_change_password ? '/pages/worker/profile/index' : '/pages/worker/orders/list' });
    } else {
      wx.reLaunch({ url: '/pages/index/index' });
    }
  },

  /**
   * 切换登录模式
   */
  switchMode() {
    this.setData({ mode: this.data.mode === 'customer' ? 'worker' : 'customer' });
  },

  onWorkerPhoneInput(e) {
    this.setData({ workerPhone: e.detail.value });
  },

  onWorkerPasswordInput(e) {
    this.setData({ workerPassword: e.detail.value });
  },

  /**
   * 师傅手机号密码登录
   */
  async onWorkerLogin() {
    const { workerPhone, workerPassword, workerLoading } = this.data;
    if (workerLoading) return;

    if (!workerPhone || !workerPassword) {
      wx.showToast({ title: '请输入手机号/工号和密码', icon: 'none' });
      return;
    }

    this.setData({ workerLoading: true });

    try {
      await app.sessionReady;
      if (this._unloaded) return;
      const res = await request.post('/api/auth/worker-login', {
        phone: workerPhone,
        password: workerPassword
      });

      if (res.success && res.data) {
        session.save(res.data.token, res.data.user);

        const snapshot = session.capture();
        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => {
          if (this._unloaded || !session.isCurrent(snapshot)) return;
          wx.reLaunch({ url: res.data.user.must_change_password ? '/pages/worker/profile/index' : '/pages/worker/orders/list' });
        }, 1200);
      }
    } catch (error) {
      console.error('师傅登录失败:', error);
    } finally {
      this.setData({ workerLoading: false });
    }
  },

  /**
   * 客户微信登录
   */
  onGetUserProfile() {
    if (this.data.loading) return;
    const that = this;

    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        that.setData({ loading: true });

        Promise.resolve(app.sessionReady)
          .then(() => {
            if (that._unloaded) throw new Error('登录页面已关闭');
            return auth.login(res.userInfo);
          })
          .then((loginRes) => {
            // worker 角色走师傅工作台，其余走客户端
            const snapshot = session.capture();
            wx.showToast({ title: '登录成功', icon: 'success', duration: 1200 });

            setTimeout(() => {
              if (!that._unloaded && session.isCurrent(snapshot)) that.routeByRole();
            }, 1200);
          })
          .catch((err) => {
            wx.showToast({
              title: err.message || '登录失败',
              icon: 'none',
              duration: 2000
            });
          })
          .finally(() => {
            that.setData({ loading: false });
          });
      },
      fail: () => {
        wx.showToast({
          title: '需要授权才能使用',
          icon: 'none'
        });
      }
    });
  }
});
