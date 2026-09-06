/**
 * 第三阶段数据库迁移脚本
 * 扩展工单流转、评价系统、操作日志
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  let connection;

  try {
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'waterproof_user',
      password: process.env.DB_PASSWORD || 'waterproof123',
      database: process.env.DB_NAME || 'waterproof_system'
    });

    console.log('📦 开始第三阶段数据库迁移...\n');

    // 1. 扩展用户表 - 添加师傅状态和统计字段
    console.log('1️⃣  扩展用户表...');
    // 1. 扩展用户表 - 添加师傅状态和统计字段
    console.log('1️⃣  扩展用户表...');
    // MySQL 8.0 不支持 ADD COLUMN IF NOT EXISTS，用 information_schema 检查
    const userNewColumns = [
      ["worker_status", "ENUM('working', 'resting') DEFAULT 'working' COMMENT '师傅状态'"],
      ['reject_count', "INT DEFAULT 0 COMMENT '拒单次数'"],
      ['assign_count', "INT DEFAULT 0 COMMENT '指派次数'"],
      ['username', "VARCHAR(50) NULL COMMENT '登录账号（管理后台）'"],
      ['password', "VARCHAR(255) NULL COMMENT '密码哈希（管理后台）'"]
    ];
    for (const [col, def] of userNewColumns) {
      const [cols] = await connection.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
        [col]
      );
      if (cols[0].cnt === 0) {
        await connection.query(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
      }
    }
    // username 唯一索引
    const [usernameIdx] = await connection.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_username'`
    );
    if (usernameIdx[0].cnt === 0) {
      await connection.query('ALTER TABLE users ADD UNIQUE INDEX idx_username (username)');
    }
    console.log('   ✅ 用户表扩展成功');

    // 2. 扩展工单表 - 完善状态和流转字段
    console.log('\n2️⃣  扩展工单表...');
    
    // 2.1 修改状态枚举
    try {
      await connection.query(`
        ALTER TABLE work_orders 
        MODIFY COLUMN status ENUM(
          'pending',           
          'confirmed',         
          'in_progress',       
          'pending_review',    
          'price_negotiating', 
          'completed',         
          'cancelled'          
        ) DEFAULT 'pending' COMMENT '工单状态'
      `);
      console.log('   ✅ 工单状态枚举更新成功');
    } catch (err) {
      console.log('   ⚠️  状态枚举更新失败:', err.message);
    }

    // 2.2 添加新字段（MySQL 8.0 兼容：先查 information_schema）
    const newOrderFields = [
      ['urge_count', "INT DEFAULT 0 COMMENT '催单次数'"],
      ['reject_reason', "TEXT COMMENT '拒单理由'"],
      ['rejected_at', "DATETIME COMMENT '拒单时间'"],
      ['price_dispute_reason', "TEXT COMMENT '价格异议原因'"],
      ['price_adjusted_at', "DATETIME COMMENT '价格调整时间'"],
      ['is_exception', "TINYINT(1) DEFAULT 0 COMMENT '是否异常工单'"]
    ];

    for (const [col, def] of newOrderFields) {
      const [cols] = await connection.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'work_orders' AND COLUMN_NAME = ?`,
        [col]
      );
      if (cols[0].cnt === 0) {
        await connection.query(`ALTER TABLE work_orders ADD COLUMN ${col} ${def}`);
      }
    }
    console.log('   ✅ 工单表扩展成功');

    // 3. 创建评价表
    console.log('\n3️⃣  创建评价表...');
    const createReviewsTable = `
      CREATE TABLE IF NOT EXISTS reviews (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL COMMENT '工单ID',
        user_id INT NOT NULL COMMENT '客户ID',
        worker_id INT NOT NULL COMMENT '师傅ID',
        service_attitude_score TINYINT COMMENT '服务态度评分(1-5)',
        quality_score TINYINT COMMENT '施工质量评分(1-5)',
        price_score TINYINT COMMENT '收费合理性评分(1-5)',
        comment TEXT COMMENT '文字评价',
        video_url VARCHAR(500) COMMENT '视频评价URL',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (worker_id) REFERENCES users(id),
        INDEX idx_order (order_id),
        INDEX idx_worker (worker_id),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评价表';
    `;
    await connection.query(createReviewsTable);
    console.log('   ✅ 评价表创建成功');

    // 4. 创建操作日志表
    console.log('\n4️⃣  创建操作日志表...');
    const createOperationLogsTable = `
      CREATE TABLE IF NOT EXISTS operation_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL COMMENT '操作人ID',
        order_id INT COMMENT '工单ID',
        action VARCHAR(50) NOT NULL COMMENT '操作类型',
        detail TEXT COMMENT '操作详情',
        ip VARCHAR(50) COMMENT 'IP地址',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_user (user_id),
        INDEX idx_order (order_id),
        INDEX idx_action (action),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';
    `;
    await connection.query(createOperationLogsTable);
    console.log('   ✅ 操作日志表创建成功');

    // 5. 创建消息通知记录表
    console.log('\n5️⃣  创建消息通知记录表...');
    const createNotificationsTable = `
      CREATE TABLE IF NOT EXISTS notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL COMMENT '接收用户ID',
        order_id INT COMMENT '关联工单ID',
        type VARCHAR(50) NOT NULL COMMENT '通知类型',
        title VARCHAR(100) COMMENT '通知标题',
        content TEXT COMMENT '通知内容',
        is_read TINYINT(1) DEFAULT 0 COMMENT '是否已读',
        template_id VARCHAR(100) COMMENT '微信模板ID',
        send_status ENUM('pending', 'success', 'failed') DEFAULT 'pending' COMMENT '发送状态',
        error_msg TEXT COMMENT '错误信息',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_user (user_id),
        INDEX idx_order (order_id),
        INDEX idx_type (type),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息通知记录表';
    `;
    await connection.query(createNotificationsTable);
    console.log('   ✅ 消息通知记录表创建成功');

    // 6. 添加索引优化
    console.log('\n6️⃣  优化索引...');
    const newIndexes = [
      ['idx_worker_status', '(worker_id, status)'],
      ['idx_status_created', '(status, created_at)'],
      ['idx_exception', '(is_exception)']
    ];
    for (const [idxName, cols] of newIndexes) {
      const [idx] = await connection.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'work_orders' AND INDEX_NAME = ?`,
        [idxName]
      );
      if (idx[0].cnt === 0) {
        await connection.query(`ALTER TABLE work_orders ADD INDEX ${idxName} ${cols}`);
      }
    }
    console.log('   ✅ 索引优化成功');

    console.log('\n🎉 第三阶段数据库迁移完成！\n');

    // 显示统计信息
    const [tables] = await connection.query(`
      SELECT TABLE_NAME, TABLE_ROWS, 
             ROUND(DATA_LENGTH/1024/1024, 2) AS 'SIZE_MB'
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `, [process.env.DB_NAME || 'waterproof_system']);

    console.log('📊 数据库表统计：');
    console.table(tables);

  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行迁移
migrate();
