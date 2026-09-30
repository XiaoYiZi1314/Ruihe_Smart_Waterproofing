const request = require('../../utils/request');
const theme = require('../../utils/theme');

function orderDetailUrl(orderId) {
  if (!orderId) return '';
  const role = (wx.getStorageSync('userInfo') || {}).role;
  return role === 'worker'
    ? `/pages/worker/orders/detail?id=${orderId}`
    : `/pages/orders/detail?id=${orderId}`;
}

Page({
  data: { items: [], loading: true, loadFailed: false, unreadCount: 0 },

  onShow() { this.load(); },

  async load() {
    try {
      const res = await request.get('/api/notifications');
      const items = (res.data || []).map((item) => ({
        ...item,
        timeText: theme.formatTime(item.created_at)
      }));
      this.setData({ items, unreadCount: items.filter((item) => !item.is_read).length, loadFailed: false });
    } catch (error) {
      if (!this.data.items.length) this.setData({ loadFailed: true });
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  onPullDownRefresh() { this.load(); },

  onRetryLoad() {
    this.setData({ loading: true, loadFailed: false });
    this.load();
  },

  async markRead(id) {
    const index = this.data.items.findIndex((item) => String(item.id) === String(id));
    if (index < 0 || this.data.items[index].is_read) return;
    try {
      await request.put(`/api/notifications/${id}/read`);
      this.setData({ [`items[${index}].is_read`]: 1, unreadCount: Math.max(this.data.unreadCount - 1, 0) });
    } catch (error) { /* 请求层已提示 */ }
  },

  async openMessage(e) {
    const { id, orderId } = e.currentTarget.dataset;
    await this.markRead(id);
    const url = orderDetailUrl(orderId);
    if (url) wx.navigateTo({ url });
  },

  async markAllRead() {
    const unread = this.data.items.filter((item) => !item.is_read);
    if (!unread.length) return;
    try {
      await Promise.all(unread.map((item) => request.put(`/api/notifications/${item.id}/read`)));
      wx.showToast({ title: '已全部标为已读', icon: 'none' });
    } catch (error) { /* 请求层已提示 */ }
    await this.load();
  }
});
