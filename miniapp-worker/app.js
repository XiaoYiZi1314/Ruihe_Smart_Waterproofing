App({
  globalData: {
    apiBaseUrl: 'http://localhost:3000', // 开发环境
    // apiBaseUrl: 'https://api.yourdomain.com', // 生产环境
    userInfo: null,
    token: null
  },

  onLaunch() {
    console.log('师傅端小程序启动');
    
    // 检查登录状态
    const token = wx.getStorageSync('worker_token');
    if (token) {
      this.globalData.token = token;
      this.checkLoginStatus();
    }
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    wx.request({
      url: `${this.globalData.apiBaseUrl}/api/auth/me`,
      header: {
        'Authorization': `Bearer ${this.globalData.token}`
      },
      success: (res) => {
        if (res.data.success) {
          this.globalData.userInfo = res.data.data;
          
          // 验证角色
          if (res.data.data.role !== 'worker') {
            wx.showModal({
              title: '权限错误',
              content: '此账号无师傅权限',
              showCancel: false,
              success: () => {
                this.logout();
              }
            });
          }
        } else {
          this.logout();
        }
      },
      fail: () => {
        this.logout();
      }
    });
  },

  /**
   * 退出登录
   */
  logout() {
    this.globalData.token = null;
    this.globalData.userInfo = null;
    wx.removeStorageSync('worker_token');
    wx.reLaunch({
      url: '/pages/login/login'
    });
  }
});
