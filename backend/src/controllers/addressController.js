const Address = require('../models/Address');

/**
 * 获取当前用户的所有地址
 */
exports.getAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    const addresses = await Address.getByUserId(userId);

    res.json({
      success: true,
      data: addresses
    });
  } catch (error) {
    console.error('获取地址列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取地址列表失败'
    });
  }
};

/**
 * 根据ID获取地址
 */
exports.getAddressById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const address = await Address.getById(id);

    if (!address) {
      return res.status(404).json({
        success: false,
        message: '地址不存在'
      });
    }

    // 检查地址是否属于当前用户
    if (address.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: '无权访问此地址'
      });
    }

    res.json({
      success: true,
      data: address
    });
  } catch (error) {
    console.error('获取地址失败:', error);
    res.status(500).json({
      success: false,
      message: '获取地址失败'
    });
  }
};

/**
 * 创建地址
 */
exports.createAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      contact_name,
      contact_phone,
      province,
      city,
      district,
      detail_address,
      is_default
    } = req.body;

    // 表单验证
    if (!contact_name || !contact_phone || !detail_address) {
      return res.status(400).json({
        success: false,
        message: '联系人、电话和详细地址不能为空'
      });
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(contact_phone)) {
      return res.status(400).json({
        success: false,
        message: '手机号格式不正确'
      });
    }

    const addressId = await Address.create(userId, {
      contact_name,
      contact_phone,
      province,
      city,
      district,
      detail_address,
      is_default
    });

    res.json({
      success: true,
      data: { id: addressId },
      message: '地址创建成功'
    });
  } catch (error) {
    console.error('创建地址失败:', error);
    res.status(500).json({
      success: false,
      message: '创建地址失败'
    });
  }
};

/**
 * 更新地址
 */
exports.updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      contact_name,
      contact_phone,
      province,
      city,
      district,
      detail_address,
      is_default
    } = req.body;

    // 表单验证
    if (!contact_name || !contact_phone || !detail_address) {
      return res.status(400).json({
        success: false,
        message: '联系人、电话和详细地址不能为空'
      });
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(contact_phone)) {
      return res.status(400).json({
        success: false,
        message: '手机号格式不正确'
      });
    }

    // 检查地址是否属于当前用户
    const belongsToUser = await Address.belongsToUser(id, userId);
    if (!belongsToUser) {
      return res.status(403).json({
        success: false,
        message: '无权修改此地址'
      });
    }

    const success = await Address.update(id, userId, {
      contact_name,
      contact_phone,
      province,
      city,
      district,
      detail_address,
      is_default
    });

    if (!success) {
      return res.status(404).json({
        success: false,
        message: '地址不存在'
      });
    }

    res.json({
      success: true,
      message: '地址更新成功'
    });
  } catch (error) {
    console.error('更新地址失败:', error);
    res.status(500).json({
      success: false,
      message: '更新地址失败'
    });
  }
};

/**
 * 设置默认地址
 */
exports.setDefaultAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 检查地址是否属于当前用户
    const belongsToUser = await Address.belongsToUser(id, userId);
    if (!belongsToUser) {
      return res.status(403).json({
        success: false,
        message: '无权修改此地址'
      });
    }

    const success = await Address.setDefault(id, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: '地址不存在'
      });
    }

    res.json({
      success: true,
      message: '默认地址设置成功'
    });
  } catch (error) {
    console.error('设置默认地址失败:', error);
    res.status(500).json({
      success: false,
      message: '设置默认地址失败'
    });
  }
};

/**
 * 删除地址
 */
exports.deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 检查地址是否属于当前用户
    const belongsToUser = await Address.belongsToUser(id, userId);
    if (!belongsToUser) {
      return res.status(403).json({
        success: false,
        message: '无权删除此地址'
      });
    }

    const success = await Address.delete(id, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: '地址不存在'
      });
    }

    res.json({
      success: true,
      message: '地址删除成功'
    });
  } catch (error) {
    console.error('删除地址失败:', error);
    res.status(500).json({
      success: false,
      message: '删除地址失败'
    });
  }
};
