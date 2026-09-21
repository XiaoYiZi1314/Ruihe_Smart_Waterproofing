const { addRealCovers } = require('../../utils/resources');
const api = require('../../utils/api');

// 服务名称到真实图片的映射


// 为服务添加真实封面图片


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
    loading: false
  },

  onLoad() {},

  async onShow() {
    const keyword = getApp().globalData.serviceKeyword || '';
    if (keyword) {
      getApp().globalData.serviceKeyword = '';
      this.setData({ keyword, page: 1 });
    }
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
        this.setData({
          categories: [{ key: null, label: '全部' }].concat(
            res.data.map((item) => ({ key: item.id, label: item.name }))
          )
        });
      }
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  },

  async loadServices(refresh = false) {
    const requestId = this._requestId = (this._requestId || 0) + 1;
    this.setData({ loading: true });

    try {
      const params = {
        page: refresh ? 1 : this.data.page,
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
        
        this.setData({
          services: list,
          page: res.pagination ? res.pagination.page : 1,
          total: res.pagination ? res.pagination.total : list.length,
          hasMore: res.pagination ? res.pagination.page < res.pagination.pages : false,
          loading: false
        });
      }
    } catch (error) {
      if (requestId !== this._requestId) return;
      console.error('加载服务列表失败:', error);
      wx.showToast({ title: '加载失败，请下拉重试', icon: 'none' });
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
      services: []
    });
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
    wx.navigateTo({
      url: `/pages/booking/create?serviceId=${service.id}`
    });
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
      this.setData({ page: this.data.page + 1 });
      this.loadServices();
    }
  }
});