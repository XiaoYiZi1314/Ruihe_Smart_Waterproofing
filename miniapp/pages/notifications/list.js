const request = require('../../utils/request');
Page({
  data: { items: [], loading: true },
  onShow() { this.load(); },
  async load() {
    try { const res = await request.get('/api/notifications'); this.setData({ items: res.data }); }
    catch (error) { /* request handles errors */ }
    finally { this.setData({ loading: false }); wx.stopPullDownRefresh(); }
  },
  onPullDownRefresh() { this.load(); },
  async markRead(e) {
    try { await request.put(`/api/notifications/${e.currentTarget.dataset.id}/read`); await this.load(); }
    catch (error) { /* request handles errors */ }
  }
});
