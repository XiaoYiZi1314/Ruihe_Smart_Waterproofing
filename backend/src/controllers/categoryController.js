const Category = require('../models/Category');

/**
 * 获取所有分类
 */
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.getAll();

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分类失败'
    });
  }
};

/**
 * 根据ID获取分类
 */
exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.getById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: '分类不存在'
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分类失败'
    });
  }
};
