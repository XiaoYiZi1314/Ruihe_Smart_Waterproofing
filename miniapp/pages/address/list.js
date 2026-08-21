const api = require('../../utils/api');

Page({
  data: {
    addresses: [],
    mode: 'manage', // manage 或 select
    loading: true
  },

  onLoad(options) {
    const mode = options.mode || 'manage';
    this.setData({ mode });
    this.loadAddresses();
  },

  onShow() {
    // 从编辑页返回时刷新列表
    this.loadAddresses();
  },

  /**
   * 加载地址列表
   */
  async loadAddresses() {
    this.setData({ loading: true });

    try {
      const res = await api.getAddresses();

      if (res.success) {
        this.setData({
          addresses: res.data,
          loading: false
        });
      }
    } catch (error) {
      console.error('加载地址列表失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
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
