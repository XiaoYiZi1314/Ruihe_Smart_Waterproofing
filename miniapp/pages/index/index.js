const auth = require('../../utils/auth');

Page({
  data: {
    // 轮播图数据
    banners: [
      {
        id: 1,
        image: 'https://picsum.photos/750/400?random=1',
        link: ''
      },
      {
        id: 2,
        image: 'https://picsum.photos/750/400?random=2',
        link: ''
      },
      {
        id: 3,
        image: 'https://picsum.photos/750/400?random=3',
        link: ''
      }
    ],

    // 服务项目数据
    services: [
      {
        id: 1,
        name: '屋顶防水',
        price: '500-1000',
        image: 'https://picsum.photos/300/300?random=11',
        desc: '专业屋顶防水施工'
      },
      {
        id: 2,
        name: '卫生间防水',
        price: '300-800',
        image: 'https://picsum.photos/300/300?random=12',
        desc: '卫生间防水补漏'
      },
      {
        id: 3,
        name: '阳台防水',
        price: '200-600',
        image: 'https://picsum.photos/300/300?random=13',
        desc: '阳台防水处理'
      },
      {
        id: 4,
        name: '外墙防水',
        price: '800-2000',
        image: 'https://picsum.photos/300/300?random=14',
        desc: '外墙防水工程'
      },
      {
        id: 5,
        name: '地下室防水',
        price: '1000-3000',
        image: 'https://picsum.photos/300/300?random=15',
        desc: '地下室防潮处理'
      },
      {
        id: 6,
        name: '水池防水',
        price: '600-1500',
        image: 'https://picsum.photos/300/300?random=16',
        desc: '水池防水施工'
      }
    ],

    // 联系方式
    contact: {
      address: '北京市朝阳区某某街道123号',
      phone: '400-123-4567',
      hours: '周一至周日 8:00-18:00',
      wechat: 'ruihe_waterproof'
    },

    // 关于我们
    aboutUs: '瑞和防水是一家专业从事防水施工的企业，拥有10年以上行业经验。我们提供屋顶防水、卫生间防水、外墙防水等全方位防水解决方案。公司拥有专业的施工团队和先进的施工工艺，为客户提供优质、高效的防水服务。',

    // 加盟信息
    joinInfo: {
      description: '诚邀全国各地优质防水施工团队加盟合作',
      phone: '400-123-4567',
      benefits: ['品牌支持', '技术培训', '订单共享', '售后保障']
    }
  },

  onLoad() {
    // 检查登录状态
    if (!auth.checkLogin()) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }
  },

  onShow() {
    // 页面显示时更新用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({
        userInfo: userInfo
      });
    }
  },

  /**
   * 轮播图点击事件
   */
  onBannerTap(e) {
    const link = e.currentTarget.dataset.link;
    if (link) {
      wx.navigateTo({ url: link });
    } else {
      wx.showToast({
        title: '功能开发中',
        icon: 'none'
      });
    }
  },

  /**
   * 服务项目点击事件
   */
  onServiceTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({
      title: '服务详情页开发中',
      icon: 'none'
    });
    // 后续可跳转到服务详情页
    // wx.navigateTo({
    //   url: `/pages/service/detail?id=${id}`
    // });
  },

  /**
   * 拨打电话
   */
  onCallPhone() {
    wx.makePhoneCall({
      phoneNumber: this.data.contact.phone
    });
  },

  /**
   * 复制微信号
   */
  onCopyWechat() {
    wx.setClipboardData({
      data: this.data.contact.wechat,
      success: () => {
        wx.showToast({
          title: '微信号已复制',
          icon: 'success'
        });
      }
    });
  }
});
