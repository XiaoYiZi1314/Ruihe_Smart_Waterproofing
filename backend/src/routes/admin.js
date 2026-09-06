/**
 * 管理员路由
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AdminController = require('../controllers/adminController');
const ContentController = require('../controllers/contentController');
const { authenticateToken, requireRole } = require('../middlewares/auth');

// 所有管理员路由都需要认证且角色为 admin
router.use(authenticateToken);
router.use(requireRole(['admin']));

// ============ 图片上传配置 ============
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `img_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('只支持 jpg/png/gif/webp 格式图片'));
    }
  }
});

// 图片上传
router.post('/upload', upload.single('file'), ContentController.uploadImage);

// ============ 工单管理 ============
router.get('/orders', AdminController.getOrders);
router.get('/orders/export', AdminController.exportOrders);
router.get('/orders/:id', AdminController.getOrderDetail);
router.put('/orders/:id/assign', AdminController.assignOrder);
router.put('/orders/:id/adjust-price', AdminController.adjustPrice);
router.put('/orders/:id/cancel', AdminController.cancelOrder);

// ============ 师傅管理 ============
router.get('/workers', AdminController.getWorkers);
router.post('/workers', AdminController.createWorker);
router.put('/workers/:id', AdminController.updateWorker);
router.put('/workers/:id/status', AdminController.updateWorkerStatus);
router.delete('/workers/:id', AdminController.deleteWorker);

// ============ 数据看板 ============
router.get('/dashboard', AdminController.getDashboard);
router.get('/dashboard/trend', AdminController.getTrend);
router.get('/dashboard/worker-ranking', AdminController.getWorkerRanking);

// ============ 操作日志 ============
router.get('/logs', AdminController.getLogs);

// ============ 服务分类管理 ============
router.get('/categories', ContentController.getCategories);
router.post('/categories', ContentController.createCategory);
router.put('/categories/:id', ContentController.updateCategory);
router.put('/categories/:id/toggle', ContentController.toggleCategory);
router.delete('/categories/:id', ContentController.deleteCategory);

// ============ 服务项目管理 ============
router.get('/services', ContentController.getServices);
router.post('/services', ContentController.createService);
router.put('/services/:id', ContentController.updateService);
router.put('/services/:id/toggle', ContentController.toggleService);
router.put('/services/:id/hot', ContentController.toggleHot);
router.delete('/services/:id', ContentController.deleteService);

// ============ 轮播图管理 ============
router.get('/banners', ContentController.getBanners);
router.post('/banners', ContentController.createBanner);
router.put('/banners/:id', ContentController.updateBanner);
router.put('/banners/:id/toggle', ContentController.toggleBanner);
router.delete('/banners/:id', ContentController.deleteBanner);

// ============ 站点配置 ============
router.get('/config', ContentController.getConfig);
router.put('/config', ContentController.saveConfig);

module.exports = router;
