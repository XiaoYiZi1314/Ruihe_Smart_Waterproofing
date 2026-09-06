const auth = require('../../utils/auth');
const request = require('../../utils/request');
const app = getApp();

Page({
  data: {
    loading: false,
    // 登录模式：customer = 客户微信登录，worker = 师傅账号登录
    mode: 'customer',
    workerPhone: '',
    workerPassword: '',
    workerLoading: false
  },

  onLoad() {
    // 检查是否已登录
    if (auth.checkLogin()) {
      this.routeByRole();
    }
  },

  /**
   * 按角色路由
   */
  routeByRole() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    if (userInfo.role === 'worker') {
      wx.reLaunch({ url: '/pages/worker/orders/list' });
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
      const res = await request.post('/api/auth/worker-login', {
        phone: workerPhone,
        password: workerPassword
      });

      if (res.success && res.data) {
        wx.setStorageSync('token', res.data.token);
        wx.setStorageSync('userInfo', res.data.user);
        app.globalData.userInfo = res.data.user;

        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/worker/orders/list' });
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
    const that = this;

    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        that.setData({ loading: true });

        auth.login(res.userInfo)
          .then((loginRes) => {
            // worker 角色走师傅工作台，其余走客户端
            const role = loginRes.user && loginRes.user.role;
            wx.showToast({ title: '登录成功', icon: 'success', duration: 1200 });

            setTimeout(() => {
              if (role === 'worker') {
                wx.reLaunch({ url: '/pages/worker/orders/list' });
              } else {
                wx.reLaunch({ url: '/pages/index/index' });
              }
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
