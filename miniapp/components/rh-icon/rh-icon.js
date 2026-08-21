Component({
  properties: {
    name: { type: String, value: 'info' },
    tone: { type: String, value: 'gray' },
    size: { type: Number, value: 32 }
  },
  data: {
    src: ''
  },
  observers: {
    'name, tone': function (name, tone) {
      this.updateSrc(name, tone);
    }
  },
  lifetimes: {
    attached() {
      this.updateSrc(this.data.name, this.data.tone);
    }
  },
  methods: {
    updateSrc(name, tone) {
      const suffix = !tone || tone === 'gray' ? '' : `-${tone}`;
      this.setData({
        src: `/assets/icons/${name}${suffix}.png`
      });
    }
  }
});