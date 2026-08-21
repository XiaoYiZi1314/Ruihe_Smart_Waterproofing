const api = require('../../utils/api');

Page({
  data: {
    id: null, // 地址ID，编辑时有值
    form: {
      contact_name: '',
      contact_phone: '',
      province: '',
      city: '',
      district: '',
      detail_address: '',
      is_default: false
    },
    region: ['', '', '']
  },

  onLoad(options) {
    const { id } = options;

    if (id) {
      this.setData({ id });
      wx.setNavigationBarTitle({ title: '编辑地址' });
      this.loadAddress(id);
    } else {
      wx.setNavigationBarTitle({ title: '新增地址' });
    }
  },

  /**
   * 加载地址详情
   */
  async loadAddress(id) {
    wx.showLoading({ title: '加载中...' });

    try {
      const res = await api.getAddressById(id);

      if (res.success) {
        const address = res.data;
        this.setData({
          form: {
            contact_name: address.contact_name,
            contact_phone: address.contact_phone,
            province: address.province || '',
            city: address.city || '',
            district: address.district || '',
            detail_address: address.detail_address,
            is_default: address.is_default === 1
          },
          region: [address.province || '', address.city || '', address.district || '']
        });
      }
    } catch (error) {
      console.error('加载地址失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 输入联系人姓名
   */
  onNameInput(e) {
    this.setData({
      'form.contact_name': e.detail.value
    });
  },

  /**
   * 输入联系电话
   */
  onPhoneInput(e) {
    this.setData({
      'form.contact_phone': e.detail.value
    });
  },

  /**
   * 选择省市区
   */
  onRegionChange(e) {
    const region = e.detail.value;
    this.setData({
      region,
      'form.province': region[0],
      'form.city': region[1],
      'form.district': region[2]
    });
  },

  /**
   * 输入详细地址
   */
  onDetailInput(e) {
    this.setData({
      'form.detail_address': e.detail.value
    });
  },

  /**
   * 切换默认地址
   */
  onDefaultChange(e) {
    this.setData({
      'form.is_default': e.detail.value
    });
  },

  /**
   * 表单验证
   */
  validateForm() {
    const { contact_name, contact_phone, province, detail_address } = this.data.form;

    if (!contact_name || contact_name.trim() === '') {
      wx.showToast({
        title: '请输入联系人姓名',
        icon: 'none'
      });
      return false;
    }

    if (contact_name.length > 20) {
      wx.showToast({
        title: '姓名不能超过20个字符',
        icon: 'none'
      });
      return false;
    }

    if (!contact_phone || contact_phone.trim() === '') {
      wx.showToast({
        title: '请输入联系电话',
        icon: 'none'
      });
      return false;
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(contact_phone)) {
      wx.showToast({
        title: '手机号格式不正确',
        icon: 'none'
      });
      return false;
    }

    if (!province) {
      wx.showToast({
        title: '请选择省市区',
        icon: 'none'
      });
      return false;
    }

    if (!detail_address || detail_address.trim() === '') {
      wx.showToast({
        title: '请输入详细地址',
        icon: 'none'
      });
      return false;
    }

    if (detail_address.length < 5) {
      wx.showToast({
        title: '详细地址至少5个字符',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  /**
   * 保存地址
   */
  async onSave() {
    if (!this.validateForm()) {
      return;
    }

    wx.showLoading({ title: '保存中...' });

    try {
      const formData = {
        ...this.data.form,
        is_default: this.data.form.is_default ? 1 : 0
      };

      let res;
      if (this.data.id) {
        // 更新地址
        res = await api.updateAddress(this.data.id, formData);
      } else {
        // 创建地址
        res = await api.createAddress(formData);
      }

      if (res.success) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });

        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    } catch (error) {
      console.error('保存地址失败:', error);
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  }
});
