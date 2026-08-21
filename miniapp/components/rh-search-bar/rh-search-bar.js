Component({
  properties: {
    placeholder: { type: String, value: '搜索防水服务...' },
    value: { type: String, value: '' },
    disabled: { type: Boolean, value: false },
    gutter: { type: Boolean, value: true }
  },
  methods: {
    onInput(e) {
      this.triggerEvent('input', { value: e.detail.value });
    },
    onConfirm(e) {
      this.triggerEvent('confirm', { value: e.detail.value });
    },
    onTap() {
      this.triggerEvent('tap');
    }
  }
});