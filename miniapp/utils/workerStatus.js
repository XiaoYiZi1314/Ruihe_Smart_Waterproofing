const { getStatusText: getCustomerStatusText, getStatusMeta } = require('./status');
const theme = require('./theme');
const STATUS = {
  PENDING: 'pending', CONFIRMED: 'confirmed', IN_PROGRESS: 'in_progress',
  PENDING_REVIEW: 'pending_review', PRICE_NEGOTIATING: 'price_negotiating',
  COMPLETED: 'completed', CANCELLED: 'cancelled'
};

const WORKER_STATUS = {
  pending: { text: '待确认', tagClass: 'pending' },
  confirmed: { text: '待接单', tagClass: 'confirmed' },
  in_progress: { text: '施工中', tagClass: 'doing' },
  pending_review: { text: '待验收', tagClass: 'review' },
  waiting_acceptance: { text: '待验收', tagClass: 'review' },
  price_negotiating: { text: '价格协商', tagClass: 'pending' },
  negotiating: { text: '价格协商', tagClass: 'pending' },
  completed: { text: '已完成', tagClass: 'done' },
  cancelled: { text: '已取消', tagClass: 'cancel' }
};

function getWorkerStatusMeta(status) {
  return WORKER_STATUS[status] || {
    text: getCustomerStatusText(status),
    tagClass: getStatusMeta(status).tagClass
  };
}

function getStatusText(status) {
  return getWorkerStatusMeta(status).text;
}

function getStatusClass(status) {
  return getWorkerStatusMeta(status).tagClass;
}

function canCallCustomer(order) {
  const status = order && order.status;
  return !!status && status !== STATUS.COMPLETED && status !== STATUS.CANCELLED;
}

function formatPrice(price) {
  return price == null || price === '' ? '待报价' : theme.formatPrice(Number(price).toFixed(2)).main;
}
function formatTime(value) {
  return theme.formatTime(value);
}
module.exports = { STATUS, getStatusText, getStatusClass, canCallCustomer,
  formatPrice, formatTime, maskPhone: theme.maskPhone };
