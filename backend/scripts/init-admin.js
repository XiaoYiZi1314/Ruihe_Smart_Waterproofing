/**
 * 管理员账号初始化脚本
 *
 * 用法：
 *   cd backend
 *   node scripts/init-admin.js                    # 交互式设置（需要 TTY）
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD=xxx \
 *     node scripts/init-admin.js                  # 环境变量方式
 *
 * 作用：
 *   在 users 表中创建（或重置）管理员账号，密码使用 bcrypt 哈希。
 *   管理后台通过 POST /api/auth/admin-login 使用该账号登录。
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function initAdmin() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'waterproof_system'
    });

    console.log('✅ 连接数据库成功');

    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD;
    if (!password || password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new Error('ADMIN_PASSWORD must be explicitly set to a strong password (12+ characters)');
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    // 查询是否已存在管理员
    const [existing] = await connection.query(
      "SELECT id FROM users WHERE username = ? AND role = 'admin' LIMIT 1",
      [username]
    );

    if (existing.length > 0) {
      if (process.env.ADMIN_RESET_CONFIRM !== 'yes') throw new Error('Set ADMIN_RESET_CONFIRM=yes to reset an existing administrator');
      // 重置密码
      await connection.query(
        'UPDATE users SET password = ?, token_version = token_version + 1, nickname = COALESCE(nickname, ?), status = ? WHERE id = ?',
        [passwordHash, '管理员', 'active', existing[0].id]
      );
      console.log(`✅ 管理员账号已重置：${username}（ID: ${existing[0].id}）`);
    } else {
      // 创建管理员（openid 使用固定标识）
      const [result] = await connection.query(
        `INSERT INTO users (openid, username, password, nickname, role, status)
         VALUES (?, ?, ?, ?, 'admin', 'active')
         ON DUPLICATE KEY UPDATE password = VALUES(password)`,
        [`admin_${username}`, username, passwordHash, '管理员']
      );
      console.log(`✅ 管理员账号已创建：${username}（ID: ${result.insertId}）`);
    }

    console.log('\n📋 登录信息：');
    console.log(`   账号: ${username}`);
    console.log('   密码已安全设置，不输出明文');
    console.log('\n   管理后台登录接口: POST /api/auth/admin-login');
  } catch (error) {
    console.error('\n❌ 初始化管理员失败:', error.message);
    console.error('请检查 backend/.env 中的数据库配置');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initAdmin();
