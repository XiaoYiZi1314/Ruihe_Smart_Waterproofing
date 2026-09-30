// 工单更正与审计：新增变更日志/跟进/变更申请三张表，以及 work_orders 的版本号与预约字段。
// 只增不改：可重复执行，不会删除或改写任何已有数据。
const mysql = require('mysql2/promise');
require('dotenv').config();

const COLUMNS = {
  work_orders: {
    revision: 'INT NOT NULL DEFAULT 0',
    correction_count: 'INT NOT NULL DEFAULT 0',
    appointment_date: 'VARCHAR(10) NULL',
    appointment_slot: 'VARCHAR(20) NULL',
    price_corrected_at: 'DATETIME NULL',
    price_before_correction: 'DECIMAL(10,2) NULL'
  },
  // 图片只做软删除，保证删除动作可追溯、文件不会被孤儿清理误删
  work_order_images: {
    deleted_at: 'DATETIME NULL',
    deleted_by: 'INT NULL'
  }
};

const TABLES = [
  `CREATE TABLE IF NOT EXISTS order_change_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    batch_id CHAR(36) NOT NULL COMMENT '同一次操作的多条字段变更共用',
    order_id INT NOT NULL,
    operator_id INT NULL,
    operator_name VARCHAR(50) NULL,
    operator_role VARCHAR(20) NULL,
    source VARCHAR(20) NOT NULL COMMENT 'flow=业务流转 admin_edit=后台更正 system=系统',
    action VARCHAR(40) NOT NULL,
    field VARCHAR(40) NULL,
    field_label VARCHAR(40) NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    reason_type VARCHAR(30) NULL,
    reason_note VARCHAR(1000) NULL,
    ip VARCHAR(64) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ocl_order (order_id, id),
    INDEX idx_ocl_batch (batch_id),
    INDEX idx_ocl_source (source, created_at),
    INDEX idx_ocl_operator (operator_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工单变更日志（只追加）'`,
  `CREATE TABLE IF NOT EXISTS order_followups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    operator_id INT NULL,
    operator_name VARCHAR(50) NULL,
    target VARCHAR(20) NOT NULL COMMENT 'customer/worker/other',
    channel VARCHAR(20) NOT NULL COMMENT 'phone/wechat/onsite/other',
    content VARCHAR(1000) NOT NULL,
    contacted_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_followup_order (order_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工单内部跟进记录（仅后台可见）'`,
  `CREATE TABLE IF NOT EXISTS order_change_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    worker_id INT NOT NULL,
    request_type VARCHAR(20) NOT NULL COMMENT 'price/time/scope/other',
    content VARCHAR(1000) NOT NULL,
    proposed_door_fee DECIMAL(10,2) NULL,
    proposed_material_fee DECIMAL(10,2) NULL,
    proposed_labor_fee DECIMAL(10,2) NULL,
    proposed_time DATETIME NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/approved/rejected',
    applied TINYINT NOT NULL DEFAULT 0,
    handled_by INT NULL,
    handled_by_name VARCHAR(50) NULL,
    handled_at DATETIME NULL,
    handle_note VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_req_order (order_id, id),
    INDEX idx_req_status (status, id),
    INDEX idx_req_worker (worker_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='师傅现场变更申请'`
];

async function migrate() {
  const db = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  try {
    for (const sql of TABLES) await db.query(sql);
    for (const [table, columns] of Object.entries(COLUMNS)) {
      for (const [column, definition] of Object.entries(columns)) {
        const [rows] = await db.query('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [table, column]);
        if (!rows.length) await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    }
    // 历史订单：把备注里的“预约时间：2026-10-01 上午 08-12”还原成结构化字段（只处理还没有值的订单）
    const [legacy] = await db.query("SELECT id, remark FROM work_orders WHERE appointment_date IS NULL AND remark LIKE '%预约时间：%'");
    let backfilled = 0;
    for (const row of legacy) {
      const match = /预约时间[：:]\s*(\d{4}-\d{2}-\d{2})\s+((?:上午|下午|晚上)\s*\d{2}-\d{2})/.exec(row.remark || '');
      if (!match) continue;
      await db.query('UPDATE work_orders SET appointment_date = ?, appointment_slot = ? WHERE id = ? AND appointment_date IS NULL', [match[1], match[2].replace(/\s+/, ' '), row.id]);
      backfilled += 1;
    }
    console.log(`Order edit migration complete (additive and repeatable), backfilled appointments: ${backfilled}`);
  } finally { await db.end(); }
}
if (require.main === module) migrate().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = migrate;
