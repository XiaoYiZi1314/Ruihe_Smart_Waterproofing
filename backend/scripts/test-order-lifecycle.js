/**
 * 完整工单流转测试（在服务器上运行）
 * 用真实数据库插入模拟客户 + 真实 API 跑完整状态机：
 *   pending → confirmed(指派) → accept → in_progress(施工) → pending_review(完工填价)
 *   → completed(客户验收) → review(评价)
 * 以及异常分支：拒单、价格异议、调价、取消
 *
 * 用法：
 *   cd backend && node scripts/test-order-lifecycle.js
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD=xxx node scripts/test-order-lifecycle.js
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

let passed = 0;
let failed = 0;

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

async function main() {
  // 直连数据库准备测试数据（模拟微信注册的客户）
  require('dotenv').config();
  const mysql = require('mysql2/promise');
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'waterproof_system'
  });
  const { generateToken } = require('../src/utils/jwt');
  const bcrypt = require('bcryptjs');

  console.log('🚀 完整工单流转测试\n');

  // ===== 准备账号 =====
  console.log('🔐 账号准备');
  const adminLogin = await api('POST', '/api/auth/admin-login', {
    username: ADMIN_USERNAME, password: ADMIN_PASSWORD
  });
  const adminToken = adminLogin.data.data.token;
  log(!!adminToken, '管理员登录');

  // 测试师傅
  const testPhone = `138${Date.now().toString().slice(-8)}`;
  const createWorker = await api('POST', '/api/admin/workers', {
    phone: testPhone, nickname: '流转测试师傅'
  }, adminToken);
  const workerId = createWorker.data.data.id;
  const wLogin = await api('POST', '/api/auth/worker-login', {
    phone: testPhone, password: createWorker.data.data.initial_password
  });
  const workerToken = wLogin.data.data.token;
  log(!!workerToken, '师傅登录');

  // 模拟客户（数据库直插 + 本地生成 token）
  const [customerRes] = await db.query(
    `INSERT INTO users (openid, nickname, role, status) VALUES (?, '流转测试客户', 'customer', 'active')`,
    [`test_customer_${Date.now()}`]
  );
  const customerId = customerRes.insertId;
  const customerToken = generateToken({ id: customerId, role: 'customer' });
  log(true, '模拟客户就绪', `ID=${customerId}`);

  // 测试地址
  const addrRes = await api('POST', '/api/addresses', {
    contact_name: '测试客户', contact_phone: '13700000000',
    province: '广东省', city: '深圳市', district: '南山区',
    detail_address: '科技园测试路1号', is_default: 1
  }, customerToken);
  const addressId = addrRes.data.data ? addrRes.data.data.id : null;
  log(!!addressId, '客户创建地址');

  // ===== 主流程：完整流转 =====
  console.log('\n📦 主流程：完整工单流转');

  // 1. 客户建单
  const createOrder = await api('POST', '/api/orders', {
    service_id: 1, address_id: addressId,
    contact_name: '测试客户', contact_phone: '13700000000',
    remark: '端到端流转测试', expected_price: 500
  }, customerToken);
  const orderId = createOrder.data.data ? createOrder.data.data.id : null;
  log(!!orderId, '客户创建工单', `单号=${createOrder.data.data ? createOrder.data.data.order_no : '-'}`);
  const orderNo = createOrder.data.data ? createOrder.data.data.order_no : '';

  // 2. 管理员指派
  const assign = await api('PUT', `/api/admin/orders/${orderId}/assign`, {
    worker_id: workerId, estimated_time: '2026-09-01 10:00:00'
  }, adminToken);
  log(assign.status === 200, '管理员指派师傅');

  // 3. 师傅接单
  const accept = await api('PUT', `/api/worker/orders/${orderId}/accept`, {}, workerToken);
  log(accept.status === 200, '师傅接受工单');

  // 4. 师傅开始施工
  const start = await api('PUT', `/api/worker/orders/${orderId}/start`, {}, workerToken);
  log(start.status === 200, '师傅开始施工');

  // 5. 客户施工中取消应被拒绝（仅管理员可取消）
  const badCancel = await api('PUT', `/api/orders/${orderId}/cancel`, {}, customerToken);
  log(badCancel.status === 400, '施工中客户取消被拒绝');

  // 6. 师傅完工填价
  const complete = await api('PUT', `/api/worker/orders/${orderId}/complete`, {
    door_fee: 50, material_fee: 300, labor_fee: 200
  }, workerToken);
  log(complete.status === 200, '师傅完工填价', `合计 ¥${complete.data.data ? complete.data.data.final_price : '?'}`);

  // 7. 客户价格异议
  const dispute = await api('PUT', `/api/orders/${orderId}/dispute-price`, {
    reason: '测试异议：材料费偏高'
  }, customerToken);
  log(dispute.status === 200, '客户提交价格异议');

  // 8. 管理员调价
  const adjust = await api('PUT', `/api/admin/orders/${orderId}/adjust-price`, {
    door_fee: 0, material_fee: 250, labor_fee: 180
  }, adminToken);
  log(adjust.status === 200, '管理员调整价格');

  // 9. 客户确认完成（验收）
  const confirm = await api('PUT', `/api/orders/${orderId}/confirm`, {}, customerToken);
  log(confirm.status === 200, '客户确认验收');

  // 10. 客户评价
  const review = await api('POST', `/api/orders/${orderId}/review`, {
    service_attitude_score: 5, quality_score: 5, price_score: 4,
    comment: '端到端测试好评'
  }, customerToken);
  log(review.status === 200, '客户提交评价');

  // 11. 服务详情应包含评价
  const svc = await api('GET', '/api/services/1');
  const hasReview = svc.data.data && svc.data.data.reviews &&
    svc.data.data.reviews.some(r => r.comment === '端到端测试好评');
  log(hasReview, '服务详情展示评价');

  // 12. 操作日志应记录全流程
  const logs = await api('GET', '/api/admin/logs?limit=50', null, adminToken);
  const flowActions = ['create_order', 'assign', 'accept', 'start', 'complete', 'dispute_price', 'adjust_price', 'confirm', 'review'];
  const loggedActions = new Set((logs.data.data.logs || []).map(l => l.action));
  const missing = flowActions.filter(a => !loggedActions.has(a));
  log(missing.length === 0, '操作日志覆盖全流程', missing.length ? `缺失: ${missing.join(',')}` : `${flowActions.length} 类操作全部记录`);

  // 13. 日志详情列可读（detail 字段）
  const logDetailOk = (logs.data.data.logs || []).every(l => l.detail !== undefined);
  log(logDetailOk, '日志 detail 字段可读（表结构对齐）');

  // ===== 分支流程：拒单 =====
  console.log('\n🔄 分支流程：师傅拒单');
  const order2 = await api('POST', '/api/orders', {
    service_id: 1, address_id: addressId,
    contact_name: '测试客户', contact_phone: '13700000000', remark: '拒单测试'
  }, customerToken);
  const orderId2 = order2.data.data.id;
  await api('PUT', `/api/admin/orders/${orderId2}/assign`, {
    worker_id: workerId, estimated_time: '2026-09-02 10:00:00'
  }, adminToken);
  const reject = await api('PUT', `/api/worker/orders/${orderId2}/reject`, {
    reason: '测试拒单：行程冲突'
  }, workerToken);
  log(reject.status === 200, '师傅拒单（回到待确认）');

  // 拒单后管理员可见拒单理由
  const detail2 = await api('GET', `/api/admin/orders/${orderId2}`, null, adminToken);
  log(detail2.data.data && detail2.data.data.reject_reason === '测试拒单：行程冲突',
    '管理员可见拒单理由');

  // ===== 分支流程：催单 + 客户取消 =====
  console.log('\n🔄 分支流程：催单与取消');
  const urge = await api('PUT', `/api/orders/${orderId2}/urge`, {}, customerToken);
  log(urge.status === 200, '客户催单');

  const cancel = await api('PUT', `/api/orders/${orderId2}/cancel`, {}, customerToken);
  log(cancel.status === 200, '客户取消待确认工单');

  // ===== 清理 =====
  console.log('\n🧹 清理测试数据');
  await db.query('DELETE FROM reviews WHERE order_id IN (?, ?)', [orderId, orderId2]);
  await db.query('DELETE FROM notifications WHERE order_id IN (?, ?)', [orderId, orderId2]);
  await db.query('DELETE FROM work_order_images WHERE order_id IN (?, ?)', [orderId, orderId2]);
  await db.query('DELETE FROM work_orders WHERE id IN (?, ?)', [orderId, orderId2]);
  await db.query('DELETE FROM addresses WHERE user_id = ?', [customerId]);
  // 先删该用户产生的日志，再删用户（外键约束）
  await db.query('DELETE FROM operation_logs WHERE user_id = ? OR order_id IN (?, ?)', [customerId, orderId, orderId2]);
  await db.query('DELETE FROM users WHERE id = ?', [customerId]);
  await api('DELETE', `/api/admin/workers/${workerId}`, null, adminToken);
  log(true, '测试数据已清理');

  await db.end();

  console.log('\n' + '='.repeat(50));
  console.log(`📈 测试结果: ${passed} 通过 / ${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('测试执行异常:', e);
  process.exit(1);
});
