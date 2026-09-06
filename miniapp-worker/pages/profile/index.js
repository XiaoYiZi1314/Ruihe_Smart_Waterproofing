const api = require('../../utils/request');

const app = getApp();

Page({
  data: {
    userInfo: null,
    stats: null,
    statusChanging: false
  },

  onShow() {
    this.loadStats();
  },

  /**
   * 加载统计信息
   */
  async loadStats() {
    try {
      const stats = await api.get('/api/worker/stats');
      this.setData({ stats });
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  },

  /**
   * 切换工作状态
   */
  async toggleStatus() {
    if (this.data.statusChanging || !this.data.stats) return;

    const current = this.data.stats.worker_status;
    const next = current === 'working' ? 'resting' : 'working';
    const tip = next === 'resting' ? '休息状态下不会接收到新工单指派' : '切换后可正常接收工单指派';

    const confirmRes = await new Promise((resolve) => {
      wx.showModal({
        title: next === 'resting' ? '切换为休息' : '切换为上班',
        content: tip,
        confirmText: '确认切换',
        success: resolve
      });
    });

    if (!confirmRes.confirm) return;

    this.setData({ statusChanging: true });

    try {
      await api.put('/api/worker/status', { status: next });
      wx.showToast({ title: '已切换', icon: 'success' });
      this.loadStats();
    } catch (error) {
      console.error('切换状态失败:', error);
    } finally {
      this.setData({ statusChanging: false });
    }
  },

  /**
   * 退出登录
   */
  async handleLogout() {
    const confirmRes = await new Promise((resolve) => {
      wx.showModal({
        title: '退出登录',
        content: '确定要退出当前账号吗？',
        confirmText: '退出',
        confirmColor: '#EF4444',
        success: resolve
      });
    });

    if (!confirmRes.confirm) return;

    wx.removeStorageSync('worker_token');
    app.globalData.token = null;
    app.globalData.userInfo = null;
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
