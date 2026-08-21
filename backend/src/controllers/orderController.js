const WorkOrder = require('../models/WorkOrder');
const Service = require('../models/Service');
const Address = require('../models/Address');

/**
 * 创建工单
 */
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      service_id,
      address_id,
      expected_price,
      remark,
      images
    } = req.body;

    // 表单验证
    if (!service_id || !address_id) {
      return res.status(400).json({
        success: false,
        message: '服务项目和地址不能为空'
      });
    }

    // 验证服务是否存在
    const service = await Service.getById(service_id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: '服务项目不存在'
      });
    }

    // 验证地址是否属于当前用户
    const belongsToUser = await Address.belongsToUser(address_id, userId);
    if (!belongsToUser) {
      return res.status(403).json({
        success: false,
        message: '地址不存在或不属于您'
      });
    }

    // 验证期望价格
    if (expected_price && expected_price <= 0) {
      return res.status(400).json({
        success: false,
        message: '期望价格必须大于0'
      });
    }

    // 验证图片数量
    if (images && Array.isArray(images) && images.length > 5) {
      return res.status(400).json({
        success: false,
        message: '最多上传5张图片'
      });
    }

    // 创建工单
    const result = await WorkOrder.create(userId, {
      service_id,
      address_id,
      expected_price,
      remark,
      images
    });

    res.json({
      success: true,
      data: result,
      message: '工单创建成功'
    });
  } catch (error) {
    console.error('创建工单失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '创建工单失败'
    });
  }
};

/**
 * 获取当前用户的工单列表
 */
exports.getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      status,
      page = 1,
      limit = 10
    } = req.query;

    const options = {
      status,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const result = await WorkOrder.getByUserId(userId, options);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('获取工单列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取工单列表失败'
    });
  }
};

/**
 * 获取工单详情
 */
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 检查工单是否属于当前用户
    const belongsToUser = await WorkOrder.belongsToUser(id, userId);
    if (!belongsToUser) {
      return res.status(403).json({
        success: false,
        message: '无权查看此工单'
      });
    }

    const order = await WorkOrder.getById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: '工单不存在'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('获取工单详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取工单详情失败'
    });
  }
};

/**
 * 取消工单
 */
exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 检查工单是否属于当前用户
    const belongsToUser = await WorkOrder.belongsToUser(id, userId);
    if (!belongsToUser) {
      return res.status(403).json({
        success: false,
        message: '无权操作此工单'
      });
    }

    const success = await WorkOrder.cancel(id, userId);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: '只能取消待确认状态的工单'
      });
    }

    res.json({
      success: true,
      message: '工单已取消'
    });
  } catch (error) {
    console.error('取消工单失败:', error);
    res.status(500).json({
      success: false,
      message: '取消工单失败'
    });
  }
};
