// 服务亮点：按服务项目保存短文案列表，给详情页展示。
// 只增不改：可重复执行。已有服务回填当前页面上的三个默认亮点，避免上线后空白。
const mysql = require('mysql2/promise');
require('dotenv').config();
const { DEFAULT_HIGHLIGHTS } = require('../src/utils/serviceHighlights');

async function migrate() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  try {
    const [column] = await db.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'services' AND COLUMN_NAME = 'highlights'"
    );
    if (!column.length) {
      await db.query("ALTER TABLE services ADD COLUMN highlights TEXT NULL COMMENT '服务亮点（JSON数组）' AFTER images");
    }
    const payload = JSON.stringify(DEFAULT_HIGHLIGHTS);
    const [result] = await db.query(
      'UPDATE services SET highlights = ? WHERE highlights IS NULL OR highlights = \'\'',
      [payload]
    );
    console.log(`Service highlights migration complete (additive and repeatable), backfilled: ${result.affectedRows}`);
  } finally {
    await db.end();
  }
}

if (require.main === module) migrate().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = migrate;
