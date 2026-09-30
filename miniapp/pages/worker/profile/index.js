const session = require('../../../utils/session');
const api = require('../../../utils/request');
const notifications = require('../../../utils/notifications');
Page({
  data: { userInfo: null, stats: null, submitting: false, currentPassword: '', newPassword: '' },
  async onShow() {
    const user = wx.getStorageSync('userInfo') || {};
    if (!wx.getStorageSync('token') || user.role !== 'worker') return wx.reLaunch({ url: '/pages/login/login' });
    notifications.loadConfig();
    try {
      const res = await api.get('/api/auth/me');
      this.setData({ userInfo: res.data }); wx.setStorageSync('userInfo', res.data);
      if (!res.data.must_change_password) await this.loadStats();
    } catch (error) { /* request handles authentication errors */ }
  },
  async loadStats() { const res = await api.get('/api/worker/stats'); this.setData({ stats: res.data }); },
  onCurrentPassword(e) { this.setData({ currentPassword: e.detail.value }); },
  onNewPassword(e) { this.setData({ newPassword: e.detail.value }); },
  async changePassword() {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const res = await api.post('/api/auth/change-password', { current_password: this.data.currentPassword, new_password: this.data.newPassword });
      session.save(res.data.token, res.data.user);
      this.setData({ userInfo: res.data.user, currentPassword: '', newPassword: '' });
      await this.loadStats(); wx.showToast({ title: '密码已修改' });
    } catch (error) { /* request displays the error */ }
    finally { this.setData({ submitting: false }); }
  },
  async bindWechat() {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const login = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }));
      await api.post('/api/auth/bind-wechat', { code: login.code });
      this.setData({ 'userInfo.wechat_bound': true }); wx.showToast({ title: '微信已绑定' });
    } catch (error) { wx.showToast({ title: error.message || '绑定失败', icon: 'none' }); }
    finally { this.setData({ submitting: false }); }
  },
  async subscribe() {
    const result = await notifications.subscribe(['worker_assigned','order_urged','order_cancelled']);
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
  goOrders() { wx.reLaunch({ url: '/pages/worker/orders/list' }); },
  goEditProfile() { wx.navigateTo({ url: '/pages/profile/edit' }); },
  goMessages() { wx.navigateTo({ url: '/pages/notifications/list' }); },
  handleLogout() {
    session.clear();
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
