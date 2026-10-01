const api = require('../../utils/api');
const statusUtil = require('../../utils/status');
const theme = require('../../utils/theme');
const { buildTimeline, correctionNotice, appointmentText } = require('../../utils/order-timeline');

function loadErrorText(error) {
  if (error && error.type === 'network') return '网络不佳，加载失败';
  if (error && error.statusCode === 403) return '无权查看此工单';
  if (error && error.statusCode === 404) return '工单不存在';
  if (error && error.statusCode >= 500) return '服务暂时不可用，请稍后重试';
  return '网络不佳，加载失败';
}

Page({
  data: {
    imageLoadFailed: false,
    order: null,
    loading: true,
    loadFailed: false,
    loadErrorText: '网络不佳，加载失败',
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
    reviewVideo: '',
    starRange: [1, 2, 3, 4, 5],
    // 评价图片：本地临时路径，最多 3 张；提交时逐张上传
    reviewImages: [],
    maxReviewImages: 3
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

  onShow() {
    if (!this.orderId) return;
    // 从图片预览返回时数据没有变化，不重新加载（否则图片会重新请求，页面闪一下）
    if (this._previewing) {
      this._previewing = false;
      return;
    }
    // 首次进入已在 onLoad 拉取；这里只在已有数据时静默刷新，避免 onShow 连打两次把成功结果丢掉
    if (this.data.order) this.loadOrderDetail(this.orderId);
  },

  onPullDownRefresh() {
    this.loadOrderDetail(this.orderId).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onRetryLoad() {
    this.setData({ loading: true, loadFailed: false });
    this.loadOrderDetail(this.orderId);
  },

  async loadOrderDetail(id) {
    const requestId = this._requestId = (this._requestId || 0) + 1;
    if (!this.data.order) this.setData({ loading: true, loadFailed: false });
    try {
      const res = await api.getOrderById(id);
      if (requestId !== this._requestId && this.data.order) return;
      if (res.success && res.data) {
        const order = res.data;
        // 图片用稳定的 key（签名参数每次都会变，不能用 image_url 当 key）
        order.images = (order.images || []).map((img) => ({
          ...img,
          key: img.id != null ? String(img.id) : String(img.image_url || '').split('?')[0]
        }));
        if (order.review) {
          order.review.images = (order.review.images || []).map((img) => ({
            ...img,
            key: img.id != null ? String(img.id) : String(img.image_url || '').split('?')[0]
          }));
        }
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
          loadFailed: false,
          loadErrorText: '网络不佳，加载失败',
          statusMeta,
          expectedPriceText,
          finalPriceText,
          maskedWorkerPhone: theme.maskPhone(order.worker_phone),
          createdAt: theme.formatTime(order.created_at),
          confirmedAt: theme.formatTime(order.confirmed_at),
          startedAt: theme.formatTime(order.started_at),
          completedAt: theme.formatTime(order.completed_at),
          finishedAt: theme.formatTime(order.finished_at),
          cancelledAt: theme.formatTime(order.cancelled_at),
          timelineItems: buildTimeline(order, theme.formatTime),
          correctionNotice: correctionNotice(order, theme.formatTime),
          appointmentText: appointmentText(order),
          estimatedTimeText: order.estimated_time ? theme.formatTime(order.estimated_time) : '',
          doorFeeText: order.door_fee !== null && order.door_fee !== undefined ? `¥${order.door_fee}` : '',
          materialFeeText: order.material_fee !== null && order.material_fee !== undefined ? `¥${order.material_fee}` : '',
          laborFeeText: order.labor_fee !== null && order.labor_fee !== undefined ? `¥${order.labor_fee}` : ''
        });
        return;
      }
      if (requestId === this._requestId && !this.data.order) {
        this.setData({
          loading: false,
          loadFailed: true,
          loadErrorText: res.message || '工单暂时不可用，请稍后重试'
        });
      }
    } catch (error) {
      if (requestId !== this._requestId) return;
      console.error('加载工单详情失败:', error);
      // 已有内容时保持页面不动（请求层已提示错误）；首次加载失败显示重试入口，不再自动退出页面
      if (!this.data.order) {
        this.setData({
          loading: false,
          loadFailed: true,
          loadErrorText: loadErrorText(error)
        });
      }
    }
  },

  onImageError() {
    this.setData({ imageLoadFailed: true });
  },

  async onRetryImages() {
    this.setData({ imageLoadFailed: false });
    await this.loadOrderDetail(this.orderId);
  },

  onPreviewImage(e) {
    this._previewing = true;
    const url = e.currentTarget.dataset.url;
    const urls = this.data.order.images.map((img) => img.image_url);
    wx.previewImage({ current: url, urls });
  },

  // 预览“我的评价”里的图片
  onPreviewReviewImage(e) {
    this._previewing = true;
    const url = e.currentTarget.dataset.url;
    const urls = ((this.data.order.review && this.data.order.review.images) || []).map((img) => img.image_url);
    wx.previewImage({ current: url, urls });
  },

  onCallService() {
    require('../../utils/notifications').callService();
  },

  onCallMaster() {
    const phone = this.data.order.worker_phone;
    if (!phone) return wx.showToast({ title: '暂无师傅电话，请联系客服', icon: 'none' });
    wx.makePhoneCall({ phoneNumber: String(phone), fail: () => wx.showToast({ title: '拨号未完成，请重试', icon: 'none' }) });
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
        const count = Number(this.data.order.urge_count || 0) + 1;
        this.setData({ order: { ...this.data.order, urge_count: count } });
        wx.showToast({ title: '催单成功，已通知处理', icon: 'success' });
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
      reviewComment: '',
      reviewVideo: '',
      reviewImages: []
    });
  },

  closeReviewModal() {
    this.setData({ showReviewModal: false });
  },

  onScoreTap(e) {
    const { type, score } = e.currentTarget.dataset;
    const value = Number(score);
    if (!['attitude', 'quality', 'price'].includes(type) ||
        !Number.isInteger(value) || value < 1 || value > 5) return;
    const scores = { ...this.data.reviewScores };
    scores[type] = value;
    this.setData({ reviewScores: scores });
  },

  onReviewCommentInput(e) {
    this.setData({ reviewComment: e.detail.value });
  },

  chooseReviewVideo() {
    wx.chooseVideo({ sourceType: ['album', 'camera'], compressed: true, success: res => {
      if (res.size > 128 * 1024 * 1024) return wx.showToast({ title: '视频超过128MB，请压缩后上传', icon: 'none' });
      this.setData({ reviewVideo: res.tempFilePath });
    } });
  },
  removeReviewVideo() { this.setData({ reviewVideo: '' }); },

  // ---- 评价图片（最多 3 张，可与视频同时提交）----
  chooseReviewImages() {
    const remain = this.data.maxReviewImages - this.data.reviewImages.length;
    if (remain <= 0) {
      wx.showToast({ title: `最多上传${this.data.maxReviewImages}张图片`, icon: 'none' });
      return;
    }
    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const merged = [...this.data.reviewImages, ...(res.tempFilePaths || [])];
        this.setData({ reviewImages: merged.slice(0, this.data.maxReviewImages) });
      }
    });
  },
  removeReviewImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ reviewImages: this.data.reviewImages.filter((_, i) => i !== index) });
  },
  previewReviewDraftImage(e) {
    this._previewing = true;
    wx.previewImage({ current: e.currentTarget.dataset.url, urls: this.data.reviewImages });
  },
  deleteReview() {
    wx.showModal({ title: '删除评价', content: '删除后不能重新评价，确定删除？', success: async res => {
      if (!res.confirm) return;
      try { await api.deleteReview(this.data.order.id); await this.loadOrderDetail(this.data.order.id); }
      catch (error) { wx.showToast({ title: '删除失败', icon: 'none' }); }
    } });
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
      const request = require('../../utils/request');
      // 图片逐张上传（服务端对上传有频率限制，不并发），再连同视频一起提交
      const imageUrls = [];
      for (const filePath of this.data.reviewImages) imageUrls.push(await request.upload(filePath, 'image'));
      const videoUrl = this.data.reviewVideo ? await request.upload(this.data.reviewVideo, 'video') : null;
      const result = await api.submitReview(this.data.order.id, {
        images: imageUrls,
        video_url: videoUrl,
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
