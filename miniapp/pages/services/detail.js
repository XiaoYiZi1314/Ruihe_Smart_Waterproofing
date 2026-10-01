const api = require('../../utils/api');
const theme = require('../../utils/theme');
const auth = require('../../utils/auth');
const { isValidId } = require('../../utils/id');
const { isDefinitiveLoadError } = require('../../utils/detail-load');

/**
 * 用户昵称脱敏：张三 → 张**
 */
function maskName(name) {
  if (!name) return '匿名用户';
  if (name.length <= 1) return name + '**';
  if (name.length === 2) return name[0] + '*';
  return name[0] + '**' + name[name.length - 1];
}

/**
 * 日期格式化：2026-08-28
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function loadErrorText(error, fallback) {
  if (error && error.type === 'network') return '网络不佳，加载失败';
  if (error && (error.type === 'session' || error.statusCode === 401)) return error.message || '请重新登录';
  if (error && error.statusCode === 400) return '参数错误';
  if (error && error.statusCode === 403) return fallback.forbidden;
  if (error && error.statusCode === 404) return fallback.notFound;
  if (error && error.statusCode >= 500) return '服务暂时不可用，请稍后重试';
  return '网络不佳，加载失败';
}

Page({
  data: {
    service: null,
    loading: true,
    loadFailed: false,
    loadErrorText: '网络不佳，加载失败',
    bannerImages: [],
    currentBannerIndex: 0,
    bannerGradient: '',
    priceMain: '',
    priceSuffix: '',
    highlights: ['质保5年', '免费勘测', '签约施工'],
    reviews: [],
    reviewStats: null,
    reviewStars: [1, 2, 3, 4, 5]
  },

  onLoad(options = {}) {
    const { id } = options;
    if (isValidId(id)) {
      this.serviceId = id;
      this.loadServiceDetail(id);
    } else {
      this.setData({ loading: false, loadFailed: true, loadErrorText: '参数错误' });
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  onUnload() {
    this._unloaded = true;
    this._requestId = (this._requestId || 0) + 1;
  },

  onPullDownRefresh() {
    if (!this.serviceId) return wx.stopPullDownRefresh();
    return this.loadServiceDetail(this.serviceId).then(() => wx.stopPullDownRefresh());
  },

  onRetryLoad() {
    if (this.serviceId) this.loadServiceDetail(this.serviceId);
  },

  async loadServiceDetail(id) {
    if (this._unloaded) return;
    if (!isValidId(id)) {
      this.setData({ loading: false, loadFailed: true, loadErrorText: '参数错误' });
      return;
    }
    const requestId = this._requestId = (this._requestId || 0) + 1;
    // 首次加载显示骨架屏；已有内容时静默刷新
    if (!this.data.service) this.setData({ loading: true, loadFailed: false });
    try {
      const res = await api.getServiceById(id);
      // A definitive rejection invalidates its older reads, even while a retry is pending.
      if (this._unloaded || requestId <= (this._rejectedThroughRequestId || 0) ||
          (requestId !== this._requestId && this.data.service)) return;
      if (res.success && res.data) {
        const service = res.data;
        const price = theme.formatPrice(service.price_min, service.price_max, service.price_unit);
        
        // 构建图片轮播数组：封面图 + 详情图片
        const bannerImages = [];
        if (service.cover_image) {
          bannerImages.push(service.cover_image);
        }
        if (service.images && Array.isArray(service.images)) {
          bannerImages.push(...service.images);
        }
        
        this.setData({
          service,
          loading: false,
          loadFailed: false,
          loadErrorText: '网络不佳，加载失败',
          bannerImages,
          bannerGradient: theme.coverGradient(service.id || service.name),
          priceMain: price.main,
          priceSuffix: price.suffix ? `${price.suffix} · 参考价格` : '参考价格',
          highlights: service.tags && service.tags.length
            ? service.tags
            : ['质保5年', '免费勘测', '签约施工'],
          reviews: (service.reviews || []).map((r) => ({
            ...r,
            maskedName: maskName(r.user_name),
            dateText: formatDate(r.created_at),
            images: (r.images || []).map((img) => ({
              ...img,
              key: img.id != null ? String(img.id) : String(img.image_url || '').split('?')[0]
            })),
            avgScore: (
              ((r.service_attitude_score || 0) + (r.quality_score || 0) + (r.price_score || 0)) /
              3
            ).toFixed(1)
          })),
          reviewStats: service.review_stats
        });
        return;
      }
      if (requestId === this._requestId) {
        this._rejectedThroughRequestId = requestId;
        this.setData({
          service: null,
          loading: false,
          loadFailed: true,
          loadErrorText: res.message || '服务暂时不可用，请稍后重试'
        });
      }
    } catch (error) {
      if (this._unloaded || requestId !== this._requestId) return;
      console.error('加载服务详情失败:', error);
      const definitive = isDefinitiveLoadError(error);
      if (definitive) this._rejectedThroughRequestId = requestId;
      // Keep loaded content on transient failures, but remove it on a business/session rejection.
      if (definitive || !this.data.service) {
        this.setData({
          service: null,
          loading: false,
          loadFailed: true,
          loadErrorText: loadErrorText(error, {
            forbidden: '暂无权限查看此服务',
            notFound: '服务已下架或不存在'
          })
        });
      }
    }
  },

  onBannerChange(e) {
    this.setData({
      currentBannerIndex: e.detail.current
    });
  },

  onPreviewImage(e) {
    const current = e.currentTarget.dataset.url;
    wx.previewImage({
      current,
      urls: this.data.bannerImages
    });
  },

  // 点击评价里的图片：在该条评价的图片集合内左右滑动预览
  onPreviewReviewImage(e) {
    const { review, url } = e.currentTarget.dataset;
    const item = this.data.reviews[Number(review)];
    const urls = ((item && item.images) || []).map((img) => img.image_url);
    wx.previewImage({ current: url, urls: urls.length ? urls : [url] });
  },

  onConsult() {
    require('../../utils/notifications').callService();
  },

  onBook() {
    const service = this.data.service;
    if (!service) return;
    const url = `/pages/booking/create?serviceId=${service.id}`;
    if (!auth.requireLogin(url)) return;
    wx.navigateTo({ url });
  },

  onShareAppMessage() {
    const service = this.data.service;
    const id = service ? service.id : this.serviceId;
    return {
      title: service ? service.name : '瑞和防水',
      path: id ? `/pages/services/detail?id=${id}` : '/pages/index/index',
      imageUrl: service && service.cover_image ? service.cover_image : ''
    };
  }
});