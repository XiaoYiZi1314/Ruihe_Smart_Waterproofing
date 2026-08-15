const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * 生成JWT token
 * @param {Object} payload - token负载数据
 * @returns {String} token字符串
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

/**
 * 验证JWT token
 * @param {String} token - token字符串
 * @returns {Object} 解析后的payload
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Token无效或已过期');
  }
}

module.exports = {
  generateToken,
  verifyToken
};
