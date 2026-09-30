/**
 * 师傅端路由
 */

const express = require('express');
const router = express.Router();
const WorkerController = require('../controllers/workerController');
const { authenticateToken, requireRole } = require('../middlewares/auth');

// 所有师傅端路由都需要认证且角色为 worker
router.use(authenticateToken);
router.use(requireRole(['worker']));

// 工单管理
router.get('/orders', WorkerController.getOrders);
router.get('/orders/:id', WorkerController.getOrderDetail);
router.put('/orders/:id/accept', WorkerController.acceptOrder);
router.put('/orders/:id/reject', WorkerController.rejectOrder);
router.put('/orders/:id/start', WorkerController.startOrder);
router.put('/orders/:id/complete', WorkerController.completeOrder);
router.get('/orders/:id/change-requests', WorkerController.getChangeRequests);
router.post('/orders/:id/change-requests', WorkerController.createChangeRequest);

// 状态管理
router.put('/status', WorkerController.updateStatus);

// 统计信息
router.get('/stats', WorkerController.getStats);

module.exports = router;
