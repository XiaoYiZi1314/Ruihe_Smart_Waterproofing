const request = require('../../utils/request');
const theme = require('../../utils/theme');

Page({
  data: { items: [], loading: true, loadFailed: false, unreadCount: 0 },

  onShow() { this.load(); },

  async load() {
    try {
      const res = await request.get('/api/notifications');
      // 时间统一格式化，不再直接显示服务端的 ISO 字符串
      const items = (res.data || []).map((item) => ({ ...item, timeText: theme.formatTime(item.created_at) }));
      this.setData({ items, unreadCount: items.filter((item) => !item.is_read).length, loadFailed: false });
    } catch (error) {
      // 请求层已经提示了错误；只有一条消息都没有时才显示重试入口
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

  // 点一条消息：标记已读，本地直接更新，不再整页重新加载
  async markRead(e) {
    const id = e.currentTarget.dataset.id;
    const index = this.data.items.findIndex((item) => String(item.id) === String(id));
    if (index < 0 || this.data.items[index].is_read) return;
    try {
      await request.put(`/api/notifications/${id}/read`);
      this.setData({ [`items[${index}].is_read`]: 1, unreadCount: Math.max(this.data.unreadCount - 1, 0) });
    } catch (error) { /* 请求层已提示 */ }
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
