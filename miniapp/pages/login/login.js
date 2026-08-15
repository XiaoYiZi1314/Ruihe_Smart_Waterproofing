const auth = require('../../utils/auth');

Page({
  data: {
    loading: false
  },

  onLoad() {
    // 检查是否已登录
    if (auth.checkLogin()) {
      wx.redirectTo({
        url: '/pages/index/index'
      });
    }
  },

  /**
   * 获取用户信息并登录
   */
  onGetUserProfile() {
    const that = this;

    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        that.setData({ loading: true });

        auth.login(res.userInfo)
          .then(() => {
            wx.showToast({
              title: '登录成功',
              icon: 'success',
              duration: 1500
            });

            setTimeout(() => {
              wx.redirectTo({
                url: '/pages/index/index'
              });
            }, 1500);
          })
          .catch((err) => {
            wx.showToast({
              title: err.message || '登录失败',
              icon: 'none',
              duration: 2000
            });
          })
          .finally(() => {
            that.setData({ loading: false });
          });
      },
      fail: () => {
        wx.showToast({
          title: '需要授权才能使用',
          icon: 'none'
        });
      }
    });
  }
});
