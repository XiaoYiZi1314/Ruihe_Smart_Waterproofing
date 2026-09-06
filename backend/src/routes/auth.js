const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/auth');

// 微信登录
router.post('/login', authController.login);

// 管理员账号密码登录（管理后台）
router.post('/admin-login', authController.adminLogin);

// 均傅端手机号密码登录
router.post('/worker-login', authController.workerLogin);

// 获取当前用户信息（需要认证）
router.get('/me', authenticateToken, authController.getCurrentUser);

module.exports = router;
