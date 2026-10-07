/**
 * 文件上传控制器
 * 客户端小程序、师傅端小程序的图片上传
 */

const { logOperation } = require('../utils/operationLog');

class UploadController {
  /**
   * 通用图片上传（登录用户可用）
   * POST /api/upload/image
   */
  static async uploadImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: '请选择图片文件' });
      }

      const url = `/uploads/${req.file.filename}`;

      logOperation({
        user_id: req.user.id,
        role: req.user.role,
        action: 'upload_image',
        detail: `上传图片：${req.file.filename}`,
        ip: req.ip
      });

      res.json({
        success: true,
        message: '上传成功',
        data: { url }
      });
    } catch (error) {
      console.error('上传图片失败:', error);
      res.status(500).json({ success: false, message: '上传图片失败' });
    }
  }
}

module.exports = UploadController;
