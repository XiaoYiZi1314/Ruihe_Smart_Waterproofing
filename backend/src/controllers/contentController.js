/**
 * 管理端内容管理控制器
 * 服务分类、服务项目、轮播图、站点配置
 */

const db = require('../config/database');
const { logOperation } = require('../utils/operationLog');

class ContentController {
  // ==================== 服务分类 ====================

  /**
   * 获取分类列表（含服务数量）
   * GET /api/admin/categories
   */
  static async getCategories(req, res) {
    try {
      const [categories] = await db.query(`
        SELECT 
          c.*,
          (SELECT COUNT(*) FROM services s WHERE s.category_id = c.id) as service_count
        FROM service_categories c
        ORDER BY c.sort_order ASC, c.id ASC
      `);

      res.json({
        success: true,
        data: { categories }
      });
    } catch (error) {
      console.error('获取分类列表失败:', error);
      res.status(500).json({ success: false, message: '获取分类列表失败' });
    }
  }

  /**
   * 新增分类
   * POST /api/admin/categories
   */
  static async createCategory(req, res) {
    try {
      const { name, icon, sort_order = 0 } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: '分类名称不能为空' });
      }

      const [result] = await db.query(
        'INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)',
        [name.trim(), icon || null, parseInt(sort_order) || 0]
      );

      logOperation({
        user_id: req.user.id,
        action: 'create_category',
        detail: `新增服务分类：${name.trim()}`,
        ip: req.ip
      });

      res.json({
        success: true,
        message: '分类创建成功',
        data: { id: result.insertId }
      });
    } catch (error) {
      console.error('创建分类失败:', error);
      res.status(500).json({ success: false, message: '创建分类失败' });
    }
  }

  /**
   * 编辑分类
   * PUT /api/admin/categories/:id
   */
  static async updateCategory(req, res) {
    try {
      const { id } = req.params;
      const { name, icon, sort_order } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: '分类名称不能为空' });
      }

      const [result] = await db.query(
        `UPDATE service_categories 
         SET name = ?, icon = ?, sort_order = ?
         WHERE id = ?`,
        [name.trim(), icon || null, parseInt(sort_order) || 0, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '分类不存在' });
      }

      logOperation({
        user_id: req.user.id,
        action: 'update_category',
        detail: `编辑服务分类：${name.trim()}`,
        ip: req.ip
      });

      res.json({ success: true, message: '分类已更新' });
    } catch (error) {
      console.error('更新分类失败:', error);
      res.status(500).json({ success: false, message: '更新分类失败' });
    }
  }

  /**
   * 删除分类（有服务时禁止）
   * DELETE /api/admin/categories/:id
   */
  static async deleteCategory(req, res) {
    try {
      const { id } = req.params;

      const [services] = await db.query(
        'SELECT COUNT(*) as count FROM services WHERE category_id = ?',
        [id]
      );

      if (services[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: `该分类下有 ${services[0].count} 个服务项目，请先移除`
        });
      }

      const [result] = await db.query('DELETE FROM service_categories WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '分类不存在' });
      }

      logOperation({
        user_id: req.user.id,
        action: 'delete_category',
        detail: `删除服务分类 ID=${id}`,
        ip: req.ip
      });

      res.json({ success: true, message: '分类已删除' });
    } catch (error) {
      console.error('删除分类失败:', error);
      res.status(500).json({ success: false, message: '删除分类失败' });
    }
  }

  /**
   * 切换分类启用状态
   * PUT /api/admin/categories/:id/toggle
   */
  static async toggleCategory(req, res) {
    try {
      const { id } = req.params;

      const [result] = await db.query(
        'UPDATE service_categories SET is_active = 1 - is_active WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '分类不存在' });
      }

      logOperation({
        user_id: req.user.id,
        action: 'toggle_category',
        detail: `切换分类状态 ID=${id}`,
        ip: req.ip
      });

      res.json({ success: true, message: '状态已切换' });
    } catch (error) {
      console.error('切换分类状态失败:', error);
      res.status(500).json({ success: false, message: '切换分类状态失败' });
    }
  }

  // ==================== 服务项目 ====================

  /**
   * 获取服务项目列表
   * GET /api/admin/services
   */
  static async getServices(req, res) {
    try {
      const { category_id, status, keyword, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = '1=1';
      const params = [];

      if (category_id) {
        whereClause += ' AND s.category_id = ?';
        params.push(category_id);
      }

      if (status === 'active') {
        whereClause += ' AND s.is_active = 1';
      } else if (status === 'inactive') {
        whereClause += ' AND s.is_active = 0';
      }

      if (keyword) {
        whereClause += ' AND s.name LIKE ?';
        params.push(`%${keyword}%`);
      }

      const [services] = await db.query(
        `SELECT s.*, c.name as category_name
         FROM services s
         LEFT JOIN service_categories c ON s.category_id = c.id
         WHERE ${whereClause}
         ORDER BY s.sort_order ASC, s.id DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), parseInt(offset)]
      );

      const [countResult] = await db.query(
        `SELECT COUNT(*) as total FROM services s WHERE ${whereClause}`,
        params
      );

      res.json({
        success: true,
        data: {
          services,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult[0].total,
            totalPages: Math.ceil(countResult[0].total / limit)
          }
        }
      });
    } catch (error) {
      console.error('获取服务列表失败:', error);
      res.status(500).json({ success: false, message: '获取服务列表失败' });
    }
  }

  /**
   * 新增服务项目
   * POST /api/admin/services
   */
  static async createService(req, res) {
    try {
      const {
        category_id, name, description, cover_image, images,
        price_min, price_max, price_unit = '元', is_hot = 0, sort_order = 0
      } = req.body;

      if (!category_id || !name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: '请选择分类并填写服务名称'
        });
      }

      // 验证分类存在
      const [categories] = await db.query(
        'SELECT id FROM service_categories WHERE id = ?',
        [category_id]
      );
      if (categories.length === 0) {
        return res.status(400).json({ success: false, message: '所选分类不存在' });
      }

      const [result] = await db.query(
        `INSERT INTO services 
         (category_id, name, description, cover_image, images, 
          price_min, price_max, price_unit, is_hot, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          category_id,
          name.trim(),
          description || null,
          cover_image || null,
          images ? JSON.stringify(images) : null,
          price_min || null,
          price_max || null,
          price_unit,
          is_hot ? 1 : 0,
          parseInt(sort_order) || 0
        ]
      );

      logOperation({
        user_id: req.user.id,
        action: 'create_service',
        detail: `新增服务项目：${name.trim()}`,
        ip: req.ip
      });

      res.json({
        success: true,
        message: '服务项目创建成功',
        data: { id: result.insertId }
      });
    } catch (error) {
      console.error('创建服务失败:', error);
      res.status(500).json({ success: false, message: '创建服务失败' });
    }
  }

  /**
   * 编辑服务项目
   * PUT /api/admin/services/:id
   */
  static async updateService(req, res) {
    try {
      const { id } = req.params;
      const {
        category_id, name, description, cover_image, images,
        price_min, price_max, price_unit, is_hot, sort_order
      } = req.body;

      if (!category_id || !name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: '请选择分类并填写服务名称'
        });
      }

      const [result] = await db.query(
        `UPDATE services 
         SET category_id = ?, name = ?, description = ?, cover_image = ?, images = ?,
             price_min = ?, price_max = ?, price_unit = ?, is_hot = ?, sort_order = ?
         WHERE id = ?`,
        [
          category_id,
          name.trim(),
          description || null,
          cover_image || null,
          images ? JSON.stringify(images) : null,
          price_min || null,
          price_max || null,
          price_unit || '元',
          is_hot ? 1 : 0,
          parseInt(sort_order) || 0,
          id
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '服务项目不存在' });
      }

      logOperation({
        user_id: req.user.id,
        action: 'update_service',
        detail: `编辑服务项目：${name.trim()}`,
        ip: req.ip
      });

      res.json({ success: true, message: '服务项目已更新' });
    } catch (error) {
      console.error('更新服务失败:', error);
      res.status(500).json({ success: false, message: '更新服务失败' });
    }
  }

  /**
   * 删除服务项目（有关联工单时禁止）
   * DELETE /api/admin/services/:id
   */
  static async deleteService(req, res) {
    try {
      const { id } = req.params;

      const [orders] = await db.query(
        'SELECT COUNT(*) as count FROM work_orders WHERE service_id = ?',
        [id]
      );

      if (orders[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: `该服务已有 ${orders[0].count} 个关联工单，无法删除，建议下架处理`
        });
      }

      const [result] = await db.query('DELETE FROM services WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '服务项目不存在' });
      }

      logOperation({
        user_id: req.user.id,
        action: 'delete_service',
        detail: `删除服务项目 ID=${id}`,
        ip: req.ip
      });

      res.json({ success: true, message: '服务项目已删除' });
    } catch (error) {
      console.error('删除服务失败:', error);
      res.status(500).json({ success: false, message: '删除服务失败' });
    }
  }

  /**
   * 上架/下架
   * PUT /api/admin/services/:id/toggle
   */
  static async toggleService(req, res) {
    try {
      const { id } = req.params;

      const [result] = await db.query(
        'UPDATE services SET is_active = 1 - is_active WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '服务项目不存在' });
      }

      logOperation({
        user_id: req.user.id,
        action: 'toggle_service',
        detail: `服务上下架 ID=${id}`,
        ip: req.ip
      });

      res.json({ success: true, message: '状态已切换' });
    } catch (error) {
      console.error('切换服务状态失败:', error);
      res.status(500).json({ success: false, message: '切换服务状态失败' });
    }
  }

  /**
   * 设置/取消热门
   * PUT /api/admin/services/:id/hot
   */
  static async toggleHot(req, res) {
    try {
      const { id } = req.params;

      const [result] = await db.query(
        'UPDATE services SET is_hot = 1 - is_hot WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '服务项目不存在' });
      }

      logOperation({
        user_id: req.user.id,
        action: 'toggle_hot',
        detail: `设置热门服务 ID=${id}`,
        ip: req.ip
      });

      res.json({ success: true, message: '热门状态已切换' });
    } catch (error) {
      console.error('切换热门状态失败:', error);
      res.status(500).json({ success: false, message: '切换热门状态失败' });
    }
  }

  // ==================== 轮播图 ====================

  /**
   * 获取轮播图列表
   * GET /api/admin/banners
   */
  static async getBanners(req, res) {
    try {
      const [banners] = await db.query(
        'SELECT * FROM banners ORDER BY sort_order ASC, id ASC'
      );

      res.json({
        success: true,
        data: { banners }
      });
    } catch (error) {
      console.error('获取轮播图失败:', error);
      res.status(500).json({ success: false, message: '获取轮播图失败' });
    }
  }

  /**
   * 新增轮播图
   * POST /api/admin/banners
   */
  static async createBanner(req, res) {
    try {
      const { title, image_url, link_type = 'none', link_value, sort_order = 0 } = req.body;

      if (!image_url) {
        return res.status(400).json({ success: false, message: '请上传轮播图图片' });
      }

      const [result] = await db.query(
        `INSERT INTO banners (title, image_url, link_type, link_value, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [title || null, image_url, link_type, link_value || null, parseInt(sort_order) || 0]
      );

      logOperation({
        user_id: req.user.id,
        action: 'create_banner',
        detail: `新增轮播图：${title || image_url}`,
        ip: req.ip
      });

      res.json({
        success: true,
        message: '轮播图创建成功',
        data: { id: result.insertId }
      });
    } catch (error) {
      console.error('创建轮播图失败:', error);
      res.status(500).json({ success: false, message: '创建轮播图失败' });
    }
  }

  /**
   * 编辑轮播图
   * PUT /api/admin/banners/:id
   */
  static async updateBanner(req, res) {
    try {
      const { id } = req.params;
      const { title, image_url, link_type, link_value, sort_order } = req.body;

      if (!image_url) {
        return res.status(400).json({ success: false, message: '图片地址不能为空' });
      }

      const [result] = await db.query(
        `UPDATE banners 
         SET title = ?, image_url = ?, link_type = ?, link_value = ?, sort_order = ?
         WHERE id = ?`,
        [
          title || null,
          image_url,
          link_type || 'none',
          link_value || null,
          parseInt(sort_order) || 0,
          id
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '轮播图不存在' });
      }

      logOperation({
        user_id: req.user.id,
        action: 'update_banner',
        detail: `编辑轮播图 ID=${id}`,
        ip: req.ip
      });

      res.json({ success: true, message: '轮播图已更新' });
    } catch (error) {
      console.error('更新轮播图失败:', error);
      res.status(500).json({ success: false, message: '更新轮播图失败' });
    }
  }

  /**
   * 删除轮播图
   * DELETE /api/admin/banners/:id
   */
  static async deleteBanner(req, res) {
    try {
      const { id } = req.params;

      const [result] = await db.query('DELETE FROM banners WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '轮播图不存在' });
      }

      logOperation({
        user_id: req.user.id,
        action: 'delete_banner',
        detail: `删除轮播图 ID=${id}`,
        ip: req.ip
      });

      res.json({ success: true, message: '轮播图已删除' });
    } catch (error) {
      console.error('删除轮播图失败:', error);
      res.status(500).json({ success: false, message: '删除轮播图失败' });
    }
  }

  /**
   * 切换轮播图启用状态
   * PUT /api/admin/banners/:id/toggle
   */
  static async toggleBanner(req, res) {
    try {
      const { id } = req.params;

      const [result] = await db.query(
        'UPDATE banners SET is_active = 1 - is_active WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '轮播图不存在' });
      }

      res.json({ success: true, message: '状态已切换' });
    } catch (error) {
      console.error('切换轮播图状态失败:', error);
      res.status(500).json({ success: false, message: '切换轮播图状态失败' });
    }
  }

  // ==================== 站点配置 ====================

  /**
   * 获取全部配置
   * GET /api/admin/config
   */
  static async getConfig(req, res) {
    try {
      const [configs] = await db.query(
        'SELECT config_key, config_value, config_type, description FROM site_config'
      );

      // 转为键值对象
      const result = {};
      for (const c of configs) {
        result[c.config_key] = c.config_type === 'json'
          ? safeParse(c.config_value)
          : c.config_value;
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('获取站点配置失败:', error);
      res.status(500).json({ success: false, message: '获取站点配置失败' });
    }
  }

  /**
   * 批量保存配置
   * PUT /api/admin/config
   */
  static async saveConfig(req, res) {
    try {
      const config = req.body;

      // 允许保存的配置键白名单
      const ALLOWED_KEYS = [
        'contact_phone',
        'contact_address',
        'contact_hours',
        'contact_wechat',
        'about_us',
        'join_info'
      ];

      const entries = Object.entries(config).filter(([key]) => ALLOWED_KEYS.includes(key));

      if (entries.length === 0) {
        return res.status(400).json({ success: false, message: '没有可保存的配置项' });
      }

      const connection = await db.getConnection();
      await connection.beginTransaction();

      try {
        for (const [key, value] of entries) {
          const isJson = typeof value === 'object' && value !== null;
          const stringValue = isJson ? JSON.stringify(value) : String(value ?? '');

          await connection.query(
            `INSERT INTO site_config (config_key, config_value, config_type, description)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), config_type = VALUES(config_type)`,
            [key, stringValue, isJson ? 'json' : 'text', KEY_DESCRIPTIONS[key] || key]
          );
        }

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

      logOperation({
        user_id: req.user.id,
        action: 'update_config',
        detail: `更新站点配置：${entries.map(([k]) => k).join(', ')}`,
        ip: req.ip
      });

      res.json({ success: true, message: '配置已保存' });
    } catch (error) {
      console.error('保存站点配置失败:', error);
      res.status(500).json({ success: false, message: '保存站点配置失败' });
    }
  }

  // ==================== 图片上传 ====================

  /**
   * 图片上传（本地存储）
   * POST /api/admin/upload
   */
  static async uploadImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: '请选择图片文件' });
      }

      // multer 已存储文件，返回访问 URL
      const url = `/uploads/${req.file.filename}`;

      logOperation({
        user_id: req.user.id,
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

const KEY_DESCRIPTIONS = {
  contact_phone: '联系电话',
  contact_address: '联系地址',
  contact_hours: '营业时间',
  contact_wechat: '联系微信',
  about_us: '关于我们',
  join_info: '加盟信息'
};

function safeParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}

module.exports = ContentController;
