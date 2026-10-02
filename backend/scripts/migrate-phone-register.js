// 电话登记工单：工单增加预约来源，地址详情加长到与工单地址一致。
// 只增不改：可重复执行。
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
    const [source] = await db.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'work_orders' AND COLUMN_NAME = 'booking_source'"
    );
    if (!source.length) {
      await db.query("ALTER TABLE work_orders ADD COLUMN booking_source VARCHAR(20) NOT NULL DEFAULT 'miniapp' COMMENT '预约来源：miniapp=小程序 phone=电话登记'");
    }
    const [addr] = await db.query(
      "SELECT CHARACTER_MAXIMUM_LENGTH AS len FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'addresses' AND COLUMN_NAME = 'detail_address'"
    );
    if (addr[0] && Number(addr[0].len) < 500) {
      await db.query('ALTER TABLE addresses MODIFY COLUMN detail_address VARCHAR(500) NOT NULL COMMENT \'详细地址\'');
    }
    console.log('Phone register migration complete (additive and repeatable)');
  } finally {
    await db.end();
  }
}

if (require.main === module) migrate().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = migrate;
