const router = require('express').Router();
const { authenticateToken } = require('../middlewares/auth');
const { uploadHandler } = require('../middlewares/uploads');
const { serve } = require('../utils/attachments');
router.get('/file/:id', serve);
router.post('/image', authenticateToken, ...uploadHandler('image'));
router.post('/video', authenticateToken, ...uploadHandler('video'));
module.exports = router;
