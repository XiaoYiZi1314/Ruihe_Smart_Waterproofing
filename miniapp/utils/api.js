const request = require('./request');

/**
 * API 接口
 */
const api = {
  // ========== 认证接口 ==========

  /**
   * 微信登录
   */
  login(code) {
    return request.post('/api/auth/login', { code });
  },

  /**
   * 修改个人资料：{ nickname?, avatar_url? }（师傅仅可修改头像）
   */
  updateProfile(data) {
    return request.put('/api/auth/profile', data);
  },

  /**
   * 获取当前用户信息
   */
  getUserInfo() {
    return request.get('/api/auth/me');
  },

  // ========== 轮播图接口 ==========

  /**
   * 获取轮播图列表
   */
  getBanners() {
    return request.get('/api/banners');
  },

  // ========== 服务分类接口 ==========

  /**
   * 获取服务分类列表
   */
  getCategories() {
    return request.get('/api/categories');
  },

  // ========== 服务项目接口 ==========

  /**
   * 获取服务列表
   * @param {Object} params - 查询参数
   * @param {number} params.category_id - 分类ID
   * @param {number} params.is_hot - 是否热门
   * @param {number} params.page - 页码
   * @param {number} params.limit - 每页数量
   */
  getServices(params = {}) {
    const query = Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== null)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    return request.get(`/api/services${query ? '?' + query : ''}`);
  },

  /**
   * 获取服务详情
   */
  getServiceById(id) {
    return request.get(`/api/services/${id}`);
  },

  // ========== 地址接口 ==========

  /**
   * 获取地址列表
   */
  getAddresses() {
    return request.get('/api/addresses');
  },

  /**
   * 获取单个地址
   */
  getAddressById(id) {
    return request.get(`/api/addresses/${id}`);
  },

  /**
   * 创建地址
   */
  createAddress(data) {
    return request.post('/api/addresses', data);
  },

  /**
   * 更新地址
   */
  updateAddress(id, data) {
    return request.put(`/api/addresses/${id}`, data);
  },

  /**
   * 设置默认地址
   */
  setDefaultAddress(id) {
    return request.put(`/api/addresses/${id}/set-default`);
  },

  /**
   * 删除地址
   */
  deleteAddress(id) {
    return request.delete(`/api/addresses/${id}`);
  },

  // ========== 工单接口 ==========

  /**
   * 创建工单
   */
  createOrder(data) {
    return request.post('/api/orders', data);
  },

  /**
   * 获取工单列表
   */
  getOrders(params = {}) {
    const query = Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== null)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    return request.get(`/api/orders${query ? '?' + query : ''}`);
  },

  /**
   * 获取工单详情
   */
  getOrderById(id) {
    return request.get(`/api/orders/${id}`);
  },

  /**
   * 取消工单
   */
  cancelOrder(id) {
    return request.put(`/api/orders/${id}/cancel`);
  },

  /**
   * 催单
   */
  urgeOrder(id) {
    return request.put(`/api/orders/${id}/urge`);
  },

  /**
   * 确认完成（验收）
   */
  confirmOrder(id) {
    return request.put(`/api/orders/${id}/confirm`);
  },

  /**
   * 提交价格异议
   */
  disputePrice(id, reason) {
    return request.put(`/api/orders/${id}/dispute-price`, { reason });
  },

  /**
   * 提交评价
   */
  submitReview(id, review) {
    return request.post(`/api/orders/${id}/review`, review);
  },

  /**
   * 删除评价
   */
  deleteReview(id) {
    return request.delete(`/api/orders/${id}/review`);
  },

  // ========== 站点配置接口 ==========

  /**
   * 获取站点配置
   */
  getConfig() {
    return request.get('/api/config');
  }
};

module.exports = api;
