const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const db = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  try {
    for (const [table, columns] of Object.entries({
      users: { archived_phone: 'VARCHAR(20) NULL', token_version: 'INT NOT NULL DEFAULT 0', must_change_password: 'TINYINT NOT NULL DEFAULT 0', wechat_openid: 'VARCHAR(100) NULL' },
      work_orders: { assigned_at: 'DATETIME NULL', auto_complete_at: 'DATETIME NULL', dispute_started_at: 'DATETIME NULL', cancel_reason: 'TEXT NULL', review_submitted_at: 'DATETIME NULL' }
    })) {
      for (const [column, definition] of Object.entries(columns)) {
        const [rows] = await db.query('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [table, column]);
        if (!rows.length) await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    }
    await db.query(`UPDATE work_orders wo SET assigned_at = COALESCE(
      (SELECT MAX(created_at) FROM operation_logs WHERE order_id = wo.id AND action = 'assign'), confirmed_at, updated_at)
      WHERE worker_id IS NOT NULL AND assigned_at IS NULL`);
    await db.query(`UPDATE work_orders SET auto_complete_at = DATE_ADD(COALESCE(price_adjusted_at, completed_at), INTERVAL 3 DAY)
      WHERE status IN ('pending_review','price_negotiating') AND auto_complete_at IS NULL`);
    await db.query("UPDATE work_orders SET dispute_started_at = updated_at WHERE status = 'price_negotiating' AND dispute_started_at IS NULL");
    await db.query(`UPDATE work_orders wo JOIN reviews r ON r.order_id = wo.id SET wo.review_submitted_at = r.created_at WHERE wo.review_submitted_at IS NULL`);
    await db.query(`CREATE TABLE IF NOT EXISTS uploads (
      id CHAR(36) PRIMARY KEY, user_id INT NOT NULL, filename VARCHAR(255) NOT NULL UNIQUE,
      mime_type VARCHAR(100) NOT NULL, size_bytes BIGINT NOT NULL, is_public TINYINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_upload_user(user_id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const [idx] = await db.query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='idx_wechat_openid'");
    if (!idx.length) await db.query('ALTER TABLE users ADD UNIQUE INDEX idx_wechat_openid (wechat_openid)');
    console.log('Review migration complete (additive and repeatable)');
  } finally { await db.end(); }
}
if (require.main === module) migrate().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = migrate;
