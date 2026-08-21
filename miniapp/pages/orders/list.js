const api = require('../../utils/api');

Page({
  data: {
    tabs: [
      { key: null, label: '全部' },
      { key: 'pending', label: '待确认' },
      { key: 'confirmed', label: '已确认' },
      { key: 'in_progress', label: '进行中' },
      { key: 'completed', label: '已完成' },
      { key: 'cancelled', label: '已取消' }
    ],
    currentTab: null,
    orders: [],
    page: 1,
    limit: 10,
    total: 0,
    hasMore: true,
    loading: false
  },

  onShow() {
    this.loadOrders(true);
  },

  onTabChange(e) {
    this.setData({
      currentTab: e.detail.key,
      page: 1,
      orders: []
    });
    this.loadOrders(true);
  },

  async loadOrders(refresh = false) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const params = {
        page: refresh ? 1 : this.data.page,
        limit: this.data.limit
      };
      if (this.data.currentTab) {
        params.status = this.data.currentTab;
      }

      const res = await api.getOrders(params);
      if (res.success) {
        const orders = refresh ? res.data : [...this.data.orders, ...res.data];
        this.setData({
          orders,
          page: res.pagination ? res.pagination.page : 1,
          total: res.pagination ? res.pagination.total : orders.length,
          hasMore: res.pagination ? res.pagination.page < res.pagination.pages : false,
          loading: false
        });
      }
    } catch (error) {
      console.error('加载工单列表失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onOrderTap(e) {
    const order = e.detail.order || {};
    wx.navigateTo({
      url: `/pages/orders/detail?id=${order.id}`
    });
  },

  async onOrderAction(e) {
    const { action, order } = e.detail;
    if (!order) return;

    if (action === 'progress' || action === 'review') {
      wx.navigateTo({ url: `/pages/orders/detail?id=${order.id}` });
      return;
    }

    if (action === 'rebook') {
      wx.switchTab({ url: '/pages/services/list' });
      return;
    }

    if (action === 'callMaster') {
      const phone = order.worker_phone;
      if (!phone) {
        wx.showToast({ title: '暂无师傅电话', icon: 'none' });
        return;
      }
      wx.makePhoneCall({ phoneNumber: phone });
      return;
    }

    if (action === 'urge') {
      wx.showToast({ title: '已催单，我们会尽快处理', icon: 'none' });
      return;
    }

    if (action === 'cancel') {
      wx.showModal({
        title: '确认取消',
        content: '确定要取消这个工单吗？',
        confirmColor: '#F5222D',
        success: async (res) => {
          if (!res.confirm) return;
          try {
            const result = await api.cancelOrder(order.id);
            if (result.success) {
              wx.showToast({ title: '取消成功', icon: 'success' });
              this.loadOrders(true);
            }
          } catch (error) {
            wx.showToast({ title: error.message || '取消失败', icon: 'none' });
          }
        }
      });
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1, orders: [] });
    this.loadOrders(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadOrders();
    }
  }
});