const api = require('../../utils/api');
const auth = require('../../utils/auth');

Page({
  data: {
    addresses: [],
    mode: 'manage', // manage 或 select
    loading: true,
    loadFailed: false
  },

  onLoad(options) {
    const mode = options.mode || 'manage';
    // 分享/历史页面直接进入时，游客先登录，登录后回到这里
    if (!auth.checkLogin()) {
      wx.redirectTo({ url: `/pages/login/login?redirect=${encodeURIComponent(`/pages/address/list?mode=${mode}`)}` });
      return;
    }
    this.setData({ mode });
  },

  onShow() {
    // 首次进入和从编辑页返回都会经过这里：只在 onShow 加载一次，避免进入时请求两遍
    if (!auth.checkLogin()) return;
    this.loadAddresses();
  },

  onPullDownRefresh() {
    return this.loadAddresses().then(() => wx.stopPullDownRefresh());
  },

  onRetryLoad() {
    this.loadAddresses();
  },

  /**
   * 加载地址列表
   */
  async loadAddresses() {
    // 已有列表时静默刷新，不清空、不闪“加载中”
    if (!this._loaded) this.setData({ loading: true, loadFailed: false });

    try {
      const res = await api.getAddresses();

      if (res.success) {
        this._loaded = true;
        this.setData({
          addresses: res.data,
          loading: false,
          loadFailed: false
        });
      }
    } catch (error) {
      console.error('加载地址列表失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false, loadFailed: !this._loaded });
    }
  },

  /**
   * 选择地址（选择模式）
   */
  onSelectAddress(e) {
    if (this.data.mode !== 'select') return;

    const address = e.currentTarget.dataset.address;

    // 通过事件通道返回数据
    const eventChannel = this.getOpenerEventChannel();
    eventChannel.emit('selectAddress', { address });

    wx.navigateBack();
  },

  /**
   * 编辑地址
   */
  onEditAddress(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/address/edit?id=${id}`
    });
  },

  /**
   * 设置默认地址
   */
  async onSetDefault(e) {
    const id = e.currentTarget.dataset.id;

    wx.showLoading({ title: '设置中...' });

    try {
      const res = await api.setDefaultAddress(id);

      if (res.success) {
        wx.showToast({
          title: '设置成功',
          icon: 'success'
        });
        this.loadAddresses();
      }
    } catch (error) {
      console.error('设置默认地址失败:', error);
      wx.showToast({
        title: '设置失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 删除地址
   */
  onDeleteAddress(e) {
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个地址吗？',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });

          try {
            const result = await api.deleteAddress(id);

            if (result.success) {
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
              this.loadAddresses();
            }
          } catch (error) {
            console.error('删除地址失败:', error);
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  /**
   * 新增地址
   */
  onAddAddress() {
    wx.navigateTo({
      url: '/pages/address/edit'
    });
  },

  stop() {}
});
