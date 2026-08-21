const api = require('../../utils/api');
const theme = require('../../utils/theme');

function buildDateOptions() {
  const labels = ['今天', '明天'];
  const options = [];
  const now = new Date();
  for (let i = 0; i < 5; i += 1) {
    const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    options.push({
      value: `${date.getFullYear()}-${month}-${day}`,
      label: labels[i] || `${month}-${day}`
    });
  }
  return options;
}

Page({
  data: {
    serviceId: null,
    service: null,
    selectedAddress: null,
    addressText: '',
    contactName: '',
    contactPhone: '',
    dateOptions: [],
    timeOptions: [
      { value: '上午 08-12', label: '上午 08-12' },
      { value: '下午 13-18', label: '下午 13-18' },
      { value: '晚上 18-20', label: '晚上 18-20' }
    ],
    dateValue: '',
    timeValue: '上午 08-12',
    form: {
      expected_price: '',
      remark: '',
      images: []
    },
    maxImages: 5
  },

  onLoad(options) {
    const { serviceId } = options;
    const dateOptions = buildDateOptions();

    if (!serviceId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({
      serviceId,
      dateOptions,
      dateValue: dateOptions[0].value
    });
    this.loadService(serviceId);
    this.loadDefaultAddress();
  },

  async loadService(id) {
    try {
      const res = await api.getServiceById(id);
      if (res.success) {
        this.setData({ service: res.data });
      }
    } catch (error) {
      console.error('加载服务失败:', error);
    }
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
    this.setData({ dateValue: e.detail.value });
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
    if (!this.data.selectedAddress) {
      wx.showToast({ title: '请选择服务地址', icon: 'none' });
      return false;
    }
    if (!this.data.contactName) {
      wx.showToast({ title: '请输入联系人姓名', icon: 'none' });
      return false;
    }
    if (!this.data.contactPhone) {
      wx.showToast({ title: '请输入联系电话', icon: 'none' });
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
    if (!this.validateForm()) return;

    wx.showLoading({ title: '提交中...' });

    try {
      const slotText = `预约时间：${this.data.dateValue} ${this.data.timeValue}`;
      const remarkParts = [slotText, this.data.form.remark].filter(Boolean);

      const formData = {
        service_id: this.data.serviceId,
        address_id: this.data.selectedAddress.id,
        remark: remarkParts.join('\n'),
        images: this.data.form.images
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
      wx.hideLoading();
    }
  }
});