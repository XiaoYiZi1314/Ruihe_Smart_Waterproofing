const DATE_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
function orderDate(now = new Date()) {
  const parts = Object.fromEntries(DATE_FORMAT.formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}`;
}
// The daily row is locked by this transaction until the order is committed.
async function nextOrderNo(connection, now = new Date()) {
  const date = orderDate(now);
  await connection.query(`INSERT INTO order_sequences (order_date, \`last_value\`) VALUES (?, 0)
    ON DUPLICATE KEY UPDATE order_date = VALUES(order_date)`, [date]);
  const [rows] = await connection.query('SELECT `last_value` FROM order_sequences WHERE order_date = ? FOR UPDATE', [date]);
  const next = Number(rows[0].last_value) + 1;
  if (next > 9999) throw Object.assign(new Error('当日预约数量已达上限，请稍后联系人工客服'), { status: 409 });
  await connection.query('UPDATE order_sequences SET `last_value` = ? WHERE order_date = ?', [next, date]);
  return `RH${date}${String(next).padStart(4, '0')}`;
}
module.exports = { nextOrderNo, orderDate };
