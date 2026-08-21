const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

/**
 * @route   GET /api/config
 * @desc    获取站点配置
 * @access  Public
 */
router.get('/', configController.getConfig);

/**
 * @route   GET /api/config/:key
 * @desc    获取单个配置项
 * @access  Public
 */
router.get('/:key', configController.getConfigByKey);

module.exports = router;
