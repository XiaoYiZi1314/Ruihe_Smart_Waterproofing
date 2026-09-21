const { getStatusText, getStatusMeta } = require('./status');
const theme = require('./theme');
const STATUS = {
  PENDING: 'pending', CONFIRMED: 'confirmed', IN_PROGRESS: 'in_progress',
  PENDING_REVIEW: 'pending_review', PRICE_NEGOTIATING: 'price_negotiating',
  COMPLETED: 'completed', CANCELLED: 'cancelled'
};
function formatPrice(price) {
  return price == null || price === '' ? '待报价' : theme.formatPrice(Number(price).toFixed(2)).main;
}
function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
module.exports = { STATUS, getStatusText, getStatusClass: status => getStatusMeta(status).tagClass,
  formatPrice, formatTime, maskPhone: theme.maskPhone };
