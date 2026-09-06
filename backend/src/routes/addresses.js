const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { authenticateToken } = require('../middlewares/auth');

// 所有地址接口都需要认证
router.use(authenticateToken);

/**
 * @route   GET /api/addresses
 * @desc    获取当前用户的所有地址
 * @access  Private
 */
router.get('/', addressController.getAddresses);

/**
 * @route   GET /api/addresses/:id
 * @desc    获取单个地址
 * @access  Private
 */
router.get('/:id', addressController.getAddressById);

/**
 * @route   POST /api/addresses
 * @desc    创建新地址
 * @access  Private
 */
router.post('/', addressController.createAddress);

/**
 * @route   PUT /api/addresses/:id
 * @desc    更新地址
 * @access  Private
 */
router.put('/:id', addressController.updateAddress);

/**
 * @route   PUT /api/addresses/:id/set-default
 * @desc    设置默认地址
 * @access  Private
 */
router.put('/:id/set-default', addressController.setDefaultAddress);

/**
 * @route   DELETE /api/addresses/:id
 * @desc    删除地址
 * @access  Private
 */
router.delete('/:id', addressController.deleteAddress);

module.exports = router;
