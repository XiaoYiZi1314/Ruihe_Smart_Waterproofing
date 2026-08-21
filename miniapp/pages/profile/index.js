const auth = require('../../utils/auth');
const api = require('../../utils/api');
const theme = require('../../utils/theme');

Page({
  data: {
    userInfo: null,
    displayPhone: '',
    isDev: false,
    menuItems: []
  },

  onLoad() {
    const isDev = theme.isDevEnv();
    this.setData({ isDev });
    this.buildMenu();
  },

  onShow() {
    this.loadUserInfo();
    this.loadPendingOrders();
  },

  buildMenu() {
    const isDev = this.data.isDev;
    const items = [
      {
        id: 'orders',
        icon: 'document',
        title: '我的工单',
        action: 'goOrders',
        badge: 0,
        gradient: 'linear-gradient(135deg, #1A5CFF, #2B7BE4)'
      },
      {
        id: 'address',
        icon: 'location',
        title: '地址管理',
        url: '/pages/address/list?mode=manage',
        gradient: 'linear-gradient(135deg, #2B7BE4, #5B9AF5)'
      },
      {
        id: 'service',
        icon: 'chat',
        title: '联系客服',
        action: 'callService',
        gradient: 'linear-gradient(135deg, #5B9AF5, #7DB5FF)'
      },
      {
        id: 'about',
        icon: 'info',
        title: '关于我们',
        action: 'showAbout',
        gradient: 'linear-gradient(135deg, #1A5CFF, #5B9AF5)'
      },
      {
        id: 'settings',
        icon: 'settings',
        title: '设置',
        action: 'showSettings',
        gradient: 'linear-gradient(135deg, #6B7280, #9CA3AF)'
      }
    ];

    if (isDev) {
      items.push({
        id: 'design',
        icon: 'shield',
        title: '设计系统预览',
        url: '/pages/dev/design-system',
        gradient: 'linear-gradient(135deg, #1A5CFF, #5B9AF5)'
      });
    }

    this.setData({ menuItems: items });
  },

  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({
      userInfo,
      displayPhone: theme.maskPhone(userInfo.phone)
    });
  },

  async loadPendingOrders() {
    try {
      const res = await api.getOrders({ status: 'pending', limit: 1 });
      if (res.success) {
        const menuItems = this.data.menuItems.map((item) => {
          if (item.id === 'orders') {
            return { ...item, badge: res.pagination ? res.pagination.total : 0 };
          }
          return item;
        });
        this.setData({ menuItems });
      }
    } catch (error) {
      console.error('加载待处理工单数失败:', error);
    }
  },

  onMenuTap(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.menuItems.find((menu) => menu.id === id);
    if (!item) return;
    if (item.url) {
      wx.navigateTo({ url: item.url });
    } else if (item.action && this[item.action]) {
      this[item.action]();
    }
  },

  goOrders() {
    wx.switchTab({ url: '/pages/orders/list' });
  },

  callService() {
    wx.showModal({
      title: '联系客服',
      content: '客服电话：400-888-6688\n工作时间：周一至周日 8:00-20:00',
      confirmText: '拨打电话',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({ phoneNumber: '400-888-6688' });
        }
      }
    });
  },

  async showAbout() {
    try {
      const res = await api.getConfig();
      const content = res.success && res.data.about_us
        ? res.data.about_us
        : '瑞和智慧防水工程有限公司，专注建筑防水堵漏领域20年。';
      wx.showModal({ title: '关于我们', content, showCancel: false });
    } catch (error) {
      wx.showModal({
        title: '关于我们',
        content: '瑞和智慧防水工程有限公司，专注建筑防水堵漏领域20年。',
        showCancel: false
      });
    }
  },

  showSettings() {
    wx.showToast({ title: '设置功能开发中', icon: 'none' });
  },

  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      confirmColor: '#F5222D',
      success: (res) => {
        if (res.confirm) {
          auth.clearAuth();
          wx.reLaunch({ url: '/pages/login/login' });
        }
      }
    });
  }
});