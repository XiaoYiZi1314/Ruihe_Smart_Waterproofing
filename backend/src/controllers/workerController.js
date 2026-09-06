/**
 * 师傅端控制器
 * 处理师傅的工单管理、状态切换等操作
 */

const db = require('../config/database');
const OrderStateMachine = require('../utils/orderStateMachine');
const NotificationService = require('../utils/notification');
const { logOperation } = require('../utils/operationLog');

class WorkerController {
  /**
   * 获取指派给师傅的工单列表
   * GET /api/worker/orders
   */
  static async getOrders(req, res) {
    try {
      const workerId = req.user.id;
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // 构建查询条件
      let whereClause = 'wo.worker_id = ?';
      const params = [workerId];

      if (status) {
        whereClause += ' AND wo.status = ?';
        params.push(status);
      }

      // 查询工单列表
      const [orders] = await db.query(
        `SELECT 
          wo.*,
          u.nickname as customer_name,
          u.phone as customer_phone,
          s.name as service_name,
          s.cover_image as service_image
         FROM work_orders wo
         LEFT JOIN users u ON wo.user_id = u.id
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
      console.error('获取师傅工单列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取工单列表失败'
      });
    }
  }

  /**
   * 获取工单详情
   * GET /api/worker/orders/:id
   */
  static async getOrderDetail(req, res) {
    try {
      const { id } = req.params;
      const workerId = req.user.id;

      // 查询工单详情
      const [orders] = await db.query(
        `SELECT 
          wo.*,
          u.nickname as customer_name,
          u.phone as customer_phone,
          u.avatar_url as customer_avatar,
          s.name as service_name,
          s.description as service_description,
          s.cover_image as service_image
         FROM work_orders wo
         LEFT JOIN users u ON wo.user_id = u.id
         LEFT JOIN services s ON wo.service_id = s.id
         WHERE wo.id = ? AND wo.worker_id = ?`,
        [id, workerId]
      );

      if (orders.length === 0) {
        return res.status(404).json({
          success: false,
          message: '工单不存在或无权访问'
        });
      }

      const order = orders[0];

      // 查询工单图片
      const [images] = await db.query(
        'SELECT * FROM work_order_images WHERE order_id = ? ORDER BY sort_order',
        [id]
      );

      order.images = images;

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
   * 接受工单
   * PUT /api/worker/orders/:id/accept
   */
  static async acceptOrder(req, res) {
    try {
      const { id } = req.params;
      const workerId = req.user.id;

      // 查询工单
      const [orders] = await db.query(
        'SELECT * FROM work_orders WHERE id = ? AND worker_id = ?',
        [id, workerId]
      );

      if (orders.length === 0) {
        return res.status(404).json({
          success: false,
          message: '工单不存在或无权访问'
        });
      }

      const order = orders[0];

      // 验证状态转换
      const validation = OrderStateMachine.validate(
        order.status,
        OrderStateMachine.ACTION.ACCEPT,
        OrderStateMachine.ROLE.WORKER
      );

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }

      // 更新工单状态（接受后仍为 confirmed，但记录响应时间）
      await db.query(
        `UPDATE work_orders 
         SET confirmed_at = CURRENT_TIMESTAMP,
             is_exception = 0,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [id]
      );

      logOperation({
        user_id: workerId,
        order_id: id,
        action: 'accept',
        detail: '师傅接受工单',
        ip: req.ip
      });

      res.json({
        success: true,
        message: '已接受工单'
      });
    } catch (error) {
      console.error('接受工单失败:', error);
      res.status(500).json({
        success: false,
        message: '接受工单失败'
      });
    }
  }

  /**
   * 拒绝工单
   * PUT /api/worker/orders/:id/reject
   */
  static async rejectOrder(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const workerId = req.user.id;

      if (!reason || reason.trim() === '') {
        return res.status(400).json({
          success: false,
          message: '请填写拒单理由'
        });
      }

      // 查询工单
      const [orders] = await db.query(
        'SELECT * FROM work_orders WHERE id = ? AND worker_id = ?',
        [id, workerId]
      );

      if (orders.length === 0) {
        return res.status(404).json({
          success: false,
          message: '工单不存在或无权访问'
        });
      }

      const order = orders[0];

      // 验证状态转换
      const validation = OrderStateMachine.validate(
        order.status,
        OrderStateMachine.ACTION.REJECT,
        OrderStateMachine.ROLE.WORKER
      );

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }

      const connection = await db.getConnection();
      await connection.beginTransaction();

      try {
        // 更新工单状态为待确认，清除师傅信息
        await connection.query(
          `UPDATE work_orders 
           SET status = ?,
               worker_id = NULL,
               estimated_time = NULL,
               reject_reason = ?,
               rejected_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [OrderStateMachine.STATUS.PENDING, reason, id]
        );

        // 增加师傅的拒单次数
        await connection.query(
          'UPDATE users SET reject_count = reject_count + 1 WHERE id = ?',
          [workerId]
        );

        await connection.commit();

        // 异步：通知管理员师傅拒单
        NotificationService.notifyAdminOrderRejected(id, reason).catch(() => {});
        logOperation({
          user_id: workerId,
          order_id: id,
          action: 'reject',
          detail: `师傅拒单：${reason}`,
          ip: req.ip
        });

        res.json({
          success: true,
          message: '已拒绝工单'
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('拒绝工单失败:', error);
      res.status(500).json({
        success: false,
        message: '拒绝工单失败'
      });
    }
  }

  /**
   * 开始施工
   * PUT /api/worker/orders/:id/start
   */
  static async startOrder(req, res) {
    try {
      const { id } = req.params;
      const workerId = req.user.id;

      // 查询工单
      const [orders] = await db.query(
        'SELECT * FROM work_orders WHERE id = ? AND worker_id = ?',
        [id, workerId]
      );

      if (orders.length === 0) {
        return res.status(404).json({
          success: false,
          message: '工单不存在或无权访问'
        });
      }

      const order = orders[0];

      // 验证状态转换
      const validation = OrderStateMachine.validate(
        order.status,
        OrderStateMachine.ACTION.START,
        OrderStateMachine.ROLE.WORKER
      );

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }

      // 更新工单状态
      await db.query(
        `UPDATE work_orders 
         SET status = ?,
             started_at = CURRENT_TIMESTAMP,
             is_exception = 0,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [validation.nextStatus, id]
      );

      // 异步：通知客户开始施工 + 记录日志
      NotificationService.notifyCustomerWorkStarted(id).catch(() => {});
      logOperation({
        user_id: workerId,
        order_id: id,
        action: 'start',
        detail: '师傅开始施工',
        ip: req.ip
      });

      res.json({
        success: true,
        message: '已开始施工'
      });
    } catch (error) {
      console.error('开始施工失败:', error);
      res.status(500).json({
        success: false,
        message: '开始施工失败'
      });
    }
  }

  /**
   * 完工并填写价格
   * PUT /api/worker/orders/:id/complete
   */
  static async completeOrder(req, res) {
    try {
      const { id } = req.params;
      const { door_fee, material_fee, labor_fee } = req.body;
      const workerId = req.user.id;

      // 验证必填字段
      if (door_fee === undefined || material_fee === undefined || labor_fee === undefined) {
        return res.status(400).json({
          success: false,
          message: '请填写完整的价格信息（上门费、材料费、工时费）'
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
        'SELECT * FROM work_orders WHERE id = ? AND worker_id = ?',
        [id, workerId]
      );

      if (orders.length === 0) {
        return res.status(404).json({
          success: false,
          message: '工单不存在或无权访问'
        });
      }

      const order = orders[0];

      // 验证状态转换
      const validation = OrderStateMachine.validate(
        order.status,
        OrderStateMachine.ACTION.COMPLETE,
        OrderStateMachine.ROLE.WORKER
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
             completed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [validation.nextStatus, door_fee, material_fee, labor_fee, finalPrice, id]
      );

      // 异步：通知客户完工 + 记录日志
      NotificationService.notifyCustomerWorkCompleted(id).catch(() => {});
      logOperation({
        user_id: workerId,
        order_id: id,
        action: 'complete',
        detail: `师傅完工填价：合计 ¥${finalPrice}`,
        ip: req.ip
      });

      res.json({
        success: true,
        message: '已完工',
        data: {
          final_price: finalPrice
        }
      });
    } catch (error) {
      console.error('完工失败:', error);
      res.status(500).json({
        success: false,
        message: '完工失败'
      });
    }
  }

  /**
   * 切换工作状态
   * PUT /api/worker/status
   */
  static async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const workerId = req.user.id;

      // 验证状态值
      if (!['working', 'resting'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: '无效的状态值'
        });
      }

      // 更新师傅状态
      await db.query(
        'UPDATE users SET worker_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, workerId]
      );

      res.json({
        success: true,
        message: status === 'working' ? '已切换为上班状态' : '已切换为休息状态',
        data: { status }
      });
    } catch (error) {
      console.error('更新状态失败:', error);
      res.status(500).json({
        success: false,
        message: '更新状态失败'
      });
    }
  }

  /**
   * 获取师傅个人统计
   * GET /api/worker/stats
   */
  static async getStats(req, res) {
    try {
      const workerId = req.user.id;

      // 查询师傅信息
      const [workers] = await db.query(
        'SELECT reject_count, assign_count, worker_status FROM users WHERE id = ?',
        [workerId]
      );

      if (workers.length === 0) {
        return res.status(404).json({
          success: false,
          message: '师傅信息不存在'
        });
      }

      const worker = workers[0];

      // 查询本月完成工单数
      const [monthResult] = await db.query(
        `SELECT COUNT(*) as count FROM work_orders 
         WHERE worker_id = ? 
         AND status = 'completed'
         AND MONTH(finished_at) = MONTH(CURRENT_DATE())
         AND YEAR(finished_at) = YEAR(CURRENT_DATE())`,
        [workerId]
      );

      // 查询总完成工单数
      const [totalResult] = await db.query(
        `SELECT COUNT(*) as count FROM work_orders 
         WHERE worker_id = ? AND status = 'completed'`,
        [workerId]
      );

      // 计算拒单率
      const rejectRate = worker.assign_count > 0 
        ? ((worker.reject_count / worker.assign_count) * 100).toFixed(2)
        : 0;

      res.json({
        success: true,
        data: {
          worker_status: worker.worker_status,
          month_completed: monthResult[0].count,
          total_completed: totalResult[0].count,
          reject_count: worker.reject_count,
          assign_count: worker.assign_count,
          reject_rate: rejectRate
        }
      });
    } catch (error) {
      console.error('获取统计信息失败:', error);
      res.status(500).json({
        success: false,
        message: '获取统计信息失败'
      });
    }
  }
}

module.exports = WorkerController;
