const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// 测试API的函数
async function testAPI() {
  console.log('🧪 开始测试后端API...\n');

  try {
    // 测试健康检查
    console.log('1️⃣ 测试健康检查...');
    const health = await axios.get('http://localhost:3000/health');
    console.log('✅ 健康检查:', health.data);
    console.log('');

    // 测试获取轮播图
    console.log('2️⃣ 测试获取轮播图...');
    const banners = await axios.get(`${BASE_URL}/banners`);
    console.log('✅ 轮播图数量:', banners.data.data?.length || 0);
    console.log('');

    // 测试获取分类
    console.log('3️⃣ 测试获取分类...');
    const categories = await axios.get(`${BASE_URL}/categories`);
    console.log('✅ 分类数量:', categories.data.data?.length || 0);
    console.log('');

    // 测试获取服务列表
    console.log('4️⃣ 测试获取服务列表...');
    const services = await axios.get(`${BASE_URL}/services`);
    console.log('✅ 服务数量:', services.data.data?.length || 0);
    if (services.data.data?.length > 0) {
      console.log('   第一个服务:', services.data.data[0].name);
    }
    console.log('');

    // 测试获取网站配置
    console.log('5️⃣ 测试获取网站配置...');
    const config = await axios.get(`${BASE_URL}/config`);
    console.log('✅ 配置项:', Object.keys(config.data.data || {}).join(', '));
    console.log('');

    console.log('🎉 所有API测试通过！\n');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   响应:', error.response.data);
    } else if (error.request) {
      console.error('   无法连接到服务器，请确保后端服务已启动');
    }
    process.exit(1);
  }
}

// 运行测试
testAPI();
