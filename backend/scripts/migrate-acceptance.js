const mysql = require('mysql2/promise');
require('dotenv').config();
async function migrate() {
  const db = await mysql.createConnection({host:process.env.DB_HOST||'localhost',port:process.env.DB_PORT||3306,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS order_sequences (
      order_date CHAR(8) PRIMARY KEY, \`last_value\` INT UNSIGNED NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    // Re-running this migration never decreases a used sequence or renumbers old orders.
    await db.query(`INSERT INTO order_sequences(order_date,\`last_value\`)
      SELECT order_date, MAX(seq) FROM (
        SELECT SUBSTRING(order_no,3,8) AS order_date, CAST(RIGHT(order_no,5) AS UNSIGNED) AS seq
        FROM work_orders WHERE order_no REGEXP '^RH[0-9]{13}$'
        UNION ALL
        SELECT SUBSTRING(order_no,3,8), CAST(RIGHT(order_no,4) AS UNSIGNED)
        FROM work_orders WHERE order_no REGEXP '^RH[0-9]{12}$'
      ) numbered
      GROUP BY order_date
      ON DUPLICATE KEY UPDATE \`last_value\`=GREATEST(\`last_value\`,VALUES(\`last_value\`))`);
    // Only replace the known demo join content; preserve any manually configured information.
    const [configs] = await db.query("SELECT config_value FROM site_config WHERE config_key='join_info'");
    let join = {};
    if (configs.length) {
      try { join = JSON.parse(configs[0].config_value); } catch { join = null; }
    }
    if (join && (!configs.length || ['400-888-9999', '4008889999'].includes(join.join_phone || join.phone))) {
      const value = JSON.stringify(require('../data/confirmed-join-info.json'));
      await db.query(`INSERT INTO site_config(config_key,config_value,config_type,description) VALUES('join_info',?,'json','加盟信息')
        ON DUPLICATE KEY UPDATE config_value=VALUES(config_value),config_type='json'`, [value]);
      console.log('Known demo join content replaced with acceptance-confirmed text');
    } else {
      console.log('Existing custom join content preserved; compare it with acceptance-confirmed text');
    }
    console.log('Acceptance migration complete: daily order sequences ready');
  } finally { await db.end(); }
}
if (require.main === module) migrate().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports=migrate;
