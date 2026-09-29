const { addRealCovers } = require('../../utils/resources');
const auth = require('../../utils/auth');
const api = require('../../utils/api');
const theme = require('../../utils/theme');

const FALLBACK_BANNERS = [];

// 服务名称到真实图片的映射


// 为服务添加真实封面图片


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

  onLoad() {},

  onShow() {
    if (!auth.checkLogin()) return wx.reLaunch({ url: '/pages/login/login' });
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo?.role === 'worker') return wx.reLaunch({ url: '/pages/worker/orders/list' });
    if (userInfo) this.setData({ userInfo });
    // 30 秒内从其他 Tab 切回来不重复拉取，避免遮罩和整页重绘（下拉刷新仍会强制刷新）
    if (this._loadedAt && Date.now() - this._loadedAt < 30000) return;
    this.loadData();
  },

  onUnload() {
    this._requestId = (this._requestId || 0) + 1;
    wx.hideLoading();
  },

  async loadData() {
    const requestId = this._requestId = (this._requestId || 0) + 1;
    // 只有第一次加载才显示遮罩；之后都是静默刷新
    const silent = !!this._loadedAt;
    if (!silent) wx.showLoading({ title: '加载中...' });

    try {
      const [bannersRes, servicesRes, categoriesRes, configRes] = await Promise.all([
        api.getBanners(),
        api.getServices({ is_hot: 1, limit: 6 }),
        api.getCategories(),
        api.getConfig()
      ]);
      if (requestId !== this._requestId) return;

      let banners = FALLBACK_BANNERS;
      if (bannersRes.success && bannersRes.data && bannersRes.data.length) {
        banners = bannersRes.data.map((item, index) => ({
          ...item,
          title: item.title || '',
          subtitle: item.subtitle || item.description || '',
          gradient: item.gradient || theme.coverGradient(item.id)
        }));
      }

      const allServices = servicesRes.success ? addRealCovers(servicesRes.data) : [];
      const categoryTags = [{ key: null, label: '全部' }].concat(
        (categoriesRes.success ? categoriesRes.data : []).map((item) => ({
          key: item.id,
          label: item.name
        }))
      );

      const config = configRes.success ? configRes.data : {};
      const currentCategoryId = categoryTags.some(item => item.key === this.data.currentCategoryId)
        ? this.data.currentCategoryId : null;
      const services = currentCategoryId == null ? allServices
        : allServices.filter(item => item.category_id === currentCategoryId);

      this.setData({
        banners,
        allServices,
        services,
        currentCategoryId,
        categoryTags,
        contact: config.contact_info || {},
        aboutUs: config.about_us || '',
        joinInfo: { ...(config.join_info || {}), partners: Array.isArray(config.join_info?.partners) ? config.join_info.partners.join('\n') : config.join_info?.partners || '' },
        loading: false
      });
      this._loadedAt = Date.now();
    } catch (error) {
      if (requestId !== this._requestId) return;
      console.error('加载数据失败:', error);
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
      this.setData({ loading: false });
    } finally {
      if (!silent && requestId === this._requestId) wx.hideLoading();
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