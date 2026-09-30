const mysql = require('mysql2/promise');
require('dotenv').config();

const company = require('../data/confirmed-company-info.json');
const DEMO_PHONES = ['400-888-6688', '4008886688', '400-888-9999', '4008889999'];
const DEMO_SNIPPETS = ['科技园瑞和大厦', '南山区', '瑞和防水成立于2010年', 'ruihe_waterproof', 'service@ruihe-waterproof.com'];

function looksLikeDemo(values) {
  const text = values.join('\n');
  return DEMO_PHONES.some((phone) => text.includes(phone)) || DEMO_SNIPPETS.some((snippet) => text.includes(snippet));
}

async function upsert(db, key, value, type, description) {
  const stored = type === 'json' ? JSON.stringify(value) : String(value ?? '');
  await db.query(
    `INSERT INTO site_config (config_key, config_value, config_type, description)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), config_type = VALUES(config_type)`,
    [key, stored, type, description]
  );
}

async function migrate() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  try {
    const [rows] = await db.query(
      "SELECT config_key, config_value FROM site_config WHERE config_key IN ('contact_phone','contact_address','contact_hours','contact_wechat','contact_info','about_us')"
    );
    const current = Object.fromEntries(rows.map((row) => [row.config_key, row.config_value || '']));
    const force = process.env.FORCE_COMPANY_INFO === '1';
    if (!force && current.contact_phone && !looksLikeDemo(Object.values(current))) {
      console.log('Existing custom company content preserved');
      return;
    }
    const contactInfo = {
      address: company.contact_address,
      phone: company.contact_phone,
      mobile: company.contact_phone,
      wechat: company.contact_wechat || '',
      hours: company.contact_hours,
      business_hours: company.contact_hours,
      email: ''
    };
    await upsert(db, 'contact_phone', company.contact_phone, 'text', '联系电话');
    await upsert(db, 'contact_address', company.contact_address, 'text', '联系地址');
    await upsert(db, 'contact_hours', company.contact_hours, 'text', '营业时间');
    await upsert(db, 'contact_wechat', company.contact_wechat || '', 'text', '联系微信');
    await upsert(db, 'contact_info', contactInfo, 'json', '联系方式');
    await upsert(db, 'about_us', company.about_us, 'text', '关于我们');
    console.log('Company profile updated from confirmed-company-info.json');
  } finally {
    await db.end();
  }
}

if (require.main === module) migrate().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
module.exports = migrate;
