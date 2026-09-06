const api = require('../../utils/request');
const { STATUS, getStatusText, getStatusClass, formatPrice, formatTime, maskPhone } = require('../../utils/status');

Page({
  data: {
    id: null,
    order: null,
    loading: true,
    submitting: false,

    // 拒单弹窗
    showRejectModal: false,
    rejectReason: '',

    // 完工填价弹窗
    showCompleteModal: false,
    doorFee: '',
    materialFee: '',
    laborFee: '',
    totalFee: '0.00'
  },

  onLoad(options) {
    this.setData({ id: options.id });
    this.loadOrder();
  },

  /**
   * 加载工单详情
   */
  async loadOrder() {
    this.setData({ loading: true });
    try {
      const order = await api.get(`/api/worker/orders/${this.data.id}`);

      order.statusText = getStatusText(order.status);
      order.statusClass = getStatusClass(order.status);
      order.priceText = formatPrice(order.final_price);
      order.createdTimeText = formatTime(order.created_at);
      order.estimatedTimeText = formatTime(order.estimated_time);
      order.completedTimeText = formatTime(order.completed_at);
      order.finishedTimeText = formatTime(order.finished_at);
      order.maskedPhone = order.contact_phone;

      // 根据状态决定可用操作
      order.canAccept = order.status === STATUS.CONFIRMED && !order.confirmed_at;
      order.canReject = order.status === STATUS.CONFIRMED && !order.confirmed_at;
      order.canStart = order.status === STATUS.CONFIRMED && !!order.confirmed_at;
      order.canComplete = order.status === STATUS.IN_PROGRESS;

      this.setData({ order });
    } catch (error) {
      console.error('加载工单详情失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadOrder().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 拨打客户电话
   */
  callCustomer() {
    const phone = this.data.order && this.data.order.contact_phone;
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: phone });
  },

  /**
   * 复制地址
   */
  copyAddress() {
    const address = this.data.order && this.data.order.full_address;
    if (!address) return;
    wx.setClipboardData({
      data: address,
      success: () => {
        wx.showToast({ title: '地址已复制', icon: 'success' });
      }
    });
  },

  /**
   * 查看图片
   */
  previewImage(e) {
    const { url } = e.currentTarget.dataset;
    const urls = (this.data.order.images || []).map((img) => img.image_url);
    wx.previewImage({ current: url, urls });
  },

  // ============ 接单 ============
  async handleAccept() {
    if (this.data.submitting) return;
    this.setData({ submitting: true });

    try {
      await api.put(`/api/worker/orders/${this.data.id}/accept`);
      wx.showToast({ title: '已接单', icon: 'success' });
      this.loadOrder();
    } catch (error) {
      console.error('接单失败:', error);
    } finally {
      this.setData({ submitting: false });
    }
  },

  // ============ 拒单 ============
  openRejectModal() {
    this.setData({ showRejectModal: true, rejectReason: '' });
  },

  closeRejectModal() {
    this.setData({ showRejectModal: false });
  },

  onRejectReasonInput(e) {
    this.setData({ rejectReason: e.detail.value });
  },

  async handleReject() {
    if (this.data.submitting) return;

    if (!this.data.rejectReason || this.data.rejectReason.trim().length < 5) {
      wx.showToast({ title: '请填写至少5个字的拒单理由', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      await api.put(`/api/worker/orders/${this.data.id}/reject`, {
        reason: this.data.rejectReason.trim()
      });
      wx.showToast({ title: '已拒单', icon: 'success' });
      this.setData({ showRejectModal: false });
      setTimeout(() => {
        wx.navigateBack();
      }, 1200);
    } catch (error) {
      console.error('拒单失败:', error);
    } finally {
      this.setData({ submitting: false });
    }
  },

  // ============ 开始施工 ============
  async handleStart() {
    if (this.data.submitting) return;

    const confirmRes = await new Promise((resolve) => {
      wx.showModal({
        title: '开始施工',
        content: '确认已到达现场并开始施工？',
        success: resolve
      });
    });

    if (!confirmRes.confirm) return;

    this.setData({ submitting: true });

    try {
      await api.put(`/api/worker/orders/${this.data.id}/start`);
      wx.showToast({ title: '已开始施工', icon: 'success' });
      this.loadOrder();
    } catch (error) {
      console.error('开始施工失败:', error);
    } finally {
      this.setData({ submitting: false });
    }
  },

  // ============ 完工填价 ============
  openCompleteModal() {
    this.setData({
      showCompleteModal: true,
      doorFee: '',
      materialFee: '',
      laborFee: '',
      totalFee: '0.00'
    });
  },

  closeCompleteModal() {
    this.setData({ showCompleteModal: false });
  },

  onDoorFeeInput(e) {
    this.setData({ doorFee: e.detail.value });
    this.updateTotalFee();
  },

  onMaterialFeeInput(e) {
    this.setData({ materialFee: e.detail.value });
    this.updateTotalFee();
  },

  onLaborFeeInput(e) {
    this.setData({ laborFee: e.detail.value });
    this.updateTotalFee();
  },

  updateTotalFee() {
    const d = parseFloat(this.data.doorFee) || 0;
    const m = parseFloat(this.data.materialFee) || 0;
    const l = parseFloat(this.data.laborFee) || 0;
    this.setData({ totalFee: (d + m + l).toFixed(2) });
  },

  async handleComplete() {
    if (this.data.submitting) return;

    const { doorFee, materialFee, laborFee } = this.data;

    if (doorFee === '' || materialFee === '' || laborFee === '') {
      wx.showToast({ title: '请填写完整价格信息', icon: 'none' });
      return;
    }

    const d = parseFloat(doorFee);
    const m = parseFloat(materialFee);
    const l = parseFloat(laborFee);

    if (isNaN(d) || isNaN(m) || isNaN(l) || d < 0 || m < 0 || l < 0) {
      wx.showToast({ title: '价格必须为非负数字', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      await api.put(`/api/worker/orders/${this.data.id}/complete`, {
        door_fee: d,
        material_fee: m,
        labor_fee: l
      });
      wx.showToast({ title: '已完工，等待客户验收', icon: 'success' });
      this.setData({ showCompleteModal: false });
      this.loadOrder();
    } catch (error) {
      console.error('完工失败:', error);
    } finally {
      this.setData({ submitting: false });
    }
  }
});
