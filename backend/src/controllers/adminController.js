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
      let whereClause = '1=1';
      const params = [];

      if (status) {
        whereClause += ' AND wo.status = ?';
        params.push(status);
      }

      if (worker_id) {
        whereClause += ' AND wo.worker_id = ?';
        params.push(worker_id);
      }

      if (start_date) {
        whereClause += ' AND DATE(wo.created_at) >= ?';
        params.push(start_date);
      }

      if (end_date) {
        whereClause += ' AND DATE(wo.created_at) <= ?';
        params.push(end_date);
      }

      if (keyword) {
        whereClause += ' AND (wo.order_no LIKE ? OR wo.contact_name LIKE ? OR wo.contact_phone LIKE ?)';
        const likeKeyword = `%${keyword}%`;
        params.push(likeKeyword, likeKeyword, likeKeyword);
      }

      // 查询工单列表
      const [orders] = await db.query(
        `SELECT 
          wo.*,
          c.nickname as customer_name,
          c.phone as customer_phone,
          w.nickname as worker_name,
          w.phone as worker_phone,
          s.name as service_name
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
          c.nickname as customer_name,
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
        'SELECT * FROM work_order_images WHERE order_id = ? ORDER BY sort_order',
        [id]
      );
      order.images = images;

      // 查询评价（如果有）
      const [reviews] = await db.query(
        'SELECT * FROM reviews WHERE order_id = ?',
        [id]
      );
      order.review = reviews.length > 0 ? reviews[0] : null;

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
      const { id } = req.params;
      const { worker_id, estimated_time } = req.body;

      // 验证必填字段
      if (!worker_id || !estimated_time) {
        return res.status(400).json({
          success: false,
          message: '请选择师傅并填写预计上门时间'
        });
      }

      // 查询工单
      const [orders] = await db.query(
        'SELECT * FROM work_orders WHERE id = ?',
        [id]
      );

      if (orders.length === 0) {
        return res.status(404).json({
          success: false,
          message: '工单不存在'
        });
      }

      const order = orders[0];

      // 验证状态转换
      const validation = OrderStateMachine.validate(
        order.status,
        OrderStateMachine.ACTION.ASSIGN,
        OrderStateMachine.ROLE.ADMIN
      );

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }

      // 查询师傅信息
      const [workers] = await db.query(
        "SELECT * FROM users WHERE id = ? AND role = 'worker'",
        [worker_id]
      );

      if (workers.length === 0) {
        return res.status(404).json({
          success: false,
          message: '师傅不存在'
        });
      }

      const worker = workers[0];

      // 检查师傅状态
      if (worker.worker_status === 'resting') {
        return res.status(400).json({
          success: false,
          message: '该师傅当前处于休息状态，无法接单'
        });
      }

      const connection = await db.getConnection();
      await connection.beginTransaction();

      try {
        // 更新工单
        await connection.query(
          `UPDATE work_orders 
           SET status = ?,
               worker_id = ?,
               estimated_time = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [validation.nextStatus, worker_id, estimated_time, id]
        );

        // 增加师傅的指派次数
        await connection.query(
          'UPDATE users SET assign_count = assign_count + 1 WHERE id = ?',
          [worker_id]
        );

        await connection.commit();

        // 异步：通知师傅和客户 + 记录日志
        NotificationService.notifyOrderAssigned(id).catch(() => {});
        logOperation({
          user_id: req.user.id,
          order_id: id,
          action: 'assign',
          detail: `指派给师傅：${worker.nickname}，预计上门：${estimated_time}`,
          ip: req.ip
        });

        res.json({
          success: true,
          message: '工单已指派'
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('指派工单失败:', error);
      res.status(500).json({
        success: false,
        message: '指派工单失败'
      });
    }
  }

  /**
   * 调整价格
   * PUT /api/admin/orders/:id/adjust-price
   */
  static async adjustPrice(req, res) {
    try {
      const { id } = req.params;
      const { door_fee, material_fee, labor_fee } = req.body;

      // 验证必填字段
      if (door_fee === undefined || material_fee === undefined || labor_fee === undefined) {
        return res.status(400).json({
          success: false,
          message: '请填写完整的价格信息'
        });
      }

      // 验证价格为非负数
      if (door_fee < 0 || material_fee < 0 || labor_fee < 0) {
        return res.status(400).json({
          success: false,
          message: '价格不能为负数'
        });
      }

      // 查询工单
      const [orders] = await db.query(
        'SELECT * FROM work_orders WHERE id = ?',
        [id]
      );

      if (orders.length === 0) {
        return res.status(404).json({
          success: false,
          message: '工单不存在'
        });
      }

      const order = orders[0];

      // 验证状态
      const validation = OrderStateMachine.validate(
        order.status,
        OrderStateMachine.ACTION.ADJUST_PRICE,
        OrderStateMachine.ROLE.ADMIN
      );

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }

      // 计算最终价格
      const finalPrice = parseFloat(door_fee) + parseFloat(material_fee) + parseFloat(labor_fee);

      // 更新工单
      await db.query(
        `UPDATE work_orders 
         SET status = ?,
             door_fee = ?,
             material_fee = ?,
             labor_fee = ?,
             final_price = ?,
             price_adjusted_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [validation.nextStatus, door_fee, material_fee, labor_fee, finalPrice, id]
      );

      // 异步：通知客户价格调整 + 记录日志
      NotificationService.notifyCustomerPriceAdjusted(id).catch(() => {});
      logOperation({
        user_id: req.user.id,
        order_id: id,
        action: 'adjust_price',
        detail: `管理员调整价格：合计 ¥${finalPrice}`,
        ip: req.ip
      });

      res.json({
        success: true,
        message: '价格已调整',
        data: {
          final_price: finalPrice
        }
      });
    } catch (error) {
      console.error('调整价格失败:', error);
      res.status(500).json({
        success: false,
        message: '调整价格失败'
      });
    }
  }

  /**
   * 取消工单
   * PUT /api/admin/orders/:id/cancel
   */
  static async cancelOrder(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || reason.trim() === '') {
        return res.status(400).json({
          success: false,
          message: '请填写取消原因'
        });
      }

      // 查询工单
      const [orders] = await db.query(
        'SELECT * FROM work_orders WHERE id = ?',
        [id]
      );

      if (orders.length === 0) {
        return res.status(404).json({
          success: false,
          message: '工单不存在'
        });
      }

      const order = orders[0];

      // 管理员可以取消任何非终态工单
      if (OrderStateMachine.isFinalStatus(order.status)) {
        return res.status(400).json({
          success: false,
          message: '已完成或已取消的工单无法再次取消'
        });
      }

      // 更新工单状态
      await db.query(
        `UPDATE work_orders 
         SET status = 'cancelled',
             remark = CONCAT(IFNULL(remark, ''), '\n\n[管理员取消原因] ', ?),
             cancelled_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [reason, id]
      );

      // 异步：通知师傅工单取消 + 记录日志
      NotificationService.notifyWorkerOrderCancelled(id, `管理员取消：${reason}`).catch(() => {});
      logOperation({
        user_id: req.user.id,
        order_id: id,
        action: 'cancel',
        detail: `管理员取消工单：${reason}`,
        ip: req.ip
      });

      res.json({
        success: true,
        message: '工单已取消'
      });
    } catch (error) {
      console.error('取消工单失败:', error);
      res.status(500).json({
        success: false,
        message: '取消工单失败'
      });
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
          id, nickname, phone, avatar_url, worker_status,
          reject_count, assign_count, created_at,
          CASE 
            WHEN assign_count > 0 THEN ROUND((reject_count / assign_count) * 100, 2)
            ELSE 0 
          END as reject_rate
         FROM users
         WHERE role = 'worker'
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [parseInt(limit), parseInt(offset)]
      );

      // 查询总数
      const [countResult] = await db.query(
        "SELECT COUNT(*) as total FROM users WHERE role = 'worker'"
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

      if (!phone || !nickname) {
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

      // 生成密码哈希（传入了密码则用密码，否则生成随机密码）
      const rawPassword = password || Math.random().toString(36).slice(-8).toUpperCase();
      const passwordHash = bcrypt.hashSync(rawPassword, 10);

      // 创建师傅账号
      const [result] = await db.query(
        `INSERT INTO users (openid, phone, nickname, role, worker_status, username, password)
         VALUES (?, ?, ?, 'worker', 'working', ?, ?)`,
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
      const { id } = req.params;

      // 检查师傅是否有进行中的工单
      const [orders] = await db.query(
        `SELECT COUNT(*) as count FROM work_orders 
         WHERE worker_id = ? AND status NOT IN ('completed', 'cancelled')`,
        [id]
      );

      if (orders[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: '该师傅有进行中的工单，无法删除'
        });
      }

      // 删除师傅（软删除，更改状态）
      const [result] = await db.query(
        "UPDATE users SET status = 'inactive' WHERE id = ? AND role = 'worker'",
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: '师傅不存在'
        });
      }

      logOperation({
        user_id: req.user.id,
        action: 'delete_worker',
        detail: `删除师傅账号 ID=${id}`,
        ip: req.ip
      });

      res.json({
        success: true,
        message: '师傅已删除'
      });
    } catch (error) {
      console.error('删除师傅失败:', error);
      res.status(500).json({
        success: false,
        message: '删除师傅失败'
      });
    }
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
          COUNT(*) as new_orders,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders
        FROM work_orders
        WHERE DATE(created_at) = CURDATE()
      `);

      // 本月数据
      const [monthStats] = await db.query(`
        SELECT 
          COUNT(*) as new_orders,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
          SUM(CASE WHEN status = 'completed' THEN final_price ELSE 0 END) as total_revenue
        FROM work_orders
        WHERE YEAR(created_at) = YEAR(CURDATE()) 
        AND MONTH(created_at) = MONTH(CURDATE())
      `);

      res.json({
        success: true,
        data: {
          orders: orderStats[0],
          workers: workerStats[0],
          today: todayStats[0],
          month: monthStats[0]
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
      let whereClause = '1=1';
      const params = [];

      if (status) {
        whereClause += ' AND wo.status = ?';
        params.push(status);
      }

      if (start_date) {
        whereClause += ' AND DATE(wo.created_at) >= ?';
        params.push(start_date);
      }

      if (end_date) {
        whereClause += ' AND DATE(wo.created_at) <= ?';
        params.push(end_date);
      }

      // 查询工单数据
      const [orders] = await db.query(
        `SELECT 
          wo.order_no,
          c.nickname as customer_name,
          wo.contact_phone,
          s.name as service_name,
          wo.full_address,
          wo.status,
          wo.created_at,
          wo.finished_at,
          w.nickname as worker_name,
          wo.final_price,
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
        { header: '客户名称', key: 'customer_name', width: 15 },
        { header: '联系电话', key: 'contact_phone', width: 15 },
        { header: '服务项目', key: 'service_name', width: 20 },
        { header: '地址', key: 'full_address', width: 30 },
        { header: '状态', key: 'status', width: 15 },
        { header: '创建时间', key: 'created_at', width: 20 },
        { header: '完成时间', key: 'finished_at', width: 20 },
        { header: '师傅姓名', key: 'worker_name', width: 15 },
        { header: '最终价格', key: 'final_price', width: 12 },
        { header: '评价内容', key: 'review_comment', width: 30 },
        { header: '平均评分', key: 'avg_score', width: 12 }
      ];

      // 添加数据
      orders.forEach(order => {
        worksheet.addRow({
          ...order,
          status: OrderStateMachine.getStatusText(order.status)
        });
      });

      // 设置响应头
      const filename = `工单导出_${new Date().toISOString().split('T')[0]}.xlsx`;
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
      const { action, start_date, end_date, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // 构建查询条件
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

      // 查询日志
      const [logs] = await db.query(
        `SELECT 
          ol.*,
          u.nickname as user_name,
          u.role as user_role,
          wo.order_no
         FROM operation_logs ol
         LEFT JOIN users u ON ol.user_id = u.id
         LEFT JOIN work_orders wo ON ol.order_id = wo.id
         WHERE ${whereClause}
         ORDER BY ol.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), parseInt(offset)]
      );

      // 查询总数
      const [countResult] = await db.query(
        `SELECT COUNT(*) as total FROM operation_logs ol WHERE ${whereClause}`,
        params
      );

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult[0].total,
            totalPages: Math.ceil(countResult[0].total / limit)
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
      const days = Math.min(parseInt(req.query.days) || 30, 90);

      const [rows] = await db.query(
        `SELECT 
           DATE(created_at) as date,
           COUNT(*) as new_orders,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders
         FROM work_orders
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [days]
      );

      // 补齐缺失日期
      const result = [];
      const dateMap = new Map(rows.map((r) => [String(r.date).slice(0, 10), r]));
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const row = dateMap.get(key);
        result.push({
          date: key,
          new_orders: row ? row.new_orders : 0,
          completed_orders: row ? row.completed_orders : 0
        });
      }

      res.json({
        success: true,
        data: { trend: result }
      });
    } catch (error) {
      console.error('获取趋势数据失败:', error);
      res.status(500).json({ success: false, message: '获取趋势数据失败' });
    }
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
  static async updateWorker(req, res) {
    try {
      const { id } = req.params;
      const { nickname, phone } = req.body;

      if (!nickname || !nickname.trim() || !phone) {
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
