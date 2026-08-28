const api = require('../../utils/api');

// 服务名称到真实图片的映射
const SERVICE_COVER_MAP = {
  '卫生间': '/assets/services/bathroom.jpg',
  '阳台': '/assets/services/balcony.jpg',
  '屋顶': '/assets/services/roof.jpg',
  '地下室': '/assets/services/basement.jpg',
  '定制': '/assets/services/custom.jpg'
};

// 为服务添加真实封面图片
function addRealCovers(services) {
  return services.map(service => {
    // 如果后端已经提供了封面图片，优先使用
    if (service.cover && !service.cover.includes('placeholder')) {
      return service;
    }
    
    // 根据服务名称匹配真实图片
    for (const keyword in SERVICE_COVER_MAP) {
      if (service.name && service.name.includes(keyword)) {
        return { ...service, cover: SERVICE_COVER_MAP[keyword] };
      }
    }
    
    return service;
  });
}

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

  onLoad() {
    this.loadCategories();
    this.loadServices(true);
  },

  onShow() {
    const keyword = getApp().globalData.serviceKeyword || '';
    if (keyword && keyword !== this.data.keyword) {
      getApp().globalData.serviceKeyword = '';
      this.setData({ keyword, page: 1, services: [] });
      this.loadServices(true);
    }
  },

  async loadCategories() {
    try {
      const res = await api.getCategories();
      if (res.success) {
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
    if (this.data.loading) return;

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
      console.error('加载服务列表失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearchConfirm() {
    this.setData({ page: 1, services: [] });
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

  onPullDownRefresh() {
    this.setData({ page: 1, services: [] });
    this.loadServices(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadServices();
    }
  }
});