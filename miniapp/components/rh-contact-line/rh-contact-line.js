Component({
  properties: {
    icon: { type: String, value: 'phone' },
    title: { type: String, value: '' },
    subtitle: { type: String, value: '' }
  },
  methods: {
    onTap() {
      this.triggerEvent('select');
    }
  }
});