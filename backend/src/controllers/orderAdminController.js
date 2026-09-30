/**
 * 后台工单更正：字段修改 / 改派 / 状态更正 / 图片 / 跟进 / 师傅申请 / 更正复盘
 */
const db = require('../config/database');
const ExcelJS = require('exceljs');
const OrderEdit = require('../utils/orderEdit');
const Log = require('../utils/orderChangeLog');
const { logOperation } = require('../utils/operationLog');

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
const daysAgo = days => new Date(Date.now() - days * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
function send(res, error, fallback = '操作失败，请重试') {
  if (!error.status) console.error(fallback, error);
  res.status(error.status || 500).json({ success: false, message: error.status ? error.message : fallback });
}
const meta = req => ({ ip: req.ip });
const asId = value => { const number = Number(value); return Number.isInteger(number) && number > 0 ? number : null; };
const page = (value, max) => Math.min(Math.max(parseInt(value, 10) || 1, 1), max);

exports.getEditMeta = (req, res) => {
  res.json({ success: true, data: {
    reason_types: Object.entries(Log.REASON_TYPES).map(([value, label]) => ({ value, label })),
    slots: OrderEdit.SLOTS,
    followup_targets: Object.entries(OrderEdit.FOLLOWUP_TARGETS).map(([value, label]) => ({ value, label })),
    followup_channels: Object.entries(OrderEdit.FOLLOWUP_CHANNELS).map(([value, label]) => ({ value, label })),
    request_types: Object.entries(OrderEdit.REQUEST_TYPES).map(([value, label]) => ({ value, label })),
    status_labels: Log.STATUS_LABELS
  } });
};

exports.editOrder = async (req, res) => {
  try {
    const result = await OrderEdit.editOrder(req.params.id, req.user, req.body || {}, meta(req));
    logOperation({ user_id: req.user.id, order_id: req.params.id, action: 'edit_order', detail: `更正工单：${result.entries.map(entry => entry.label || Log.FIELD_LABELS[entry.field]).join('、')}`, ip: req.ip });
    res.json({ success: true, message: '工单已更新', data: { revision: result.revision } });
  } catch (error) { send(res, error, '保存失败，请重试'); }
};
exports.reassignOrder = async (req, res) => {
  try {
    const result = await OrderEdit.reassignOrder(req.params.id, req.user, req.body || {}, meta(req));
    logOperation({ user_id: req.user.id, order_id: req.params.id, action: 'reassign', detail: '改派师傅', ip: req.ip });
    res.json({ success: true, message: '已改派', data: { revision: result.revision } });
  } catch (error) { send(res, error, '改派失败，请重试'); }
};
exports.correctStatus = async (req, res) => {
  try {
    const result = await OrderEdit.correctStatus(req.params.id, req.user, req.body || {}, meta(req));
    logOperation({ user_id: req.user.id, order_id: req.params.id, action: 'correct_status', detail: `更正状态为${Log.STATUS_LABELS[result.status]}`, ip: req.ip });
    res.json({ success: true, message: '状态已更正', data: { revision: result.revision, status: result.status } });
  } catch (error) { send(res, error, '状态更正失败，请重试'); }
};
exports.addImage = async (req, res) => {
  try {
    const result = await OrderEdit.addImage(req.params.id, req.user, req.body || {}, meta(req));
    logOperation({ user_id: req.user.id, order_id: req.params.id, action: 'image_add', detail: '补充现场图片', ip: req.ip });
    res.json({ success: true, message: '图片已添加', data: result });
  } catch (error) { send(res, error, '添加图片失败'); }
};
exports.removeImage = async (req, res) => {
  try {
    const result = await OrderEdit.removeImage(req.params.id, req.params.imageId, req.user, req.body || {}, meta(req));
    logOperation({ user_id: req.user.id, order_id: req.params.id, action: 'image_remove', detail: '删除现场图片', ip: req.ip });
    res.json({ success: true, message: '图片已删除', data: result });
  } catch (error) { send(res, error, '删除图片失败'); }
};
exports.getTimeline = async (req, res) => {
  try {
    res.json({ success: true, data: await OrderEdit.timeline(req.params.id) });
  } catch (error) { send(res, error, '获取操作记录失败'); }
};
exports.addFollowup = async (req, res) => {
  try {
    const result = await OrderEdit.addFollowup(req.params.id, req.user, req.body || {});
    res.json({ success: true, message: '跟进记录已保存', data: result });
  } catch (error) { send(res, error, '保存跟进记录失败'); }
};

// ---------- 师傅变更申请 ----------
exports.listChangeRequests = async (req, res) => {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : null;
    const current = page(req.query.page, 100000);
    const limit = page(req.query.limit || 20, 100);
    const where = status ? 'WHERE r.status = ?' : '';
    const params = status ? [status] : [];
    const [rows] = await db.query(`SELECT r.*, wo.order_no, wo.status AS order_status, u.nickname AS worker_name FROM order_change_requests r
      JOIN work_orders wo ON wo.id = r.order_id LEFT JOIN users u ON u.id = r.worker_id ${where} ORDER BY r.id DESC LIMIT ? OFFSET ?`, [...params, limit, (current - 1) * limit]);
    const [[count]] = await db.query(`SELECT COUNT(*) AS total FROM order_change_requests r ${where}`, params);
    const [[pending]] = await db.query("SELECT COUNT(*) AS total FROM order_change_requests WHERE status = 'pending'");
    res.json({ success: true, data: { requests: rows.map(row => ({ ...row, request_label: OrderEdit.REQUEST_TYPES[row.request_type] })), total: count.total, pending: pending.total, page: current, limit } });
  } catch (error) { send(res, error, '获取变更申请失败'); }
};
exports.handleChangeRequest = async (req, res) => {
  try {
    const result = await OrderEdit.handleChangeRequest(req.params.id, req.user, req.body || {}, meta(req));
    logOperation({ user_id: req.user.id, order_id: result.order_id, action: 'handle_change_request', detail: `处理师傅变更申请 #${req.params.id}`, ip: req.ip });
    res.json({ success: true, message: req.body.decision === 'approve' ? '已同意' : '已驳回', data: result });
  } catch (error) { send(res, error, '处理申请失败'); }
};

// ---------- 更正复盘 ----------
function logFilter(query) {
  const clauses = [];
  const params = [];
  const source = query.source === 'all' ? null : (['flow', 'system', 'admin_edit'].includes(query.source) ? query.source : 'admin_edit');
  if (source) { clauses.push('l.source = ?'); params.push(source); }
  if (query.order_no) { clauses.push('wo.order_no LIKE ?'); params.push(`%${String(query.order_no).trim()}%`); }
  if (query.field) { clauses.push('l.field = ?'); params.push(query.field); }
  if (query.action) { clauses.push('l.action = ?'); params.push(query.action); }
  if (query.reason_type) { clauses.push('l.reason_type = ?'); params.push(query.reason_type); }
  if (asId(query.operator_id)) { clauses.push('l.operator_id = ?'); params.push(asId(query.operator_id)); }
  if (query.start_date) { clauses.push('DATE(l.created_at) >= ?'); params.push(query.start_date); }
  if (query.end_date) { clauses.push('DATE(l.created_at) <= ?'); params.push(query.end_date); }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}
const decorate = row => ({ ...row, action_label: Log.ACTION_LABELS[row.action] || row.action, reason_label: Log.REASON_TYPES[row.reason_type] || null });

exports.getCorrectionLogs = async (req, res) => {
  try {
    const { where, params } = logFilter(req.query);
    const current = page(req.query.page, 100000);
    const limit = page(req.query.limit || 20, 100);
    const [rows] = await db.query(`SELECT l.*, wo.order_no FROM order_change_logs l JOIN work_orders wo ON wo.id = l.order_id ${where} ORDER BY l.id DESC LIMIT ? OFFSET ?`, [...params, limit, (current - 1) * limit]);
    const [[count]] = await db.query(`SELECT COUNT(*) AS total FROM order_change_logs l JOIN work_orders wo ON wo.id = l.order_id ${where}`, params);
    res.json({ success: true, data: { logs: rows.map(decorate), total: count.total, page: current, limit } });
  } catch (error) { send(res, error, '获取变更记录失败'); }
};
exports.exportCorrectionLogs = async (req, res) => {
  try {
    const { where, params } = logFilter(req.query);
    const [rows] = await db.query(`SELECT l.*, wo.order_no FROM order_change_logs l JOIN work_orders wo ON wo.id = l.order_id ${where} ORDER BY l.id DESC LIMIT 20000`, params);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('工单变更记录');
    sheet.columns = [
      { header: '时间', key: 'created_at', width: 20 }, { header: '工单号', key: 'order_no', width: 20 }, { header: '操作人', key: 'operator_name', width: 14 },
      { header: '操作', key: 'action_label', width: 16 }, { header: '字段', key: 'field_label', width: 14 }, { header: '修改前', key: 'old_value', width: 28 },
      { header: '修改后', key: 'new_value', width: 28 }, { header: '原因类型', key: 'reason_label', width: 14 }, { header: '原因说明', key: 'reason_note', width: 36 }, { header: 'IP', key: 'ip', width: 16 }
    ];
    rows.map(decorate).forEach(row => sheet.addRow(row));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(`changes-${today().replaceAll('-', '')}.xlsx`)}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { send(res, error, '导出失败'); }
};
exports.getCorrectionStats = async (req, res) => {
  try {
    const start = /^\d{4}-\d{2}-\d{2}$/.test(req.query.start_date || '') ? req.query.start_date : daysAgo(29);
    const end = /^\d{4}-\d{2}-\d{2}$/.test(req.query.end_date || '') ? req.query.end_date : today();
    const range = [start, end];
    const base = "FROM order_change_logs l JOIN work_orders wo ON wo.id = l.order_id WHERE l.source = 'admin_edit' AND DATE(wo.created_at) BETWEEN ? AND ?";
    const [[totals]] = await db.query('SELECT COUNT(*) AS total_orders, COALESCE(SUM(wo.correction_count > 0), 0) AS corrected_orders, COALESCE(SUM(wo.correction_count), 0) AS correction_times FROM work_orders wo WHERE DATE(wo.created_at) BETWEEN ? AND ?', range);
    const [[fee]] = await db.query(`SELECT COUNT(DISTINCT l.order_id) AS fee_corrected_orders ${base} AND l.field = 'final_price'`, range);
    const [reasons] = await db.query(`SELECT COALESCE(l.reason_type, 'unknown') AS reason_type, COUNT(DISTINCT l.batch_id) AS count ${base} GROUP BY COALESCE(l.reason_type, 'unknown') ORDER BY count DESC`, range);
    const [fields] = await db.query(`SELECT l.field, MAX(l.field_label) AS label, COUNT(*) AS count ${base} AND l.field IS NOT NULL GROUP BY l.field ORDER BY count DESC LIMIT 12`, range);
    const [operators] = await db.query(`SELECT l.operator_name AS name, COUNT(DISTINCT l.batch_id) AS count ${base} GROUP BY l.operator_id, l.operator_name ORDER BY count DESC LIMIT 10`, range);
    const [services] = await db.query(`SELECT s.name, COUNT(DISTINCT l.order_id) AS corrected_orders ${base.replace('WHERE', 'JOIN services s ON s.id = wo.service_id WHERE')} GROUP BY s.id, s.name ORDER BY corrected_orders DESC LIMIT 10`, range);
    const [workers] = await db.query(`SELECT u.nickname AS name, COUNT(DISTINCT l.order_id) AS corrected_orders ${base.replace('WHERE', 'JOIN users u ON u.id = wo.worker_id WHERE')} GROUP BY u.id, u.nickname ORDER BY corrected_orders DESC LIMIT 10`, range);
    const total = Number(totals.total_orders) || 0;
    res.json({ success: true, data: {
      range: { start_date: start, end_date: end },
      totals: { total_orders: total, corrected_orders: Number(totals.corrected_orders), correction_times: Number(totals.correction_times),
        correction_rate: total ? Math.round(Number(totals.corrected_orders) / total * 1000) / 10 : 0, fee_corrected_orders: Number(fee.fee_corrected_orders) },
      reasons: reasons.map(row => ({ ...row, label: Log.REASON_TYPES[row.reason_type] || '未填写' })),
      fields, operators, services, workers
    } });
  } catch (error) { send(res, error, '获取复盘数据失败'); }
};
