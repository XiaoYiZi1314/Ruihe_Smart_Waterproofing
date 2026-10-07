/**
 * 操作日志：只记录管理端（及无操作人的系统）审计，不写客户/师傅在小程序里的操作。
 */

const db = require('../config/database');

const ADMIN_ACTION_LABELS = {
  register_order: '电话登记',
  assign: '指派工单',
  adjust_price: '调整价格',
  cancel: '取消工单',
  edit_order: '更正工单',
  reassign: '改派师傅',
  correct_status: '更正状态',
  image_add: '补充图片',
  image_remove: '删除图片',
  handle_change_request: '处理变更申请',
  create_worker: '创建师傅',
  update_worker: '编辑师傅',
  delete_worker: '停用师傅',
  update_worker_status: '切换师傅状态',
  reset_worker_password: '重置师傅密码',
  create_category: '新增分类',
  update_category: '编辑分类',
  delete_category: '删除分类',
  toggle_category: '切换分类状态',
  create_service: '新增服务',
  update_service: '编辑服务',
  delete_service: '删除服务',
  toggle_service: '上架/下架服务',
  toggle_hot: '设置热门服务',
  create_banner: '新增轮播',
  update_banner: '编辑轮播',
  delete_banner: '删除轮播',
  update_config: '更新站点配置',
  upload_image: '上传图片',
  change_password: '修改密码'
};

const LEGACY_ACTION_LABELS = {
  create_order: '创建工单',
  accept: '接受工单',
  reject: '拒绝工单',
  start: '开始施工',
  complete: '完工填价',
  urge: '催单',
  confirm: '确认完成',
  dispute_price: '价格异议',
  change_request: '师傅变更申请',
  auto_complete: '自动完成',
  mark_exception: '标记异常',
  review: '评价'
};

const ACTION_LABELS = { ...ADMIN_ACTION_LABELS, ...LEGACY_ACTION_LABELS };

function actionLabel(action) {
  return ACTION_LABELS[action] || '其他操作';
}

function actionOptions() {
  return Object.entries(ADMIN_ACTION_LABELS).map(([value, label]) => ({ value, label }));
}

function decorateLog(row) {
  return { ...row, action_label: actionLabel(row && row.action) };
}

function adminLogScopeSql() {
  return "(ol.user_id IS NULL OR u.role = 'admin')";
}

async function isAdminActor(user_id, role) {
  if (!user_id) return true;
  if (role === 'admin') return true;
  if (role) return false;
  const [rows] = await db.query('SELECT role FROM users WHERE id = ? LIMIT 1', [user_id]);
  return Boolean(rows[0] && rows[0].role === 'admin');
}

/**
 * 记录操作日志（非管理员操作直接丢弃）
 * @param {object} params
 * @param {number|null} params.user_id - 操作人ID（系统操作可为 null）
 * @param {number|null} params.order_id - 关联工单ID
 * @param {string} params.action - 操作类型
 * @param {string} params.detail - 操作详情
 * @param {string|null} params.ip - 操作IP
 * @param {string|null} params.role - 已知角色时可传入，避免再查库
 */
async function logOperation({ user_id = null, order_id = null, action, detail, ip = null, role = null }) {
  try {
    if (!(await isAdminActor(user_id, role))) return;
    await db.query(
      `INSERT INTO operation_logs (user_id, order_id, action, detail, ip)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, order_id, action, detail, ip]
    );
  } catch (error) {
    // 日志记录失败不影响主流程
    console.error('记录操作日志失败:', error.message);
  }
}

module.exports = {
  logOperation,
  ACTION_LABELS,
  ADMIN_ACTION_LABELS,
  actionLabel,
  actionOptions,
  decorateLog,
  adminLogScopeSql
};
