Component({
  options: {
    multipleSlots: true,
    virtualHost: true
  },
  properties: {
    variant: { type: String, value: 'brand' },
    size: { type: String, value: 'md' },
    block: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
    text: { type: String, value: '' }
  },
  methods: {
    onTap() {
      if (this.data.disabled || this.data.loading) return;
      this.triggerEvent('tap', {}, { bubbles: false, composed: false });
    }
  }
});