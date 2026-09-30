// 预约日期/时段工具：今天已经过去（或不足 1 小时）的时段不可选，纯函数便于测试
const SLOTS = [
  { value: '上午 08-12', label: '上午 08-12', endHour: 12 },
  { value: '下午 13-18', label: '下午 13-18', endHour: 18 },
  { value: '晚上 18-20', label: '晚上 18-20', endHour: 20 }
];
// 至少距离时段结束还有 60 分钟才允许预约当天
const LEAD_MINUTES = 60;
const DAY_LABELS = ['今天', '明天'];

function pad(n) { return String(n).padStart(2, '0'); }

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toOption(slot) { return { value: slot.value, label: slot.label }; }

// 指定日期可选的时段；非今天全部可选
function availableSlots(dateValue, now) {
  const current = now || new Date();
  if (dateValue !== formatDate(current)) return SLOTS.map(toOption);
  const minutes = current.getHours() * 60 + current.getMinutes();
  return SLOTS.filter((slot) => minutes + LEAD_MINUTES <= slot.endHour * 60).map(toOption);
}

function isSlotAvailable(dateValue, timeValue, now) {
  return availableSlots(dateValue, now).some((slot) => slot.value === timeValue);
}

// 连续 days 天；今天已经没有可选时段时，从明天开始
function buildDateOptions(now, days) {
  const current = now || new Date();
  const total = days || 5;
  const start = availableSlots(formatDate(current), current).length ? 0 : 1;
  const options = [];
  for (let i = start; i < start + total; i += 1) {
    const date = new Date(current.getFullYear(), current.getMonth(), current.getDate() + i);
    options.push({
      value: formatDate(date),
      label: DAY_LABELS[i] || `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    });
  }
  return options;
}

// 当前选中的时段仍可用则保留，否则取第一个可用时段
function pickTime(dateValue, currentValue, now) {
  const slots = availableSlots(dateValue, now);
  if (slots.some((slot) => slot.value === currentValue)) return currentValue;
  return slots.length ? slots[0].value : '';
}

// 预约时段目前拼在备注第一行：“预约时间：2026-10-01 上午 08-12”
function extractSlot(remark) {
  if (!remark) return '';
  const match = /预约时间：([^\n\r]+)/.exec(String(remark));
  return match ? match[1].trim() : '';
}

// 预约展示文本：优先用后端的结构化预约字段（后台更正后以它为准），旧订单回退到备注里的那一行
function appointmentText(order) {
  const source = order || {};
  if (source.appointment_date) return `${String(source.appointment_date).slice(0, 10)} ${source.appointment_slot || ''}`.trim();
  return extractSlot(source.remark);
}

module.exports = { SLOTS, formatDate, availableSlots, isSlotAvailable, buildDateOptions, pickTime, extractSlot, appointmentText };
