Component({
  properties: {
    title: { type: String, value: '' },
    more: { type: String, value: '' }
  },
  methods: {
    onMore() {
      this.triggerEvent('more');
    }
  }
});