const api = require('../../../utils/request');
const { STATUS, getStatusText, getStatusClass, formatPrice, formatTime } = require('../../../utils/workerStatus');

Page({
  data: {
    activeTab: 'confirmed',
    tabs: [
      { key: '', label: '全部' },
      { key: 'confirmed', label: '待接单' },
      { key: 'in_progress', label: '施工中' },
      { key: 'pending_review', label: '待验收' },
      { key: 'price_negotiating', label: '价格协商' },
      { key: 'completed', label: '已完成' }
    ],
    orders: [],
    page: 1,
    limit: 10,
    total: 0,
    loading: false,
    loadingMore: false,
    hasMore: true
  },

  onLoad() {
    // 角色防护：非师傅用户不能进入师傅工作台
    const userInfo = wx.getStorageSync('userInfo') || {};
    if (!wx.getStorageSync('token') || userInfo.role !== 'worker') {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.loadOrders(true);
  },

  onShow() {
    const user = wx.getStorageSync('userInfo') || {};
    if (!wx.getStorageSync('token') || user.role !== 'worker') return wx.reLaunch({ url: '/pages/login/login' });
    if (user.must_change_password) return wx.reLaunch({ url: '/pages/worker/profile/index' });
    this.loadOrders(true);
  },

  /**
   * 切换 Tab
   */
  onTabChange(e) {
    const { key } = e.detail;
    if (key === this.data.activeTab) return;
    this.setData({ activeTab: key, orders: [], page: 1, hasMore: true });
    this.loadOrders(true);
  },

  /**
   * 加载工单列表
   */
  async loadOrders(refresh = false) {
    if (this.data.loading || this.data.loadingMore) return;

    if (refresh) this.setData({ page: 1 });
    this.setData(refresh ? { loading: true } : { loadingMore: true });

    try {
      const res = await api.get('/api/worker/orders', {
        status: this.data.activeTab,
        page: this.data.page,
        limit: this.data.limit
      });
      const data = (res && res.data) || {};

      const orders = (data.orders || []).map((o) => ({
        ...o,
        statusText: getStatusText(o.status),
        statusClass: getStatusClass(o.status),
        priceText: formatPrice(o.final_price),
        createdTimeText: formatTime(o.created_at)
      }));

      this.setData({
        orders: refresh ? orders : [...this.data.orders, ...orders],
        total: data.pagination ? data.pagination.total : orders.length,
        hasMore: refresh
          ? orders.length >= this.data.limit
          : orders.length > 0
      });
    } catch (error) {
      console.error('加载工单失败:', error);
    } finally {
      this.setData({ loading: false, loadingMore: false });
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true });
    this.loadOrders(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 上拉加载更多
   */
  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.setData({ page: this.data.page + 1 });
    this.loadOrders(false);
  },

  /**
   * 跳转到师傅个人中心
   */
  goProfile() {
    wx.navigateTo({
      url: '/pages/worker/profile/index'
    });
  },

  /**
   * 跳转到工单详情
   */
  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/worker/orders/detail?id=${id}`
    });
  },

  /**
   * 一键拨打电话
   */
  callCustomer(e) {
    const { phone } = e.currentTarget.dataset;
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: phone });
  }
});
