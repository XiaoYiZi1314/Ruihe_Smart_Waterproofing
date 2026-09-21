const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/database');
const files = require('../utils/attachments');
const { uploadLimit } = require('./rateLimits');

function detect(buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return ['image/jpeg', '.jpg'];
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return ['image/png', '.png'];
  if (/^GIF8[79]a/.test(buffer.toString('ascii', 0, 6))) return ['image/gif', '.gif'];
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return ['image/webp', '.webp'];
  if (buffer.toString('ascii', 4, 8) === 'ftyp') return ['video/mp4', '.mp4'];
  return null;
}
function uploadHandler(kind, isPublic = false) {
  fs.mkdirSync(files.privateDir, { recursive: true });
  fs.mkdirSync(files.publicDir, { recursive: true });
  const parser = multer({ storage: multer.diskStorage({ destination: files.privateDir, filename: (req, file, cb) => cb(null, crypto.randomUUID() + '.part') }),
    limits: { fileSize: kind === 'video' ? 128 * 1024 * 1024 : 5 * 1024 * 1024, files: 1, fields: 2 } }).single('file');
  return [uploadLimit, parser, async (req, res, next) => {
    if (!req.file) return res.status(400).json({ success: false, message: '请选择文件' });
    let connection;
    let location = req.file.path;
    try {
      const handle = await fs.promises.open(location, 'r');
      const head = Buffer.alloc(32);
      try { await handle.read(head, 0, 32, 0); } finally { await handle.close(); }
      const format = detect(head);
      if (!format || !format[0].startsWith(kind + '/')) throw Object.assign(new Error('文件内容格式不支持'), { status: 400 });
      connection = await db.getConnection();
      await connection.beginTransaction();
      await connection.query('SELECT id FROM users WHERE id=? FOR UPDATE', [req.user.id]);
      const [totals] = await connection.query('SELECT COALESCE(SUM(size_bytes),0) AS bytes FROM uploads WHERE user_id=?', [req.user.id]);
      if (Number(totals[0].bytes) + req.file.size > 512 * 1024 * 1024) throw Object.assign(new Error('附件存储额度已满，请联系客服'), { status: 413 });
      const id = crypto.randomUUID();
      const filename = id + format[1];
      const destination = path.join(isPublic ? files.publicDir : files.privateDir, filename);
      await fs.promises.rename(location, destination); location = destination;
      await connection.query('INSERT INTO uploads(id,user_id,filename,mime_type,size_bytes,is_public) VALUES (?,?,?,?,?,?)', [id, req.user.id, filename, format[0], req.file.size, isPublic ? 1 : 0]);
      await connection.commit();
      res.json({ success: true, data: { url: isPublic ? '/uploads/' + filename : '/api/upload/file/' + id } });
    } catch (error) {
      if (connection) await connection.rollback();
      await fs.promises.rm(location, { force: true });
      next(error);
    } finally { if (connection) connection.release(); }
  }];
}
module.exports = { uploadHandler, detect };
