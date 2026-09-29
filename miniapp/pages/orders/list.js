const api = require('../../utils/api');
const statusUtil = require('../../utils/status');

Page({
  data: {
    tabs: [],
    currentTab: null,
    orders: [],
    page: 1,
    limit: 10,
    total: 0,
    hasMore: true,
    loading: false
  },

  onLoad() {
    // 从 status.js 构建标签
    const STATUS_MAP = statusUtil.STATUS_MAP || {};
    const tabs = [{ key: null, label: '全部' }];
    
    // 添加主要状态标签
    ['pending', 'confirmed', 'in_progress', 'pending_review', 'completed', 'cancelled'].forEach(key => {
      if (STATUS_MAP[key]) {
        tabs.push({ key, label: STATUS_MAP[key].text });
      }
    });

    this.setData({ tabs });
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
    const requestId = this._requestId = (this._requestId || 0) + 1;
    // 已有列表时的刷新是静默的（从详情返回、切 Tab 回来），不显示加载条
    if (!refresh || this.data.orders.length === 0) this.setData({ loading: true });

    try {
      const params = {
        page: refresh ? 1 : this.data.page,
        limit: this.data.limit
      };
      if (this.data.currentTab) {
        params.status = this.data.currentTab;
      }

      const res = await api.getOrders(params);
      if (requestId !== this._requestId) return;
      if (res.success) {
        const orders = refresh ? res.data : [...this.data.orders, ...res.data];
        const unchanged = refresh && JSON.stringify(orders) === JSON.stringify(this.data.orders);
        this.setData({
          ...(unchanged ? {} : { orders }),
          page: res.pagination ? res.pagination.page : 1,
          total: res.pagination ? res.pagination.total : orders.length,
          hasMore: res.pagination ? res.pagination.page < res.pagination.pages : false,
          loading: false
        });
      }
    } catch (error) {
      if (requestId !== this._requestId) return;
      console.error('加载工单列表失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      if (requestId === this._requestId) this.setData({ loading: false });
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
      wx.makePhoneCall({ phoneNumber: String(phone), fail: () => wx.showToast({ title: '拨号未完成，可在详情查看电话', icon: 'none' }) });
      return;
    }

    if (action === 'urge') {
      if (this._urging) return;
      this._urging = true;
      try {
        const result = await api.urgeOrder(order.id);
        if (result.success) {
          wx.showToast({ title: '催单成功，已通知处理', icon: 'success' });
          await this.loadOrders(true);
        }
      } catch (error) {
        wx.showToast({ title: error.message || '催单失败', icon: 'none' });
      } finally {
        this._urging = false;
      }
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
    this.setData({ page: 1 });
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