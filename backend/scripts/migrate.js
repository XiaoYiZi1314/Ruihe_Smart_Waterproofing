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

    // 创建服务分类表
    const createCategoriesTable = `
      CREATE TABLE IF NOT EXISTS service_categories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL COMMENT '分类名称',
        icon VARCHAR(200) COMMENT '图标URL',
        sort_order INT DEFAULT 0 COMMENT '排序',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sort (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='服务分类表';
    `;
    await connection.query(createCategoriesTable);
    console.log('✅ 服务分类表创建成功');

    // 创建服务项目表
    const createServicesTable = `
      CREATE TABLE IF NOT EXISTS services (
        id INT PRIMARY KEY AUTO_INCREMENT,
        category_id INT NOT NULL COMMENT '分类ID',
        name VARCHAR(100) NOT NULL COMMENT '服务名称',
        description TEXT COMMENT '服务描述',
        cover_image VARCHAR(500) COMMENT '封面图',
        images TEXT COMMENT '详情图片（JSON数组）',
        highlights TEXT COMMENT '服务亮点（JSON数组）',
        price_min DECIMAL(10,2) COMMENT '价格区间-最低',
        price_max DECIMAL(10,2) COMMENT '价格区间-最高',
        price_unit VARCHAR(20) DEFAULT '元' COMMENT '价格单位',
        is_hot TINYINT(1) DEFAULT 0 COMMENT '是否热门',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否上架',
        sort_order INT DEFAULT 0 COMMENT '排序',
        view_count INT DEFAULT 0 COMMENT '浏览次数',
        order_count INT DEFAULT 0 COMMENT '预约次数',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES service_categories(id),
        INDEX idx_category (category_id),
        INDEX idx_hot (is_hot),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='服务项目表';
    `;
    await connection.query(createServicesTable);
    console.log('✅ 服务项目表创建成功');

    // 创建轮播图表
    const createBannersTable = `
      CREATE TABLE IF NOT EXISTS banners (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(100) COMMENT '标题',
        image_url VARCHAR(500) NOT NULL COMMENT '图片URL',
        link_type ENUM('none', 'service', 'url') DEFAULT 'none' COMMENT '跳转类型',
        link_value VARCHAR(500) COMMENT '跳转值（服务ID或URL）',
        sort_order INT DEFAULT 0 COMMENT '排序（数字越小越靠前）',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sort (sort_order),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='轮播图表';
    `;
    await connection.query(createBannersTable);
    console.log('✅ 轮播图表创建成功');

    // 创建地址表
    const createAddressesTable = `
      CREATE TABLE IF NOT EXISTS addresses (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL COMMENT '用户ID',
        contact_name VARCHAR(50) NOT NULL COMMENT '联系人姓名',
        contact_phone VARCHAR(20) NOT NULL COMMENT '联系电话',
        province VARCHAR(50) COMMENT '省份',
        city VARCHAR(50) COMMENT '城市',
        district VARCHAR(50) COMMENT '区县',
        detail_address VARCHAR(500) NOT NULL COMMENT '详细地址',
        is_default TINYINT(1) DEFAULT 0 COMMENT '是否默认地址',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_user (user_id),
        INDEX idx_default (is_default)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='地址表';
    `;
    await connection.query(createAddressesTable);
    console.log('✅ 地址表创建成功');

    // 创建工单表
    const createWorkOrdersTable = `
      CREATE TABLE IF NOT EXISTS work_orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_no VARCHAR(32) UNIQUE NOT NULL COMMENT '工单号',
        user_id INT NOT NULL COMMENT '客户ID',
        service_id INT NOT NULL COMMENT '服务项目ID',
        address_id INT NOT NULL COMMENT '地址ID',

        contact_name VARCHAR(50) NOT NULL COMMENT '联系人',
        contact_phone VARCHAR(20) NOT NULL COMMENT '联系电话',
        full_address VARCHAR(500) NOT NULL COMMENT '完整地址',
        booking_source VARCHAR(20) NOT NULL DEFAULT 'miniapp' COMMENT '预约来源：miniapp=小程序 phone=电话登记',

        expected_price DECIMAL(10,2) COMMENT '期望价格',
        final_price DECIMAL(10,2) COMMENT '最终价格',
        door_fee DECIMAL(10,2) COMMENT '上门费',
        material_fee DECIMAL(10,2) COMMENT '材料费',
        labor_fee DECIMAL(10,2) COMMENT '工时费',

        remark TEXT COMMENT '客户备注',

        status ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending' COMMENT '状态',

        worker_id INT COMMENT '师傅ID',
        estimated_time DATETIME COMMENT '预计上门时间',

        confirmed_at DATETIME COMMENT '确认时间',
        started_at DATETIME COMMENT '开始施工时间',
        completed_at DATETIME COMMENT '完工时间',
        finished_at DATETIME COMMENT '完成时间',
        cancelled_at DATETIME COMMENT '取消时间',

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (service_id) REFERENCES services(id),
        FOREIGN KEY (worker_id) REFERENCES users(id),
        INDEX idx_order_no (order_no),
        INDEX idx_user (user_id),
        INDEX idx_worker (worker_id),
        INDEX idx_status (status),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工单表';
    `;
    await connection.query(createWorkOrdersTable);
    console.log('✅ 工单表创建成功');

    // 创建工单图片表
    const createWorkOrderImagesTable = `
      CREATE TABLE IF NOT EXISTS work_order_images (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL COMMENT '工单ID',
        image_url VARCHAR(500) NOT NULL COMMENT '图片URL',
        image_type ENUM('scene', 'before', 'after') DEFAULT 'scene' COMMENT '图片类型',
        sort_order INT DEFAULT 0 COMMENT '排序',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
        INDEX idx_order (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工单图片表';
    `;
    await connection.query(createWorkOrderImagesTable);
    console.log('✅ 工单图片表创建成功');

    // 创建站点配置表
    const createSiteConfigTable = `
      CREATE TABLE IF NOT EXISTS site_config (
        id INT PRIMARY KEY AUTO_INCREMENT,
        config_key VARCHAR(50) UNIQUE NOT NULL COMMENT '配置键',
        config_value TEXT COMMENT '配置值',
        config_type ENUM('text', 'json', 'image') DEFAULT 'text' COMMENT '配置类型',
        description VARCHAR(200) COMMENT '配置说明',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_key (config_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站点配置表';
    `;
    await connection.query(createSiteConfigTable);
    console.log('✅ 站点配置表创建成功');

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
