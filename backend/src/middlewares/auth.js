const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

/**
 * 身份验证中间件
 * 验证请求头中的JWT token
 */
async function authMiddleware(req, res, next) {
  try {
    // 获取token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '未提供认证token'
      });
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前缀

    // 验证token
    const decoded = verifyToken(token);

    // 查询用户信息
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: '用户已被禁用'
      });
    }

    // 将用户信息挂载到请求对象上
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || '认证失败'
    });
  }
}

module.exports = authMiddleware;
