Component({
  properties: {
    items: { type: Array, value: [] },
    activeKey: { type: null, value: null }
  },
  methods: {
    onTap(e) {
      const { key } = e.currentTarget.dataset;
      if (key === this.data.activeKey) return;
      this.triggerEvent('change', { key });
    }
  }
});