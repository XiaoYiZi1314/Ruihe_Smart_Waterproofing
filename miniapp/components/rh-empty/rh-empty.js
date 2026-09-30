Component({
  properties: {
    text: { type: String, value: '暂无数据' },
    icon: { type: String, value: 'empty' },
    // 传入 actionText 会显示一个按钮（重试/去登录），点击触发 action 事件
    actionText: { type: String, value: '' }
  },
  methods: {
    onAction() {
      this.triggerEvent('action');
    }
  }
});