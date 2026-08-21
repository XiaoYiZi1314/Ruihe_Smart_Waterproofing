const api = require('../../utils/api');
const theme = require('../../utils/theme');

Page({
  data: {
    service: null,
    loading: true,
    bannerGradient: '',
    priceMain: '',
    priceSuffix: '',
    highlights: ['质保5年', '免费勘测', '签约施工']
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.loadServiceDetail(id);
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  async loadServiceDetail(id) {
    wx.showLoading({ title: '加载中...' });

    try {
      const res = await api.getServiceById(id);
      if (res.success) {
        const service = res.data;
        const price = theme.formatPrice(service.price_min, service.price_max, service.price_unit);
        this.setData({
          service,
          loading: false,
          bannerGradient: theme.coverGradient(service.id || service.name),
          priceMain: price.main,
          priceSuffix: price.suffix ? `${price.suffix} · 参考价格` : '参考价格',
          highlights: service.tags && service.tags.length
            ? service.tags
            : ['质保5年', '免费勘测', '签约施工']
        });
      }
    } catch (error) {
      console.error('加载服务详情失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    } finally {
      wx.hideLoading();
    }
  },

  onConsult() {
    wx.showModal({
      title: '咨询客服',
      content: '请拨打客服电话：400-888-6688',
      confirmText: '拨打电话',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({ phoneNumber: '400-888-6688' });
        }
      }
    });
  },

  onBook() {
    const service = this.data.service;
    if (!service) return;
    wx.navigateTo({
      url: `/pages/booking/create?serviceId=${service.id}`
    });
  },

  onShareAppMessage() {
    const service = this.data.service;
    return {
      title: service ? service.name : '瑞和防水',
      path: `/pages/services/detail?id=${service.id}`,
      imageUrl: service ? service.cover_image : ''
    };
  }
});