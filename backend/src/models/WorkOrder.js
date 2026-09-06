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
      service_id, address_id, expected_price, remark, images,
      contact_name, contact_phone
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

    // 使用前端传入的联系人信息，如果没有则使用地址中的
    const finalContactName = contact_name || address.contact_name;
    const finalContactPhone = contact_phone || address.contact_phone;

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
        [orderNo, userId, service_id, address_id, finalContactName,
         finalContactPhone, fullAddress, expected_price, remark]
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
    params.push(Number(limit), Number(offset));

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

    // 获取评价（如果有）
    const [reviews] = await db.query(
      'SELECT id, service_attitude_score, quality_score, price_score, comment, created_at FROM reviews WHERE order_id = ?',
      [id]
    );
    order.review = reviews.length > 0 ? reviews[0] : null;

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

  /**
   * 催单
   */
  static async urge(id) {
    const [result] = await db.query(
      `UPDATE work_orders
       SET urge_count = urge_count + 1
       WHERE id = ? AND status IN ('pending', 'confirmed')`,
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * 确认完成
   */
  static async confirm(id) {
    const [result] = await db.query(
      `UPDATE work_orders
       SET status = 'completed', finished_at = NOW()
       WHERE id = ? AND status = 'pending_review'`,
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * 价格异议
   */
  static async disputePrice(id, reason) {
    const [result] = await db.query(
      `UPDATE work_orders
       SET status = 'price_negotiating', 
           price_dispute_reason = ?,
           updated_at = NOW()
       WHERE id = ? AND status = 'pending_review'`,
      [reason, id]
    );
    return result.affectedRows > 0;
  }

  /**
   * 提交评价
   */
  static async submitReview(orderId, userId, reviewData) {
    // 检查工单状态
    const [orders] = await db.query(
      'SELECT worker_id, status FROM work_orders WHERE id = ?',
      [orderId]
    );

    if (orders.length === 0) {
      throw new Error('工单不存在');
    }

    const order = orders[0];
    if (order.status !== 'completed') {
      return false;
    }

    if (!order.worker_id) {
      throw new Error('工单未指派师傅');
    }

    // 检查是否已评价
    const [existing] = await db.query(
      'SELECT id FROM reviews WHERE order_id = ?',
      [orderId]
    );

    if (existing.length > 0) {
      throw new Error('已经评价过此工单');
    }

    // 插入评价
    await db.query(
      `INSERT INTO reviews 
       (order_id, user_id, worker_id, service_attitude_score, quality_score, 
        price_score, comment, video_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        userId,
        order.worker_id,
        reviewData.service_attitude_score,
        reviewData.quality_score,
        reviewData.price_score,
        reviewData.comment || null,
        reviewData.video_url || null
      ]
    );

    return true;
  }

  /**
   * 删除评价
   */
  static async deleteReview(orderId, userId) {
    const [result] = await db.query(
      'DELETE FROM reviews WHERE order_id = ? AND user_id = ?',
      [orderId, userId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = WorkOrder;
