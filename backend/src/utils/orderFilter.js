function orderFilter(query) {
  const clauses = ['1=1'];
  const params = [];
  for (const [key, sql] of Object.entries({ status: 'wo.status = ?', worker_id: 'wo.worker_id = ?', start_date: 'DATE(wo.created_at) >= ?', end_date: 'DATE(wo.created_at) <= ?' })) {
    if (query[key]) { clauses.push(sql); params.push(query[key]); }
  }
  if (query.keyword) { clauses.push('(wo.order_no LIKE ? OR wo.contact_name LIKE ? OR wo.contact_phone LIKE ?)'); params.push(...Array(3).fill(`%${query.keyword}%`)); }
  return { whereClause: clauses.join(' AND '), params };
}
module.exports = { orderFilter };
