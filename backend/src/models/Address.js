const db = require('../config/database');

class Address {
  /**
   * 获取用户的所有地址
   */
  static async getByUserId(userId) {
    const [rows] = await db.query(
      `SELECT * FROM addresses
       WHERE user_id = ?
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );
    return rows;
  }

  /**
   * 根据ID获取地址
   */
  static async getById(id) {
    const [rows] = await db.query(
      'SELECT * FROM addresses WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  /**
   * 获取用户的默认地址
   */
  static async getDefaultByUserId(userId) {
    const [rows] = await db.query(
      'SELECT * FROM addresses WHERE user_id = ? AND is_default = 1',
      [userId]
    );
    return rows[0];
  }

  /**
   * 创建地址
   */
  static async create(userId, data) {
    const {
      contact_name, contact_phone, province, city, district,
      detail_address, is_default
    } = data;

    // 如果设置为默认，先取消其他默认地址
    if (is_default) {
      await db.query(
        'UPDATE addresses SET is_default = 0 WHERE user_id = ?',
        [userId]
      );
    }

    const [result] = await db.query(
      `INSERT INTO addresses
       (user_id, contact_name, contact_phone, province, city, district, detail_address, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, contact_name, contact_phone, province, city, district, detail_address, is_default || 0]
    );

    return result.insertId;
  }

  /**
   * 更新地址
   */
  static async update(id, userId, data) {
    const {
      contact_name, contact_phone, province, city, district,
      detail_address, is_default
    } = data;

    // 如果设置为默认，先取消其他默认地址
    if (is_default) {
      await db.query(
        'UPDATE addresses SET is_default = 0 WHERE user_id = ? AND id != ?',
        [userId, id]
      );
    }

    const [result] = await db.query(
      `UPDATE addresses
       SET contact_name = ?, contact_phone = ?, province = ?, city = ?,
           district = ?, detail_address = ?, is_default = ?
       WHERE id = ? AND user_id = ?`,
      [contact_name, contact_phone, province, city, district, detail_address, is_default || 0, id, userId]
    );

    return result.affectedRows > 0;
  }

  /**
   * 设置默认地址
   */
  static async setDefault(id, userId) {
    // 先取消所有默认
    await db.query(
      'UPDATE addresses SET is_default = 0 WHERE user_id = ?',
      [userId]
    );

    // 设置新默认
    const [result] = await db.query(
      'UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    return result.affectedRows > 0;
  }

  /**
   * 删除地址
   */
  static async delete(id, userId) {
    const [result] = await db.query(
      'DELETE FROM addresses WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }

  /**
   * 检查地址是否属于用户
   */
  static async belongsToUser(id, userId) {
    const [rows] = await db.query(
      'SELECT id FROM addresses WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return rows.length > 0;
  }
}

module.exports = Address;
