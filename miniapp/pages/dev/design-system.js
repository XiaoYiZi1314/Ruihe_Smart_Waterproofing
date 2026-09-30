const theme = require('../../utils/theme');

const DEMO_SERVICE = {
  id: 1,
  name: '屋顶防水施工',
  description: 'SBS卷材+聚氨酯涂层 双重防水工艺',
  price_min: '80.00',
  price_max: '150.00',
  price_unit: '元/平米'
};

const DEMO_ORDER = {
  id: 1,
  order_no: 'RH2026080700001',
  status: 'confirmed',
  worker_name: '测试师傅',
  worker_phone: '13800138000',
  service_name: '屋顶防水施工',
  created_at: '2026-08-09 上午 08-12',
  full_address: '上海市闵行区虹桥商务区·瑞和大厦16楼'
};

Page({
  data: {
    colors: [
      { name: 'primary', value: '#1A5CFF' },
      { name: 'brand', value: '#2B7BE4' },
      { name: 'light', value: '#5B9AF5' },
      { name: 'orange', value: '#FAAD14' },
      { name: 'green', value: '#52C41A' },
      { name: 'gray', value: '#9CA3AF' },
      { name: 'red', value: '#F5222D' },
      { name: 'bg', value: '#F4F6FA' }
    ],
    fonts: [
      { name: '标题 17', size: '34rpx', weight: 600, sample: '瑞和智慧' },
      { name: '标题 16', size: '32rpx', weight: 600, sample: '专业防水堵漏服务' },
      { name: '正文 14', size: '28rpx', weight: 400, sample: '提交后生成待确认工单' },
      { name: '辅助 12.5', size: '25rpx', weight: 400, sample: '全国服务热线 · 7×24小时' },
      { name: '标签 11', size: '22rpx', weight: 500, sample: '待确认' }
    ],
    tags: [
      { key: 'all', label: '全部' },
      { key: 'roof', label: '屋顶防水' },
      { key: 'bath', label: '卫生间堵漏' }
    ],
    activeTag: 'all',
    slots: [
      { value: 'am', label: '上午 08-12' },
      { value: 'pm', label: '下午 13-18' },
      { value: 'night', label: '晚上 18-20' }
    ],
    slotValue: 'am',
    demoService: DEMO_SERVICE,
    demoOrder: DEMO_ORDER,
    demoTimeline: [
      { key: 'created_at', label: '提交预约', time: '08-09 10:00', current: false },
      { key: 'assigned_at', label: '已指派师傅', time: '08-09 10:20', current: false },
      { key: 'confirmed_at', label: '师傅已接单', time: '08-09 11:00', current: true }
    ]
  },

  onLoad() {
    if (!theme.isDevEnv()) {
      wx.showToast({ title: '仅开发环境可用', icon: 'none' });
      setTimeout(() => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) }), 800);
    }
  },

  onTagChange(e) {
    this.setData({ activeTag: e.detail.key });
  },

  onSlotChange(e) {
    this.setData({ slotValue: e.detail.value });
  },

  onDemoTap() {
    wx.showToast({ title: '组件事件已触发', icon: 'none' });
  }
});