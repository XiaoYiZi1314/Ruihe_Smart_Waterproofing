const app = getApp();
const api = require('../../utils/request');

Page({
  data: {
    phone: '',
    password: '',
    loading: false,
    // 登录方式：wx = 微信授权，phone = 手机号密码
    loginMode: 'wx'
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  switchMode() {
    this.setData({ loginMode: this.data.loginMode === 'wx' ? 'phone' : 'wx' });
  },

  /**
   * 手机号+密码登录（管理员创建师傅账号后发放）
   */
  async handlePhoneLogin() {
    const { phone, password, loading } = this.data;
    if (loading) return;

    if (!phone || !password) {
      wx.showToast({ title: '请输入手机号和密码', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const data = await api.post('/api/auth/worker-login', { phone, password });

      wx.setStorageSync('worker_token', data.token);
      app.globalData.token = data.token;
      app.globalData.userInfo = data.user;

      wx.showToast({ title: '登录成功', icon: 'success' });

      setTimeout(() => {
        wx.switchTab({ url: '/pages/orders/list' });
      }, 1200);
    } catch (error) {
      console.error('登录失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 登录（使用微信登录）
   */
  async handleWxLogin() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      // 获取微信登录 code
      const loginRes = await wx.login();

      if (!loginRes.code) {
        throw new Error('获取登录凭证失败');
      }

      // 调用后端登录接口
      const data = await api.post('/api/auth/login', {
        code: loginRes.code
      });

      // 验证角色：师傅端只允许 worker 角色
      if (!data.user || data.user.role !== 'worker') {
        wx.showModal({
          title: '权限错误',
          content: '此账号无师傅权限，请联系管理员开通',
          showCancel: false
        });
        return;
      }

      // 保存 token
      wx.setStorageSync('worker_token', data.token);
      app.globalData.token = data.token;
      app.globalData.userInfo = data.user;

      wx.showToast({ title: '登录成功', icon: 'success' });

      setTimeout(() => {
        wx.switchTab({ url: '/pages/orders/list' });
      }, 1200);
    } catch (error) {
      console.error('登录失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  }
});
