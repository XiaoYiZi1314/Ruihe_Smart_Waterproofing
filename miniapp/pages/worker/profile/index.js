const session = require('../../../utils/session');
const api = require('../../../utils/request');
const notifications = require('../../../utils/notifications');

Page({
  data: {
    userInfo: null,
    stats: null,
    submitting: false,
    showPasswordModal: false,
    currentPassword: '',
    newPassword: ''
  },

  onLoad() {
    const user = wx.getStorageSync('userInfo') || {};
    if (user.role === 'worker') this.setData({ userInfo: user });
  },

  async onShow() {
    const user = wx.getStorageSync('userInfo') || {};
    if (!wx.getStorageSync('token') || user.role !== 'worker') return wx.reLaunch({ url: '/pages/login/login' });
    notifications.loadConfig();
    this.syncTitle(user);
    try {
      const res = await api.get('/api/auth/me');
      this.setData({ userInfo: res.data });
      wx.setStorageSync('userInfo', res.data);
      this.syncTitle(res.data);
      if (!res.data.must_change_password) await this.loadStats();
    } catch (error) { /* request handles authentication errors */ }
  },

  syncTitle(user) {
    if (typeof wx.setNavigationBarTitle !== 'function') return;
    wx.setNavigationBarTitle({ title: user && user.must_change_password ? '修改密码' : '我的' });
  },

  async loadStats() {
    const res = await api.get('/api/worker/stats');
    this.setData({ stats: res.data });
  },

  onCurrentPassword(e) { this.setData({ currentPassword: e.detail.value }); },
  onNewPassword(e) { this.setData({ newPassword: e.detail.value }); },

  openPasswordModal() {
    this.setData({ showPasswordModal: true, currentPassword: '', newPassword: '' });
  },

  closePasswordModal() {
    if (this.data.submitting) return;
    this.setData({ showPasswordModal: false, currentPassword: '', newPassword: '' });
  },

  async changePassword() {
    if (this.data.submitting) return;
    if (!this.data.currentPassword || !this.data.newPassword) {
      wx.showToast({ title: '请填写原密码和新密码', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    const firstLogin = !!(this.data.userInfo && this.data.userInfo.must_change_password);
    try {
      const res = await api.post('/api/auth/change-password', {
        current_password: this.data.currentPassword,
        new_password: this.data.newPassword
      });
      session.save(res.data.token, res.data.user);
      this.setData({
        userInfo: res.data.user,
        currentPassword: '',
        newPassword: '',
        showPasswordModal: false
      });
      wx.showToast({ title: '密码已修改' });
      if (firstLogin) {
        setTimeout(() => wx.reLaunch({ url: '/pages/worker/orders/list' }), 600);
      }
    } catch (error) { /* request displays the error */ }
    finally { this.setData({ submitting: false }); }
  },

  async bindWechat() {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const login = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }));
      await api.post('/api/auth/bind-wechat', { code: login.code });
      this.setData({ 'userInfo.wechat_bound': true });
      wx.showToast({ title: '微信已绑定' });
    } catch (error) {
      wx.showToast({ title: error.message || '绑定失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async subscribe() {
    const result = await notifications.subscribe(['worker_assigned', 'order_urged', 'order_cancelled']);
    if (!result) wx.showToast({ title: '暂不可订阅，请查看站内消息', icon: 'none' });
  },

  async toggleStatus() {
    if (this.data.submitting || !this.data.stats) return;
    this.setData({ submitting: true });
    try {
      await api.put('/api/worker/status', { status: this.data.stats.worker_status === 'working' ? 'resting' : 'working' });
      await this.loadStats();
    } catch (error) { /* request displays the error */ }
    finally { this.setData({ submitting: false }); }
  },

  preventMove() {},
  onWorkerNav(e) {
    if (e.detail.key === 'orders') {
      wx.reLaunch({ url: '/pages/worker/orders/list' });
    }
  },
  goEditProfile() { wx.navigateTo({ url: '/pages/profile/edit' }); },
  goMessages() { wx.navigateTo({ url: '/pages/notifications/list' }); },
  handleLogout() {
    session.clear();
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
