/**
 * 管理员路由
 */

const express = require('express');
const router = express.Router();
const { uploadHandler } = require('../middlewares/uploads');
const AdminController = require('../controllers/adminController');
const ContentController = require('../controllers/contentController');
const OrderAdmin = require('../controllers/orderAdminController');
const { authenticateToken, requireRole } = require('../middlewares/auth');

// 所有管理员路由都需要认证且角色为 admin
router.use(authenticateToken);
router.use(requireRole(['admin']));

router.post('/upload', ...uploadHandler('image', true));

// ============ 工单管理 ============
router.get('/orders', AdminController.getOrders);
router.get('/orders/export', AdminController.exportOrders);
router.get('/orders/edit-meta', OrderAdmin.getEditMeta);
router.get('/orders/:id', AdminController.getOrderDetail);
router.put('/orders/:id/assign', AdminController.assignOrder);
router.put('/orders/:id/adjust-price', AdminController.adjustPrice);
router.put('/orders/:id/cancel', AdminController.cancelOrder);
// 工单更正（所有修改都会写入变更日志）
router.put('/orders/:id', OrderAdmin.editOrder);
router.put('/orders/:id/reassign', OrderAdmin.reassignOrder);
router.put('/orders/:id/correct-status', OrderAdmin.correctStatus);
router.post('/orders/:id/images', OrderAdmin.addImage);
router.delete('/orders/:id/images/:imageId', OrderAdmin.removeImage);
router.get('/orders/:id/timeline', OrderAdmin.getTimeline);
router.post('/orders/:id/followups', OrderAdmin.addFollowup);
router.get('/change-requests', OrderAdmin.listChangeRequests);
router.put('/change-requests/:id', OrderAdmin.handleChangeRequest);
router.get('/corrections/stats', OrderAdmin.getCorrectionStats);
router.get('/corrections/logs', OrderAdmin.getCorrectionLogs);
router.get('/corrections/export', OrderAdmin.exportCorrectionLogs);

// ============ 师傅管理 ============
router.get('/workers', AdminController.getWorkers);
router.post('/workers', AdminController.createWorker);
router.post('/workers/:id/reset-password', AdminController.resetWorkerPassword);
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
