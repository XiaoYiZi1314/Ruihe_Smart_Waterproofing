const db = require('../config/database');

class WorkOrder {
  /**
   * 生成工单号
   */
  static generateOrderNo() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `WO${timestamp}${random}`;
  }

  /**
   * 创建工单
   */
  static async create(userId, data) {
    const {
      service_id, address_id, expected_price, remark, images
    } = data;

    // 获取地址信息
    const [addressRows] = await db.query(
      'SELECT * FROM addresses WHERE id = ? AND user_id = ?',
      [address_id, userId]
    );

    if (addressRows.length === 0) {
      throw new Error('地址不存在或不属于当前用户');
    }

    const address = addressRows[0];

    // 构建完整地址
    const fullAddress = `${address.province || ''}${address.city || ''}${address.district || ''}${address.detail_address}`;

    // 生成工单号
    const orderNo = this.generateOrderNo();

    // 开始事务
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // 插入工单
      const [result] = await connection.query(
        `INSERT INTO work_orders
         (order_no, user_id, service_id, address_id, contact_name, contact_phone,
          full_address, expected_price, remark, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [orderNo, userId, service_id, address_id, address.contact_name,
         address.contact_phone, fullAddress, expected_price, remark]
      );

      const orderId = result.insertId;

      // 插入工单图片
      if (images && Array.isArray(images) && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          await connection.query(
            'INSERT INTO work_order_images (order_id, image_url, image_type, sort_order) VALUES (?, ?, ?, ?)',
            [orderId, images[i], 'scene', i]
          );
        }
      }

      // 增加服务的预约次数
      await connection.query(
        'UPDATE services SET order_count = order_count + 1 WHERE id = ?',
        [service_id]
      );

      await connection.commit();

      return {
        id: orderId,
        order_no: orderNo
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取用户的工单列表
   */
  static async getByUserId(userId, options = {}) {
    const { status, page = 1, limit = 10 } = options;

    let query = `
      SELECT
        wo.*,
        s.name as service_name,
        s.cover_image as service_cover
      FROM work_orders wo
      LEFT JOIN services s ON wo.service_id = s.id
      WHERE wo.user_id = ?
    `;

    const params = [userId];

    // 按状态筛选
    if (status) {
      query += ' AND wo.status = ?';
      params.push(status);
    }

    // 排序
    query += ' ORDER BY wo.created_at DESC';

    // 分页
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM work_orders WHERE user_id = ?';
    const countParams = [userId];

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    const [countRows] = await db.query(countQuery, countParams);
    const total = countRows[0].total;

    return {
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 根据ID获取工单详情
   */
  static async getById(id) {
    const [rows] = await db.query(
      `SELECT
        wo.*,
        s.name as service_name,
        s.description as service_description,
        s.cover_image as service_cover,
        u.nickname as customer_name,
        u.avatar_url as customer_avatar,
        w.nickname as worker_name,
        w.phone as worker_phone
      FROM work_orders wo
      LEFT JOIN services s ON wo.service_id = s.id
      LEFT JOIN users u ON wo.user_id = u.id
      LEFT JOIN users w ON wo.worker_id = w.id
      WHERE wo.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    const order = rows[0];

    // 获取工单图片
    const [images] = await db.query(
      'SELECT image_url, image_type FROM work_order_images WHERE order_id = ? ORDER BY sort_order ASC',
      [id]
    );

    order.images = images;

    return order;
  }

  /**
   * 检查工单是否属于用户
   */
  static async belongsToUser(id, userId) {
    const [rows] = await db.query(
      'SELECT id FROM work_orders WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return rows.length > 0;
  }

  /**
   * 更新工单状态
   */
  static async updateStatus(id, status, extraData = {}) {
    const updates = ['status = ?'];
    const params = [status];

    // 根据状态更新对应的时间字段
    const timeFieldMap = {
      confirmed: 'confirmed_at',
      in_progress: 'started_at',
      completed: 'completed_at',
      cancelled: 'cancelled_at'
    };

    if (timeFieldMap[status]) {
      updates.push(`${timeFieldMap[status]} = NOW()`);
    }

    // 添加额外的更新字段
    Object.keys(extraData).forEach(key => {
      updates.push(`${key} = ?`);
      params.push(extraData[key]);
    });

    params.push(id);

    const [result] = await db.query(
      `UPDATE work_orders SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  /**
   * 取消工单
   */
  static async cancel(id, userId) {
    const [result] = await db.query(
      `UPDATE work_orders
       SET status = 'cancelled', cancelled_at = NOW()
       WHERE id = ? AND user_id = ? AND status = 'pending'`,
      [id, userId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = WorkOrder;
