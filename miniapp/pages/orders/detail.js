const api = require('../../utils/api');
const statusUtil = require('../../utils/status');
const theme = require('../../utils/theme');

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

Page({
  data: {
    order: null,
    loading: true,
    statusMeta: {},
    maskedWorkerPhone: '',
    createdAt: '',
    confirmedAt: '',
    startedAt: '',
    completedAt: '',
    cancelledAt: ''
  },

  onLoad(options) {
    const { id } = options;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.loadOrderDetail(id);
  },

  async loadOrderDetail(id) {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await api.getOrderById(id);
      if (res.success) {
        const order = res.data;
        const statusMeta = statusUtil.getStatusMeta(order.status);
        
        // 格式化价格
        const expectedPriceText = order.expected_price 
          ? theme.formatPrice(order.expected_price, null, '元').main 
          : '';
        const finalPriceText = order.final_price 
          ? theme.formatPrice(order.final_price, null, '元').main 
          : '';
        
        this.setData({
          order,
          loading: false,
          statusMeta,
          expectedPriceText,
          finalPriceText,
          maskedWorkerPhone: theme.maskPhone(order.worker_phone),
          createdAt: formatTime(order.created_at),
          confirmedAt: formatTime(order.confirmed_at),
          startedAt: formatTime(order.started_at),
          completedAt: formatTime(order.completed_at),
          cancelledAt: formatTime(order.cancelled_at)
        });
      }
    } catch (error) {
      console.error('加载工单详情失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    } finally {
      wx.hideLoading();
    }
  },

  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = this.data.order.images.map((img) => img.image_url);
    wx.previewImage({ current: url, urls });
  },

  onCallService() {
    wx.makePhoneCall({ phoneNumber: '400-888-6688' });
  },

  onCancelOrder() {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这个工单吗？',
      confirmColor: '#F5222D',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '取消中...' });
        try {
          const result = await api.cancelOrder(this.data.order.id);
          if (result.success) {
            wx.showToast({ title: '取消成功', icon: 'success' });
            this.loadOrderDetail(this.data.order.id);
          }
        } catch (error) {
          wx.showToast({ title: error.message || '取消失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  }
});