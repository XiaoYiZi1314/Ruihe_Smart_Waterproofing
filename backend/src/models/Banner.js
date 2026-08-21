const db = require('../config/database');

class Banner {
  /**
   * 获取所有启用的轮播图
   */
  static async getAll() {
    const [rows] = await db.query(
      'SELECT id, title, image_url, link_type, link_value FROM banners WHERE is_active = 1 ORDER BY sort_order ASC'
    );
    return rows;
  }

  /**
   * 根据ID获取轮播图
   */
  static async getById(id) {
    const [rows] = await db.query(
      'SELECT * FROM banners WHERE id = ? AND is_active = 1',
      [id]
    );
    return rows[0];
  }

  /**
   * 创建轮播图（管理后台使用）
   */
  static async create(data) {
    const { title, image_url, link_type, link_value, sort_order } = data;
    const [result] = await db.query(
      'INSERT INTO banners (title, image_url, link_type, link_value, sort_order) VALUES (?, ?, ?, ?, ?)',
      [title, image_url, link_type || 'none', link_value, sort_order || 0]
    );
    return result.insertId;
  }

  /**
   * 更新轮播图（管理后台使用）
   */
  static async update(id, data) {
    const { title, image_url, link_type, link_value, sort_order, is_active } = data;
    const [result] = await db.query(
      'UPDATE banners SET title = ?, image_url = ?, link_type = ?, link_value = ?, sort_order = ?, is_active = ? WHERE id = ?',
      [title, image_url, link_type, link_value, sort_order, is_active, id]
    );
    return result.affectedRows > 0;
  }

  /**
   * 删除轮播图（管理后台使用）
   */
  static async delete(id) {
    const [result] = await db.query(
      'DELETE FROM banners WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = Banner;
