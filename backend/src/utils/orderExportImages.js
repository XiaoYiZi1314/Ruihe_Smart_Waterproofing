const path = require('path');
const fs = require('fs');
function db() {
  return require('../config/database');
}
function uploadDirs() {
  const attachments = require('./attachments');
  return { privateDir: attachments.privateDir, publicDir: attachments.publicDir };
}

const MAX_EMBEDDED_IMAGES = 80;
const IMAGE_SIZE = 88;

function imageExtension(mime, filename) {
  const type = String(mime || '').toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg') return 'jpeg';
  if (type === 'image/png') return 'png';
  if (type === 'image/gif') return 'gif';
  const ext = path.extname(String(filename || '')).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'jpeg';
  if (ext === '.png') return 'png';
  if (ext === '.gif') return 'gif';
  return null;
}

async function readUploadFile(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    if (url.startsWith('/api/upload/file/')) {
      const id = url.split('/').pop().split('?')[0];
      if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
      const [rows] = await db().query('SELECT filename, mime_type, is_public FROM uploads WHERE id = ?', [id]);
      if (!rows[0]) return null;
      const dirs = uploadDirs();
      const dir = rows[0].is_public ? dirs.publicDir : dirs.privateDir;
      const buffer = await fs.promises.readFile(path.join(dir, rows[0].filename));
      const extension = imageExtension(rows[0].mime_type, rows[0].filename);
      return extension ? { buffer, extension } : null;
    }
    if (url.startsWith('/uploads/')) {
      const filename = path.posix.normalize('/' + decodeURIComponent(url.slice('/uploads/'.length))).replace(/^\/+/, '');
      if (!filename || filename.includes('..')) return null;
      const buffer = await fs.promises.readFile(path.join(uploadDirs().publicDir, filename));
      const extension = imageExtension('', filename);
      return extension ? { buffer, extension } : null;
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function loadOrderImages(orderIds) {
  const ids = [...new Set((orderIds || []).filter(id => id != null))];
  const map = {};
  if (!ids.length) return map;
  const [rows] = await db().query(
    `SELECT order_id, image_url FROM work_order_images
     WHERE order_id IN (?) AND deleted_at IS NULL
     ORDER BY order_id ASC, sort_order ASC, id ASC`,
    [ids]
  );
  for (const row of rows || []) {
    (map[row.order_id] = map[row.order_id] || []).push(row.image_url);
  }
  return map;
}

function imageCountText(orderId, imagesByOrder) {
  const count = (imagesByOrder[orderId] || []).length;
  return count ? `${count}张` : '无';
}

async function addImageSheet(workbook, orders, imagesByOrder) {
  const sheet = workbook.addWorksheet('现场图片');
  sheet.columns = [
    { header: '工单号', key: 'order_no', width: 20 },
    { header: '客户', key: 'customer_name', width: 14 },
    { header: '序号', key: 'index', width: 8 },
    { header: '图片', key: 'image', width: 16 }
  ];
  let embedded = 0;
  for (const order of orders || []) {
    const urls = imagesByOrder[order.id] || [];
    for (let i = 0; i < urls.length; i++) {
      if (embedded >= MAX_EMBEDDED_IMAGES) {
        sheet.addRow({ order_no: '（其余图片未导出）', customer_name: '', index: '', image: `最多嵌入 ${MAX_EMBEDDED_IMAGES} 张` });
        return;
      }
      const row = sheet.addRow({
        order_no: order.order_no,
        customer_name: order.customer_name,
        index: i + 1,
        image: ''
      });
      row.height = 70;
      const file = await readUploadFile(urls[i]);
      if (!file) {
        row.getCell('image').value = '文件缺失';
        continue;
      }
      const imageId = workbook.addImage({ buffer: file.buffer, extension: file.extension });
      sheet.addImage(imageId, {
        tl: { col: 3, row: row.number - 1 },
        ext: { width: IMAGE_SIZE, height: IMAGE_SIZE }
      });
      embedded += 1;
    }
  }
}

module.exports = {
  MAX_EMBEDDED_IMAGES,
  imageExtension,
  readUploadFile,
  loadOrderImages,
  imageCountText,
  addImageSheet
};
