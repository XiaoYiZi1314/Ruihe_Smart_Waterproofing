const router = require('express').Router();
const db = require('../config/database');
const { authenticateToken } = require('../middlewares/auth');
router.use(authenticateToken);
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT n.id, n.order_id, n.type, n.title, n.content, n.is_read, n.created_at,
              wo.order_no, s.name AS service_name
       FROM notifications n
       LEFT JOIN work_orders wo ON wo.id = n.order_id
       LEFT JOIN services s ON s.id = wo.service_id
       WHERE n.user_id=?
       ORDER BY n.id DESC
       LIMIT 50`,
      [req.user.id]
    );
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
