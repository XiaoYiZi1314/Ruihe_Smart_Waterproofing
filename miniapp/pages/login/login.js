const auth = require('../../utils/auth');
const request = require('../../utils/request');
const app = getApp();
const session = require('../../utils/session');
const profileGuide = require('../../utils/profile-guide');

const TAB_PAGES = [
  '/pages/index/index',
  '/pages/services/list',
  '/pages/orders/list',
  '/pages/profile/index'
];
// 登录成功后的回跳地址只允许客户端内部页面，避免被构造成任意跳转
function safeRedirect(value) {
  let url = '';
  try { url = decodeURIComponent(value || ''); } catch (error) { return ''; }
  if (!/^\/pages\//.test(url) || /^\/pages\/(login|worker|dev)\//.test(url)) return '';
  return url;
}

Page({
  data: {
    loading: false,
    // 已有登录态时先校验并跳转，期间不渲染登录表单，避免“登录页一闪而过”
    checking: false,
    // 登录模式：customer = 客户微信登录，worker = 师傅账号登录
    mode: 'customer',
    workerPhone: '',
    workerPassword: '',
    workerLoading: false
  },

  onLoad(options = {}) {
    if (options.mode === 'worker') this.setData({ mode: 'worker' });
    this.redirect = safeRedirect(options.redirect);
    // 检查是否已登录
    if (auth.checkLogin()) {
      const snapshot = session.capture();
      this.setData({ checking: true });
      Promise.resolve(app.sessionReady).then(() => {
        if (this._unloaded) return;
        if (session.isCurrent(snapshot) && auth.checkLogin()) this.routeByRole();
        else this.setData({ checking: false });
      });
    }
  },

  onUnload() { this._unloaded = true; },

  onShow() {
    // 登录态过期被送回这里时，告诉用户原因，而不是悄悄跳转
    const globalData = (app && app.globalData) || {};
    if (globalData.loginNotice) {
      const title = globalData.loginNotice;
      globalData.loginNotice = '';
      wx.showToast({ title, icon: 'none', duration: 2000 });
    }
  },

  // 游客点“先逛逛”：能返回就返回，否则回首页
  onBrowse() {
    if (getCurrentPages().length > 1) wx.navigateBack();
    else wx.reLaunch({ url: '/pages/index/index' });
  },

  goRedirect(url) {
    const path = url.split('?')[0];
    if (TAB_PAGES.indexOf(path) >= 0) {
      wx.switchTab({ url: path, fail: () => wx.reLaunch({ url }) });
      return;
    }
    wx.redirectTo({ url, fail: () => wx.reLaunch({ url }) });
  },

  /**
   * 按角色路由
   */
  routeByRole(guideProfile) {
    const userInfo = wx.getStorageSync('userInfo') || {};
    if (userInfo.role === 'worker') {
      wx.reLaunch({ url: userInfo.must_change_password ? '/pages/worker/profile/index' : '/pages/worker/orders/list' });
    } else if (this.redirect) {
      // 从预约/工单等入口来登录的：回到原来想去的页面（优先于资料引导）
      this.goRedirect(this.redirect);
    } else {
      wx.reLaunch({
        url: '/pages/index/index',
        // 首次登录引导完善资料：先落到首页，再压入编辑页，用户可直接跳过/返回
        success: guideProfile ? () => wx.navigateTo({ url: '/pages/profile/edit?guide=1' }) : undefined
      });
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
        }, 500);
      }
    } catch (error) {
      console.error('师傅登录失败:', error);
    } finally {
      this.setData({ workerLoading: false });
    }
  },

  /**
   * 客户微信登录
   * 微信已不再通过 wx.getUserProfile 返回真实头像昵称（只会得到灰色默认头像），
   * 所以这里直接登录，头像昵称由用户在“编辑资料”页主动填写。
   */
  onLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    Promise.resolve(app.sessionReady)
      .then(() => {
        if (this._unloaded) throw new Error('登录页面已关闭');
        return auth.login();
      })
      .then((loginRes) => {
        const snapshot = session.capture();
        wx.showToast({ title: '登录成功', icon: 'success', duration: 1000 });
        // worker 角色走师傅工作台，其余走客户端；新客户引导完善一次资料
        const guideProfile = profileGuide.consume(loginRes.user);

        setTimeout(() => {
          if (!this._unloaded && session.isCurrent(snapshot)) this.routeByRole(guideProfile);
        }, 500);
      })
      .catch((err) => {
        wx.showToast({
          title: err.message || '登录失败',
          icon: 'none',
          duration: 2000
        });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  }
});
