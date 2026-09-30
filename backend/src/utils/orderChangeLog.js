// 工单变更日志：只追加，写入与业务修改在同一个事务里（日志写不进去，修改也不会生效）。
const crypto = require('crypto');

const STATUS_LABELS = {
  pending: '待指派', confirmed: '已指派', in_progress: '施工中', pending_review: '待客户确认',
  price_negotiating: '价格协商中', completed: '已完成', cancelled: '已取消'
};
const FIELD_LABELS = {
  status: '状态', worker_id: '负责师傅', service_id: '服务项目', contact_name: '联系人', contact_phone: '联系电话',
  full_address: '服务地址', remark: '备注', expected_price: '期望价格', estimated_time: '上门时间',
  appointment_date: '预约日期', appointment_slot: '预约时段',
  door_fee: '上门费', material_fee: '材料费', labor_fee: '人工费', final_price: '最终价格',
  confirmed_at: '接单时间', started_at: '开工时间', completed_at: '完工提交时间', finished_at: '订单完成时间',
  cancelled_at: '取消时间', assigned_at: '指派时间', auto_complete_at: '自动确认时间',
  cancel_reason: '取消原因', reject_reason: '拒单原因', price_dispute_reason: '价格异议原因', images: '现场图片'
};
const ACTION_LABELS = {
  create: '提交预约', assign: '指派师傅', accept: '师傅接单', reject: '师傅拒单', start: '开始施工', complete: '提交完工',
  dispute: '价格异议', adjust_price: '调整价格', confirm: '客户确认完成', auto_complete: '系统自动完成', cancel: '取消工单',
  edit: '更正工单信息', reassign: '改派师傅', correct_status: '更正工单状态', image_add: '补充现场图片', image_remove: '删除现场图片',
  request_handle: '处理师傅变更申请'
};
const REASON_TYPES = {
  customer_request: '客户要求', data_entry_error: '录入错误', worker_onsite: '师傅现场变更',
  price_negotiation: '价格协商', customer_complaint: '客户投诉', data_fix: '数据修正', other: '其他'
};
const MONEY_FIELDS = ['expected_price', 'door_fee', 'material_fee', 'labor_fee', 'final_price'];
const DATETIME_FIELDS = ['estimated_time', 'confirmed_at', 'started_at', 'completed_at', 'finished_at', 'cancelled_at', 'assigned_at', 'auto_complete_at'];

const pad = n => String(n).padStart(2, '0');
function fmtDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  return String(value).slice(0, 10);
}
function fmtDateTime(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${fmtDate(value)} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  const text = String(value).trim().replace('T', ' ');
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?/.exec(text);
  return match ? `${match[1]} ${match[2]}:${match[3]}:${match[4] || '00'}` : text;
}
// 统一成可比较、可展示的字符串；空字符串和 null 视为同一个“空”
function normalize(field, value) {
  if (value == null || value === '') return null;
  if (MONEY_FIELDS.includes(field)) return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : String(value);
  if (DATETIME_FIELDS.includes(field)) return fmtDateTime(value);
  if (field === 'appointment_date') return fmtDate(value);
  if (field === 'status') return STATUS_LABELS[value] || String(value);
  return String(value);
}
function sameValue(field, a, b) { return normalize(field, a) === normalize(field, b); }
function diffEntries(before, after, fields) {
  const entries = [];
  for (const field of fields) {
    if (!(field in after)) continue;
    if (sameValue(field, before[field], after[field])) continue;
    entries.push({ field, old_value: normalize(field, before[field]), new_value: normalize(field, after[field]) });
  }
  return entries;
}
const newBatchId = () => crypto.randomUUID();

async function operatorOf(connection, actor) {
  if (!actor || actor.role === 'system') return { id: null, name: '系统', role: 'system' };
  let name = actor.nickname || actor.username || null;
  if (!name && actor.id) {
    try {
      const [rows] = await connection.query('SELECT nickname, username FROM users WHERE id = ?', [actor.id]);
      if (rows && rows[0]) name = rows[0].nickname || rows[0].username || null;
    } catch (error) { /* 取不到名字不影响记录本身 */ }
  }
  return { id: actor.id || null, name: name || `用户#${actor.id}`, role: actor.role || null };
}
async function workerLabels(connection, ids) {
  const wanted = [...new Set((ids || []).filter(id => id != null))];
  const map = {};
  if (!wanted.length) return map;
  try {
    const [rows] = await connection.query('SELECT id, nickname FROM users WHERE id IN (?)', [wanted]);
    for (const row of rows || []) map[row.id] = `${row.nickname || '师傅'}（#${row.id}）`;
  } catch (error) { /* 同上 */ }
  for (const id of wanted) if (!map[id]) map[id] = `师傅#${id}`;
  return map;
}

// entries: [{ field, old_value, new_value }]；没有字段变化的事件（如接单）写一条 field 为空的记录
async function record(connection, { orderId, batchId, actor, source, action, entries, reasonType, reasonNote, ip }) {
  const operator = await operatorOf(connection, actor);
  const batch = batchId || newBatchId();
  const list = entries && entries.length ? entries : [{ field: null, old_value: null, new_value: null }];
  const rows = list.map(entry => [batch, orderId, operator.id, operator.name, operator.role, source, action,
    entry.field, entry.field ? (entry.label || FIELD_LABELS[entry.field] || entry.field) : null,
    entry.old_value == null ? null : String(entry.old_value).slice(0, 2000),
    entry.new_value == null ? null : String(entry.new_value).slice(0, 2000),
    reasonType || null, reasonNote ? String(reasonNote).slice(0, 1000) : null, ip ? String(ip).slice(0, 64) : null]);
  await connection.query('INSERT INTO order_change_logs (batch_id, order_id, operator_id, operator_name, operator_role, source, action, field, field_label, old_value, new_value, reason_type, reason_note, ip) VALUES ?', [rows]);
  return batch;
}

// 业务流转（指派/接单/拒单/开工/完工/异议/调价/确认/取消）统一落日志
async function recordFlow(connection, { order, nextStatus, action, actor, data = {}, worker, fees, meta = {} }) {
  const entries = [];
  if (order.status !== nextStatus) entries.push({ field: 'status', old_value: normalize('status', order.status), new_value: normalize('status', nextStatus) });
  let note = null;
  if (action === 'assign' && worker) {
    const names = await workerLabels(connection, [order.worker_id, worker.id]);
    entries.push({ field: 'worker_id', old_value: order.worker_id ? names[order.worker_id] : null, new_value: names[worker.id] });
    entries.push(...diffEntries(order, { estimated_time: data.estimated_time }, ['estimated_time']));
  } else if (action === 'reject') {
    const names = await workerLabels(connection, [order.worker_id]);
    entries.push({ field: 'worker_id', old_value: order.worker_id ? names[order.worker_id] : null, new_value: null });
    note = data.reason;
  } else if ((action === 'complete' || action === 'adjust_price') && fees) {
    entries.push(...diffEntries(order, fees, ['door_fee', 'material_fee', 'labor_fee', 'final_price']));
  } else if (action === 'cancel' || action === 'dispute') {
    note = data.reason;
  }
  return record(connection, { orderId: order.id, actor, source: actor && actor.role === 'system' ? 'system' : 'flow', action, entries, reasonNote: note, ip: meta.ip });
}

module.exports = { STATUS_LABELS, FIELD_LABELS, ACTION_LABELS, REASON_TYPES, MONEY_FIELDS, DATETIME_FIELDS,
  fmtDate, fmtDateTime, normalize, sameValue, diffEntries, newBatchId, operatorOf, workerLabels, record, recordFlow };
