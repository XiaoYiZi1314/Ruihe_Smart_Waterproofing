const db = require('../config/database');

class User {
  /**
   * 根据openid查找用户
   * @param {String} openid - 微信openid
   * @returns {Object|null} 用户信息
   */
  static async findByOpenid(openid) {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE openid = ?',
      [openid]
    );
    return rows[0] || null;
  }

  /**
   * 创建新用户
   * @param {Object} userData - 用户数据
   * @returns {Object} 创建的用户信息
   */
  static async create(userData) {
    const { openid, union_id, nickname, avatar_url, phone, role } = userData;
    const [result] = await db.query(
      `INSERT INTO users (openid, union_id, nickname, avatar_url, phone, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [openid, union_id || null, nickname || '微信用户', avatar_url || null, phone || null, role || 'customer']
    );

    return await User.findById(result.insertId);
  }

  /**
   * 根据ID查找用户
   * @param {Number} id - 用户ID
   * @returns {Object|null} 用户信息
   */
  static async findById(id) {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * 更新用户信息
   * @param {Number} id - 用户ID
   * @param {Object} userData - 要更新的用户数据
   * @returns {Object} 更新后的用户信息
   */
  static async update(id, userData) {
    const { nickname, avatar_url, phone } = userData;
    await db.query(
      `UPDATE users SET nickname = ?, avatar_url = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nickname, avatar_url, phone, id]
    );

    return await User.findById(id);
  }
}

module.exports = User;
