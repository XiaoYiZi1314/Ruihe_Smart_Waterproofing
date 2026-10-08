Component({
  properties: {
    icon: { type: String, value: 'phone' },
    title: { type: String, value: '' },
    subtitle: { type: String, value: '' },
    align: { type: String, value: 'center' }
  },
  methods: {
    onTap() {
      this.triggerEvent('select');
    }
  }
});