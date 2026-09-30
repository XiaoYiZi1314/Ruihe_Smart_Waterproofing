const api = require('../../../utils/request');
const { STATUS, getStatusText, getStatusClass, formatPrice, formatTime, maskPhone } = require('../../../utils/workerStatus');

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
    totalFee: '0.00',

    // 现场变更申请
    showChangeModal: false,
    changeTypes: [
      { value: 'price', label: '费用调整' },
      { value: 'time', label: '上门时间调整' },
      { value: 'scope', label: '施工范围变更' },
      { value: 'other', label: '其他' }
    ],
    changeTypeIndex: 0,
    changeContent: '',
    changeDoorFee: '',
    changeMaterialFee: '',
    changeLaborFee: '',
    changeTotalFee: '0.00',
    changeProposedDate: '',
    changeProposedTime: '09:00',
    changeRequests: [],
    hasPendingRequest: false
  },

  onLoad(options) {
    const user = wx.getStorageSync('userInfo') || {};
    if (!wx.getStorageSync('token') || user.role !== 'worker') return wx.reLaunch({ url: '/pages/login/login' });
    this.setData({ id: options.id });
    this.loadOrder();
  },

  /**
   * 加载工单详情
   */
  async loadOrder() {
    // 已有数据时静默刷新，不切回“加载中”，避免整页闪一下
    this.setData({ loading: !this.data.order });
    try {
      const res = await api.get(`/api/worker/orders/${this.data.id}`);
      const order = (res && res.data) || null;
      if (!order) throw new Error('工单不存在');

      order.statusText = getStatusText(order.status);
      order.statusClass = getStatusClass(order.status);
      order.priceText = formatPrice(order.final_price);
      order.createdTimeText = formatTime(order.created_at);
      order.estimatedTimeText = formatTime(order.estimated_time);
      order.assignedTimeText = formatTime(order.assigned_at);
      order.acceptedTimeText = formatTime(order.confirmed_at);
      order.startedTimeText = formatTime(order.started_at);
      order.completedTimeText = formatTime(order.completed_at);
      order.finishedTimeText = formatTime(order.finished_at);
      order.maskedPhone = order.contact_phone;
      // 图片用稳定 key（私有图片地址的签名参数每次都会变）
      order.images = (order.images || []).map((img) => ({
        ...img,
        key: img.id != null ? String(img.id) : String(img.image_url || '').split('?')[0]
      }));

      // 根据状态决定可用操作
      order.canAccept = order.status === STATUS.CONFIRMED && !order.confirmed_at;
      order.canReject = order.status === STATUS.CONFIRMED && !order.confirmed_at;
      order.canStart = order.status === STATUS.CONFIRMED && !!order.confirmed_at;
      order.canComplete = order.status === STATUS.IN_PROGRESS;
      order.canRequestChange = [STATUS.CONFIRMED, STATUS.IN_PROGRESS, 'pending_review'].includes(order.status);
      order.appointmentText = order.appointment_date ? `${String(order.appointment_date).slice(0, 10)} ${order.appointment_slot || ''}`.trim() : '';
      order.correctionText = order.price_corrected_at && order.price_before_correction != null ? `已由客服更正（原 ¥${Number(order.price_before_correction).toFixed(2)}）` : '';

      this.setData({ order });
      this.loadChangeRequests();
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

  onRetryLoad() {
    this.loadOrder();
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

    // 完工填价提交后不能自行修改，先让师傅核对一遍
    const total = (d + m + l).toFixed(2);
    const confirmRes = await new Promise((resolve) => {
      wx.showModal({
        title: '确认提交完工价格',
        content: `上门费 ¥${d.toFixed(2)}\n材料费 ¥${m.toFixed(2)}\n工时费 ¥${l.toFixed(2)}\n合计 ¥${total}\n\n提交后将通知客户验收，确认提交？`,
        confirmText: '确认提交',
        success: resolve,
        fail: () => resolve({ confirm: false })
      });
    });
    if (!confirmRes.confirm) return;
    if (this.data.submitting) return;

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
  },

  // ============ 现场变更申请（提交后由客服审核） ============
  async loadChangeRequests() {
    try {
      const res = await api.get(`/api/worker/orders/${this.data.id}/change-requests`);
      const list = ((res && res.data) || []).map((item) => {
        const type = this.data.changeTypes.filter((t) => t.value === item.request_type)[0];
        let statusText = '已驳回';
        if (item.status === 'pending') statusText = '待客服处理';
        else if (item.status === 'approved') statusText = item.applied ? '已同意并更新工单' : '已同意';
        return { ...item, typeText: type ? type.label : '变更申请', statusText };
      });
      this.setData({ changeRequests: list, hasPendingRequest: list.some((item) => item.status === 'pending') });
    } catch (error) {
      console.error('加载变更申请失败:', error);
    }
  },

  openChangeModal() {
    if (this.data.hasPendingRequest) return;
    const order = this.data.order || {};
    const date = order.appointment_date ? String(order.appointment_date).slice(0, 10) : '';
    this.setData({
      showChangeModal: true,
      changeTypeIndex: 0,
      changeContent: '',
      changeDoorFee: '',
      changeMaterialFee: '',
      changeLaborFee: '',
      changeTotalFee: '0.00',
      changeProposedDate: date,
      changeProposedTime: '09:00'
    });
  },

  closeChangeModal() {
    this.setData({ showChangeModal: false });
  },

  onChangeTypeChange(e) {
    this.setData({ changeTypeIndex: Number(e.detail.value) });
  },

  onChangeProposedDateChange(e) {
    this.setData({ changeProposedDate: e.detail.value });
  },

  onChangeProposedTimeChange(e) {
    this.setData({ changeProposedTime: e.detail.value });
  },

  onChangeContentInput(e) {
    this.setData({ changeContent: e.detail.value });
  },

  onChangeFeeInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [key]: e.detail.value });
    const d = parseFloat(this.data.changeDoorFee) || 0;
    const m = parseFloat(this.data.changeMaterialFee) || 0;
    const l = parseFloat(this.data.changeLaborFee) || 0;
    this.setData({ changeTotalFee: (d + m + l).toFixed(2) });
  },

  async handleChangeRequest() {
    if (this.data.submitting) return;
    const type = this.data.changeTypes[this.data.changeTypeIndex];
    const content = this.data.changeContent.trim();
    if (content.length < 5) {
      wx.showToast({ title: '请至少用 5 个字说明现场情况', icon: 'none' });
      return;
    }
    const body = { request_type: type.value, content };
    if (type.value === 'price') {
      const { changeDoorFee, changeMaterialFee, changeLaborFee } = this.data;
      const values = [changeDoorFee, changeMaterialFee, changeLaborFee].map((value) => (value === '' ? NaN : parseFloat(value)));
      if (values.some((value) => isNaN(value) || value < 0)) {
        wx.showToast({ title: '请填写完整且非负的建议费用', icon: 'none' });
        return;
      }
      body.proposed_door_fee = values[0];
      body.proposed_material_fee = values[1];
      body.proposed_labor_fee = values[2];
    }
    if (type.value === 'time') {
      const { changeProposedDate, changeProposedTime } = this.data;
      if (!changeProposedDate || !changeProposedTime) {
        wx.showToast({ title: '请选择建议上门时间', icon: 'none' });
        return;
      }
      body.proposed_time = `${changeProposedDate} ${changeProposedTime}:00`;
    }
    this.setData({ submitting: true });
    try {
      await api.post(`/api/worker/orders/${this.data.id}/change-requests`, body);
      wx.showToast({ title: '申请已提交', icon: 'success' });
      this.setData({ showChangeModal: false });
      this.loadChangeRequests();
    } catch (error) {
      console.error('提交变更申请失败:', error);
    } finally {
      this.setData({ submitting: false });
    }
  }
});
