Component({
  properties: {
    icon: { type: String, value: 'info' },
    title: { type: String, value: '' },
    gradient: { type: String, value: 'var(--gradient-brand)' },
    badge: { type: Number, value: 0 }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap');
    }
  }
});