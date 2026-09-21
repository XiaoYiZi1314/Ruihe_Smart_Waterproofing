const router = require('express').Router();
const db = require('../config/database');
const { authenticateToken } = require('../middlewares/auth');
router.use(authenticateToken);
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id, order_id, type, title, content, is_read, created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50', [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});
router.put('/:id/read', async (req, res, next) => {
  try {
    await db.query('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) { next(error); }
});
module.exports = router;
