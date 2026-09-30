const router = require('express').Router();
const { authenticateToken } = require('../middlewares/auth');
const { uploadHandler } = require('../middlewares/uploads');
const { serve } = require('../utils/attachments');
router.get('/file/:id', serve);
router.post('/image', authenticateToken, ...uploadHandler('image'));
router.post('/video', authenticateToken, ...uploadHandler('video'));
// 头像：公开存储（随机 UUID 文件名、地址不过期），由 PUT /api/auth/profile 校验归属后才会生效
router.post('/avatar', authenticateToken, ...uploadHandler('image', true));
module.exports = router;
