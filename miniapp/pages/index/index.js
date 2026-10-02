const { addRealCovers } = require('../../utils/resources');
const auth = require('../../utils/auth');
const { isValidId } = require('../../utils/id');
const api = require('../../utils/api');
const theme = require('../../utils/theme');

const FALLBACK_BANNERS = [];
const HOT_KEY = 'hot';
const HOME_SERVICE_LIMIT = 50;

function normalizeCategoryKey(key) {
  if (key === HOT_KEY || key == null || key === '' || key === 'null') return HOT_KEY;
  const id = Number(key);
  return Number.isInteger(id) && id > 0 ? id : HOT_KEY;
}

function homeServiceQuery(categoryId) {
  if (categoryId === HOT_KEY) return { is_hot: 1, limit: HOME_SERVICE_LIMIT };
  return { category_id: categoryId, limit: HOME_SERVICE_LIMIT };
}

function sectionMeta(categoryId, categoryTags) {
  if (categoryId === HOT_KEY) return { sectionTitle: '🔥 热门服务', emptyText: '暂无热门服务' };
  const label = (categoryTags || []).find(item => item.key === categoryId)?.label;
  return { sectionTitle: label || '服务项目', emptyText: '暂无相关服务' };
}

Page({
  data: {
    banners: FALLBACK_BANNERS,
    services: [],
    categoryTags: [{ key: HOT_KEY, label: '热门' }],
    currentCategoryId: HOT_KEY,
    sectionTitle: '🔥 热门服务',
    emptyText: '暂无热门服务',
    contact: {},
    aboutUs: '',
    joinInfo: {},
    keyword: '',
    loading: true,
    loadFailed: false
  },

  onLoad() {},

  onShow() {
    // 游客也可以浏览首页；师傅登录后自动进入工作台
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo?.role === 'worker') return wx.reLaunch({ url: '/pages/worker/orders/list' });
    if (userInfo) this.setData({ userInfo });
    // 30 秒内从其他 Tab 切回来不重复拉取，避免遮罩和整页重绘（下拉刷新仍会强制刷新）
    if (this._loadedAt && Date.now() - this._loadedAt < 30000) return;
    this.loadData();
  },

  onUnload() {
    this._requestId = (this._requestId || 0) + 1;
    this._serviceRequestId = (this._serviceRequestId || 0) + 1;
    wx.hideLoading();
  },

  async loadData() {
    const requestId = this._requestId = (this._requestId || 0) + 1;
    const serviceRequestId = this._serviceRequestId = (this._serviceRequestId || 0) + 1;
    const categoryId = normalizeCategoryKey(this.data.currentCategoryId);
    // 只有第一次加载才显示遮罩；之后都是静默刷新
    const silent = !!this._loadedAt;
    if (!silent) wx.showLoading({ title: '加载中...' });

    try {
      const [bannersRes, servicesRes, categoriesRes, configRes] = await Promise.all([
        api.getBanners(),
        api.getServices(homeServiceQuery(categoryId)),
        api.getCategories(),
        api.getConfig()
      ]);
      if (requestId !== this._requestId) return;

      let banners = FALLBACK_BANNERS;
      if (bannersRes.success && bannersRes.data && bannersRes.data.length) {
        banners = bannersRes.data.map((item) => ({
          ...item,
          title: item.title || '',
          subtitle: item.subtitle || item.description || '',
          gradient: item.gradient || theme.coverGradient(item.id)
        }));
      }

      const categoryTags = [{ key: HOT_KEY, label: '热门' }].concat(
        (categoriesRes.success ? categoriesRes.data : []).map((item) => ({
          key: item.id,
          label: item.name
        }))
      );
      const currentCategoryId = categoryTags.some(item => item.key === categoryId) ? categoryId : HOT_KEY;
      const config = configRes.success ? configRes.data : {};
      const nextData = {
        banners,
        currentCategoryId,
        categoryTags,
        contact: config.contact_info || {},
        aboutUs: config.about_us || '',
        joinInfo: { ...(config.join_info || {}), partners: Array.isArray(config.join_info?.partners) ? config.join_info.partners.join('\n') : config.join_info?.partners || '' },
        loading: false,
        loadFailed: false,
        ...sectionMeta(currentCategoryId, categoryTags)
      };
      if (serviceRequestId === this._serviceRequestId) {
        nextData.services = servicesRes.success ? addRealCovers(servicesRes.data || []) : [];
      }

      this.setData(nextData);
      this._loadedAt = Date.now();
    } catch (error) {
      if (requestId !== this._requestId) return;
      console.error('加载数据失败:', error);
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
      this.setData({ loading: false, loadFailed: true });
    } finally {
      if (!silent && requestId === this._requestId) wx.hideLoading();
    }
  },

  async loadServices(categoryId) {
    const currentCategoryId = normalizeCategoryKey(categoryId);
    const serviceRequestId = this._serviceRequestId = (this._serviceRequestId || 0) + 1;
    const meta = sectionMeta(currentCategoryId, this.data.categoryTags);
    this.setData({ currentCategoryId, ...meta, loadFailed: false });
    try {
      const res = await api.getServices(homeServiceQuery(currentCategoryId));
      if (serviceRequestId !== this._serviceRequestId) return;
      this.setData({
        services: res.success ? addRealCovers(res.data || []) : [],
        loadFailed: false
      });
    } catch (error) {
      if (serviceRequestId !== this._serviceRequestId) return;
      this.setData({ loadFailed: true });
    }
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onRetryLoad() {
    this.loadData();
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
      this.goAbout();
    }
  },

  onCategoryChange(e) {
    const categoryId = normalizeCategoryKey(e.detail.key);
    if (categoryId === this.data.currentCategoryId) return;
    this.loadServices(categoryId);
  },

  onBannerTap(e) {
    const banner = e.currentTarget.dataset.banner;
    if (!banner) return;

    if (banner.link_type === 'service') {
      if (!isValidId(banner.link_value)) return;
      wx.navigateTo({
        url: `/pages/services/detail?id=${banner.link_value}`
      });
    } else if (banner.link_type === 'url' && banner.link_value) {
      const value = String(banner.link_value);
      if (value.indexOf('/pages/') === 0) {
        wx.navigateTo({ url: value });
      } else {
        // 小程序内无法直接打开外部网页：复制链接并提示
        wx.setClipboardData({
          data: value,
          success: () => wx.showToast({ title: '链接已复制，请在浏览器中打开', icon: 'none' })
        });
      }
    }
  },

  onServiceTap(e) {
    const service = (e.detail || {}).service || {};
    if (!isValidId(service.id)) return;
    wx.navigateTo({
      url: `/pages/services/detail?id=${service.id}`
    });
  },

  onBookTap(e) {
    const service = (e.detail || {}).service || {};
    if (!isValidId(service.id)) return;
    const url = `/pages/booking/create?serviceId=${service.id}`;
    if (!auth.requireLogin(url)) return;
    wx.navigateTo({ url });
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

  goAbout() {
    wx.navigateTo({ url: '/pages/about/index' });
  },

  onJoinConsult() {
    if (!this.data.joinInfo.phone) {
      wx.showToast({ title: '暂无加盟电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({ phoneNumber: this.data.joinInfo.phone });
  }
});