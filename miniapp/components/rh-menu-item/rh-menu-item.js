Component({
  properties: {
    icon: { type: String, value: 'info' },
    title: { type: String, value: '' },
    gradient: { type: String, value: 'linear-gradient(135deg, #1A5CFF, #2B7BE4)' },
    badge: { type: Number, value: 0 }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap');
    }
  }
});