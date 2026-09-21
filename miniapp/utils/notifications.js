let config = {};
function loadConfig() {
  return new Promise(resolve => {
    wx.request({ url: getApp().globalData.apiBaseUrl + '/api/config', timeout: 10000, success: res => {
      if (res.statusCode === 200 && res.data && res.data.success) config = res.data.data;
    }, complete: () => resolve(config) });
  });
}
// Preload on page entry; keep this API call in the user tap to preserve authorization eligibility.
function subscribe(keys) {
  const templates = config.subscription_templates || {};
  const tmplIds = Array.from(new Set(keys.map(key => templates[key]).filter(Boolean))).slice(0, 3);
  if (!tmplIds.length || !wx.requestSubscribeMessage) return Promise.resolve(false);
  return new Promise(resolve => wx.requestSubscribeMessage({ tmplIds, success: result => resolve(tmplIds.some(id => result[id] === 'accept')), fail: () => resolve(false) }));
}
async function callService() {
  if (!config.contact_info) await loadConfig();
  const contact = config.contact_info || {};
  if (!contact.phone && !contact.mobile) return wx.showToast({ title: '暂无联系电话', icon: 'none' });
  wx.makePhoneCall({ phoneNumber: contact.phone || contact.mobile });
}
module.exports = { loadConfig, subscribe, callService };
