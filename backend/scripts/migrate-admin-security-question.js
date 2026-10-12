// 管理员密码保护：密保问题和答案哈希。可重复执行。
const mysql = require('mysql2/promise');
require('dotenv').config();
const { DEFAULT_SECURITY_QUESTION } = require('../src/utils/securityQuestion');

async function migrate() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  try {
    for (const [column, definition] of Object.entries({
      security_question: "VARCHAR(100) NULL COMMENT '管理员密码保护问题'",
      security_answer_hash: "VARCHAR(255) NULL COMMENT '管理员密码保护答案哈希'"
    })) {
      const [rows] = await db.query(
        'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        ['users', column]
      );
      if (!rows.length) await db.query(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
    }
    const [result] = await db.query(
      "UPDATE users SET security_question = ? WHERE role = 'admin' AND (security_question IS NULL OR security_question = '')",
      [DEFAULT_SECURITY_QUESTION]
    );
    console.log(`Admin security-question migration complete (additive and repeatable), backfilled: ${result.affectedRows}`);
  } finally {
    await db.end();
  }
}

if (require.main === module) migrate().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = migrate;
