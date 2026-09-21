const COVER_MAP = { '卫生间': '/assets/services/bathroom.jpg', '阳台': '/assets/services/balcony.jpg', '屋顶': '/assets/services/roof.jpg', '地下室': '/assets/services/basement.jpg', '定制': '/assets/services/custom.jpg' };
function resourceUrl(value) {
  if (typeof value !== 'string') return value;
  if (value.indexOf('/uploads/') === 0 || value.indexOf('/api/upload/file/') === 0) return getApp().globalData.apiBaseUrl + value;
  return value;
}
function normalizeResources(value, key) {
  if (Array.isArray(value)) return value.map(item => normalizeResources(item, key));
  if (value && typeof value === 'object') {
    const result = {};
    Object.keys(value).forEach(name => { result[name] = normalizeResources(value[name], name); });
    return result;
  }
  return ['image_url','cover_image','service_cover','service_image','avatar_url','video_url','images'].includes(key) ? resourceUrl(value) : value;
}
function addRealCovers(services) {
  return services.map(service => {
    if (service.cover_image && !service.cover_image.includes('placeholder')) return service;
    const keyword = Object.keys(COVER_MAP).find(key => (service.name || '').includes(key));
    return { ...service, cover_image: keyword ? COVER_MAP[keyword] : '' };
  });
}
module.exports = { resourceUrl, normalizeResources, addRealCovers };
