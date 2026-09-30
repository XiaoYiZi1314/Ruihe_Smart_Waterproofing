const db = require('../config/database');
const State = require('./orderStateMachine');
const Realtime = require('./realtime');
const ChangeLog = require('./orderChangeLog');

function fail(message, status = 409) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function fees(data) {
  const result = {};
  for (const key of ['door_fee', 'material_fee', 'labor_fee']) {
    const value = data[key];
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' ||
        !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 9999999.99) {
      fail('请填写有效的非负费用', 400);
    }
    result[key] = Math.round(Number(value) * 100) / 100;
  }
  result.final_price = Math.round((result.door_fee + result.material_fee + result.labor_fee) * 100) / 100;
  if (result.final_price > 99999999.99) fail('总费用超出支持范围', 400);
  return result;
}

async function transition(id, actor, action, data = {}, meta = {}) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    let worker;
    // Assignment and deletion acquire the worker lock before any order lock.
    if (action === 'assign') {
      if (!data.worker_id || !data.estimated_time || Number.isNaN(new Date(data.estimated_time).getTime())) fail('请选择师傅及有效上门时间', 400);
      const [workers] = await connection.query("SELECT * FROM users WHERE id = ? AND role = 'worker' FOR UPDATE", [data.worker_id]);
      worker = workers[0];
      if (!worker || worker.status !== 'active' || worker.worker_status !== 'working') fail('师傅已停用或正在休息', 400);
    } else if (actor.role === 'worker') {
      const [workers] = await connection.query("SELECT * FROM users WHERE id = ? AND role = 'worker' FOR UPDATE", [actor.id]);
      if (!workers[0] || workers[0].status !== 'active') fail('师傅账号已停用', 403);
    }
    const [orders] = await connection.query('SELECT * FROM work_orders WHERE id = ? FOR UPDATE', [id]);
    const order = orders[0];
    if (!order) fail('工单不存在', 404);
    if (actor.role === 'customer' && Number(order.user_id) !== Number(actor.id)) fail('无权操作此工单', 403);
    if (actor.role === 'worker' && Number(order.worker_id) !== Number(actor.id)) fail('无权操作此工单', 403);
    if (action === 'cancel') {
      if (!State.canCancel(order.status, actor.role)) fail('当前状态不能取消');
    } else {
      const validation = State.validate(order.status, action, actor.role);
      if (!validation.success) fail(validation.error);
    }
    const updates = [];
    const params = [];
    const set = (key, value) => { updates.push(`${key} = ?`); params.push(value); };
    const raw = sql => updates.push(sql);
    const nextStatus = action === 'cancel' ? 'cancelled' : State.getNextStatus(order.status, action);
    set('status', nextStatus);
    if (action === 'assign') {
      set('worker_id', worker.id); set('estimated_time', data.estimated_time);
      raw('assigned_at = NOW()'); raw('confirmed_at = NULL'); raw('started_at = NULL'); raw('is_exception = 0');
      await connection.query('UPDATE users SET assign_count = assign_count + 1 WHERE id = ?', [worker.id]);
    } else if (action === 'accept') {
      if (order.confirmed_at) fail('工单已接单');
      raw('confirmed_at = NOW()');
    } else if (action === 'reject') {
      if (typeof data.reason !== 'string' || !data.reason.trim()) fail('请填写拒单理由', 400);
      set('reject_reason', data.reason.trim().slice(0, 1000));
      raw('rejected_at = NOW()'); raw('worker_id = NULL'); raw('estimated_time = NULL'); raw('assigned_at = NULL'); raw('confirmed_at = NULL'); raw('is_exception = 0');
      await connection.query('UPDATE users SET reject_count = reject_count + 1 WHERE id = ?', [actor.id]);
    } else if (action === 'start') {
      raw('started_at = NOW()'); raw('confirmed_at = COALESCE(confirmed_at, NOW())'); raw('is_exception = 0');
    } else if (action === 'complete') {
      Object.entries(fees(data)).forEach(([key, value]) => set(key, value));
      raw('completed_at = NOW()'); raw('auto_complete_at = DATE_ADD(NOW(), INTERVAL 3 DAY)');
    } else if (action === 'dispute') {
      if (order.price_adjusted_at || order.dispute_started_at) fail('价格仅支持协商一轮');
      if (typeof data.reason !== 'string' || !data.reason.trim()) fail('请填写异议原因', 400);
      set('price_dispute_reason', data.reason.trim().slice(0, 1000)); raw('dispute_started_at = NOW()');
    } else if (action === 'adjust_price') {
      Object.entries(fees(data)).forEach(([key, value]) => set(key, value));
      raw('auto_complete_at = DATE_ADD(NOW(), INTERVAL GREATEST(0, TIMESTAMPDIFF(SECOND, COALESCE(dispute_started_at, NOW()), COALESCE(auto_complete_at, DATE_ADD(completed_at, INTERVAL 3 DAY)))) SECOND)');
      raw('price_adjusted_at = NOW()');
    } else if (action === 'confirm' || action === 'auto_complete') {
      if (action === 'auto_complete') {
        const [due] = await connection.query('SELECT id FROM work_orders WHERE id = ? AND auto_complete_at <= NOW()', [id]);
        if (!due.length) fail('尚未到自动完成时间');
      }
      raw('finished_at = NOW()'); raw('is_exception = 0');
    } else if (action === 'cancel') {
      if (actor.role === 'admin') {
        if (typeof data.reason !== 'string' || !data.reason.trim()) fail('请填写取消原因', 400);
        set('cancel_reason', data.reason.trim().slice(0, 1000));
      }
      raw('cancelled_at = NOW()'); raw('is_exception = 0');
    }
    raw('updated_at = NOW()');
    await connection.query(`UPDATE work_orders SET ${updates.join(', ')} WHERE id = ?`, [...params, id]);
    // 审计：变更日志和业务修改在同一个事务里，写不进去就整体回滚
    const feeResult = action === 'complete' || action === 'adjust_price' ? fees(data) : undefined;
    await ChangeLog.recordFlow(connection, { order, nextStatus, action, actor, data, worker, fees: feeResult, meta });
    await connection.commit();
    // Broadcast only committed state. A socket outage must not fail a saved operation.
    Promise.resolve().then(() => Realtime.notifyOrderChange(order.id, nextStatus, { action }))
      .catch(error => console.error('Order change delivery failed:', error.message));
    return { ...order, status: nextStatus, ...(action === 'complete' || action === 'adjust_price' ? fees(data) : {}), worker_name: worker ? worker.nickname : undefined };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

async function deleteWorker(id) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [workers] = await connection.query("SELECT id FROM users WHERE id = ? AND role = 'worker' AND status = 'active' FOR UPDATE", [id]);
    if (!workers.length) fail('师傅不存在', 404);
    const [orders] = await connection.query("SELECT id FROM work_orders WHERE worker_id = ? AND status NOT IN ('completed', 'cancelled') FOR UPDATE", [id]);
    if (orders.length) fail('师傅有未完成工单，不能删除', 400);
    await connection.query("UPDATE users SET status = 'inactive', archived_phone = phone, phone = NULL, username = NULL, token_version = token_version + 1 WHERE id = ?", [id]);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
module.exports = { transition, deleteWorker, fees };
