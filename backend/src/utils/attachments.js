const crypto = require('crypto');
const db = require('../config/database');
const path = require('path');
const fs = require('fs');
const privateDir = path.join(__dirname, '../../private-uploads');
const publicDir = path.join(__dirname, '../../uploads');
const origin = () => process.env.PUBLIC_ORIGIN || 'https://ruihezhihui.cn';
function signUrl(url) {
  if (!url || (!url.startsWith('/api/upload/file/') && !url.startsWith('/uploads/'))) return url;
  const expires = Math.floor(Date.now() / 1000) + 900;
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${url}:${expires}`).digest('hex');
  return `${origin()}${url}?expires=${expires}&signature=${signature}`;
}
function validSignature(req) {
  const expires = Number(req.query.expires);
  if (!Number.isInteger(expires) || expires < Date.now() / 1000 || expires > Date.now() / 1000 + 901) return false;
  const expected = crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${req.originalUrl.split('?')[0]}:${expires}`).digest('hex');
  const signature = String(req.query.signature || '');
  return /^[a-f0-9]{64}$/.test(signature) && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
async function assertOwned(connection, userId, urls, kind = 'image') {
  for (const url of urls || []) {
    if (typeof url !== 'string' || !/^\/api\/upload\/file\/[a-f0-9-]{36}$/.test(url)) throw Object.assign(new Error('请先上传有效附件'), { status: 400 });
    const [rows] = await connection.query('SELECT mime_type FROM uploads WHERE id=? AND user_id=?', [url.split('/').pop(), userId]);
    if (!rows.length || !rows[0].mime_type.startsWith(kind + '/')) throw Object.assign(new Error('附件不属于当前用户或格式错误'), { status: 403 });
  }
}
function presentOrder(order) {
  if (order.images) order.images = order.images.map(image => ({ ...image, image_url: signUrl(image.image_url) }));
  if (order.review && order.review.video_url) order.review.video_url = signUrl(order.review.video_url);
  if (order.review && Array.isArray(order.review.images)) order.review.images = order.review.images.map(image => ({ ...image, image_url: signUrl(image.image_url) }));
  return order;
}
// 批量读取评价图片，返回 { [reviewId]: [{ id, image_url }] }（地址未签名，展示前需 signUrl）
async function loadReviewImages(reviewIds) {
  const ids = (reviewIds || []).filter(id => id != null);
  const result = {};
  if (!ids.length) return result;
  try {
    const [rows] = await db.query('SELECT id, review_id, image_url FROM review_images WHERE review_id IN (?) ORDER BY review_id ASC, sort_order ASC', [ids]);
    for (const row of rows) (result[row.review_id] = result[row.review_id] || []).push({ id: row.id, image_url: row.image_url });
  } catch (error) {
    // 迁移尚未执行时表不存在：按“没有图片”处理，不影响评价和工单详情本身
    if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
  return result;
}
async function serve(req, res, next) {
  try {
    const [rows] = await db.query('SELECT * FROM uploads WHERE id=?', [req.params.id]);
    if (!rows.length) return res.sendStatus(404);
    const upload = rows[0];
    if (!upload.is_public && !validSignature(req)) return res.sendStatus(403);
    res.set('Cache-Control', upload.is_public ? 'public, max-age=86400' : 'private, no-store');
    res.type(upload.mime_type);
    res.sendFile(path.join(upload.is_public ? publicDir : privateDir, upload.filename));
  } catch (error) { next(error); }
}
async function protectLegacy(req, res, next) {
  try {
    const url = '/uploads/' + path.posix.normalize('/' + decodeURIComponent(req.path)).replace(/^\/+/, '');
    const [rows] = await db.query('SELECT id FROM work_order_images WHERE image_url=? LIMIT 1', [url]);
    if (rows.length && !validSignature(req)) return res.sendStatus(403);
    if (rows.length) res.set('Cache-Control', 'private, no-store');
    next();
  } catch (error) { next(error); }
}
async function cleanupOrphans() {
  const [rows] = await db.query(`SELECT u.* FROM uploads u WHERE u.is_public=0 AND u.created_at < DATE_SUB(NOW(), INTERVAL 1 DAY)
    AND NOT EXISTS (SELECT 1 FROM work_order_images i WHERE i.image_url=CONCAT('/api/upload/file/',u.id))
    AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.video_url=CONCAT('/api/upload/file/',u.id))
    AND NOT EXISTS (SELECT 1 FROM review_images ri WHERE ri.image_url=CONCAT('/api/upload/file/',u.id))`);
  for (const row of rows) {
    await fs.promises.rm(path.join(privateDir, row.filename), { force: true });
    await db.query('DELETE FROM uploads WHERE id=?', [row.id]);
  }
}
module.exports = { signUrl, validSignature, assertOwned, presentOrder, loadReviewImages, serve, protectLegacy, cleanupOrphans, privateDir, publicDir };
