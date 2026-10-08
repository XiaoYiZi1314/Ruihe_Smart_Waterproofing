const api = require('../../../utils/request');
const { getStatusText, getStatusClass, canCallCustomer, formatPrice, formatTime } = require('../../../utils/workerStatus');

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
    hasMore: true,
    loadFailed: false
  },

  onLoad() {
    // 角色防护：非师傅用户不能进入师傅工作台
    const userInfo = wx.getStorageSync('userInfo') || {};
    if (!wx.getStorageSync('token') || userInfo.role !== 'worker') {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    // 数据由紧随其后的 onShow 加载，这里不再重复请求
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
    this.setData({ activeTab: key, orders: [], page: 1, hasMore: true, loadFailed: false });
    this.loadOrders(true);
  },

  /**
   * 加载工单列表
   */
  async loadOrders(refresh = false) {
    // 用请求序号代替“忙碌锁”：切换 Tab 时旧请求的结果会被丢弃，新请求不会被吞掉
    const requestId = this._requestId = (this._requestId || 0) + 1;

    // 已有列表时的刷新是静默的，不切换“加载中 / 暂无工单”状态
    const silent = refresh && this.data.orders.length > 0;
    if (!silent) this.setData(refresh ? { loading: true, loadingMore: false, loadFailed: false } : { loadingMore: true });

    try {
      // 上拉加载：请求成功后才推进页码，失败后再次上拉会重试同一页
      const pageToLoad = refresh ? 1 : this.data.page + 1;
      const res = await api.get('/api/worker/orders', {
        status: this.data.activeTab,
        page: pageToLoad,
        limit: this.data.limit
      });
      if (requestId !== this._requestId) return;
      const data = (res && res.data) || {};

      const orders = (data.orders || []).map((o) => ({
        ...o,
        statusText: getStatusText(o.status),
        statusClass: getStatusClass(o.status),
        canCall: canCallCustomer(o),
        priceText: formatPrice(o.final_price),
        createdTimeText: formatTime(o.created_at)
      }));

      const nextOrders = refresh ? orders : [...this.data.orders, ...orders];
      const unchanged = refresh && JSON.stringify(nextOrders) === JSON.stringify(this.data.orders);
      const total = data.pagination ? Number(data.pagination.total) : NaN;
      this.setData({
        ...(unchanged ? {} : { orders: nextOrders }),
        page: pageToLoad,
        total: Number.isNaN(total) ? nextOrders.length : total,
        hasMore: Number.isNaN(total)
          ? orders.length >= this.data.limit
          : nextOrders.length < total,
        loadFailed: false
      });
    } catch (error) {
      if (requestId !== this._requestId) return;
      console.error('加载工单失败:', error);
      this.setData({ loadFailed: true });
    } finally {
      if (requestId === this._requestId) this.setData({ loading: false, loadingMore: false });
    }
  },

  onRetryLoad() {
    this.loadOrders(true);
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
    if (!this.data.hasMore || this.data.loading || this.data.loadingMore) return;
    this.loadOrders(false);
  },

  onWorkerNav(e) {
    if (e.detail.key === 'profile') {
      wx.reLaunch({ url: '/pages/worker/profile/index' });
    }
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
