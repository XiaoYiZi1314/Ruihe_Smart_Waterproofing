const auth = require('../../utils/auth');
const api = require('../../utils/api');
const theme = require('../../utils/theme');

const FALLBACK_BANNERS = [
  {
    id: 'fb-1',
    title: '专业防水堵漏服务',
    subtitle: '20年施工经验 · 免费上门勘测',
    gradient: 'linear-gradient(135deg, #1A5CFF, #5B9AF5)'
  },
  {
    id: 'fb-2',
    title: '雨季防水专项保障',
    subtitle: '屋顶/外墙/卫生间 全屋解决方案',
    gradient: 'linear-gradient(135deg, #2B7BE4, #5B9AF5)'
  },
  {
    id: 'fb-3',
    title: '质保5年 安心无忧',
    subtitle: '签约施工 · 全国联保',
    gradient: 'linear-gradient(135deg, #1A5CFF, #2B7BE4)'
  }
];

Page({
  data: {
    banners: FALLBACK_BANNERS,
    services: [],
    allServices: [],
    categoryTags: [{ key: null, label: '全部' }],
    currentCategoryId: null,
    contact: {},
    aboutUs: '',
    joinInfo: {},
    keyword: '',
    loading: true
  },

  onLoad() {
    if (!auth.checkLogin()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.loadData();
  },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({ userInfo });
    }
  },

  async loadData() {
    wx.showLoading({ title: '加载中...' });

    try {
      const [bannersRes, servicesRes, categoriesRes, configRes] = await Promise.all([
        api.getBanners(),
        api.getServices({ is_hot: 1, limit: 6 }),
        api.getCategories(),
        api.getConfig()
      ]);

      let banners = FALLBACK_BANNERS;
      if (bannersRes.success && bannersRes.data && bannersRes.data.length) {
        banners = bannersRes.data.map((item, index) => ({
          ...item,
          title: item.title || FALLBACK_BANNERS[index % FALLBACK_BANNERS.length].title,
          subtitle: item.subtitle || item.description || FALLBACK_BANNERS[index % FALLBACK_BANNERS.length].subtitle,
          gradient: item.gradient || theme.coverGradient(item.id)
        }));
      }

      const allServices = servicesRes.success ? servicesRes.data : [];
      const categoryTags = [{ key: null, label: '全部' }].concat(
        (categoriesRes.success ? categoriesRes.data : []).map((item) => ({
          key: item.id,
          label: item.name
        }))
      );

      const config = configRes.success ? configRes.data : {};

      this.setData({
        banners,
        allServices,
        services: allServices,
        categoryTags,
        contact: config.contact_info || {},
        aboutUs: config.about_us || '瑞和智慧防水工程有限公司，专注建筑防水堵漏领域20年，拥有甲级施工资质，服务覆盖全国200+城市。以“科技防水、匠心堵漏”为理念，为客户提供勘测、设计、施工、质保一站式解决方案。',
        joinInfo: config.join_info || {},
        loading: false
      });
    } catch (error) {
      console.error('加载数据失败:', error);
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
      this.setData({ loading: false });
    } finally {
      wx.hideLoading();
    }
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearchConfirm(e) {
    const keyword = (e.detail.value || '').trim();
    getApp().globalData.serviceKeyword = keyword;
    wx.switchTab({ url: '/pages/services/list' });
  },

  onQuickTap(e) {
    const { key } = e.detail;
    if (key === 'service') {
      wx.switchTab({ url: '/pages/services/list' });
    } else if (key === 'order') {
      wx.switchTab({ url: '/pages/orders/list' });
    } else if (key === 'consult') {
      this.onCallPhone();
    } else if (key === 'about') {
      this.onAboutMore();
    }
  },

  onCategoryChange(e) {
    const categoryId = e.detail.key;
    const { allServices } = this.data;
    const services = categoryId == null
      ? allServices
      : allServices.filter((item) => item.category_id === categoryId);
    this.setData({
      currentCategoryId: categoryId,
      services
    });
  },

  onBannerTap(e) {
    const banner = e.currentTarget.dataset.banner;
    if (!banner) return;

    if (banner.link_type === 'service' && banner.link_value) {
      wx.navigateTo({
        url: `/pages/services/detail?id=${banner.link_value}`
      });
    }
  },

  onServiceTap(e) {
    const service = e.detail.service || {};
    if (!service.id) return;
    wx.navigateTo({
      url: `/pages/services/detail?id=${service.id}`
    });
  },

  onBookTap(e) {
    const service = e.detail.service || {};
    if (!service.id) return;
    wx.navigateTo({
      url: `/pages/booking/create?serviceId=${service.id}`
    });
  },

  onViewMoreServices() {
    wx.switchTab({ url: '/pages/services/list' });
  },

  onCallPhone() {
    const phoneNumber = this.data.contact.mobile || this.data.contact.phone;
    if (!phoneNumber) {
      wx.showToast({ title: '暂无联系电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({ phoneNumber });
  },

  onCopyWechat() {
    if (!this.data.contact.wechat) {
      wx.showToast({ title: '暂无微信号', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: this.data.contact.wechat,
      success: () => {
        wx.showToast({ title: '微信号已复制', icon: 'success' });
      }
    });
  },

  onAboutMore() {
    wx.showModal({
      title: '关于我们',
      content: this.data.aboutUs,
      showCancel: false
    });
  },

  onJoinConsult() {
    if (!this.data.joinInfo.phone) {
      wx.showToast({ title: '暂无加盟电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({ phoneNumber: this.data.joinInfo.phone });
  }
});