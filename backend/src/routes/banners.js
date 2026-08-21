const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');

/**
 * @route   GET /api/banners
 * @desc    获取所有轮播图
 * @access  Public
 */
router.get('/', bannerController.getBanners);

module.exports = router;
