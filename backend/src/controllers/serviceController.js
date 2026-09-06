const db = require('../config/database');
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

    // 查询该服务的评价（通过工单关联，仅已完成的工单）
    const [reviews] = await db.query(
      `SELECT 
         r.id,
         r.service_attitude_score,
         r.quality_score,
         r.price_score,
         r.comment,
         r.created_at,
         u.nickname as user_name,
         u.avatar_url as user_avatar
       FROM reviews r
       INNER JOIN work_orders wo ON r.order_id = wo.id
       INNER JOIN users u ON r.user_id = u.id
       WHERE wo.service_id = ?
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [id]
    );

    // 计算平均分
    let reviewStats = null;
    if (reviews.length > 0) {
      const avg = (key) =>
        (reviews.reduce((sum, r) => sum + (r[key] || 0), 0) / reviews.length).toFixed(1);
      reviewStats = {
        total: reviews.length,
        avg_attitude: avg('service_attitude_score'),
        avg_quality: avg('quality_score'),
        avg_price: avg('price_score'),
        avg_overall: (
          reviews.reduce(
            (sum, r) =>
              sum +
              ((r.service_attitude_score || 0) +
                (r.quality_score || 0) +
                (r.price_score || 0)) /
                3,
            0
          ) / reviews.length
        ).toFixed(1)
      };
    }

    service.reviews = reviews;
    service.review_stats = reviewStats;

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
