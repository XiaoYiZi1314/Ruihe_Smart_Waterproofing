// 后台更正工单：字段修改 / 改派师傅 / 状态更正 / 现场图片 / 跟进记录 / 师傅变更申请。
// 所有修改都在事务里：锁行 → 校验版本号 → 更新 → 写变更日志，任一步失败整体回滚。
const db = require('../config/database');
const Log = require('./orderChangeLog');
const { assertOwned } = require('./attachments');
const Realtime = require('./realtime');

const SLOTS = ['上午 08-12', '下午 13-18', '晚上 18-20'];
const MAX_IMAGES = 9;
const DAY = 24 * 3600 * 1000;

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
const round2 = value => Math.round(Number(value) * 100) / 100;

// ---------- 字段解析（返回规范化后的值，非法则抛 400） ----------
function text(label, min, max, { nullable = false } = {}) {
  return value => {
    if (value == null || (typeof value === 'string' && !value.trim())) {
      if (nullable) return null;
      fail(`${label}不能为空`);
    }
    if (typeof value !== 'string') fail(`${label}格式不正确`);
    const trimmed = value.trim();
    if (trimmed.length < min || trimmed.length > max) fail(`${label}长度需在 ${min}-${max} 个字之间`);
    return trimmed;
  };
}
function money(label, { nullable = false, positive = false } = {}) {
  return value => {
    if (value == null || (typeof value === 'string' && !value.trim())) {
      if (nullable) return null;
      fail(`${label}不能为空`);
    }
    const number = Number(value);
    if (typeof value === 'boolean' || !Number.isFinite(number) || number < 0 || number > 9999999.99) fail(`${label}需为 0 到 9999999.99 之间的金额`);
    if (positive && number <= 0) fail(`${label}必须大于 0`);
    return round2(number);
  };
}
function datetime(label) {
  return value => {
    if (value == null || value === '') return null;
    const normalized = Log.fmtDateTime(value);
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized || '') || Number.isNaN(new Date(normalized.replace(' ', 'T')).getTime())) fail(`${label}格式不正确`);
    return normalized;
  };
}
const PARSERS = {
  contact_name: text('联系人', 1, 50),
  contact_phone: value => {
    if (typeof value !== 'string' || !/^1[3-9]\d{9}$/.test(value.trim())) fail('请填写正确的 11 位手机号');
    return value.trim();
  },
  full_address: text('服务地址', 5, 500),
  remark: text('备注', 0, 2000, { nullable: true }),
  expected_price: money('期望价格', { nullable: true, positive: true }),
  estimated_time: datetime('上门时间'),
  service_id: value => {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) fail('服务项目无效');
    return number;
  },
  appointment_date: value => {
    if (value == null || value === '') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || Number.isNaN(new Date(`${value}T00:00:00`).getTime())) fail('预约日期格式不正确');
    return String(value);
  },
  appointment_slot: value => {
    if (value == null || value === '') return null;
    if (!SLOTS.includes(value)) fail('预约时段无效');
    return value;
  },
  door_fee: money('上门费'),
  material_fee: money('材料费'),
  labor_fee: money('人工费'),
  confirmed_at: datetime('接单时间'),
  started_at: datetime('开工时间'),
  completed_at: datetime('完工提交时间'),
  finished_at: datetime('订单完成时间')
};
const FEE_KEYS = ['door_fee', 'material_fee', 'labor_fee'];
// 时间字段只允许出现在“已经走到这一步”的状态
const TIME_RULES = {
  confirmed_at: ['confirmed', 'in_progress', 'pending_review', 'price_negotiating', 'completed'],
  started_at: ['in_progress', 'pending_review', 'price_negotiating', 'completed'],
  completed_at: ['pending_review', 'price_negotiating', 'completed'],
  finished_at: ['completed']
};
const TIME_ORDER = ['created_at', 'confirmed_at', 'started_at', 'completed_at', 'finished_at'];
const EDIT_LOG_FIELDS = ['contact_name', 'contact_phone', 'full_address', 'remark', 'expected_price', 'estimated_time', 'service_id',
  'appointment_date', 'appointment_slot', 'door_fee', 'material_fee', 'labor_fee', 'final_price', 'confirmed_at', 'started_at', 'completed_at', 'finished_at', 'auto_complete_at'];

function checkReason(reasonType, reasonNote, { noteRequired = false } = {}) {
  if (!Log.REASON_TYPES[reasonType]) fail('请选择更正原因');
  const note = typeof reasonNote === 'string' ? reasonNote.trim() : '';
  if (note.length > 500) fail('原因说明最多 500 字');
  if ((noteRequired || reasonType === 'other') && note.length < 2) fail('请填写原因说明');
  return note;
}

// 备注第一行的“预约时间：…”需要和结构化预约保持一致（旧版小程序仍读取备注）
function withAppointmentLine(remark, date, slot) {
  const body = String(remark || '').split('\n').filter(line => !/^预约时间[：:]/.test(line)).join('\n');
  if (!date || !slot) return body;
  return body ? `预约时间：${date} ${slot}\n${body}` : `预约时间：${date} ${slot}`;
}

// 纯函数：根据当前工单和提交的修改，算出真正需要更新的字段
function planEdit(order, changes) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes) || !Object.keys(changes).length) fail('没有需要保存的修改');
  const updates = {};
  for (const key of Object.keys(changes)) {
    if (!PARSERS[key]) fail(`不支持修改字段：${key}`);
    const value = PARSERS[key](changes[key]);
    if (!Log.sameValue(key, order[key], value)) updates[key] = value;
  }
  if (FEE_KEYS.some(key => key in updates)) {
    const merged = FEE_KEYS.map(key => (key in updates ? updates[key] : order[key]));
    if (merged.some(value => value == null)) fail('上门费、材料费、人工费需要同时填写');
    const total = round2(merged.reduce((sum, value) => sum + Number(value), 0));
    if (total > 99999999.99) fail('总费用超出支持范围');
    if (!Log.sameValue('final_price', order.final_price, total)) updates.final_price = total;
  }
  if ('appointment_date' in updates || 'appointment_slot' in updates) {
    const date = 'appointment_date' in updates ? updates.appointment_date : Log.fmtDate(order.appointment_date);
    const slot = 'appointment_slot' in updates ? updates.appointment_slot : order.appointment_slot;
    if (Boolean(date) !== Boolean(slot)) fail('预约日期和时段需要同时填写或同时清空');
    const remark = withAppointmentLine('remark' in updates ? updates.remark : order.remark, date, slot);
    if (!Log.sameValue('remark', order.remark, remark)) updates.remark = remark || null;
  }
  for (const [field, statuses] of Object.entries(TIME_RULES)) {
    if (field in updates && updates[field] != null && !statuses.includes(order.status)) fail(`当前状态（${Log.STATUS_LABELS[order.status]}）不能设置${Log.FIELD_LABELS[field]}`);
  }
  let previous = null;
  for (const field of TIME_ORDER) {
    const value = Log.fmtDateTime(field in updates ? updates[field] : order[field]);
    if (!value) continue;
    if (previous && value < previous.value) fail(`${Log.FIELD_LABELS[field] || '创建时间'}不能早于${previous.label}`);
    previous = { value, label: Log.FIELD_LABELS[field] || '创建时间' };
  }
  if (!Object.keys(updates).length) fail('内容没有变化，无需保存');
  return updates;
}

async function lockOrder(connection, id, revision) {
  const [rows] = await connection.query('SELECT * FROM work_orders WHERE id = ? FOR UPDATE', [id]);
  const order = rows[0];
  if (!order) fail('工单不存在', 404);
  if (revision !== undefined && revision !== null && Number(revision) !== Number(order.revision)) fail('工单刚刚被其他人修改，请刷新后重新编辑', 409);
  return order;
}
async function serviceNames(connection, ids) {
  const wanted = [...new Set(ids.filter(Boolean))];
  const map = {};
  if (!wanted.length) return map;
  const [rows] = await connection.query('SELECT id, name FROM services WHERE id IN (?)', [wanted]);
  for (const row of rows) map[row.id] = row.name;
  return map;
}

// 在已加锁的连接上执行字段修改（师傅申请通过时复用）
async function applyEdit(connection, order, { changes, reasonType, reasonNote, actor, meta = {}, action = 'edit', confirmFee = false }) {
  const updates = planEdit(order, changes);
  const feeChanged = 'final_price' in updates;
  if (feeChanged && order.status === 'completed' && !confirmFee) {
    fail('订单已完成，修改费用需二次确认', 400);
  }
  if ('service_id' in updates) {
    const [services] = await connection.query('SELECT id FROM services WHERE id = ?', [updates.service_id]);
    if (!services.length) fail('服务项目不存在', 404);
  }
  const extra = {};
  // 客户已经看到费用之后被更正：记录更正前金额，客户端据此展示“费用已更正”
  if (feeChanged && ['pending_review', 'price_negotiating', 'completed'].includes(order.status) && order.final_price != null) {
    extra.price_corrected_at = new Date();
    extra.price_before_correction = round2(order.final_price);
  }
  if (feeChanged && order.status === 'pending_review') extra.auto_complete_at = new Date(Date.now() + 3 * DAY);
  const columns = { ...updates, ...extra };
  const sets = Object.keys(columns).map(key => `${key} = ?`);
  await connection.query(`UPDATE work_orders SET ${sets.join(', ')}, revision = revision + 1, correction_count = correction_count + 1, updated_at = NOW() WHERE id = ?`,
    [...Object.keys(columns).map(key => columns[key]), order.id]);
  if ('service_id' in updates) {
    await connection.query('UPDATE services SET order_count = GREATEST(order_count - 1, 0) WHERE id = ?', [order.service_id]);
    await connection.query('UPDATE services SET order_count = order_count + 1 WHERE id = ?', [updates.service_id]);
  }
  const entries = Log.diffEntries(order, { ...updates, auto_complete_at: extra.auto_complete_at }, EDIT_LOG_FIELDS);
  const serviceEntry = entries.find(entry => entry.field === 'service_id');
  if (serviceEntry) {
    const names = await serviceNames(connection, [order.service_id, updates.service_id]);
    serviceEntry.old_value = names[order.service_id] || `服务#${order.service_id}`;
    serviceEntry.new_value = names[updates.service_id] || `服务#${updates.service_id}`;
  }
  const batchId = await Log.record(connection, { orderId: order.id, actor, source: 'admin_edit', action, entries, reasonType, reasonNote, ip: meta.ip });
  return { batchId, updates, entries, revision: Number(order.revision) + 1 };
}

async function editOrder(id, actor, payload = {}, meta = {}) {
  const note = checkReason(payload.reason_type, payload.reason_note);
  if (payload.revision === undefined || payload.revision === null) fail('缺少工单版本号，请刷新后重试');
  const changes = payload.changes;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const order = await lockOrder(connection, id, payload.revision);
    const hasFee = changes && typeof changes === 'object' && FEE_KEYS.some(key => key in changes);
    if (hasFee && note.length < 2) fail('修改费用必须填写原因说明');
    const result = await applyEdit(connection, order, { changes, reasonType: payload.reason_type, reasonNote: note, actor, meta, confirmFee: payload.confirm_completed_fee === true });
    await connection.commit();
    afterCommit(order, result.entries, { kind: 'edit' });
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

// ---------- 改派师傅 ----------
const REASSIGN_STATUSES = ['confirmed', 'in_progress', 'pending_review', 'price_negotiating'];
async function reassignOrder(id, actor, payload = {}, meta = {}) {
  const note = checkReason(payload.reason_type, payload.reason_note);
  if (payload.revision === undefined || payload.revision === null) fail('缺少工单版本号，请刷新后重试');
  const workerId = Number(payload.worker_id);
  if (!Number.isInteger(workerId) || workerId <= 0) fail('请选择新的师傅');
  const estimated = payload.estimated_time ? datetime('上门时间')(payload.estimated_time) : null;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    // 与指派流程一致：先锁师傅，再锁工单，避免死锁
    const [workers] = await connection.query("SELECT * FROM users WHERE id = ? AND role = 'worker' FOR UPDATE", [workerId]);
    const worker = workers[0];
    if (!worker || worker.status !== 'active' || worker.worker_status !== 'working') fail('师傅已停用或正在休息');
    const order = await lockOrder(connection, id, payload.revision);
    if (!REASSIGN_STATUSES.includes(order.status)) fail(`当前状态（${Log.STATUS_LABELS[order.status]}）不能改派，待指派请直接指派`, 409);
    if (Number(order.worker_id) === workerId) fail('新师傅与当前师傅相同');
    const sets = ['worker_id = ?', 'assigned_at = NOW()', 'is_exception = 0', 'revision = revision + 1', 'correction_count = correction_count + 1', 'updated_at = NOW()'];
    const params = [workerId];
    const after = { confirmed_at: order.confirmed_at };
    // 已指派未开工：新师傅需要重新接单
    if (order.status === 'confirmed') { sets.push('confirmed_at = NULL'); after.confirmed_at = null; }
    if (estimated) { sets.push('estimated_time = ?'); params.push(estimated); after.estimated_time = estimated; }
    await connection.query(`UPDATE work_orders SET ${sets.join(', ')} WHERE id = ?`, [...params, order.id]);
    await connection.query('UPDATE users SET assign_count = assign_count + 1 WHERE id = ?', [workerId]);
    if (order.worker_id) await connection.query('UPDATE users SET assign_count = GREATEST(assign_count - 1, 0) WHERE id = ?', [order.worker_id]);
    const names = await Log.workerLabels(connection, [order.worker_id, workerId]);
    const entries = [{ field: 'worker_id', old_value: order.worker_id ? names[order.worker_id] : null, new_value: names[workerId] },
      ...Log.diffEntries(order, after, ['estimated_time', 'confirmed_at'])];
    const batchId = await Log.record(connection, { orderId: order.id, actor, source: 'admin_edit', action: 'reassign', entries, reasonType: payload.reason_type, reasonNote: note, ip: meta.ip });
    await connection.commit();
    afterCommit(order, entries, { kind: 'reassign', oldWorkerId: order.worker_id, newWorkerId: workerId });
    return { batchId, revision: Number(order.revision) + 1 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

// ---------- 状态更正 ----------
const CLEAR_ASSIGNMENT = { worker_id: null, estimated_time: null, assigned_at: null, confirmed_at: null };
const STATUS_CORRECTIONS = {
  'completed>pending_review': { label: '退回待客户确认', effects: () => ({ finished_at: null, auto_complete_at: new Date(Date.now() + 3 * DAY) }) },
  'completed>in_progress': { label: '退回施工中', effects: () => ({ completed_at: null, finished_at: null, auto_complete_at: null }) },
  'pending_review>in_progress': { label: '退回施工中（师傅需重新提交完工）', effects: () => ({ completed_at: null, auto_complete_at: null }) },
  'pending_review>completed': { label: '强制完成', effects: () => ({ finished_at: new Date(), auto_complete_at: null }) },
  'price_negotiating>pending_review': { label: '结束协商，回到待客户确认', effects: () => ({ auto_complete_at: new Date(Date.now() + 3 * DAY) }) },
  'price_negotiating>completed': { label: '强制完成', effects: () => ({ finished_at: new Date(), auto_complete_at: null }) },
  'in_progress>confirmed': { label: '退回已指派（未开工）', effects: () => ({ started_at: null }) },
  'confirmed>pending': { label: '退回待指派', effects: () => ({ ...CLEAR_ASSIGNMENT }) },
  'cancelled>pending': { label: '恢复为待指派', effects: () => ({ cancelled_at: null, cancel_reason: null, ...CLEAR_ASSIGNMENT, started_at: null, completed_at: null, finished_at: null, auto_complete_at: null }) }
};
function allowedCorrections(status) {
  return Object.entries(STATUS_CORRECTIONS).filter(([key]) => key.startsWith(`${status}>`))
    .map(([key, rule]) => ({ to: key.split('>')[1], to_label: Log.STATUS_LABELS[key.split('>')[1]], label: rule.label }));
}
async function correctStatus(id, actor, payload = {}, meta = {}) {
  const note = checkReason(payload.reason_type, payload.reason_note, { noteRequired: true });
  if (payload.revision === undefined || payload.revision === null) fail('缺少工单版本号，请刷新后重试');
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const order = await lockOrder(connection, id, payload.revision);
    const rule = STATUS_CORRECTIONS[`${order.status}>${payload.to_status}`];
    if (!rule) fail(`不支持把「${Log.STATUS_LABELS[order.status]}」更正为「${Log.STATUS_LABELS[payload.to_status] || payload.to_status}」`, 409);
    const effects = { ...rule.effects(), status: payload.to_status };
    const keys = Object.keys(effects);
    await connection.query(`UPDATE work_orders SET ${keys.map(key => `${key} = ?`).join(', ')}, is_exception = 0, revision = revision + 1, correction_count = correction_count + 1, updated_at = NOW() WHERE id = ?`,
      [...keys.map(key => effects[key]), order.id]);
    const entries = Log.diffEntries(order, effects, ['status', ...keys.filter(key => key !== 'status')]);
    const workerEntry = entries.find(entry => entry.field === 'worker_id');
    if (workerEntry && order.worker_id) workerEntry.old_value = (await Log.workerLabels(connection, [order.worker_id]))[order.worker_id];
    const batchId = await Log.record(connection, { orderId: order.id, actor, source: 'admin_edit', action: 'correct_status', entries, reasonType: payload.reason_type, reasonNote: note, ip: meta.ip });
    await connection.commit();
    afterCommit(order, entries, { kind: 'status', toStatus: payload.to_status });
    return { batchId, revision: Number(order.revision) + 1, status: payload.to_status };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

// ---------- 现场图片（软删除，保证可追溯） ----------
async function addImage(id, actor, payload = {}, meta = {}) {
  const note = checkReason(payload.reason_type || 'data_fix', payload.reason_note);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const order = await lockOrder(connection, id, payload.revision);
    await assertOwned(connection, actor.id, [payload.image_url]);
    const [[count]] = await connection.query('SELECT COUNT(*) AS total, COALESCE(MAX(sort_order), -1) AS last FROM work_order_images WHERE order_id = ? AND deleted_at IS NULL', [order.id]);
    if (Number(count.total) >= MAX_IMAGES) fail(`每个工单最多 ${MAX_IMAGES} 张现场图片`);
    const [inserted] = await connection.query("INSERT INTO work_order_images (order_id, image_url, image_type, sort_order) VALUES (?, ?, 'scene', ?)", [order.id, payload.image_url, Number(count.last) + 1]);
    await connection.query('UPDATE work_orders SET revision = revision + 1, correction_count = correction_count + 1, updated_at = NOW() WHERE id = ?', [order.id]);
    const batchId = await Log.record(connection, { orderId: order.id, actor, source: 'admin_edit', action: 'image_add',
      entries: [{ field: 'images', old_value: null, new_value: payload.image_url }], reasonType: payload.reason_type || 'data_fix', reasonNote: note, ip: meta.ip });
    await connection.commit();
    return { batchId, image_id: inserted.insertId, revision: Number(order.revision) + 1 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
async function removeImage(id, imageId, actor, payload = {}, meta = {}) {
  const note = checkReason(payload.reason_type, payload.reason_note, { noteRequired: true });
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const order = await lockOrder(connection, id, payload.revision);
    const [rows] = await connection.query('SELECT * FROM work_order_images WHERE id = ? AND order_id = ? AND deleted_at IS NULL FOR UPDATE', [imageId, order.id]);
    if (!rows.length) fail('图片不存在或已删除', 404);
    await connection.query('UPDATE work_order_images SET deleted_at = NOW(), deleted_by = ? WHERE id = ?', [actor.id, imageId]);
    await connection.query('UPDATE work_orders SET revision = revision + 1, correction_count = correction_count + 1, updated_at = NOW() WHERE id = ?', [order.id]);
    const batchId = await Log.record(connection, { orderId: order.id, actor, source: 'admin_edit', action: 'image_remove',
      entries: [{ field: 'images', old_value: rows[0].image_url, new_value: null }], reasonType: payload.reason_type, reasonNote: note, ip: meta.ip });
    await connection.commit();
    return { batchId, revision: Number(order.revision) + 1 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

// ---------- 内部跟进（仅后台可见，只追加） ----------
const FOLLOWUP_TARGETS = { customer: '客户', worker: '师傅', other: '其他' };
const FOLLOWUP_CHANNELS = { phone: '电话', wechat: '微信', onsite: '上门', other: '其他' };
async function addFollowup(id, actor, payload = {}) {
  if (!FOLLOWUP_TARGETS[payload.target]) fail('请选择沟通对象');
  if (!FOLLOWUP_CHANNELS[payload.channel]) fail('请选择沟通方式');
  const content = typeof payload.content === 'string' ? payload.content.trim() : '';
  if (content.length < 2 || content.length > 1000) fail('跟进内容需在 2-1000 字之间');
  const contactedAt = payload.contacted_at ? datetime('沟通时间')(payload.contacted_at) : Log.fmtDateTime(new Date());
  const [orders] = await db.query('SELECT id FROM work_orders WHERE id = ?', [id]);
  if (!orders.length) fail('工单不存在', 404);
  const operator = await Log.operatorOf(db, actor);
  const [result] = await db.query('INSERT INTO order_followups (order_id, operator_id, operator_name, target, channel, content, contacted_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, operator.id, operator.name, payload.target, payload.channel, content, contactedAt]);
  return { id: result.insertId };
}

// ---------- 师傅现场变更申请 ----------
const REQUEST_TYPES = { price: '费用调整', time: '上门时间调整', scope: '施工范围变更', other: '其他' };
async function createChangeRequest(workerId, orderId, payload = {}) {
  if (!REQUEST_TYPES[payload.request_type]) fail('请选择申请类型');
  const content = typeof payload.content === 'string' ? payload.content.trim() : '';
  if (content.length < 5 || content.length > 500) fail('请用 5-500 个字说明现场情况');
  const fees = FEE_KEYS.map(key => payload[`proposed_${key}`]);
  const hasFees = fees.some(value => value != null && value !== '');
  if (hasFees && fees.some(value => value == null || value === '')) fail('申请调整费用时，三项费用需要全部填写');
  const parsedFees = hasFees ? FEE_KEYS.map((key, index) => money(Log.FIELD_LABELS[key])(fees[index])) : [null, null, null];
  const proposedTime = payload.proposed_time ? datetime('建议上门时间')(payload.proposed_time) : null;
  if (payload.request_type === 'price' && !hasFees) fail('请填写建议的费用');
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.query('SELECT id, order_no, worker_id, status FROM work_orders WHERE id = ? FOR UPDATE', [orderId]);
    const order = orders[0];
    if (!order || Number(order.worker_id) !== Number(workerId)) fail('工单不存在或无权访问', 404);
    if (!['confirmed', 'in_progress', 'pending_review'].includes(order.status)) fail('当前状态不能提交变更申请', 409);
    const [pending] = await connection.query("SELECT id FROM order_change_requests WHERE order_id = ? AND status = 'pending' LIMIT 1", [orderId]);
    if (pending.length) fail('该工单已有待处理的申请，请等待客服处理', 409);
    const [result] = await connection.query('INSERT INTO order_change_requests (order_id, worker_id, request_type, content, proposed_door_fee, proposed_material_fee, proposed_labor_fee, proposed_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [orderId, workerId, payload.request_type, content, ...parsedFees, proposedTime]);
    await connection.commit();
    Promise.resolve().then(() => Realtime.notifyAdmins && Realtime.notifyAdmins('change_request', { order_id: orderId, order_no: order.order_no, request_id: result.insertId }))
      .catch(error => console.error('Change request delivery failed:', error.message));
    return { id: result.insertId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
async function handleChangeRequest(requestId, actor, payload = {}, meta = {}) {
  const decision = payload.decision;
  if (!['approve', 'reject'].includes(decision)) fail('请选择处理结果');
  const note = typeof payload.note === 'string' ? payload.note.trim() : '';
  if (note.length > 500) fail('处理说明最多 500 字');
  if (decision === 'reject' && note.length < 2) fail('驳回时请填写原因');
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [requests] = await connection.query('SELECT * FROM order_change_requests WHERE id = ? FOR UPDATE', [requestId]);
    const request = requests[0];
    if (!request) fail('申请不存在', 404);
    if (request.status !== 'pending') fail('该申请已被处理', 409);
    const order = await lockOrder(connection, request.order_id);
    const operator = await Log.operatorOf(connection, actor);
    let applied = 0;
    let applyResult = null;
    if (decision === 'approve' && payload.apply) {
      const changes = {};
      if (request.proposed_door_fee != null) { changes.door_fee = request.proposed_door_fee; changes.material_fee = request.proposed_material_fee; changes.labor_fee = request.proposed_labor_fee; }
      if (request.proposed_time) changes.estimated_time = Log.fmtDateTime(request.proposed_time);
      if (!Object.keys(changes).length) fail('该申请没有可直接应用的费用或时间，请仅标记为已同意后手动更正');
      applyResult = await applyEdit(connection, order, { changes, reasonType: 'worker_onsite', reasonNote: `师傅现场申请 #${request.id}：${request.content}`.slice(0, 480), actor, meta, confirmFee: true });
      applied = 1;
    }
    await connection.query('UPDATE order_change_requests SET status = ?, applied = ?, handled_by = ?, handled_by_name = ?, handled_at = NOW(), handle_note = ? WHERE id = ?',
      [decision === 'approve' ? 'approved' : 'rejected', applied, operator.id, operator.name, note || null, request.id]);
    await Log.record(connection, { orderId: order.id, actor, source: 'admin_edit', action: 'request_handle',
      entries: [], reasonType: 'worker_onsite', reasonNote: `${decision === 'approve' ? '同意' : '驳回'}师傅申请 #${request.id}${note ? `：${note}` : ''}`, ip: meta.ip });
    await connection.commit();
    if (applyResult) afterCommit(order, applyResult.entries, { kind: 'edit' });
    notify(request.worker_id, order.id, 'change_request_result', decision === 'approve' ? '变更申请已同意' : '变更申请被驳回',
      `工单 ${order.order_no} 的${REQUEST_TYPES[request.request_type]}申请${decision === 'approve' ? (applied ? '已同意并已更新工单' : '已同意') : '已被驳回'}${note ? `：${note}` : ''}`);
    return { applied: Boolean(applied) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

// ---------- 通知（站内，失败不影响已保存的修改） ----------
const CUSTOMER_FIELDS = ['contact_name', 'contact_phone', 'full_address', 'estimated_time', 'appointment_date', 'appointment_slot', 'door_fee', 'material_fee', 'labor_fee', 'final_price', 'service_id', 'status', 'worker_id'];
const WORKER_FIELDS = ['contact_name', 'contact_phone', 'full_address', 'remark', 'estimated_time', 'appointment_date', 'appointment_slot', 'door_fee', 'material_fee', 'labor_fee', 'final_price', 'service_id', 'status', 'worker_id'];
function notify(userId, orderId, type, title, content) {
  if (!userId) return;
  Promise.resolve().then(() => require('./notification').logNotification(userId, orderId, type, title, content, null, 'success'))
    .catch(error => console.error('Correction notice failed:', error.message));
}
function summarize(entries, allowed) {
  const labels = [...new Set(entries.filter(entry => allowed.includes(entry.field)).map(entry => Log.FIELD_LABELS[entry.field]))];
  return labels;
}
function afterCommit(order, entries, info) {
  const number = order.order_no;
  if (info.kind === 'reassign') {
    notify(info.oldWorkerId, order.id, 'order_corrected', '工单已改派', `工单 ${number} 已由客服改派给其他师傅，无需再处理该工单`);
    notify(info.newWorkerId, order.id, 'order_corrected', '您有新的工单', `客服将工单 ${number} 改派给您，请尽快查看并处理`);
    notify(order.user_id, order.id, 'order_corrected', '服务师傅已更换', `您的工单 ${number} 已更换服务师傅，上门时间如有变化会另行通知`);
  } else {
    const customerLabels = summarize(entries, CUSTOMER_FIELDS);
    const workerLabels = summarize(entries, WORKER_FIELDS);
    const fee = entries.find(entry => entry.field === 'final_price');
    if (customerLabels.length) {
      const extra = fee ? `，费用由 ¥${fee.old_value == null ? '-' : fee.old_value} 更正为 ¥${fee.new_value == null ? '-' : fee.new_value}` : '';
      notify(order.user_id, order.id, 'order_corrected', fee ? '工单费用已更正' : '工单信息已更新', `您的工单 ${number} 已由客服更正（${customerLabels.join('、')}）${extra}，如有疑问请联系客服`);
    }
    if (workerLabels.length && order.worker_id) notify(order.worker_id, order.id, 'order_corrected', '工单信息已更新', `工单 ${number} 已由客服更正（${workerLabels.join('、')}），请以最新信息为准`);
  }
  Promise.resolve().then(() => Realtime.notifyOrderChange(order.id, info.toStatus || order.status, { action: info.kind }))
    .catch(error => console.error('Correction delivery failed:', error.message));
}

// ---------- 时间线（变更日志 + 跟进 + 师傅申请，按时间倒序） ----------
async function timeline(orderId) {
  const [logs] = await db.query('SELECT * FROM order_change_logs WHERE order_id = ? ORDER BY id ASC', [orderId]);
  const batches = new Map();
  for (const row of logs) {
    let batch = batches.get(row.batch_id);
    if (!batch) {
      batch = { type: 'change', key: `c-${row.batch_id}`, time: row.created_at, source: row.source, action: row.action, action_label: Log.ACTION_LABELS[row.action] || row.action,
        operator_name: row.operator_name, operator_role: row.operator_role, reason_type: row.reason_type, reason_label: Log.REASON_TYPES[row.reason_type] || null,
        reason_note: row.reason_note, entries: [] };
      batches.set(row.batch_id, batch);
    }
    if (row.field) batch.entries.push({ field: row.field, label: row.field_label, old_value: row.old_value, new_value: row.new_value });
  }
  const [followups] = await db.query('SELECT * FROM order_followups WHERE order_id = ? ORDER BY id ASC', [orderId]);
  const [requests] = await db.query('SELECT r.*, u.nickname AS worker_name FROM order_change_requests r LEFT JOIN users u ON u.id = r.worker_id WHERE r.order_id = ? ORDER BY r.id ASC', [orderId]);
  const items = [...batches.values(),
    ...followups.map(row => ({ type: 'followup', key: `f-${row.id}`, time: row.created_at, operator_name: row.operator_name, target: row.target, target_label: FOLLOWUP_TARGETS[row.target],
      channel: row.channel, channel_label: FOLLOWUP_CHANNELS[row.channel], content: row.content, contacted_at: row.contacted_at })),
    ...requests.map(row => ({ type: 'request', key: `r-${row.id}`, time: row.created_at, id: row.id, worker_name: row.worker_name, request_type: row.request_type, request_label: REQUEST_TYPES[row.request_type],
      content: row.content, proposed_door_fee: row.proposed_door_fee, proposed_material_fee: row.proposed_material_fee, proposed_labor_fee: row.proposed_labor_fee, proposed_time: row.proposed_time,
      status: row.status, applied: Boolean(row.applied), handled_by_name: row.handled_by_name, handled_at: row.handled_at, handle_note: row.handle_note }))];
  return items.sort((a, b) => new Date(b.time) - new Date(a.time) || String(b.key).localeCompare(String(a.key)));
}

module.exports = { SLOTS, planEdit, withAppointmentLine, editOrder, applyEdit, reassignOrder, correctStatus, allowedCorrections, STATUS_CORRECTIONS,
  addImage, removeImage, addFollowup, createChangeRequest, handleChangeRequest, timeline, REQUEST_TYPES, FOLLOWUP_TARGETS, FOLLOWUP_CHANNELS, MAX_IMAGES };
