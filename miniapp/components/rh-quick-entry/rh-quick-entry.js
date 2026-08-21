Component({
  properties: {
    items: {
      type: Array,
      value: [
        {
          key: 'service',
          label: '预约服务',
          icon: 'calendar',
          gradient: 'linear-gradient(135deg, #1A5CFF, #2B7BE4)'
        },
        {
          key: 'order',
          label: '工单查询',
          icon: 'document',
          gradient: 'linear-gradient(135deg, #2B7BE4, #5B9AF5)'
        },
        {
          key: 'consult',
          label: '在线咨询',
          icon: 'chat',
          gradient: 'linear-gradient(135deg, #5B9AF5, #7DB5FF)'
        },
        {
          key: 'about',
          label: '关于我们',
          icon: 'info',
          gradient: 'linear-gradient(135deg, #1A5CFF, #5B9AF5)'
        }
      ]
    }
  },
  methods: {
    onTap(e) {
      this.triggerEvent('tap', { key: e.currentTarget.dataset.key });
    }
  }
});