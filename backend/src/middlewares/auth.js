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

    // 兼容 {id} 与 {userId} 两种 payload 结构
    const userId = decoded.userId || decoded.id;

    // 查询用户信息
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    if (user.status !== 'active' || Number(decoded.tokenVersion || 0) !== Number(user.token_version || 0)) {
      return res.status(401).json({
        success: false,
        message: '用户已被禁用'
      });
    }

    if (user.role === 'worker' && user.must_change_password &&
        !['/api/auth/me', '/api/auth/change-password', '/api/auth/bind-wechat'].includes(req.originalUrl.split('?')[0])) {
      return res.status(403).json({ success: false, code: 'PASSWORD_CHANGE_REQUIRED', message: '请先修改初始密码' });
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

/**
 * 角色验证中间件
 * 验证用户是否具有指定角色
 * @param {Array<string>} roles - 允许的角色列表
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken: authMiddleware,
  requireRole
};
