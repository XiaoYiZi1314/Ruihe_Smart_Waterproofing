Component({
  properties: {
    options: { type: Array, value: [] },
    value: { type: null, value: null }
  },
  methods: {
    onTap(e) {
      const { value } = e.currentTarget.dataset;
      this.triggerEvent('change', { value });
    }
  }
});