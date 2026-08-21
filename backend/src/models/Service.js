const db = require('../config/database');

class Service {
  /**
   * 获取服务列表（分页）
   */
  static async getList(options = {}) {
    const {
      category_id,
      is_hot,
      page = 1,
      limit = 10
    } = options;

    let query = `
      SELECT
        s.id, s.category_id, s.name, s.description,
        s.cover_image, s.price_min, s.price_max, s.price_unit,
        s.is_hot, s.view_count, s.order_count,
        c.name as category_name
      FROM services s
      LEFT JOIN service_categories c ON s.category_id = c.id
      WHERE s.is_active = 1
    `;

    const params = [];

    // 按分类筛选
    if (category_id) {
      query += ' AND s.category_id = ?';
      params.push(category_id);
    }

    // 按热门筛选
    if (is_hot !== undefined) {
      query += ' AND s.is_hot = ?';
      params.push(is_hot);
    }

    // 排序
    query += ' ORDER BY s.sort_order ASC, s.created_at DESC';

    // 分页
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM services WHERE is_active = 1';
    const countParams = [];

    if (category_id) {
      countQuery += ' AND category_id = ?';
      countParams.push(category_id);
    }

    if (is_hot !== undefined) {
      countQuery += ' AND is_hot = ?';
      countParams.push(is_hot);
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
   * 根据ID获取服务详情
   */
  static async getById(id) {
    const [rows] = await db.query(
      `SELECT
        s.*,
        c.name as category_name
      FROM services s
      LEFT JOIN service_categories c ON s.category_id = c.id
      WHERE s.id = ? AND s.is_active = 1`,
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    const service = rows[0];

    // 解析图片JSON
    if (service.images) {
      try {
        service.images = JSON.parse(service.images);
      } catch (e) {
        service.images = [];
      }
    } else {
      service.images = [];
    }

    return service;
  }

  /**
   * 增加浏览次数
   */
  static async incrementViewCount(id) {
    await db.query(
      'UPDATE services SET view_count = view_count + 1 WHERE id = ?',
      [id]
    );
  }

  /**
   * 增加预约次数
   */
  static async incrementOrderCount(id) {
    await db.query(
      'UPDATE services SET order_count = order_count + 1 WHERE id = ?',
      [id]
    );
  }

  /**
   * 创建服务（管理后台使用）
   */
  static async create(data) {
    const {
      category_id, name, description, cover_image, images,
      price_min, price_max, price_unit, is_hot, sort_order
    } = data;

    const imagesJson = Array.isArray(images) ? JSON.stringify(images) : images;

    const [result] = await db.query(
      `INSERT INTO services
       (category_id, name, description, cover_image, images, price_min, price_max, price_unit, is_hot, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [category_id, name, description, cover_image, imagesJson,
       price_min, price_max, price_unit || '元', is_hot || 0, sort_order || 0]
    );

    return result.insertId;
  }

  /**
   * 更新服务（管理后台使用）
   */
  static async update(id, data) {
    const {
      category_id, name, description, cover_image, images,
      price_min, price_max, price_unit, is_hot, is_active, sort_order
    } = data;

    const imagesJson = Array.isArray(images) ? JSON.stringify(images) : images;

    const [result] = await db.query(
      `UPDATE services
       SET category_id = ?, name = ?, description = ?, cover_image = ?, images = ?,
           price_min = ?, price_max = ?, price_unit = ?, is_hot = ?, is_active = ?, sort_order = ?
       WHERE id = ?`,
      [category_id, name, description, cover_image, imagesJson,
       price_min, price_max, price_unit, is_hot, is_active, sort_order, id]
    );

    return result.affectedRows > 0;
  }

  /**
   * 删除服务（管理后台使用）
   */
  static async delete(id) {
    const [result] = await db.query(
      'DELETE FROM services WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = Service;
