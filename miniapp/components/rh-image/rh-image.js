/**
 * rh-image：带占位、渐显、失败重试的图片组件。
 *
 * 关键点：后端私有图片每次接口返回都会重新签名（?expires=&signature=），
 * 同一张图的地址每次都不同。这里按“去掉查询串后的地址”判断是否同一张图，
 * 已经加载成功的图片不会因为签名变化而重新加载，避免页面刷新时图片闪烁。
 */
function baseOf(url) {
  return String(url || '').split('?')[0];
}

Component({
  properties: {
    src: { type: String, value: '' },
    mode: { type: String, value: 'aspectFill' },
    lazy: { type: Boolean, value: true }
  },
  data: {
    realSrc: '',
    status: 'empty' // empty | loading | loaded | error
  },
  observers: {
    src(src) {
      this.applySrc(src);
    }
  },
  lifetimes: {
    attached() {
      this.applySrc(this.data.src);
    }
  },
  methods: {
    applySrc(src) {
      const { realSrc, status } = this.data;
      if (!src) {
        if (realSrc || status !== 'empty') this.setData({ realSrc: '', status: 'empty' });
        return;
      }
      // 同一张图仅签名参数变化：已加载成功就保持不动
      if (realSrc && status === 'loaded' && baseOf(src) === baseOf(realSrc)) return;
      if (realSrc === src && status !== 'error') return;
      this.setData({ realSrc: src, status: 'loading' });
    },

    onLoad() {
      if (this.data.status !== 'loaded') this.setData({ status: 'loaded' });
      this.triggerEvent('load');
    },

    onError() {
      this.setData({ status: 'error' });
      this.triggerEvent('error', { src: this.data.realSrc });
    },

    onRetry() {
      const src = this.data.src;
      if (!src) return;
      this.setData({ realSrc: '', status: 'loading' });
      setTimeout(() => this.setData({ realSrc: src }), 0);
      // 通知页面：签名可能已过期，必要时重新拉取数据
      this.triggerEvent('retry', { src });
    }
  }
});
