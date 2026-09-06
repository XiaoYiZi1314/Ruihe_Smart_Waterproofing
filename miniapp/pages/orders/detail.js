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
    submitting: false,
    statusMeta: {},
    maskedWorkerPhone: '',
    createdAt: '',
    confirmedAt: '',
    startedAt: '',
    completedAt: '',
    finishedAt: '',
    cancelledAt: '',

    // 费用明细
    doorFeeText: '',
    materialFeeText: '',
    laborFeeText: '',

    // 价格异议弹窗
    showDisputeModal: false,
    disputeReason: '',

    // 评价弹窗
    showReviewModal: false,
    reviewScores: { attitude: 5, quality: 5, price: 5 },
    reviewComment: '',
    starRange: [1, 2, 3, 4, 5]
  },

  onLoad(options) {
    const { id } = options;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.orderId = id;
    this.loadOrderDetail(id);
  },

  onPullDownRefresh() {
    this.loadOrderDetail(this.orderId).then(() => {
      wx.stopPullDownRefresh();
    });
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
          finishedAt: formatTime(order.finished_at),
          cancelledAt: formatTime(order.cancelled_at),
          doorFeeText: order.door_fee !== null && order.door_fee !== undefined ? `¥${order.door_fee}` : '',
          materialFeeText: order.material_fee !== null && order.material_fee !== undefined ? `¥${order.material_fee}` : '',
          laborFeeText: order.labor_fee !== null && order.labor_fee !== undefined ? `¥${order.labor_fee}` : ''
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

  onCallMaster() {
    const phone = this.data.order.worker_phone;
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: phone });
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
  },

  /**
   * 催单
   */
  async onUrgeOrder() {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const result = await api.urgeOrder(this.data.order.id);
      if (result.success) {
        const count = (this.data.order.urge_count || 0) + 1;
        this.setData({ order: { ...this.data.order, urge_count: count } });
        wx.showToast({ title: '催单成功，已通知师傅', icon: 'success' });
      }
    } catch (error) {
      wx.showToast({ title: error.message || '催单失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  /**
   * 确认验收
   */
  onConfirmOrder() {
    const { order } = this.data;
    const priceText = order.final_price ? `¥${order.final_price}` : '约定价格';
    wx.showModal({
      title: '确认验收',
      content: `确认师傅已完成施工并接受最终价格 ${priceText}？确认后工单将完成。`,
      confirmText: '确认完成',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '提交中...' });
        try {
          const result = await api.confirmOrder(order.id);
          if (result.success) {
            wx.showToast({ title: '工单已完成', icon: 'success' });
            this.loadOrderDetail(order.id);
          }
        } catch (error) {
          wx.showToast({ title: error.message || '确认失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  // ============ 价格异议 ============
  openDisputeModal() {
    this.setData({ showDisputeModal: true, disputeReason: '' });
  },

  closeDisputeModal() {
    this.setData({ showDisputeModal: false });
  },

  onDisputeReasonInput(e) {
    this.setData({ disputeReason: e.detail.value });
  },

  async submitDispute() {
    if (this.data.submitting) return;

    const reason = this.data.disputeReason.trim();
    if (reason.length < 5) {
      wx.showToast({ title: '请填写至少5个字的异议原因', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const result = await api.disputePrice(this.data.order.id, reason);
      if (result.success) {
        wx.showToast({ title: '异议已提交，等待处理', icon: 'success' });
        this.setData({ showDisputeModal: false });
        this.loadOrderDetail(this.data.order.id);
      }
    } catch (error) {
      wx.showToast({ title: error.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  // ============ 评价 ============
  openReviewModal() {
    this.setData({
      showReviewModal: true,
      reviewScores: { attitude: 5, quality: 5, price: 5 },
      reviewComment: ''
    });
  },

  closeReviewModal() {
    this.setData({ showReviewModal: false });
  },

  onScoreTap(e) {
    const { type, score } = e.currentTarget.dataset;
    const scores = { ...this.data.reviewScores };
    scores[type] = parseInt(score);
    this.setData({ reviewScores: scores });
  },

  onReviewCommentInput(e) {
    this.setData({ reviewComment: e.detail.value });
  },

  async submitReview() {
    if (this.data.submitting) return;

    const { attitude, quality, price } = this.data.reviewScores;
    const comment = this.data.reviewComment.trim();

    if (!comment) {
      wx.showToast({ title: '请填写评价内容', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const result = await api.submitReview(this.data.order.id, {
        service_attitude_score: attitude,
        quality_score: quality,
        price_score: price,
        comment
      });
      if (result.success) {
        wx.showToast({ title: '评价成功，感谢反馈', icon: 'success' });
        this.setData({ showReviewModal: false });
        this.loadOrderDetail(this.data.order.id);
      }
    } catch (error) {
      wx.showToast({ title: error.message || '评价失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  /**
   * 重新预约
   */
  onRebook() {
    wx.switchTab({ url: '/pages/services/list' });
  }
});
