const { addRealCovers } = require('../../utils/resources');
const api = require('../../utils/api');
const auth = require('../../utils/auth');

Page({
  data: {
    categories: [{ key: null, label: '全部' }],
    services: [],
    currentCategoryId: null,
    keyword: '',
    page: 1,
    limit: 10,
    total: 0,
    hasMore: true,
    loading: false,
    loadFailed: false
  },

  onLoad() {},

  async onShow() {
    const keyword = getApp().globalData.serviceKeyword || '';
    if (keyword) {
      getApp().globalData.serviceKeyword = '';
      this.setData({ keyword, page: 1 });
    }
    // 每次回来都刷新（保证分类/服务是最新的），但刷新是静默的：
    // 不清空列表、不显示加载条，数据没变就不重绘
    await this.loadCategories();
    return this.loadServices(true);
  },

  async loadCategories() {
    try {
      const res = await api.getCategories();
      if (res.success) {
        if (this.data.currentCategoryId && !res.data.some(item => item.id === this.data.currentCategoryId)) {
          this.setData({ currentCategoryId: null });
        }
        const categories = [{ key: null, label: '全部' }].concat(
          res.data.map((item) => ({ key: item.id, label: item.name }))
        );
        if (JSON.stringify(categories) !== JSON.stringify(this.data.categories)) {
          this.setData({ categories });
        }
      }
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  },

  async loadServices(refresh = false) {
    const requestId = this._requestId = (this._requestId || 0) + 1;
    // 已有列表时的刷新是静默的：不显示加载条，也不清空列表
    if (!refresh || this.data.services.length === 0) this.setData({ loading: true });

    try {
      // 上拉加载：只有请求成功后才推进页码，失败后再次上拉会重试同一页而不是漏掉一页
      const pageToLoad = refresh ? 1 : this.data.page + 1;
      const params = {
        page: pageToLoad,
        limit: this.data.limit
      };

      if (this.data.currentCategoryId) {
        params.category_id = this.data.currentCategoryId;
      }
      if (this.data.keyword) {
        params.keyword = this.data.keyword;
      }

      const res = await api.getServices(params);
      if (requestId !== this._requestId) return;

      if (res.success) {
        // 为服务数据添加真实封面图片
        const servicesWithCovers = addRealCovers(res.data);
        const list = refresh ? servicesWithCovers : [...this.data.services, ...servicesWithCovers];
        const unchanged = refresh && JSON.stringify(list) === JSON.stringify(this.data.services);

        this.setData({
          ...(unchanged ? {} : { services: list }),
          page: res.pagination ? res.pagination.page : pageToLoad,
          total: res.pagination ? res.pagination.total : list.length,
          hasMore: res.pagination ? res.pagination.page < res.pagination.pages : false,
          loading: false,
          loadFailed: false
        });
        this._loadedAt = Date.now();
      }
    } catch (error) {
      if (requestId !== this._requestId) return;
      console.error('加载服务列表失败:', error);
      wx.showToast({ title: '加载失败，请下拉重试', icon: 'none' });
      this.setData({ loadFailed: true });
    } finally {
      if (requestId === this._requestId) this.setData({ loading: false });
    }
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearchConfirm() {
    this.setData({ page: 1 });
    this.loadServices(true);
  },

  onCategoryTap(e) {
    this.setData({
      currentCategoryId: e.detail.key,
      page: 1,
      services: [],
      loadFailed: false
    });
    this.loadServices(true);
  },

  onRetryLoad() {
    this.loadServices(true);
  },

  onServiceTap(e) {
    const service = e.detail.service || {};
    wx.navigateTo({
      url: `/pages/services/detail?id=${service.id}`
    });
  },

  onBookTap(e) {
    const service = e.detail.service || {};
    if (!service.id) return;
    const url = `/pages/booking/create?serviceId=${service.id}`;
    if (!auth.requireLogin(url)) return;
    wx.navigateTo({ url });
  },

  async onPullDownRefresh() {
    try {
      await this.loadCategories();
      await this.loadServices(true);
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadServices();
    }
  }
});