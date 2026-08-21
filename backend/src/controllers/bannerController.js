const Banner = require('../models/Banner');

/**
 * 获取所有轮播图
 */
exports.getBanners = async (req, res) => {
  try {
    const banners = await Banner.getAll();

    res.json({
      success: true,
      data: banners
    });
  } catch (error) {
    console.error('获取轮播图失败:', error);
    res.status(500).json({
      success: false,
      message: '获取轮播图失败'
    });
  }
};
