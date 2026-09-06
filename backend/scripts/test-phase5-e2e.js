/**
 * 阶段五端到端联调测试
 * 
 * 用法：
 *   需要环境变量：
 *     TEST_BASE_URL - 后端地址（默认 http://localhost:3000）
 *     ADMIN_USERNAME / ADMIN_PASSWORD - 管理员账号
 * 
 * 测试范围：
 *   1. 健康检查
 *   2. 管理员登录
 *   3. 看板数据（含趋势、排行榜）
 *   4. 分类/服务管理 CRUD
 *   5. 轮播图/站点配置
 *   6. 师傅管理
 *   7. WebSocket 连接（socket.io-client）
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

let passed = 0;
let failed = 0;
let adminToken = '';

function log(ok, name, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}${detail ? ' - ' + detail : ''}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ' - ' + detail : ''}`);
  }
}

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function testHealth() {
  console.log('\n🏥 健康检查');
  const { status, data } = await api('GET', '/health');
  log(status === 200 && data.success !== undefined, '健康检查接口', `status=${status}`);
}

async function testAdminLogin() {
  console.log('\n🔐 管理员登录');
  const { status, data } = await api('POST', '/api/auth/admin-login', {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD
  });
  log(status === 200 && data.success, '账号密码登录');
  if (data.success && data.data) {
    adminToken = data.data.token;
    log(data.data.user.role === 'admin', '角色为 admin');
  }
}

async function testDashboard() {
  console.log('\n📊 数据看板');
  const dash = await api('GET', '/api/admin/dashboard', null, adminToken);
  log(dash.status === 200 && dash.data.success, '看板统计');
  log(dash.data.data && dash.data.data.orders, '包含工单统计');

  const trend = await api('GET', '/api/admin/dashboard/trend?days=7', null, adminToken);
  log(trend.status === 200 && Array.isArray(trend.data.data.trend), '趋势数据（7天）',
    `${trend.data.data.trend ? trend.data.data.trend.length : 0} 天`);

  const ranking = await api('GET', '/api/admin/dashboard/worker-ranking', null, adminToken);
  log(ranking.status === 200 && Array.isArray(ranking.data.data.ranking), '师傅排行榜',
    `${ranking.data.data.ranking ? ranking.data.data.ranking.length : 0} 人`);
}

async function testCategoryCrud() {
  console.log('\n📁 服务分类 CRUD');
  const created = await api('POST', '/api/admin/categories', {
    name: `测试分类_${Date.now()}`,
    sort_order: 999
  }, adminToken);
  log(created.status === 200 && created.data.success, '创建分类');
  const catId = created.data.data && created.data.data.id;

  if (catId) {
    const list = await api('GET', '/api/admin/categories', null, adminToken);
    log(list.data.success && list.data.data.categories.some((c) => c.id === catId), '列表包含新分类');

    const updated = await api('PUT', `/api/admin/categories/${catId}`, {
      name: `测试分类改_${Date.now()}`,
      sort_order: 998
    }, adminToken);
    log(updated.data.success, '编辑分类');

    const deleted = await api('DELETE', `/api/admin/categories/${catId}`, null, adminToken);
    log(deleted.data.success, '删除分类');
  }
}

async function testServiceCrud() {
  console.log('\n🛠 服务项目 CRUD');
  // 先建一个分类
  const cat = await api('POST', '/api/admin/categories', {
    name: `CRUD测试_${Date.now()}`
  }, adminToken);
  const catId = cat.data.data.id;

  const created = await api('POST', '/api/admin/services', {
    category_id: catId,
    name: `测试服务_${Date.now()}`,
    description: '自动化测试服务',
    price_min: 100,
    price_max: 500
  }, adminToken);
  log(created.status === 200 && created.data.success, '创建服务');
  const svcId = created.data.data && created.data.data.id;

  if (svcId) {
    const toggled = await api('PUT', `/api/admin/services/${svcId}/toggle`, null, adminToken);
    log(toggled.data.success, '下架服务');

    const hot = await api('PUT', `/api/admin/services/${svcId}/hot`, null, adminToken);
    log(hot.data.success, '设置热门');

    const deleted = await api('DELETE', `/api/admin/services/${svcId}`, null, adminToken);
    log(deleted.data.success, '删除服务');
  }

  await api('DELETE', `/api/admin/categories/${catId}`, null, adminToken);
}

async function testBannerAndConfig() {
  console.log('\n🖼 轮播图与站点配置');
  const banners = await api('GET', '/api/admin/banners', null, adminToken);
  log(banners.status === 200 && banners.data.success, '轮播图列表');

  const created = await api('POST', '/api/admin/banners', {
    title: '测试轮播',
    image_url: '/uploads/test-banner.jpg',
    link_type: 'none',
    sort_order: 999
  }, adminToken);
  log(created.data.success, '创建轮播图');
  const bannerId = created.data.data && created.data.data.id;

  if (bannerId) {
    const deleted = await api('DELETE', `/api/admin/banners/${bannerId}`, null, adminToken);
    log(deleted.data.success, '删除轮播图');
  }

  const saved = await api('PUT', '/api/admin/config', {
    contact_phone: '400-888-6688',
    contact_hours: '周一至周日 8:00-18:00'
  }, adminToken);
  log(saved.data.success, '保存站点配置');

  const config = await api('GET', '/api/admin/config', null, adminToken);
  log(config.data.success && config.data.data.contact_phone, '读取站点配置',
    `phone=${config.data.data.contact_phone}`);
}

async function testWorkerCrud() {
  console.log('\n👷 师傅管理');
  const phone = `138${String(Date.now()).slice(-8)}`;
  const created = await api('POST', '/api/admin/workers', {
    nickname: `测试师傅_${Date.now() % 1000}`,
    phone
  }, adminToken);
  log(created.data.success, '创建师傅');
  const workerId = created.data.data && created.data.data.id;

  if (workerId) {
    const updated = await api('PUT', `/api/admin/workers/${workerId}`, {
      nickname: '测试师傅改名',
      phone
    }, adminToken);
    log(updated.data.success, '编辑师傅');

    const status = await api('PUT', `/api/admin/workers/${workerId}/status`, {
      status: 'resting'
    }, adminToken);
    log(status.data.success, '修改师傅状态');

    const deleted = await api('DELETE', `/api/admin/workers/${workerId}`, null, adminToken);
    log(deleted.data.success, '删除师傅');
  }
}

async function testWebSocket() {
  console.log('\n🔌 WebSocket 连接测试');
  try {
    const { io } = await import('socket.io-client');
    return new Promise((resolve) => {
      const socket = io(BASE_URL, {
        auth: { token: adminToken },
        transports: ['websocket', 'polling'],
        timeout: 5000
      });

      const timer = setTimeout(() => {
        log(false, 'WebSocket 连接（超时）');
        socket.disconnect();
        resolve();
      }, 6000);

      socket.on('connect', () => {
        clearTimeout(timer);
        log(true, 'WebSocket 连接成功', `id=${socket.id}`);
        socket.disconnect();
        resolve();
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        log(false, 'WebSocket 连接', err.message);
        socket.disconnect();
        resolve();
      });
    });
  } catch (e) {
    log(false, 'socket.io-client 不可用', '请先 npm install socket.io-client');
  }
}

async function main() {
  console.log('🚀 阶段五端到端联调测试');
  console.log(`   目标: ${BASE_URL}`);

  await testHealth();

  if (!(await testAdminLoginCanProceed())) {
    console.log('\n❌ 管理员登录失败，无法继续测试（请检查 ADMIN_USERNAME/ADMIN_PASSWORD）');
    summary();
    return;
  }

  await testDashboard();
  await testCategoryCrud();
  await testServiceCrud();
  await testBannerAndConfig();
  await testWorkerCrud();
  await testWebSocket();

  summary();
}

async function testAdminLoginCanProceed() {
  const { status, data } = await api('POST', '/api/auth/admin-login', {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD
  });
  if (status === 200 && data.success) {
    adminToken = data.data.token;
    return true;
  }
  return false;
}

function summary() {
  console.log('\n' + '='.repeat(50));
  console.log(`📈 测试结果: ${passed} 通过 / ${failed} 失败`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('测试执行异常:', err.message);
  process.exitCode = 1;
});
