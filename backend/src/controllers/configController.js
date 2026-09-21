const SiteConfig = require('../models/SiteConfig');

/**
 * 获取站点配置
 */
exports.getConfig = async (req, res) => {
  try {
    const configs = await SiteConfig.getPublicConfigs();

    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('获取站点配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取站点配置失败'
    });
  }
};

/**
 * 获取单个配置项
 */
exports.getConfigByKey = async (req, res) => {
  try {
    const { key } = req.params;
    if (!['contact_info', 'about_us', 'join_info'].includes(key)) return res.status(404).json({ success: false, message: '配置不存在' });
    const configs = await SiteConfig.getPublicConfigs();
    const config = { config_value: configs[key] };

    if (!config) {
      return res.status(404).json({
        success: false,
        message: '配置项不存在'
      });
    }

    res.json({
      success: true,
      data: config.config_value
    });
  } catch (error) {
    console.error('获取配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配置失败'
    });
  }
};
