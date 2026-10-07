const mysql = require('mysql2/promise');
require('dotenv').config();
const company = require('../data/confirmed-company-info.json');

async function seed() {
  let connection;

  try {
    // 连接数据库
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'waterproof_system'
    });

    console.log('✅ 连接数据库成功');

    // 1. 插入服务分类
    console.log('\n📦 开始插入服务分类...');
    const categories = [
      { name: '屋面防水', icon: 'https://picsum.photos/seed/roof/200', sort_order: 1 },
      { name: '卫生间防水', icon: 'https://picsum.photos/seed/bathroom/200', sort_order: 2 },
      { name: '地下室防水', icon: 'https://picsum.photos/seed/basement/200', sort_order: 3 },
      { name: '外墙防水', icon: 'https://picsum.photos/seed/wall/200', sort_order: 4 },
      { name: '阳台防水', icon: 'https://picsum.photos/seed/balcony/200', sort_order: 5 },
      { name: '水池防水', icon: 'https://picsum.photos/seed/pool/200', sort_order: 6 }
    ];

    for (const category of categories) {
      await connection.query(
        'INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)',
        [category.name, category.icon, category.sort_order]
      );
    }
    console.log(`✅ 已插入 ${categories.length} 个服务分类`);

    // 2. 插入服务项目
    console.log('\n📦 开始插入服务项目...');
    const services = [
      // 屋面防水
      { category_id: 1, name: '平屋面防水', description: '适用于商业建筑、住宅楼等平面屋顶的防水处理，采用高分子防水卷材，使用寿命长达15年以上。施工工艺严格按照国家标准执行，包括基层处理、找平层施工、防水层铺设、保护层施工等多道工序。', cover_image: 'https://picsum.photos/seed/flat-roof/400/300', images: '["https://picsum.photos/seed/flat-roof-1/800/600","https://picsum.photos/seed/flat-roof-2/800/600"]', price_min: 80, price_max: 150, is_hot: 1, sort_order: 1 },
      { category_id: 1, name: '坡屋面防水', description: '专业处理各类坡屋顶渗漏问题，包括瓦片屋面、混凝土斜屋面等。采用柔性防水涂料，能够适应屋面的温度变化和结构微小变形，有效防止开裂渗漏。', cover_image: 'https://picsum.photos/seed/slope-roof/400/300', images: '["https://picsum.photos/seed/slope-roof-1/800/600"]', price_min: 100, price_max: 180, is_hot: 0, sort_order: 2 },
      { category_id: 1, name: '屋顶补漏', description: '针对已有屋面的局部渗漏快速修补，无需大面积翻修，节约成本。采用高效堵漏材料，当天施工当天见效，质保3年。', cover_image: 'https://picsum.photos/seed/roof-repair/400/300', images: '["https://picsum.photos/seed/roof-repair-1/800/600"]', price_min: 50, price_max: 120, is_hot: 1, sort_order: 3 },

      // 卫生间防水
      { category_id: 2, name: '卫生间整体防水', description: '包含地面、墙面（淋浴区1.8米高，其他区域0.3米高）的全方位防水处理。采用JS复合防水涂料，柔韧性强，与基层粘结牢固。施工后进行48小时闭水试验，确保质量。', cover_image: 'https://picsum.photos/seed/bathroom/400/300', images: '["https://picsum.photos/seed/bathroom-1/800/600","https://picsum.photos/seed/bathroom-2/800/600","https://picsum.photos/seed/bathroom-3/800/600"]', price_min: 60, price_max: 100, is_hot: 1, sort_order: 1 },
      { category_id: 2, name: '卫生间免砸砖防水', description: '不破坏原有瓷砖，采用渗透结晶型防水材料，深入瓷砖缝隙形成防水层。适合已装修房屋的渗漏处理，施工快速，不影响使用。', cover_image: 'https://picsum.photos/seed/bathroom-no-tile/400/300', images: '["https://picsum.photos/seed/bathroom-no-tile-1/800/600"]', price_min: 80, price_max: 150, is_hot: 1, sort_order: 2 },
      { category_id: 2, name: '厨房防水', description: '厨房地面及墙面防水处理，特别加强水槽、洗菜盆等用水区域。采用环保型防水涂料，无毒无味，适合家庭使用。', cover_image: 'https://picsum.photos/seed/kitchen/400/300', images: '["https://picsum.photos/seed/kitchen-1/800/600"]', price_min: 50, price_max: 90, is_hot: 0, sort_order: 3 },

      // 地下室防水
      { category_id: 3, name: '地下室整体防水', description: '地下室墙面、地面的全面防水处理，有效阻隔地下水渗透。采用防水卷材+防水涂料的双重防护体系，并设置排水系统，确保地下空间干燥。', cover_image: 'https://picsum.photos/seed/basement/400/300', images: '["https://picsum.photos/seed/basement-1/800/600","https://picsum.photos/seed/basement-2/800/600"]', price_min: 120, price_max: 200, is_hot: 0, sort_order: 1 },
      { category_id: 3, name: '地下室堵漏', description: '针对地下室出现的渗漏点进行精准堵漏，使用快速堵漏材料，3-5分钟初凝，快速止水。适合紧急渗漏处理。', cover_image: 'https://picsum.photos/seed/basement-repair/400/300', images: '["https://picsum.photos/seed/basement-repair-1/800/600"]', price_min: 80, price_max: 150, is_hot: 0, sort_order: 2 },

      // 外墙防水
      { category_id: 4, name: '外墙整体防水', description: '建筑外墙全面防水处理，防止雨水渗透导致内墙发霉、脱落。采用弹性防水涂料，能够覆盖细小裂缝，抗紫外线，耐候性强。', cover_image: 'https://picsum.photos/seed/exterior-wall/400/300', images: '["https://picsum.photos/seed/exterior-wall-1/800/600"]', price_min: 70, price_max: 120, is_hot: 0, sort_order: 1 },
      { category_id: 4, name: '外墙裂缝修补', description: '修补外墙裂缝并进行防水处理，防止裂缝扩大和渗水。采用柔性密封材料，能够适应墙体的微小变形。', cover_image: 'https://picsum.photos/seed/wall-crack/400/300', images: '["https://picsum.photos/seed/wall-crack-1/800/600"]', price_min: 60, price_max: 100, is_hot: 1, sort_order: 2 },

      // 阳台防水
      { category_id: 5, name: '阳台防水', description: '开放式阳台或封闭阳台的防水处理，包括地面、墙面及排水口周边。采用聚氨酯防水涂料，弹性好，耐老化，适应户外环境。', cover_image: 'https://picsum.photos/seed/balcony/400/300', images: '["https://picsum.photos/seed/balcony-1/800/600","https://picsum.photos/seed/balcony-2/800/600"]', price_min: 50, price_max: 90, is_hot: 1, sort_order: 1 },
      { category_id: 5, name: '飘窗防水', description: '飘窗周边及底部防水处理，防止雨水从窗框缝隙渗入。特别加强窗台与墙体连接处的防水，确保窗边墙面不受潮。', cover_image: 'https://picsum.photos/seed/bay-window/400/300', images: '["https://picsum.photos/seed/bay-window-1/800/600"]', price_min: 40, price_max: 80, is_hot: 0, sort_order: 2 },

      // 水池防水
      { category_id: 6, name: '游泳池防水', description: '专业游泳池防水施工，采用专用泳池防水涂料，耐水压、耐氯腐蚀。施工包括基层处理、防水层施工、保护层施工，质保10年。', cover_image: 'https://picsum.photos/seed/pool/400/300', images: '["https://picsum.photos/seed/pool-1/800/600"]', price_min: 150, price_max: 250, is_hot: 0, sort_order: 1 },
      { category_id: 6, name: '水池堵漏', description: '各类蓄水池、鱼池的渗漏修补，采用水下堵漏材料，可在有水环境下施工，快速止水，不影响使用。', cover_image: 'https://picsum.photos/seed/pool-repair/400/300', images: '["https://picsum.photos/seed/pool-repair-1/800/600"]', price_min: 100, price_max: 180, is_hot: 0, sort_order: 2 }
    ];

    for (const service of services) {
      await connection.query(
        `INSERT INTO services (category_id, name, description, cover_image, images, highlights, price_min, price_max, price_unit, is_hot, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, '元/平米', ?, 1, ?)`,
        [service.category_id, service.name, service.description, service.cover_image, service.images,
         service.highlights || '["质保5年","免费勘测","签约施工"]',
         service.price_min, service.price_max, service.is_hot, service.sort_order]
      );
    }
    console.log(`✅ 已插入 ${services.length} 个服务项目`);

    // 3. 插入轮播图
    console.log('\n📦 开始插入轮播图...');
    const banners = [
      { title: '专业防水15年', image_url: 'https://picsum.photos/seed/banner1/800/400', link_type: 'none', link_value: null, sort_order: 1 },
      { title: '卫生间防水特惠', image_url: 'https://picsum.photos/seed/banner2/800/400', link_type: 'service', link_value: '4', sort_order: 2 },
      { title: '屋面防水补漏', image_url: 'https://picsum.photos/seed/banner3/800/400', link_type: 'service', link_value: '3', sort_order: 3 },
      { title: '免费上门勘察', image_url: 'https://picsum.photos/seed/banner4/800/400', link_type: 'none', link_value: null, sort_order: 4 }
    ];

    for (const banner of banners) {
      await connection.query(
        'INSERT INTO banners (title, image_url, link_type, link_value, sort_order) VALUES (?, ?, ?, ?, ?)',
        [banner.title, banner.image_url, banner.link_type, banner.link_value, banner.sort_order]
      );
    }
    console.log(`✅ 已插入 ${banners.length} 个轮播图`);

    // 4. 插入站点配置
    console.log('\n📦 开始插入站点配置...');
    const siteConfigs = [
      {
        config_key: 'contact_info',
        config_value: JSON.stringify({
          address: company.contact_address,
          phone: company.contact_phone,
          mobile: company.contact_phone,
          wechat: company.contact_wechat || '',
          business_hours: company.contact_hours,
          hours: company.contact_hours,
          email: ''
        }),
        config_type: 'json',
        description: '联系方式'
      },
      {
        config_key: 'contact_phone',
        config_value: company.contact_phone,
        config_type: 'text',
        description: '联系电话'
      },
      {
        config_key: 'contact_address',
        config_value: company.contact_address,
        config_type: 'text',
        description: '联系地址'
      },
      {
        config_key: 'contact_hours',
        config_value: company.contact_hours,
        config_type: 'text',
        description: '营业时间'
      },
      {
        config_key: 'about_us',
        config_value: company.about_us,
        config_type: 'text',
        description: '关于我们'
      },
      {
        config_key: 'join_info',
        config_value: JSON.stringify(require('../data/confirmed-join-info.json')),
        config_type: 'json',
        description: '加盟信息'
      }
    ];

    for (const config of siteConfigs) {
      await connection.query(
        'INSERT INTO site_config (config_key, config_value, config_type, description) VALUES (?, ?, ?, ?)',
        [config.config_key, config.config_value, config.config_type, config.description]
      );
    }
    console.log(`✅ 已插入 ${siteConfigs.length} 条站点配置`);

    console.log('\n🎉 初始数据导入完成！');
    console.log('\n📊 数据统计：');
    console.log(`   - 服务分类: ${categories.length} 个`);
    console.log(`   - 服务项目: ${services.length} 个`);
    console.log(`   - 轮播图: ${banners.length} 个`);
    console.log(`   - 站点配置: ${siteConfigs.length} 条`);

  } catch (error) {
    console.error('❌ 数据导入失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行数据导入
seed();
