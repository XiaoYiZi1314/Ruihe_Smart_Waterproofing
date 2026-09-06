/**
 * 第三阶段 API 测试脚本
 * 测试师傅端和客户端扩展接口
 */

const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// 测试用 token（需要替换为实际的 token）
let customerToken = '';
let workerToken = '';
let adminToken = '';

// 测试数据
let testOrderId = null;

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// HTTP 请求封装
async function request(method, endpoint, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {}
    };

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      if (method === 'GET') {
        config.params = data;
      } else {
        config.data = data;
      }
    }

    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

// ==================== 测试套件 ====================

/**
 * 测试 1: 健康检查
 */
async function testHealthCheck() {
  logInfo('测试 1: 健康检查');
  const result = await request('GET', '/health');
  if (result.success) {
    logSuccess('服务运行正常');
    return true;
  } else {
    logError(`健康检查失败: ${result.error}`);
    return false;
  }
}

/**
 * 测试 2: 师傅端 - 获取工单列表
 */
async function testWorkerGetOrders() {
  logInfo('测试 2: 师傅端 - 获取工单列表');
  
  if (!workerToken) {
    logWarning('跳过: 未设置师傅 token');
    return false;
  }

  const result = await request('GET', '/api/worker/orders', null, workerToken);
  if (result.success) {
    logSuccess(`获取工单列表成功，共 ${result.data.data.orders.length} 条`);
    if (result.data.data.orders.length > 0) {
      testOrderId = result.data.data.orders[0].id;
      logInfo(`使用工单 ID: ${testOrderId} 进行后续测试`);
    }
    return true;
  } else {
    logError(`获取工单列表失败: ${result.error}`);
    return false;
  }
}

/**
 * 测试 3: 师傅端 - 获取工单详情
 */
async function testWorkerGetOrderDetail() {
  logInfo('测试 3: 师傅端 - 获取工单详情');
  
  if (!workerToken) {
    logWarning('跳过: 未设置师傅 token');
    return false;
  }

  if (!testOrderId) {
    logWarning('跳过: 无可用工单 ID');
    return false;
  }

  const result = await request('GET', `/api/worker/orders/${testOrderId}`, null, workerToken);
  if (result.success) {
    logSuccess(`获取工单详情成功: ${result.data.data.order_no}`);
    return true;
  } else {
    logError(`获取工单详情失败: ${result.error}`);
    return false;
  }
}

/**
 * 测试 4: 师傅端 - 接受工单
 */
async function testWorkerAcceptOrder() {
  logInfo('测试 4: 师傅端 - 接受工单');
  
  if (!workerToken || !testOrderId) {
    logWarning('跳过: 缺少必要参数');
    return false;
  }

  const result = await request('PUT', `/api/worker/orders/${testOrderId}/accept`, null, workerToken);
  if (result.success) {
    logSuccess('接受工单成功');
    return true;
  } else {
    logError(`接受工单失败: ${result.error}`);
    return false;
  }
}

/**
 * 测试 5: 师傅端 - 开始施工
 */
async function testWorkerStartOrder() {
  logInfo('测试 5: 师傅端 - 开始施工');
  
  if (!workerToken || !testOrderId) {
    logWarning('跳过: 缺少必要参数');
    return false;
  }

  const result = await request('PUT', `/api/worker/orders/${testOrderId}/start`, null, workerToken);
  if (result.success) {
    logSuccess('开始施工成功');
    return true;
  } else {
    logError(`开始施工失败: ${result.error}`);
    return false;
  }
}

/**
 * 测试 6: 师傅端 - 完工
 */
async function testWorkerCompleteOrder() {
  logInfo('测试 6: 师傅端 - 完工');
  
  if (!workerToken || !testOrderId) {
    logWarning('跳过: 缺少必要参数');
    return false;
  }

  const data = {
    door_fee: 50,
    material_fee: 200,
    labor_fee: 300
  };

  const result = await request('PUT', `/api/worker/orders/${testOrderId}/complete`, data, workerToken);
  if (result.success) {
    logSuccess(`完工成功，最终价格: ${result.data.data.final_price}`);
    return true;
  } else {
    logError(`完工失败: ${result.error}`);
    return false;
  }
}

/**
 * 测试 7: 师傅端 - 切换工作状态
 */
async function testWorkerUpdateStatus() {
  logInfo('测试 7: 师傅端 - 切换工作状态');
  
  if (!workerToken) {
    logWarning('跳过: 未设置师傅 token');
    return false;
  }

  // 切换到休息状态
  let result = await request('PUT', '/api/worker/status', { status: 'resting' }, workerToken);
  if (result.success) {
    logSuccess('切换到休息状态成功');
  } else {
    logError(`切换状态失败: ${result.error}`);
    return false;
  }

  // 切换回上班状态
  result = await request('PUT', '/api/worker/status', { status: 'working' }, workerToken);
  if (result.success) {
    logSuccess('切换到上班状态成功');
    return true;
  } else {
    logError(`切换状态失败: ${result.error}`);
    return false;
  }
}

/**
 * 测试 8: 师傅端 - 获取统计信息
 */
async function testWorkerGetStats() {
  logInfo('测试 8: 师傅端 - 获取统计信息');
  
  if (!workerToken) {
    logWarning('跳过: 未设置师傅 token');
    return false;
  }

  const result = await request('GET', '/api/worker/stats', null, workerToken);
  if (result.success) {
    const stats = result.data.data;
    logSuccess(`统计信息: 本月完成 ${stats.month_completed} 单，拒单率 ${stats.reject_rate}%`);
    return true;
  } else {
    logError(`获取统计信息失败: ${result.error}`);
    return false;
  }
}

/**
 * 测试 9: 客户端 - 催单
 */
async function testCustomerUrgeOrder() {
  logInfo('测试 9: 客户端 - 催单');
  
  if (!customerToken || !testOrderId) {
    logWarning('跳过: 缺少必要参数');
    return false;
  }

  const result = await request('PUT', `/api/orders/${testOrderId}/urge`, null, customerToken);
  if (result.success) {
    logSuccess('催单成功');
    return true;
  } else {
    logError(`催单失败: ${result.error}`);
    return false;
  }
}

/**
 * 测试 10: 客户端 - 价格异议
 */
async function testCustomerDisputePrice() {
  logInfo('测试 10: 客户端 - 价格异议');
  
  if (!customerToken || !testOrderId) {
    logWarning('跳过: 缺少必要参数');
    return false;
  }

  const data = {
    reason: '价格偏高，希望能调整'
  };

  const result = await request('PUT', `/api/orders/${testOrderId}/dispute-price`, data, customerToken);
  if (result.success) {
    logSuccess('提交价格异议成功');
    return true;
  } else {
    logError(`提交价格异议失败: ${result.error}`);
    return false;
  }
}

/**
 * 测试 11: 客户端 - 确认完成
 */
async function testCustomerConfirmOrder() {
  logInfo('测试 11: 客户端 - 确认完成');
  
  if (!customerToken || !testOrderId) {
    logWarning('跳过: 缺少必要参数');
    return false;
  }

  const result = await request('PUT', `/api/orders/${testOrderId}/confirm`, null, customerToken);
  if (result.success) {
    logSuccess('确认完成成功');
    return true;
  } else {
    logError(`确认完成失败: ${result.error}`);
    return false;
  }
}

/**
 * 测试 12: 客户端 - 提交评价
 */
async function testCustomerSubmitReview() {
  logInfo('测试 12: 客户端 - 提交评价');
  
  if (!customerToken || !testOrderId) {
    logWarning('跳过: 缺少必要参数');
    return false;
  }

  const data = {
    service_attitude_score: 5,
    quality_score: 5,
    price_score: 4,
    comment: '师傅很专业，服务态度好，施工质量高！'
  };

  const result = await request('POST', `/api/orders/${testOrderId}/review`, data, customerToken);
  if (result.success) {
    logSuccess('提交评价成功');
    return true;
  } else {
    logError(`提交评价失败: ${result.error}`);
    return false;
  }
}

/**
 * 测试 13: 权限验证 - 客户访问师傅接口
 */
async function testPermissionDenied() {
  logInfo('测试 13: 权限验证 - 客户访问师傅接口');
  
  if (!customerToken) {
    logWarning('跳过: 未设置客户 token');
    return false;
  }

  const result = await request('GET', '/api/worker/orders', null, customerToken);
  if (!result.success && result.error.includes('权限')) {
    logSuccess('权限验证正常（403）');
    return true;
  } else {
    logError('权限验证失败：客户不应该能访问师傅接口');
    return false;
  }
}

// ==================== 主测试流程 ====================

async function runTests() {
  log('\n========================================', 'blue');
  log('第三阶段 API 测试', 'blue');
  log('========================================\n', 'blue');

  logInfo(`测试目标: ${BASE_URL}`);
  logInfo(`客户 Token: ${customerToken ? '已设置' : '未设置'}`);
  logInfo(`师傅 Token: ${workerToken ? '已设置' : '未设置'}`);
  logInfo(`管理员 Token: ${adminToken ? '已设置' : '未设置'}\n`);

  const tests = [
    testHealthCheck,
    testWorkerGetOrders,
    testWorkerGetOrderDetail,
    testWorkerGetStats,
    testWorkerUpdateStatus,
    testPermissionDenied
  ];

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const test of tests) {
    try {
      const result = await test();
      if (result === true) {
        passed++;
      } else if (result === false) {
        failed++;
      } else {
        skipped++;
      }
    } catch (error) {
      logError(`测试异常: ${error.message}`);
      failed++;
    }
    console.log(''); // 空行
  }

  // 测试总结
  log('\n========================================', 'blue');
  log('测试总结', 'blue');
  log('========================================\n', 'blue');
  logSuccess(`通过: ${passed}`);
  logError(`失败: ${failed}`);
  logWarning(`跳过: ${skipped}`);
  log(`总计: ${passed + failed + skipped}\n`);

  if (failed === 0) {
    logSuccess('所有测试通过！🎉');
  } else {
    logError('部分测试失败，请检查');
  }
}

// ==================== 使用说明 ====================

function printUsage() {
  console.log(`
使用方法:

1. 设置环境变量:
   export API_BASE_URL=http://localhost:3000
   export CUSTOMER_TOKEN=<客户JWT token>
   export WORKER_TOKEN=<师傅JWT token>
   export ADMIN_TOKEN=<管理员JWT token>

2. 运行测试:
   node scripts/test-phase3-api.js

注意事项:
- 需要先执行数据库迁移: node scripts/migrate-phase3.js
- 需要创建测试用户并获取 token
- 确保后端服务已启动
  `);
}

// ==================== 入口 ====================

if (require.main === module) {
  // 从环境变量读取 token
  customerToken = process.env.CUSTOMER_TOKEN || '';
  workerToken = process.env.WORKER_TOKEN || '';
  adminToken = process.env.ADMIN_TOKEN || '';

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  runTests().catch(error => {
    logError(`测试运行失败: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  testHealthCheck,
  testWorkerGetOrders,
  testCustomerUrgeOrder
};
