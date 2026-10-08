Component({
  properties: {
    active: { type: String, value: 'orders' }
  },
  data: {
    items: [
      {
        key: 'orders',
        label: '工作台',
        icon: '/assets/tabbar/order.png',
        iconOn: '/assets/tabbar/order-active.png'
      },
      {
        key: 'profile',
        label: '我的',
        icon: '/assets/tabbar/me.png',
        iconOn: '/assets/tabbar/me-active.png'
      }
    ]
  },
  methods: {
    onTap(e) {
      const { key } = e.currentTarget.dataset;
      if (key === this.data.active) return;
      this.triggerEvent('change', { key });
    }
  }
});
