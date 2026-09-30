const notifications = require('../../utils/notifications');
const api = require('../../utils/api');
const theme = require('../../utils/theme');
const auth = require('../../utils/auth');
const slots = require('../../utils/booking-slots');
const { upload } = require('../../utils/request');

const PHONE_REGEX = /^1[3-9]\d{9}$/;

Page({
  data: {
    serviceId: null,
    service: null,
    serviceFailed: false,
    selectedAddress: null,
    addressText: '',
    contactName: '',
    contactPhone: '',
    dateOptions: [],
    timeOptions: [],
    dateValue: '',
    timeValue: '',
    form: {
      expected_price: '',
      remark: '',
      images: []
    },
    maxImages: 5
  },

  onLoad(options) {
    const { serviceId } = options;

    if (!serviceId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    // 分享链接/历史页面直接进入时，游客先登录，登录后回到这里
    if (!auth.checkLogin()) {
      wx.redirectTo({ url: `/pages/login/login?redirect=${encodeURIComponent(`/pages/booking/create?serviceId=${serviceId}`)}` });
      return;
    }

    // 已经过去的时段不可选；今天没有可选时段时从明天开始
    const dateOptions = slots.buildDateOptions();
    const dateValue = dateOptions[0].value;
    const timeOptions = slots.availableSlots(dateValue);

    this.setData({
      serviceId,
      dateOptions,
      dateValue,
      timeOptions,
      timeValue: timeOptions.length ? timeOptions[0].value : ''
    });
    notifications.loadConfig();
    this.loadService(serviceId);
    this.loadDefaultAddress();
  },

  async loadService(id) {
    this.setData({ serviceFailed: false });
    try {
      const res = await api.getServiceById(id);
      if (res.success) {
        this.setData({ service: res.data });
      } else {
        this.setData({ serviceFailed: true });
      }
    } catch (error) {
      console.error('加载服务失败:', error);
      this.setData({ serviceFailed: true });
    }
  },

  onRetryService() {
    if (!this.data.service && this.data.serviceFailed) this.loadService(this.data.serviceId);
  },

  async loadDefaultAddress() {
    try {
      const res = await api.getAddresses();
      if (res.success && res.data.length > 0) {
        const defaultAddress = res.data.find((addr) => addr.is_default === 1);
        this.applyAddress(defaultAddress || res.data[0]);
      }
    } catch (error) {
      console.error('加载地址失败:', error);
    }
  },

  applyAddress(address) {
    this.setData({
      selectedAddress: address,
      addressText: theme.joinAddress(address),
      contactName: address.contact_name || this.data.contactName,
      contactPhone: address.contact_phone || this.data.contactPhone
    });
  },

  onSelectAddress() {
    wx.navigateTo({
      url: '/pages/address/list?mode=select',
      events: {
        selectAddress: (data) => {
          this.applyAddress(data.address);
        }
      }
    });
  },

  onDateChange(e) {
    const dateValue = e.detail.value;
    const timeOptions = slots.availableSlots(dateValue);
    this.setData({
      dateValue,
      timeOptions,
      timeValue: slots.pickTime(dateValue, this.data.timeValue)
    });
  },

  onTimeChange(e) {
    this.setData({ timeValue: e.detail.value });
  },

  onNameInput(e) {
    this.setData({ contactName: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ contactPhone: e.detail.value });
  },

  onPriceInput(e) {
    this.setData({ 'form.expected_price': e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ 'form.remark': e.detail.value });
  },

  onChooseImage() {
    const remainCount = this.data.maxImages - this.data.form.images.length;
    if (remainCount <= 0) {
      wx.showToast({ title: '最多上传5张图片', icon: 'none' });
      return;
    }

    wx.chooseImage({
      count: remainCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          'form.images': [...this.data.form.images, ...res.tempFilePaths]
        });
      }
    });
  },

  onPreviewImage(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.url,
      urls: this.data.form.images
    });
  },

  onDeleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.form.images.filter((_, i) => i !== index);
    this.setData({ 'form.images': images });
  },

  validateForm() {
    const contactName = (this.data.contactName || '').trim();
    const contactPhone = (this.data.contactPhone || '').trim();

    if (!this.data.selectedAddress) {
      wx.showToast({ title: '请选择服务地址', icon: 'none' });
      return false;
    }
    if (!contactName) {
      wx.showToast({ title: '请输入联系人姓名', icon: 'none' });
      return false;
    }
    if (contactName.length > 20) {
      wx.showToast({ title: '姓名不能超过20个字符', icon: 'none' });
      return false;
    }
    if (!contactPhone) {
      wx.showToast({ title: '请输入联系电话', icon: 'none' });
      return false;
    }
    if (!PHONE_REGEX.test(contactPhone)) {
      wx.showToast({ title: '请输入正确的11位手机号', icon: 'none' });
      return false;
    }

    // 页面停留太久，选中的时段可能已经过去
    if (!slots.isSlotAvailable(this.data.dateValue, this.data.timeValue)) {
      const dateOptions = slots.buildDateOptions();
      const dateValue = dateOptions[0].value;
      const timeOptions = slots.availableSlots(dateValue);
      this.setData({
        dateOptions,
        dateValue,
        timeOptions,
        timeValue: timeOptions.length ? timeOptions[0].value : ''
      });
      wx.showToast({ title: '所选时段已过，请重新选择预约时间', icon: 'none' });
      return false;
    }

    const { expected_price } = this.data.form;
    if (expected_price && (isNaN(expected_price) || Number(expected_price) <= 0)) {
      wx.showToast({ title: '期望价格必须大于0', icon: 'none' });
      return false;
    }
    return true;
  },

  async onSubmit() {
    if (!this.validateForm() || this.submitting) return;
    this.submitting = true;
    await notifications.subscribe(['customer_assigned','work_completed','price_adjusted']);
    wx.showLoading({ title: '提交中...', mask: true });

    try {
      const slotText = `预约时间：${this.data.dateValue} ${this.data.timeValue}`;
      const remarkParts = [slotText, this.data.form.remark].filter(Boolean);

      // 先上传本地图片，再把服务器 URL 提交给后端
      let uploadedUrls = [];
      const localImages = this.data.form.images || [];
      if (localImages.length > 0) {
        wx.showLoading({ title: `上传图片 0/${localImages.length}`, mask: true });
        for (let i = 0; i < localImages.length; i++) {
          wx.showLoading({ title: `上传图片 ${i + 1}/${localImages.length}`, mask: true });
          const url = await upload(localImages[i]);
          uploadedUrls.push(url);
        }
        wx.showLoading({ title: '提交中...', mask: true });
      }

      const formData = {
        service_id: this.data.serviceId,
        address_id: this.data.selectedAddress.id,
        contact_name: this.data.contactName.trim(),
        contact_phone: this.data.contactPhone.trim(),
        remark: remarkParts.join('\n'),
        appointment_date: this.data.dateValue,
        appointment_slot: this.data.timeValue,
        images: uploadedUrls
      };

      if (this.data.form.expected_price) {
        formData.expected_price = Number(this.data.form.expected_price);
      }

      const res = await api.createOrder(formData);

      if (res.success) {
        wx.hideLoading();
        wx.showModal({
          title: '预约成功',
          content: `您的工单号：${res.data.order_no}\n客服将在30分钟内联系您确认`,
          showCancel: false,
          confirmText: '查看工单',
          success: (modalRes) => {
            if (modalRes.confirm) {
              wx.redirectTo({
                url: `/pages/orders/detail?id=${res.data.id}`
              });
            }
          }
        });
      }
    } catch (error) {
      console.error('提交预约失败:', error);
      wx.showToast({ title: error.message || '提交失败', icon: 'none' });
    } finally {
      this.submitting = false;
      wx.hideLoading();
    }
  }
});