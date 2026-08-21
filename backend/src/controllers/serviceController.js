const Service = require('../models/Service');

/**
 * 获取服务列表
 */
exports.getServices = async (req, res) => {
  try {
    const {
      category_id,
      is_hot,
      page = 1,
      limit = 10
    } = req.query;

    const options = {
      category_id,
      is_hot: is_hot !== undefined ? parseInt(is_hot) : undefined,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const result = await Service.getList(options);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('获取服务列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取服务列表失败'
    });
  }
};

/**
 * 获取服务详情
 */
exports.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.getById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: '服务不存在'
      });
    }

    // 增加浏览次数
    await Service.incrementViewCount(id);

    res.json({
      success: true,
      data: service
    });
  } catch (error) {
    console.error('获取服务详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取服务详情失败'
    });
  }
};
