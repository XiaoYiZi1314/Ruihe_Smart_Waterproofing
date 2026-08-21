const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

/**
 * @route   GET /api/categories
 * @desc    获取所有服务分类
 * @access  Public
 */
router.get('/', categoryController.getCategories);

/**
 * @route   GET /api/categories/:id
 * @desc    获取单个分类
 * @access  Public
 */
router.get('/:id', categoryController.getCategoryById);

module.exports = router;
