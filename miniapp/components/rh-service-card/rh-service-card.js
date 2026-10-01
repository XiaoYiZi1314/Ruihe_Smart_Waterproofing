const theme = require('../../utils/theme');

Component({
  properties: {
    service: { type: Object, value: {} },
    showBook: { type: Boolean, value: true }
  },
  data: {
    view: {
      name: '',
      desc: '',
      cover: '',
      gradient: '',
      priceMain: '',
      priceSuffix: ''
    }
  },
  observers: {
    service(service) {
      const item = service || {};
      const price = theme.formatPrice(item.price_min, item.price_max, item.price_unit);
      this.setData({
        view: {
          name: item.name || '',
          desc: item.description || '',
          cover: item.cover_image || '',
          gradient: theme.coverGradient(item.id || item.name),
          priceMain: price.main,
          priceSuffix: price.suffix
        }
      });
    }
  },
  methods: {
    onTap() {
      this.triggerEvent('select', { service: this.data.service });
    },
    onBook() {
      this.triggerEvent('book', { service: this.data.service });
    }
  }
});