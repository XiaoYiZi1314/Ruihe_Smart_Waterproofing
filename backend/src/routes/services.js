const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

/**
 * @route   GET /api/services
 * @desc    获取服务列表
 * @access  Public
 * @query   category_id - 分类ID（可选）
 * @query   is_hot - 是否热门（可选）
 * @query   page - 页码（默认1）
 * @query   limit - 每页数量（默认10）
 */
router.get('/', serviceController.getServices);

/**
 * @route   GET /api/services/:id
 * @desc    获取服务详情
 * @access  Public
 */
router.get('/:id', serviceController.getServiceById);

module.exports = router;
