// 操作日志只保留管理端：删除客户/师傅写入的历史记录，释放空间。
// 可重复执行：系统（user_id 为空）和管理员记录不动。
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  try {
    const [result] = await db.query(
      `DELETE ol FROM operation_logs ol
       LEFT JOIN users u ON u.id = ol.user_id
       WHERE ol.user_id IS NOT NULL AND IFNULL(u.role, '') <> 'admin'`
    );
    console.log(`Admin operation-log cleanup complete (repeatable), removed: ${result.affectedRows}`);
  } finally {
    await db.end();
  }
}

if (require.main === module) migrate().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = migrate;
