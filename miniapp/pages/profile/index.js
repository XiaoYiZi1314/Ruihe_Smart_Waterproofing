const auth = require('../../utils/auth');
const api = require('../../utils/api');
const theme = require('../../utils/theme');
const notifications = require('../../utils/notifications');

// 这些入口需要登录，游客点击时先去登录，登录成功后回到对应页面
const LOGIN_REQUIRED = {
  orders: '/pages/orders/list',
  address: '/pages/address/list?mode=manage'
};

Page({
  onMessages() {
    if (!auth.requireLogin('/pages/notifications/list')) return;
    wx.navigateTo({ url: '/pages/notifications/list' });
  },
  data: {
    userInfo: null,
    displayPhone: '',
    guest: false,
    isDev: false,
    menuItems: []
  },

  onLoad() {
    const isDev = theme.isDevEnv();
    this.setData({ isDev });
    this.buildMenu();
  },

  onShow() {
    // 游客也能看“我的”页：展示登录入口，而不是直接跳去登录页
    if (!auth.checkLogin()) {
      this.setData({ guest: true, userInfo: null, displayPhone: '' });
      return;
    }
    if (this.data.guest) this.setData({ guest: false });
    this.loadUserInfo();

    // 师傅角色跳转到师傅工作台（防止误入客户端页面）
    const userInfo = wx.getStorageSync('userInfo') || {};
    if (userInfo.role === 'worker') {
      wx.reLaunch({ url: '/pages/worker/orders/list' });
      return;
    }

    this.loadPendingOrders();
  },

  onEditProfile() {
    wx.navigateTo({ url: '/pages/profile/edit' });
  },

  onGuestLogin() {
    auth.requireLogin('/pages/profile/index');
  },

  onWorkerLoginEntry() {
    wx.navigateTo({ url: '/pages/login/login?mode=worker' });
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
        gradient: 'var(--gradient-brand)'
      },
      {
        id: 'address',
        icon: 'location',
        title: '地址管理',
        url: '/pages/address/list?mode=manage',
        gradient: 'var(--gradient-brand-light)'
      },
      {
        id: 'service',
        icon: 'chat',
        title: '联系客服',
        action: 'callService',
        gradient: 'var(--gradient-brand-pale)'
      },
      {
        id: 'about',
        icon: 'info',
        title: '关于我们',
        action: 'showAbout',
        gradient: 'var(--gradient-brand-wide)'
      }
    ];

    if (isDev) {
      items.push({
        id: 'design',
        icon: 'shield',
        title: '设计系统预览',
        url: '/pages/dev/design-system',
        gradient: 'var(--gradient-brand-wide)'
      });
    }

    this.setData({ menuItems: items });
  },

  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    // 内容没变就不 setData，避免个人中心头部重复渲染
    const previous = this.data.userInfo;
    if (previous && JSON.stringify(previous) === JSON.stringify(userInfo)) return;
    this.setData({
      userInfo,
      displayPhone: theme.maskPhone(userInfo.phone)
    });
  },

  async loadPendingOrders() {
    try {
      const res = await api.getOrders({ status: 'pending', limit: 1 });
      if (res.success) {
        const badge = res.pagination ? res.pagination.total : 0;
        const current = this.data.menuItems.find((item) => item.id === 'orders');
        if (current && current.badge === badge) return;
        const menuItems = this.data.menuItems.map((item) => {
          if (item.id === 'orders') {
            return { ...item, badge };
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
    if (LOGIN_REQUIRED[id] && !auth.requireLogin(LOGIN_REQUIRED[id])) return;
    if (item.url) {
      wx.navigateTo({ url: item.url });
    } else if (item.action && this[item.action]) {
      this[item.action]();
    }
  },

  goOrders() {
    wx.switchTab({ url: '/pages/orders/list' });
  },

  async callService() {
    await notifications.callService();
  },

  async showAbout() {
    try {
      const res = await api.getConfig();
      const content = res.success && res.data.about_us
        ? res.data.about_us
        : '暂无公司介绍';
      wx.showModal({ title: '关于我们', content, showCancel: false });
    } catch (error) {
      wx.showModal({
        title: '关于我们',
        content: '加载失败，请稍后重试。',
        showCancel: false
      });
    }
  },

  onSwitchRole() {
    wx.showModal({
      title: '切换身份', content: '退出当前账号，使用管理员分配的师傅账号登录？',
      success: res => {
        if (!res.confirm) return;
        auth.clearAuth();
        wx.reLaunch({ url: '/pages/login/login?mode=worker' });
      }
    });
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