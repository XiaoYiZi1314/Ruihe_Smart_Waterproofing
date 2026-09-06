/**
 * 师傅登录账号匹配：手机号、username（工号）、1-8 位数字 ID。
 * 11 位手机号不得按 INT 去比 users.id，避免 MySQL 隐式转换溢出误匹配。
 */
function buildWorkerLoginLookup(identifier) {
  const value = String(identifier || '').trim();
  const params = [value, value];
  let idClause = '';

  if (/^\d{1,8}$/.test(value)) {
    idClause = ' OR id = ?';
    params.push(Number(value));
  }

  return {
    sql: `SELECT * FROM users
       WHERE role = 'worker' AND status = 'active'
         AND (phone = ? OR username = ?${idClause})
       LIMIT 1`,
    params
  };
}

module.exports = { buildWorkerLoginLookup };
