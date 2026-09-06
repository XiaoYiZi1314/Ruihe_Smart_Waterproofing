/**
 * 师傅端工单状态工具
 * 状态文案、标签样式、操作按钮
 */

const STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  PENDING_REVIEW: 'pending_review',
  PRICE_NEGOTIATING: 'price_negotiating',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const STATUS_TEXT = {
  [STATUS.PENDING]: '待指派',
  [STATUS.CONFIRMED]: '待接单',
  [STATUS.IN_PROGRESS]: '施工中',
  [STATUS.PENDING_REVIEW]: '待验收',
  [STATUS.PRICE_NEGOTIATING]: '价格协商',
  [STATUS.COMPLETED]: '已完成',
  [STATUS.CANCELLED]: '已取消'
};

const STATUS_CLASS = {
  [STATUS.PENDING]: 'status-pending',
  [STATUS.CONFIRMED]: 'status-confirmed',
  [STATUS.IN_PROGRESS]: 'status-in-progress',
  [STATUS.PENDING_REVIEW]: 'status-pending-review',
  [STATUS.PRICE_NEGOTIATING]: 'status-negotiating',
  [STATUS.COMPLETED]: 'status-completed',
  [STATUS.CANCELLED]: 'status-cancelled'
};

/**
 * 获取状态文案
 */
function getStatusText(status) {
  return STATUS_TEXT[status] || status || '';
}

/**
 * 获取状态样式类名
 */
function getStatusClass(status) {
  return STATUS_CLASS[status] || 'status-pending';
}

/**
 * 格式化价格为显示字符串
 */
function formatPrice(price) {
  if (price === null || price === undefined || price === '') return '待报价';
  return `¥${parseFloat(price).toFixed(2)}`;
}

/**
 * 格式化时间
 */
function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(/-/g, '/'));
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 手机号脱敏（用于展示）
 */
function maskPhone(phone) {
  if (!phone || phone.length < 11) return phone || '';
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

module.exports = {
  STATUS,
  STATUS_TEXT,
  STATUS_CLASS,
  getStatusText,
  getStatusClass,
  formatPrice,
  formatTime,
  maskPhone
};
