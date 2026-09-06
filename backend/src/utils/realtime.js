/**
 * WebSocket 实时通知服务
 * 管理后台实时提醒：新工单、师傅拒单、价格异议、异常工单
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

class RealtimeService {
  static io = null;

  /**
   * 初始化 Socket.IO（挂在 HTTP server 上）
   */
  static init(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: '*', // 生产环境应限制为管理后台域名
        methods: ['GET', 'POST']
      }
    });

    // 连接认证
    this.io.use((socket, next) => {
      try {
        const token =
          socket.handshake.auth && socket.handshake.auth.token;

        if (!token) {
          return next(new Error('未授权'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ruihe_waterproof_secret');
        socket.userId = decoded.id;
        socket.role = decoded.role;
        next();
      } catch (err) {
        next(new Error('认证失败'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`🔌 WebSocket 连接：用户 ${socket.userId}（${socket.role}）`);

      // 管理员加入 admin 房间
      if (socket.role === 'admin') {
        socket.join('admin');
      }

      // 每个用户加入自己的房间（定向通知）
      socket.join(`user_${socket.userId}`);

      socket.on('disconnect', () => {
        console.log(`🔌 WebSocket 断开：用户 ${socket.userId}`);
      });
    });

    console.log('✅ WebSocket 实时通知服务已启动（路径 /socket.io）');
  }

  /**
   * 通知所有在线管理员
   * @param {string} event - 事件类型
   * @param {object} payload - 通知数据
   */
  static notifyAdmins(event, payload) {
    if (!this.io) return;
    this.io.to('admin').emit('admin:notify', {
      event,
      payload,
      timestamp: Date.now()
    });
  }

  /**
   * 定向通知某个用户
   */
  static notifyUser(userId, event, payload) {
    if (!this.io) return;
    this.io.to(`user_${userId}`).emit('user:notify', {
      event,
      payload,
      timestamp: Date.now()
    });
  }

  /**
   * 广播工单状态变更（管理员 + 相关方）
   */
  static notifyOrderChange(orderId, status, extra = {}) {
    if (!this.io) return;
    this.io.to('admin').emit('order:changed', {
      order_id: orderId,
      status,
      ...extra,
      timestamp: Date.now()
    });
  }
}

// 通知事件类型常量
RealtimeService.EVENTS = {
  NEW_ORDER: 'new_order',               // 新工单
  ORDER_REJECTED: 'order_rejected',     // 师傅拒单
  PRICE_DISPUTE: 'price_dispute',       // 价格异议
  EXCEPTION_DETECTED: 'exception',      // 异常工单
  ORDER_ASSIGNED: 'order_assigned',     // 工单指派
  WORK_COMPLETED: 'work_completed',     // 完工待验收
  ORDER_CANCELLED: 'order_cancelled'    // 工单取消
};

module.exports = RealtimeService;
