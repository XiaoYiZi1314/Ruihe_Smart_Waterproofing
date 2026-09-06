/**
 * 操作日志记录工具
 */

const db = require('../config/database');

/**
 * 记录操作日志
 * @param {object} params
 * @param {number} params.user_id - 操作人ID（系统操作可为 null）
 * @param {number|null} params.order_id - 关联工单ID
 * @param {string} params.action - 操作类型
 * @param {string} params.detail - 操作详情
 * @param {string|null} params.ip - 操作IP
 */
async function logOperation({ user_id = null, order_id = null, action, detail, ip = null }) {
  try {
    await db.query(
      `INSERT INTO operation_logs (user_id, order_id, action, detail, ip)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, order_id, action, detail, ip]
    );
  } catch (error) {
    // 日志记录失败不影响主流程
    console.error('记录操作日志失败:', error.message);
  }
}

module.exports = { logOperation };
