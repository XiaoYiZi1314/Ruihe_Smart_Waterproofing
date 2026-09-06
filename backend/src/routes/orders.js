const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateToken } = require('../middlewares/auth');

// 所有工单接口都需要认证
router.use(authenticateToken);

/**
 * @route   POST /api/orders
 * @desc    创建工单
 * @access  Private
 */
router.post('/', orderController.createOrder);

/**
 * @route   GET /api/orders
 * @desc    获取当前用户的工单列表
 * @access  Private
 * @query   status - 状态筛选（可选）
 * @query   page - 页码（默认1）
 * @query   limit - 每页数量（默认10）
 */
router.get('/', orderController.getOrders);

/**
 * @route   GET /api/orders/:id
 * @desc    获取工单详情
 * @access  Private
 */
router.get('/:id', orderController.getOrderById);

/**
 * @route   PUT /api/orders/:id/cancel
 * @desc    取消工单
 * @access  Private
 */
router.put('/:id/cancel', orderController.cancelOrder);

/**
 * @route   PUT /api/orders/:id/urge
 * @desc    催单
 * @access  Private
 */
router.put('/:id/urge', orderController.urgeOrder);

/**
 * @route   PUT /api/orders/:id/confirm
 * @desc    确认完成
 * @access  Private
 */
router.put('/:id/confirm', orderController.confirmOrder);

/**
 * @route   PUT /api/orders/:id/dispute-price
 * @desc    价格异议
 * @access  Private
 */
router.put('/:id/dispute-price', orderController.disputePrice);

/**
 * @route   POST /api/orders/:id/review
 * @desc    提交评价
 * @access  Private
 */
router.post('/:id/review', orderController.submitReview);

/**
 * @route   DELETE /api/orders/:id/review
 * @desc    删除评价
 * @access  Private
 */
router.delete('/:id/review', orderController.deleteReview);

module.exports = router;
