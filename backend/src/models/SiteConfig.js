const db = require('../config/database');

class SiteConfig {
  /**
   * 获取配置
   */
  static async get(key) {
    const [rows] = await db.query(
      'SELECT * FROM site_config WHERE config_key = ?',
      [key]
    );

    if (rows.length === 0) {
      return null;
    }

    const config = rows[0];

    // 如果是JSON类型，解析返回
    if (config.config_type === 'json') {
      try {
        config.config_value = JSON.parse(config.config_value);
      } catch (e) {
        // 解析失败，返回原值
      }
    }

    return config;
  }

  /**
   * 获取所有配置
   */
  static async getAll() {
    const [rows] = await db.query(
      'SELECT * FROM site_config ORDER BY config_key ASC'
    );

    const configs = {};

    rows.forEach(row => {
      let value = row.config_value;

      // JSON类型解析
      if (row.config_type === 'json') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // 解析失败，使用原值
        }
      }

      configs[row.config_key] = value;
    });

    return configs;
  }

  /**
   * 设置配置（管理后台使用）
   */
  static async set(key, value, type = 'text', description = '') {
    const valueStr = type === 'json' ? JSON.stringify(value) : value;

    const [result] = await db.query(
      `INSERT INTO site_config (config_key, config_value, config_type, description)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE config_value = ?, config_type = ?, description = ?`,
      [key, valueStr, type, description, valueStr, type, description]
    );

    return result.affectedRows > 0;
  }

  /**
   * 删除配置（管理后台使用）
   */
  static async delete(key) {
    const [result] = await db.query(
      'DELETE FROM site_config WHERE config_key = ?',
      [key]
    );
    return result.affectedRows > 0;
  }

  /**
   * 获取前端需要的配置集合
   */
  static async getPublicConfigs() {
    const configs = await this.getAll();

    const oldContact = configs.contact_info || {};
    const join = configs.join_info || {};
    const hours = configs.contact_hours ?? oldContact.hours ?? oldContact.business_hours ?? '';
    const subscription_templates = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('WECHAT_TEMPLATE_') && value) subscription_templates[key.slice(16).toLowerCase()] = value;
    }
    return {
      contact_info: { ...oldContact, phone: configs.contact_phone ?? oldContact.phone ?? '', mobile: configs.contact_phone ?? oldContact.mobile ?? oldContact.phone ?? '', address: configs.contact_address ?? oldContact.address ?? '', hours, business_hours: hours, wechat: configs.contact_wechat ?? oldContact.wechat ?? '' },
      about_us: configs.about_us || '',
      join_info: { ...join, phone: join.join_phone ?? join.phone ?? '', partners: join.partners ?? '', description: join.brand_intro ?? join.description ?? join.content ?? '' },
      subscription_templates
    };
  }
}

module.exports = SiteConfig;
