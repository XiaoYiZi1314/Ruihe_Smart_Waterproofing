const WorkOrder = require('../models/WorkOrder');
const Service = require('../models/Service');
const Address = require('../models/Address');
const NotificationService = require('../utils/notification');
const { logOperation } = require('../utils/operationLog');

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
      images,
      contact_name,
      contact_phone
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
    if (expected_price != null && (!Number.isFinite(Number(expected_price)) || Number(expected_price) < 0)) {
      return res.status(400).json({
        success: false,
        message: '期望价格必须大于0'
      });
    }

    // 验证图片数量
    if (images != null && (!Array.isArray(images) || images.length > 5)) {
      return res.status(400).json({
        success: false,
        message: '最多上传5张图片'
      });
    }

    if ((contact_name !== undefined && (typeof contact_name !== 'string' || !contact_name.trim())) ||
        (contact_phone !== undefined && !/^1[3-9]\d{9}$/.test(contact_phone))) {
      return res.status(400).json({ success: false, message: '联系人姓名或手机号无效' });
    }

    // 创建工单
    const result = await WorkOrder.create(userId, {
      service_id,
      address_id,
      expected_price,
      remark,
      images,
      contact_name,
      contact_phone
    });

    // 异步：通知管理员新工单 + 记录日志
    NotificationService.notifyAdminNewOrder(result.id).catch(() => {});
    logOperation({
      user_id: userId,
      order_id: result.id,
      action: 'create_order',
      detail: '客户提交新工单',
      ip: req.ip
    });

    res.json({
      success: true,
      data: result,
      message: '工单创建成功'
    });
  } catch (error) {
    console.error('创建工单失败:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : '创建工单失败'
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
    res.status(error.status || 500).json({
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
    res.status(error.status || 500).json({
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

    // 异步：通知师傅 + 记录日志
    NotificationService.notifyWorkerOrderCancelled(id, '客户主动取消').catch(() => {});
    logOperation({
      user_id: userId,
      order_id: id,
      action: 'cancel',
      detail: '客户取消工单',
      ip: req.ip
    });

    res.json({
      success: true,
      message: '工单已取消'
    });
  } catch (error) {
    console.error('取消工单失败:', error);
    res.status(error.status || 500).json({
      success: false,
      message: '取消工单失败'
    });
  }
};

/**
 * 催单
 */
exports.urgeOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const belongsToUser = await WorkOrder.belongsToUser(id, userId);
    if (!belongsToUser) {
      return res.status(403).json({
        success: false,
        message: '无权操作此工单'
      });
    }

    const success = await WorkOrder.urge(id);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: '只能催促待确认或已确认状态的工单'
      });
    }

    // 查询催单次数用于通知
    try {
      const [rows] = await require('../config/database').query(
        'SELECT urge_count FROM work_orders WHERE id = ?',
        [id]
      );
      const urgeCount = rows.length > 0 ? rows[0].urge_count : 1;
      await NotificationService.notifyWorkerOrderUrged(id, urgeCount);
    } catch (e) {
      // 查询失败不影响主流程
    }

    logOperation({
      user_id: userId,
      order_id: id,
      action: 'urge',
      detail: '客户催单',
      ip: req.ip
    });

    res.json({
      success: true,
      message: '催单成功'
    });
  } catch (error) {
    console.error('催单失败:', error);
    res.status(error.status || 500).json({
      success: false,
      message: '催单失败'
    });
  }
};

/**
 * 确认完成
 */
exports.confirmOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const belongsToUser = await WorkOrder.belongsToUser(id, userId);
    if (!belongsToUser) {
      return res.status(403).json({
        success: false,
        message: '无权操作此工单'
      });
    }

    const success = await WorkOrder.confirm(id, userId);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: '只能确认完工待验收状态的工单'
      });
    }

    // 异步：通知师傅 + 记录日志
    NotificationService.notifyWorkerOrderConfirmed(id).catch(() => {});
    logOperation({
      user_id: userId,
      order_id: id,
      action: 'confirm',
      detail: '客户确认工单完成',
      ip: req.ip
    });

    res.json({
      success: true,
      message: '工单已确认完成'
    });
  } catch (error) {
    console.error('确认完成失败:', error);
    res.status(error.status || 500).json({
      success: false,
      message: '确认完成失败'
    });
  }
};

/**
 * 价格异议
 */
exports.disputePrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '请填写异议原因'
      });
    }

    const belongsToUser = await WorkOrder.belongsToUser(id, userId);
    if (!belongsToUser) {
      return res.status(403).json({
        success: false,
        message: '无权操作此工单'
      });
    }

    const success = await WorkOrder.disputePrice(id, reason, userId);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: '只能对完工待验收状态的工单提出价格异议'
      });
    }

    // 实时通知管理员：价格异议
    NotificationService.realtimeNotifyAdmins('price_dispute', {
      order_id: id,
      title: '价格异议提醒',
      content: `客户对工单提出价格异议：${reason.trim().substring(0, 50)}`
    });
    logOperation({
      user_id: userId,
      order_id: id,
      action: 'dispute_price',
      detail: `客户提交价格异议：${reason.trim()}`,
      ip: req.ip
    });

    res.json({
      success: true,
      message: '已提交价格异议'
    });
  } catch (error) {
    console.error('提交价格异议失败:', error);
    res.status(error.status || 500).json({
      success: false,
      message: '提交价格异议失败'
    });
  }
};

/**
 * 提交评价
 */
exports.submitReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      service_attitude_score,
      quality_score,
      price_score,
      comment,
      video_url
    } = req.body;

    // 验证评分
    if (!service_attitude_score || !quality_score || !price_score) {
      return res.status(400).json({
        success: false,
        message: '请完成所有评分'
      });
    }

    if (![service_attitude_score, quality_score, price_score].every(score => Number.isInteger(score) && score >= 1 && score <= 5)) {
      return res.status(400).json({
        success: false,
        message: '评分必须在1-5之间'
      });
    }

    const belongsToUser = await WorkOrder.belongsToUser(id, userId);
    if (!belongsToUser) {
      return res.status(403).json({
        success: false,
        message: '无权操作此工单'
      });
    }

    const success = await WorkOrder.submitReview(id, userId, {
      service_attitude_score,
      quality_score,
      price_score,
      comment,
      video_url
    });

    if (!success) {
      return res.status(400).json({
        success: false,
        message: '只能对已完成的工单进行评价'
      });
    }

    // 异步：记录日志
    logOperation({
      user_id: userId,
      order_id: id,
      action: 'review',
      detail: `客户评价：态度${service_attitude_score}分 / 质量${quality_score}分 / 价格${price_score}分`,
      ip: req.ip
    });

    res.json({
      success: true,
      message: '评价提交成功'
    });
  } catch (error) {
    console.error('提交评价失败:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : '提交评价失败'
    });
  }
};

/**
 * 删除评价
 */
exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const belongsToUser = await WorkOrder.belongsToUser(id, userId);
    if (!belongsToUser) {
      return res.status(403).json({
        success: false,
        message: '无权操作此工单'
      });
    }

    const success = await WorkOrder.deleteReview(id, userId);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: '评价不存在'
      });
    }

    res.json({
      success: true,
      message: '评价已删除'
    });
  } catch (error) {
    console.error('删除评价失败:', error);
    res.status(error.status || 500).json({
      success: false,
      message: '删除评价失败'
    });
  }
};
