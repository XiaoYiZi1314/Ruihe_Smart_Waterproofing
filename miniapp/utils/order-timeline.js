// 客户端订单进度：根据工单上已有的时间字段拼出时间线，纯函数便于测试
const { appointmentText } = require('./booking-slots');

const STEPS = [
  { key: 'created_at', label: '提交预约' },
  { key: 'assigned_at', label: '已指派师傅' },
  { key: 'confirmed_at', label: '师傅已接单' },
  { key: 'started_at', label: '师傅开始施工' },
  { key: 'completed_at', label: '师傅已完工，等待您确认' },
  { key: 'price_adjusted_at', label: '价格已调整' },
  { key: 'price_corrected_at', label: '费用已更正' },
  { key: 'finished_at', label: '订单已完成' },
  { key: 'cancelled_at', label: '订单已取消' }
];

function parse(value) {
  const direct = Date.parse(value);
  return Number.isNaN(direct) ? Date.parse(String(value).replace(/-/g, '/')) : direct;
}

// formatTime：把时间值格式化成页面展示文本（传入 utils/theme 的 formatTime）
function buildTimeline(order, formatTime) {
  const source = order || {};
  const items = [];
  STEPS.forEach((step, index) => {
    const value = source[step.key];
    if (!value) return;
    const at = parse(value);
    if (Number.isNaN(at)) return;
    items.push({ key: step.key, label: step.label, time: formatTime(value), at, index });
  });
  items.sort((a, b) => a.at - b.at || a.index - b.index);
  return items.map((item, position) => ({ key: item.key, label: item.label, time: item.time, current: position === items.length - 1 }));
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `¥${number.toFixed(2)}` : '';
}

// 费用被客服更正后，给客户的醒目提示；没有更正过返回空字符串
function correctionNotice(order, formatTime) {
  const source = order || {};
  if (!source.price_corrected_at) return '';
  const before = money(source.price_before_correction);
  const after = money(source.final_price);
  const when = formatTime ? formatTime(source.price_corrected_at) : '';
  const change = before && after ? `由 ${before} 更正为 ${after}` : (after ? `更正为 ${after}` : '已更正');
  return `客服已将费用${change}${when ? `（${when}）` : ''}，如有疑问请联系客服。`;
}

module.exports = { buildTimeline, correctionNotice, appointmentText };
