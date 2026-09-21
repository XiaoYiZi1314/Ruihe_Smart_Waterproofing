const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, requireRole } = require('../middlewares/auth');
const { loginIpLimit, loginAccountLimit } = require('../middlewares/rateLimits');

// 微信登录
router.post('/login', loginIpLimit, authController.login);

// 管理员账号密码登录（管理后台）
router.post('/admin-login', loginIpLimit, loginAccountLimit, authController.adminLogin);

// 均傅端手机号密码登录
router.post('/worker-login', loginIpLimit, loginAccountLimit, authController.workerLogin);

// 获取当前用户信息（需要认证）
router.get('/me', authenticateToken, authController.getCurrentUser);

router.post('/bind-wechat', authenticateToken, requireRole(['worker']), authController.bindWechat);
router.post('/change-password', authenticateToken, loginIpLimit, authController.changePassword);
module.exports = router;
