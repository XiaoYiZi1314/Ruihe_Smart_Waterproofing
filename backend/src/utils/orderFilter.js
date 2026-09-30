// 快捷筛选：客服每天最常看的几类“需要处理”的工单
const QUICK = {
  unassigned: "wo.status = 'pending' AND wo.created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)",
  unaccepted: "wo.status = 'confirmed' AND wo.confirmed_at IS NULL AND wo.assigned_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)",
  urged: "wo.urge_count > 0 AND wo.status NOT IN ('completed', 'cancelled')",
  dispute: "wo.status = 'price_negotiating'",
  exception: 'wo.is_exception = 1',
  corrected: 'wo.correction_count > 0',
  request: "EXISTS (SELECT 1 FROM order_change_requests r WHERE r.order_id = wo.id AND r.status = 'pending')"
};
function orderFilter(query) {
  const clauses = ['1=1'];
  const params = [];
  for (const [key, sql] of Object.entries({ status: 'wo.status = ?', worker_id: 'wo.worker_id = ?', start_date: 'DATE(wo.created_at) >= ?', end_date: 'DATE(wo.created_at) <= ?' })) {
    if (query[key]) { clauses.push(sql); params.push(query[key]); }
  }
  if (query.keyword) { clauses.push('(wo.order_no LIKE ? OR wo.contact_name LIKE ? OR wo.contact_phone LIKE ?)'); params.push(...Array(3).fill(`%${query.keyword}%`)); }
  if (query.quick && Object.prototype.hasOwnProperty.call(QUICK, query.quick)) clauses.push(`(${QUICK[query.quick]})`);
  return { whereClause: clauses.join(' AND '), params };
}
module.exports = { orderFilter, QUICK };
