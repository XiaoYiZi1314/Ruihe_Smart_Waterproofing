const api = require('../../utils/api');

Page({
  data: {
    loading: true,
    loadFailed: false,
    aboutUs: '',
    contact: {}
  },

  onLoad() {
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  onRetryLoad() {
    this.setData({ loading: true, loadFailed: false });
    this.load();
  },

  async load() {
    try {
      const res = await api.getConfig();
      const config = (res && res.success && res.data) || {};
      this.setData({
        aboutUs: config.about_us || '',
        contact: config.contact_info || {},
        loading: false,
        loadFailed: false
      });
    } catch (error) {
      if (!this.data.aboutUs) this.setData({ loadFailed: true });
      this.setData({ loading: false });
    }
  },

  onCallPhone() {
    const phoneNumber = this.data.contact.mobile || this.data.contact.phone;
    if (!phoneNumber) {
      wx.showToast({ title: '暂无联系电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({ phoneNumber });
  }
});
