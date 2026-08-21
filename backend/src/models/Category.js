const db = require('../config/database');

class Category {
  /**
   * 获取所有启用的分类
   */
  static async getAll() {
    const [rows] = await db.query(
      'SELECT id, name, icon, sort_order FROM service_categories WHERE is_active = 1 ORDER BY sort_order ASC'
    );
    return rows;
  }

  /**
   * 根据ID获取分类
   */
  static async getById(id) {
    const [rows] = await db.query(
      'SELECT * FROM service_categories WHERE id = ? AND is_active = 1',
      [id]
    );
    return rows[0];
  }

  /**
   * 创建分类（管理后台使用）
   */
  static async create(data) {
    const { name, icon, sort_order } = data;
    const [result] = await db.query(
      'INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)',
      [name, icon, sort_order || 0]
    );
    return result.insertId;
  }

  /**
   * 更新分类（管理后台使用）
   */
  static async update(id, data) {
    const { name, icon, sort_order, is_active } = data;
    const [result] = await db.query(
      'UPDATE service_categories SET name = ?, icon = ?, sort_order = ?, is_active = ? WHERE id = ?',
      [name, icon, sort_order, is_active, id]
    );
    return result.affectedRows > 0;
  }

  /**
   * 删除分类（管理后台使用）
   */
  static async delete(id) {
    const [result] = await db.query(
      'DELETE FROM service_categories WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = Category;
