const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  let connection;

  try {
    // 连接数据库
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    console.log('✅ 连接数据库成功');

    // 创建数据库（如果不存在）
    const dbName = process.env.DB_NAME || 'waterproof_system';
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ 数据库 ${dbName} 已创建或已存在`);

    // 使用数据库
    await connection.query(`USE ${dbName}`);

    // 创建用户表
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        openid VARCHAR(100) UNIQUE NOT NULL COMMENT '微信openid',
        union_id VARCHAR(100) COMMENT '微信unionid',
        nickname VARCHAR(100) COMMENT '昵称',
        avatar_url VARCHAR(500) COMMENT '头像URL',
        phone VARCHAR(20) COMMENT '手机号',
        role ENUM('customer', 'worker', 'admin') DEFAULT 'customer' COMMENT '角色：客户/师傅/管理员',
        status ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_openid (openid),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
    `;

    await connection.query(createUsersTable);
    console.log('✅ 用户表创建成功');

    console.log('\n🎉 数据库迁移完成！');
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行迁移
migrate();
