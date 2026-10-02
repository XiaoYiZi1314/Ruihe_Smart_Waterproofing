const Workflow = require('../utils/orderWorkflow');
/**
 * 管理员控制器
 * 处理工单管理、师傅管理、数据统计等管理员操作
 */

const db = require('../config/database');
const OrderStateMachine = require('../utils/orderStateMachine');
const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');
const NotificationService = require('../utils/notification');
const { logOperation } = require('../utils/operationLog');
const { generateWorkerPassword, isValidWorkerPassword } = require('../utils/password');

class AdminController {
  /**
   * 获取工单列表（带筛选）
   * GET /api/admin/orders
   */
  static async getOrders(req, res) {
    try {
      const {
        status,
        worker_id,
        start_date,
        end_date,
        keyword,
        page = 1,
        limit = 20
      } = req.query;

      const offset = (page - 1) * limit;
      
      // 构建查询条件
      const { whereClause, params } = require('../utils/orderFilter').orderFilter(req.query);

      // 查询工单列表
      const [orders] = await db.query(
        `SELECT 
          wo.*,
          wo.contact_name as customer_name,
          c.phone as customer_phone,
          w.nickname as worker_name,
          w.phone as worker_phone,
          s.name as service_name,
          (SELECT COUNT(*) FROM order_change_requests r WHERE r.order_id = wo.id AND r.status = 'pending') as pending_requests
         FROM work_orders wo
         LEFT JOIN users c ON wo.user_id = c.id
         LEFT JOIN users w ON wo.worker_id = w.id
         LEFT JOIN services s ON wo.service_id = s.id
         WHERE ${whereClause}
         ORDER BY wo.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), parseInt(offset)]
      );

      // 查询总数
      const [countResult] = await db.query(
        `SELECT COUNT(*) as total FROM work_orders wo WHERE ${whereClause}`,
        params
      );

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult[0].total,
            totalPages: Math.ceil(countResult[0].total / limit)
          }
        }
      });
    } catch (error) {
      console.error('获取工单列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取工单列表失败'
      });
    }
  }

  /**
   * 获取工单详情
   * GET /api/admin/orders/:id
   */
  static async getOrderDetail(req, res) {
    try {
      const { id } = req.params;

      // 查询工单详情
      const [orders] = await db.query(
        `SELECT 
          wo.*,
          wo.contact_name as customer_name,
          c.phone as customer_phone,
          c.avatar_url as customer_avatar,
          w.nickname as worker_name,
          w.phone as worker_phone,
          w.avatar_url as worker_avatar,
          s.name as service_name,
          s.description as service_description
         FROM work_orders wo
         LEFT JOIN users c ON wo.user_id = c.id
         LEFT JOIN users w ON wo.worker_id = w.id
         LEFT JOIN services s ON wo.service_id = s.id
         WHERE wo.id = ?`,
        [id]
      );

      if (orders.length === 0) {
        return res.status(404).json({
          success: false,
          message: '工单不存在'
        });
      }

      const order = orders[0];

      // 查询工单图片
      const [images] = await db.query(
        'SELECT * FROM work_order_images WHERE order_id = ? AND deleted_at IS NULL ORDER BY sort_order',
        [id]
      );
      order.images = images;
      order.allowed_corrections = require('../utils/orderEdit').allowedCorrections(order.status);

      // 查询评价（如果有）
      const [reviews] = await db.query(
        'SELECT * FROM reviews WHERE order_id = ?',
        [id]
      );
      order.review = reviews.length > 0 ? reviews[0] : null;
      if (order.review) {
        const imagesByReview = await require('../utils/attachments').loadReviewImages([order.review.id]);
        order.review.images = imagesByReview[order.review.id] || [];
      }

      require('../utils/attachments').presentOrder(order);
      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      console.error('获取工单详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取工单详情失败'
      });
    }
  }

  /**
   * 指派工单
   * PUT /api/admin/orders/:id/assign
   */
  static async assignOrder(req, res) {
    try {
      const id = req.params.id;
      const result = await Workflow.transition(id, req.user, 'assign', req.body || {}, { ip: req.ip });
      NotificationService.notifyOrderAssigned(id).catch(() => {});
      logOperation({ user_id: req.user.id, order_id: id, action: 'assign', detail: '工单已指派', ip: req.ip });
      res.json({ success: true, message: '工单已指派', data: { final_price: result.final_price } });
    } catch (error) {
      res.status(error.status || 500).json({ success: false, message: error.status ? error.message : '操作失败，请重试' });
    }
  }

  /**
   * 调整价格
   * PUT /api/admin/orders/:id/adjust-price
   */
  static async adjustPrice(req, res) {
    try {
      const id = req.params.id;
      const result = await Workflow.transition(id, req.user, 'adjust_price', req.body || {}, { ip: req.ip });
      NotificationService.notifyCustomerPriceAdjusted(id).catch(() => {});
      logOperation({ user_id: req.user.id, order_id: id, action: 'adjust_price', detail: '价格已调整', ip: req.ip });
      res.json({ success: true, message: '价格已调整', data: { final_price: result.final_price } });
    } catch (error) {
      res.status(error.status || 500).json({ success: false, message: error.status ? error.message : '操作失败，请重试' });
    }
  }

  /**
   * 取消工单
   * PUT /api/admin/orders/:id/cancel
   */
  static async cancelOrder(req, res) {
    try {
      const id = req.params.id;
      const result = await Workflow.transition(id, req.user, 'cancel', req.body || {}, { ip: req.ip });
      NotificationService.notifyWorkerOrderCancelled(id, req.body.reason).catch(() => {});
      logOperation({ user_id: req.user.id, order_id: id, action: 'cancel', detail: '工单已取消', ip: req.ip });
      res.json({ success: true, message: '工单已取消', data: { final_price: result.final_price } });
    } catch (error) {
      res.status(error.status || 500).json({ success: false, message: error.status ? error.message : '操作失败，请重试' });
    }
  }

  /**
   * 获取师傅列表
   * GET /api/admin/workers
   */
  static async getWorkers(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // 查询师傅列表
      const [workers] = await db.query(
        `SELECT 
          id, nickname, phone, avatar_url, worker_status, status,
          reject_count, assign_count, created_at,
          CASE 
            WHEN assign_count > 0 THEN ROUND((reject_count / assign_count) * 100, 2)
            ELSE 0 
          END as reject_rate
         FROM users
         WHERE role = 'worker' AND status = 'active'
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [parseInt(limit), parseInt(offset)]
      );

      // 查询总数
      const [countResult] = await db.query(
        "SELECT COUNT(*) as total FROM users WHERE role = 'worker' AND status = 'active'"
      );

      res.json({
        success: true,
        data: {
          workers,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult[0].total,
            totalPages: Math.ceil(countResult[0].total / limit)
          }
        }
      });
    } catch (error) {
      console.error('获取师傅列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取师傅列表失败'
      });
    }
  }

  /**
   * 创建师傅账号
   * POST /api/admin/workers
   */
  static async createWorker(req, res) {
    try {
      const { phone, nickname, password } = req.body;

      if (typeof phone !== 'string' || !/^1[3-9]\d{9}$/.test(phone) || typeof nickname !== 'string' || !nickname.trim()) {
        return res.status(400).json({
          success: false,
          message: '手机号和昵称不能为空'
        });
      }

      // 检查手机号是否已存在
      const [existing] = await db.query(
        'SELECT id FROM users WHERE phone = ?',
        [phone]
      );

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: '该手机号已被注册'
        });
      }

      // 生成 openid（使用手机号作为唯一标识）
      const openid = `worker_${phone}_${Date.now()}`;

      // 生成密码哈希（传入了密码则用密码，否则生成 8 位随机密码）
      const rawPassword = password || generateWorkerPassword();
      if (!isValidWorkerPassword(rawPassword)) return res.status(400).json({ success: false, message: '密码需8位以上，最多72字节' });
      const passwordHash = await bcrypt.hash(rawPassword, 12);

      // 创建师傅账号
      const [result] = await db.query(
        `INSERT INTO users (openid, phone, nickname, role, worker_status, username, password, must_change_password)
         VALUES (?, ?, ?, 'worker', 'working', ?, ?, 1)`,
        [openid, phone, nickname, phone, passwordHash]
      );

      logOperation({
        user_id: req.user.id,
        action: 'create_worker',
        detail: `创建师傅账号：${nickname}（${phone}）`,
        ip: req.ip
      });

      res.json({
        success: true,
        message: '师傅账号创建成功',
        data: {
          id: result.insertId,
          phone,
          nickname,
          initial_password: rawPassword // 仅创建时返回一次，需告知师傅
        }
      });
    } catch (error) {
      console.error('创建师傅账号失败:', error);
      res.status(500).json({
        success: false,
        message: '创建师傅账号失败'
      });
    }
  }

  /**
   * 删除师傅
   * DELETE /api/admin/workers/:id
   */
  static async deleteWorker(req, res) {
    try {
      await Workflow.deleteWorker(req.params.id);
      logOperation({ user_id: req.user.id, action: 'delete_worker', detail: '停用师傅 ID=' + req.params.id, ip: req.ip });
      res.json({ success: true, message: '师傅已停用' });
    } catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : '操作失败' }); }
  }

  /**
   * 获取数据看板
   * GET /api/admin/dashboard
   */
  static async getDashboard(req, res) {
    try {
      // 工单统计
      const [orderStats] = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) as pending_review,
          SUM(CASE WHEN status = 'price_negotiating' THEN 1 ELSE 0 END) as price_negotiating,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
          SUM(CASE WHEN is_exception = 1 THEN 1 ELSE 0 END) as exception
        FROM work_orders
      `);

      // 师傅统计
      const [workerStats] = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN worker_status = 'working' AND status = 'active' THEN 1 ELSE 0 END) as working,
          SUM(CASE WHEN worker_status = 'resting' AND status = 'active' THEN 1 ELSE 0 END) as resting
        FROM users
        WHERE role = 'worker'
      `);

      // 今日数据
      const [todayStats] = await db.query(`
        SELECT 
          SUM(DATE(created_at) = CURDATE()) as new_orders,
          SUM(status = 'completed' AND DATE(finished_at) = CURDATE()) as completed_orders
        FROM work_orders
      `);

      // 本月数据
      const [monthStats] = await db.query(`
        SELECT 
          SUM(YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())) as new_orders,
          SUM(status = 'completed' AND YEAR(finished_at) = YEAR(CURDATE()) AND MONTH(finished_at) = MONTH(CURDATE())) as completed_orders,
          COALESCE(SUM(CASE WHEN status = 'completed' AND YEAR(finished_at) = YEAR(CURDATE()) AND MONTH(finished_at) = MONTH(CURDATE()) THEN final_price ELSE 0 END), 0) as total_revenue
        FROM work_orders
      `);

      // MySQL SUM returns DECIMAL strings; the API contract exposes numeric metrics.
      const numbers = row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value || 0)]));
      res.json({
        success: true,
        data: {
          orders: numbers(orderStats[0]),
          workers: numbers(workerStats[0]),
          today: numbers(todayStats[0]),
          month: numbers(monthStats[0])
        }
      });
    } catch (error) {
      console.error('获取数据看板失败:', error);
      res.status(500).json({
        success: false,
        message: '获取数据看板失败'
      });
    }
  }

  /**
   * 导出工单
   * GET /api/admin/orders/export
   */
  static async exportOrders(req, res) {
    try {
      const { status, start_date, end_date } = req.query;

      // 构建查询条件
      const { whereClause, params } = require('../utils/orderFilter').orderFilter(req.query);

      // 查询工单数据
      const [orders] = await db.query(
        `SELECT 
          wo.order_no,
          wo.booking_source,
          wo.contact_name as customer_name,
          wo.contact_phone,
          s.name as service_name,
          wo.full_address,
          wo.status,
          wo.created_at,
          wo.finished_at,
          w.nickname as worker_name,
          wo.final_price,
          wo.appointment_date,
          wo.appointment_slot,
          wo.estimated_time,
          wo.expected_price,
          wo.door_fee,
          wo.material_fee,
          wo.labor_fee,
          wo.remark,
          w.phone as worker_phone,
          wo.confirmed_at,
          wo.started_at,
          wo.completed_at,
          wo.cancel_reason,
          wo.urge_count,
          wo.correction_count,
          r.comment as review_comment,
          ROUND((IFNULL(r.service_attitude_score, 0) + 
                 IFNULL(r.quality_score, 0) + 
                 IFNULL(r.price_score, 0)) / 3, 1) as avg_score
         FROM work_orders wo
         LEFT JOIN users c ON wo.user_id = c.id
         LEFT JOIN users w ON wo.worker_id = w.id
         LEFT JOIN services s ON wo.service_id = s.id
         LEFT JOIN reviews r ON wo.id = r.order_id
         WHERE ${whereClause}
         ORDER BY wo.created_at DESC`,
        params
      );

      // 创建 Excel 工作簿
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('工单列表');

      // 设置列
      worksheet.columns = [
        { header: '工单号', key: 'order_no', width: 20 },
        { header: '来源', key: 'booking_source', width: 12 },
        { header: '客户名称', key: 'customer_name', width: 15 },
        { header: '联系电话', key: 'contact_phone', width: 15 },
        { header: '服务项目', key: 'service_name', width: 20 },
        { header: '地址', key: 'full_address', width: 30 },
        { header: '状态', key: 'status', width: 15 },
        { header: '创建时间', key: 'created_at', width: 20 },
        { header: '完成时间', key: 'finished_at', width: 20 },
        { header: '师傅姓名', key: 'worker_name', width: 15 },
        { header: '最终价格', key: 'final_price', width: 12 },
        { header: '预约日期', key: 'appointment_date', width: 12 },
        { header: '预约时段', key: 'appointment_slot', width: 14 },
        { header: '上门时间', key: 'estimated_time', width: 20 },
        { header: '期望价格', key: 'expected_price', width: 12 },
        { header: '上门费', key: 'door_fee', width: 10 },
        { header: '材料费', key: 'material_fee', width: 10 },
        { header: '人工费', key: 'labor_fee', width: 10 },
        { header: '备注', key: 'remark', width: 30 },
        { header: '师傅电话', key: 'worker_phone', width: 15 },
        { header: '接单时间', key: 'confirmed_at', width: 20 },
        { header: '开工时间', key: 'started_at', width: 20 },
        { header: '完工提交时间', key: 'completed_at', width: 20 },
        { header: '取消原因', key: 'cancel_reason', width: 24 },
        { header: '催单次数', key: 'urge_count', width: 10 },
        { header: '更正次数', key: 'correction_count', width: 10 },
        { header: '评价内容', key: 'review_comment', width: 30 },
        { header: '平均评分', key: 'avg_score', width: 12 }
      ];

      // 添加数据
      orders.forEach(order => {
        worksheet.addRow({
          ...order,
          booking_source: order.booking_source === 'phone' ? '电话登记' : '小程序',
          status: OrderStateMachine.getStatusText(order.status)
        });
      });

      // 设置响应头
      const filename = `${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }).replaceAll('-', '')}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

      // 写入响应
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('导出工单失败:', error);
      res.status(500).json({
        success: false,
        message: '导出工单失败'
      });
    }
  }

  /**
   * 获取操作日志
   * GET /api/admin/logs
   */
  static async getLogs(req, res) {
    try {
      const { action, keyword, start_date, end_date, page = 1, limit = 20 } = req.query;
      const current = Math.max(parseInt(page, 10) || 1, 1);
      const size = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

      let whereClause = '1=1';
      const params = [];

      if (action) {
        whereClause += ' AND ol.action = ?';
        params.push(action);
      }

      if (start_date) {
        whereClause += ' AND DATE(ol.created_at) >= ?';
        params.push(start_date);
      }

      if (end_date) {
        whereClause += ' AND DATE(ol.created_at) <= ?';
        params.push(end_date);
      }

      const term = typeof keyword === 'string' ? keyword.trim() : '';
      if (term) {
        whereClause += ' AND (wo.order_no LIKE ? OR u.nickname LIKE ? OR u.username LIKE ? OR ol.detail LIKE ?)';
        params.push(...Array(4).fill(`%${term}%`));
      }

      const from = `FROM operation_logs ol
         LEFT JOIN users u ON ol.user_id = u.id
         LEFT JOIN work_orders wo ON ol.order_id = wo.id
         WHERE ${whereClause}`;

      const [logs] = await db.query(
        `SELECT
          ol.id, ol.user_id, ol.order_id, ol.action, ol.detail, ol.ip, ol.created_at,
          u.nickname as user_name,
          u.role as user_role,
          wo.order_no
         ${from}
         ORDER BY ol.created_at DESC, ol.id DESC
         LIMIT ? OFFSET ?`,
        [...params, size, (current - 1) * size]
      );

      const [countResult] = await db.query(
        `SELECT COUNT(*) as total ${from}`,
        params
      );

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page: current,
            limit: size,
            total: countResult[0].total,
            totalPages: Math.ceil(countResult[0].total / size)
          }
        }
      });
    } catch (error) {
      console.error('获取操作日志失败:', error);
      res.status(500).json({
        success: false,
        message: '获取操作日志失败'
      });
    }
  }
  /**
   * 获取工单完成趋势（按日）
   * GET /api/admin/dashboard/trend?days=30
   */
  static async getTrend(req, res) {
    try {
      const days = Math.max(1, Math.min(parseInt(req.query.days) || 30, 90));
      const [trend] = await db.query(`WITH RECURSIVE dates AS (
        SELECT DATE_SUB(CURDATE(), INTERVAL ? DAY) AS day
        UNION ALL SELECT DATE_ADD(day, INTERVAL 1 DAY) FROM dates WHERE day < CURDATE()
      ) SELECT DATE_FORMAT(day, '%Y-%m-%d') AS date,
        (SELECT COUNT(*) FROM work_orders WHERE created_at >= day AND created_at < DATE_ADD(day, INTERVAL 1 DAY)) AS new_orders,
        (SELECT COUNT(*) FROM work_orders WHERE status='completed' AND finished_at >= day AND finished_at < DATE_ADD(day, INTERVAL 1 DAY)) AS completed_orders
        FROM dates ORDER BY day`, [days - 1]);
      res.json({ success: true, data: { trend } });
    } catch (error) { res.status(500).json({ success: false, message: '获取趋势数据失败' }); }
  }

  /**
   * 师傅本月完成排行榜
   * GET /api/admin/dashboard/worker-ranking?limit=10
   */
  static async getWorkerRanking(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);

      const [ranking] = await db.query(
        `SELECT 
           u.id,
           u.nickname,
           u.phone,
           u.avatar_url,
           COUNT(wo.id) as completed_count,
           COALESCE(SUM(CASE WHEN wo.status = 'completed' THEN wo.final_price ELSE 0 END), 0) as total_revenue,
           COALESCE((SELECT ROUND(AVG((r.service_attitude_score + r.quality_score + r.price_score) / 3), 2)
                     FROM reviews r 
                     JOIN work_orders wo2 ON r.order_id = wo2.id 
                     WHERE wo2.worker_id = u.id), 0) as avg_score
         FROM users u
         LEFT JOIN work_orders wo ON wo.worker_id = u.id
           AND wo.status = 'completed'
           AND YEAR(wo.finished_at) = YEAR(CURDATE())
           AND MONTH(wo.finished_at) = MONTH(CURDATE())
         WHERE u.role = 'worker' AND u.status = 'active'
         GROUP BY u.id, u.nickname, u.phone, u.avatar_url
         ORDER BY completed_count DESC, total_revenue DESC
         LIMIT ?`,
        [limit]
      );

      res.json({
        success: true,
        data: { ranking }
      });
    } catch (error) {
      console.error('获取师傅排行榜失败:', error);
      res.status(500).json({ success: false, message: '获取师傅排行榜失败' });
    }
  }

  /**
   * 编辑师傅信息
   * PUT /api/admin/workers/:id
   */
  static async resetWorkerPassword(req, res) {
    try {
      const password = generateWorkerPassword();
      const hash = await bcrypt.hash(password, 12);
      const [result] = await db.query("UPDATE users SET password=?, must_change_password=1, token_version=token_version+1 WHERE id=? AND role='worker' AND status='active'", [hash, req.params.id]);
      if (!result.affectedRows) return res.status(404).json({ success: false, message: '师傅不存在' });
      logOperation({ user_id: req.user.id, action: 'reset_worker_password', detail: '重置师傅密码 ID=' + req.params.id, ip: req.ip });
      res.json({ success: true, data: { initial_password: password } });
    } catch (error) { res.status(500).json({ success: false, message: '重置失败' }); }
  }

  static async updateWorker(req, res) {
    try {
      const { id } = req.params;
      const { nickname, phone } = req.body;

      if (typeof nickname !== 'string' || !nickname.trim() || typeof phone !== 'string' || !/^1[3-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ success: false, message: '姓名和手机号不能为空' });
      }

      // 检查手机号是否被其他用户占用
      const [existing] = await db.query(
        'SELECT id FROM users WHERE phone = ? AND id != ?',
        [phone, id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: '该手机号已被其他账号使用' });
      }

      const [result] = await db.query(
        `UPDATE users SET nickname = ?, phone = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ? AND role = 'worker'`,
        [nickname.trim(), phone, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '师傅不存在' });
      }

      logOperation({
        user_id: req.user.id,
        action: 'update_worker',
        detail: `编辑师傅信息：${nickname.trim()}（${phone}）`,
        ip: req.ip
      });

      res.json({ success: true, message: '师傅信息已更新' });
    } catch (error) {
      console.error('更新师傅信息失败:', error);
      res.status(500).json({ success: false, message: '更新师傅信息失败' });
    }
  }

  /**
   * 修改师傅工作状态
   * PUT /api/admin/workers/:id/status
   */
  static async updateWorkerStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['working', 'resting'].includes(status)) {
        return res.status(400).json({ success: false, message: '无效的状态值' });
      }

      const [result] = await db.query(
        "UPDATE users SET worker_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role = 'worker'",
        [status, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '师傅不存在' });
      }

      logOperation({
        user_id: req.user.id,
        action: 'update_worker_status',
        detail: `修改师傅状态为 ${status === 'working' ? '上班' : '休息'} ID=${id}`,
        ip: req.ip
      });

      res.json({
        success: true,
        message: status === 'working' ? '已切换为上班状态' : '已切换为休息状态'
      });
    } catch (error) {
      console.error('修改师傅状态失败:', error);
      res.status(500).json({ success: false, message: '修改师傅状态失败' });
    }
  }
}

module.exports = AdminController;
