App({
  onLaunch() {
    // 小程序启动时执行
    console.log('瑞和防水小程序启动');

    // 检查登录状态
    const token = wx.getStorageSync('token');
    if (token) {
      // 验证token是否有效
      this.checkToken();
    }
  },

  onShow() {
    // 小程序显示时执行
  },

  onHide() {
    // 小程序隐藏时执行
  },

  checkToken() {
    // 验证token有效性
    wx.request({
      url: this.globalData.apiBaseUrl + '/api/auth/me',
      method: 'GET',
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('token')
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          this.globalData.userInfo = res.data.data;
        } else {
          // token无效，清除本地存储
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
        }
      },
      fail: () => {
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
      }
    });
  },

  globalData: {
    userInfo: null,
    apiBaseUrl: 'https://ruihezhihui.cn',
    serviceKeyword: ''
  }
});
