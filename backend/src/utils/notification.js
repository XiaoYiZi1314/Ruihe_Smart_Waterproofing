/**
 * 微信模板消息通知工具
 * 实现10个关键通知场景
 */

const axios = require('axios');
const db = require('../config/database');
const RealtimeService = require('./realtime');

class NotificationService {
  /**
   * 发送实时通知给管理员（WebSocket，管理后台页面内提醒）
   * 微信模板消息发送失败不影响实时通知
   */
  static realtimeNotifyAdmins(event, payload) {
    try {
      RealtimeService.notifyAdmins(event, payload);
    } catch (e) {
      console.error('发送实时通知失败:', e.message);
    }
  }
  /**
   * 获取微信 access_token
   */
  static async getAccessToken() {
    try {
      const appId = process.env.WECHAT_APPID;
      const appSecret = process.env.WECHAT_SECRET;
      
      const response = await axios.get(
        `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
      );
      
      if (response.data.access_token) {
        return response.data.access_token;
      } else {
        throw new Error('获取access_token失败');
      }
    } catch (error) {
      console.error('获取access_token失败:', error.message);
      return null;
    }
  }

  /**
   * 发送模板消息
   * @param {string} openid - 接收者openid
   * @param {string} templateId - 模板ID
   * @param {object} data - 模板数据
   * @param {string} page - 跳转页面
   */
  static async sendTemplateMessage(openid, templateId, data, page = '') {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        throw new Error('无法获取access_token');
      }

      const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;
      
      const body = {
        touser: openid,
        template_id: templateId,
        page,
        data
      };

      const response = await axios.post(url, body);
      
      if (response.data.errcode === 0) {
        console.log('模板消息发送成功:', openid);
        return { success: true };
      } else {
        console.error('模板消息发送失败:', response.data);
        return { success: false, error: response.data.errmsg };
      }
    } catch (error) {
      console.error('发送模板消息异常:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 记录通知
   */
  static async logNotification(userId, orderId, type, title, content, templateId, sendStatus, errorMsg = null) {
    try {
      await db.query(
        `INSERT INTO notifications 
         (user_id, order_id, type, title, content, template_id, send_status, error_msg)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, orderId, type, title, content, templateId, sendStatus, errorMsg]
      );
    } catch (error) {
      console.error('记录通知失败:', error.message);
    }
  }

  /**
   * 场景1: 客户提交工单 → 通知管理员
   */
  static async notifyAdminNewOrder(orderId) {
    try {
      // 实时通知管理员（WebSocket）
      this.realtimeNotifyAdmins(RealtimeService.EVENTS.NEW_ORDER, {
        order_id: orderId,
        title: '新工单提醒',
        content: '有客户提交了新工单，请及时处理'
      });
      // 查询工单信息
      const [orders] = await db.query(
        `SELECT wo.*, s.name as service_name, c.nickname as customer_name
         FROM work_orders wo
         LEFT JOIN services s ON wo.service_id = s.id
         LEFT JOIN users c ON wo.user_id = c.id
         WHERE wo.id = ?`,
        [orderId]
      );

      if (orders.length === 0) return;
      const order = orders[0];

      // 查询管理员
      const [admins] = await db.query(
        "SELECT openid FROM users WHERE role = 'admin' AND status = 'active'"
      );

      const templateId = process.env.WECHAT_TEMPLATE_NEW_ORDER || '';
      
      for (const admin of admins) {
        const data = {
          thing1: { value: order.order_no },
          thing2: { value: order.service_name },
          name3: { value: order.customer_name },
          time4: { value: new Date().toLocaleString('zh-CN') }
        };

        const result = await this.sendTemplateMessage(
          admin.openid,
          templateId,
          data,
          `/pages/admin/orders/detail?id=${orderId}`
        );

        await this.logNotification(
          admin.id,
          orderId,
          'admin_new_order',
          '新工单提醒',
          `客户${order.customer_name}提交了新工单`,
          templateId,
          result.success ? 'success' : 'failed',
          result.error
        );
      }
    } catch (error) {
      console.error('通知管理员新工单失败:', error.message);
    }
  }

  /**
   * 场景2: 管理员指派 → 通知师傅和客户
   */
  static async notifyOrderAssigned(orderId) {
    try {
      // 查询工单信息
      const [orders] = await db.query(
        `SELECT wo.*, 
                s.name as service_name,
                c.openid as customer_openid, c.id as customer_id, c.nickname as customer_name,
                w.openid as worker_openid, w.id as worker_id, w.nickname as worker_name, w.phone as worker_phone
         FROM work_orders wo
         LEFT JOIN services s ON wo.service_id = s.id
         LEFT JOIN users c ON wo.user_id = c.id
         LEFT JOIN users w ON wo.worker_id = w.id
         WHERE wo.id = ?`,
        [orderId]
      );

      if (orders.length === 0) return;
      const order = orders[0];

      const templateId = process.env.WECHAT_TEMPLATE_ORDER_ASSIGNED || '';

      // 通知师傅
      if (order.worker_openid) {
        const workerData = {
          thing1: { value: order.order_no },
          thing2: { value: order.service_name },
          time3: { value: order.estimated_time },
          thing4: { value: order.full_address.substring(0, 20) }
        };

        const workerResult = await this.sendTemplateMessage(
          order.worker_openid,
          templateId,
          workerData,
          `/pages/orders/detail?id=${orderId}`
        );

        await this.logNotification(
          order.worker_id,
          orderId,
          'worker_assigned',
          '工单指派通知',
          `您有新的工单：${order.service_name}`,
          templateId,
          workerResult.success ? 'success' : 'failed',
          workerResult.error
        );
      }

      // 通知客户
      if (order.customer_openid) {
        const customerData = {
          thing1: { value: order.order_no },
          name2: { value: order.worker_name },
          phone_number3: { value: order.worker_phone },
          time4: { value: order.estimated_time }
        };

        const customerResult = await this.sendTemplateMessage(
          order.customer_openid,
          templateId,
          customerData,
          `/pages/orders/detail?id=${orderId}`
        );

        await this.logNotification(
          order.customer_id,
          orderId,
          'customer_assigned',
          '工单已指派',
          `师傅${order.worker_name}将为您服务`,
          templateId,
          customerResult.success ? 'success' : 'failed',
          customerResult.error
        );
      }
    } catch (error) {
      console.error('通知工单指派失败:', error.message);
    }
  }

  /**
   * 场景3: 师傅拒单 → 通知管理员
   */
  static async notifyAdminOrderRejected(orderId, reason) {
    try {
      // 实时通知管理员（WebSocket）
      this.realtimeNotifyAdmins(RealtimeService.EVENTS.ORDER_REJECTED, {
        order_id: orderId,
        title: '师傅拒单提醒',
        content: '师傅拒绝了工单，请重新指派',
        reason
      });
      const [orders] = await db.query(
        `SELECT wo.*, s.name as service_name, w.nickname as worker_name
         FROM work_orders wo
         LEFT JOIN services s ON wo.service_id = s.id
         LEFT JOIN users w ON wo.worker_id = w.id
         WHERE wo.id = ?`,
        [orderId]
      );

      if (orders.length === 0) return;
      const order = orders[0];

      const [admins] = await db.query(
        "SELECT id, openid FROM users WHERE role = 'admin' AND status = 'active'"
      );

      const templateId = process.env.WECHAT_TEMPLATE_ORDER_REJECTED || '';

      for (const admin of admins) {
        const data = {
          thing1: { value: order.order_no },
          name2: { value: order.worker_name || '未知' },
          thing3: { value: reason.substring(0, 20) }
        };

        const result = await this.sendTemplateMessage(
          admin.openid,
          templateId,
          data,
          `/pages/admin/orders/detail?id=${orderId}`
        );

        await this.logNotification(
          admin.id,
          orderId,
          'admin_order_rejected',
          '师傅拒单通知',
          `师傅${order.worker_name}拒绝了工单`,
          templateId,
          result.success ? 'success' : 'failed',
          result.error
        );
      }
    } catch (error) {
      console.error('通知管理员师傅拒单失败:', error.message);
    }
  }

  /**
   * 场景4: 师傅开始施工 → 通知客户
   */
  static async notifyCustomerWorkStarted(orderId) {
    try {
      const [orders] = await db.query(
        `SELECT wo.*, w.nickname as worker_name, c.openid as customer_openid, c.id as customer_id
         FROM work_orders wo
         LEFT JOIN users w ON wo.worker_id = w.id
         LEFT JOIN users c ON wo.user_id = c.id
         WHERE wo.id = ?`,
        [orderId]
      );

      if (orders.length === 0 || !orders[0].customer_openid) return;
      const order = orders[0];

      const templateId = process.env.WECHAT_TEMPLATE_WORK_STARTED || '';

      const data = {
        thing1: { value: order.order_no },
        name2: { value: order.worker_name },
        time3: { value: new Date().toLocaleString('zh-CN') }
      };

      const result = await this.sendTemplateMessage(
        order.customer_openid,
        templateId,
        data,
        `/pages/orders/detail?id=${orderId}`
      );

      await this.logNotification(
        order.customer_id,
        orderId,
        'customer_work_started',
        '师傅已开始施工',
        `师傅${order.worker_name}已开始施工`,
        templateId,
        result.success ? 'success' : 'failed',
        result.error
      );
    } catch (error) {
      console.error('通知客户施工开始失败:', error.message);
    }
  }

  /**
   * 场景5: 师傅完工 → 通知客户
   */
  static async notifyCustomerWorkCompleted(orderId) {
    try {
      const [orders] = await db.query(
        `SELECT wo.*, c.openid as customer_openid, c.id as customer_id
         FROM work_orders wo
         LEFT JOIN users c ON wo.user_id = c.id
         WHERE wo.id = ?`,
        [orderId]
      );

      if (orders.length === 0 || !orders[0].customer_openid) return;
      const order = orders[0];

      const templateId = process.env.WECHAT_TEMPLATE_WORK_COMPLETED || '';

      const data = {
        thing1: { value: order.order_no },
        amount2: { value: `¥${order.final_price}` },
        thing3: { value: '请验收确认' }
      };

      const result = await this.sendTemplateMessage(
        order.customer_openid,
        templateId,
        data,
        `/pages/orders/detail?id=${orderId}`
      );

      await this.logNotification(
        order.customer_id,
        orderId,
        'customer_work_completed',
        '施工已完成',
        '工单施工已完成，请验收',
        templateId,
        result.success ? 'success' : 'failed',
        result.error
      );
    } catch (error) {
      console.error('通知客户完工失败:', error.message);
    }
  }

  /**
   * 场景6: 客户催单 → 通知师傅
   */
  static async notifyWorkerOrderUrged(orderId, urgeCount) {
    try {
      const [orders] = await db.query(
        `SELECT wo.*, w.openid as worker_openid, w.id as worker_id
         FROM work_orders wo
         LEFT JOIN users w ON wo.worker_id = w.id
         WHERE wo.id = ?`,
        [orderId]
      );

      if (orders.length === 0 || !orders[0].worker_openid) return;
      const order = orders[0];

      const templateId = process.env.WECHAT_TEMPLATE_ORDER_URGED || '';

      const data = {
        thing1: { value: order.order_no },
        thing2: { value: `第${urgeCount}次催单` }
      };

      const result = await this.sendTemplateMessage(
        order.worker_openid,
        templateId,
        data,
        `/pages/orders/detail?id=${orderId}`
      );

      await this.logNotification(
        order.worker_id,
        orderId,
        'worker_order_urged',
        '客户催单提醒',
        `客户进行了第${urgeCount}次催单`,
        templateId,
        result.success ? 'success' : 'failed',
        result.error
      );
    } catch (error) {
      console.error('通知师傅催单失败:', error.message);
    }
  }

  /**
   * 场景7: 客户确认完成 → 通知师傅
   */
  static async notifyWorkerOrderConfirmed(orderId) {
    try {
      const [orders] = await db.query(
        `SELECT wo.*, w.openid as worker_openid, w.id as worker_id
         FROM work_orders wo
         LEFT JOIN users w ON wo.worker_id = w.id
         WHERE wo.id = ?`,
        [orderId]
      );

      if (orders.length === 0 || !orders[0].worker_openid) return;
      const order = orders[0];

      const templateId = process.env.WECHAT_TEMPLATE_ORDER_CONFIRMED || '';

      const data = {
        thing1: { value: order.order_no },
        amount2: { value: `¥${order.final_price}` },
        thing3: { value: '客户已确认完成' }
      };

      const result = await this.sendTemplateMessage(
        order.worker_openid,
        templateId,
        data,
        `/pages/orders/detail?id=${orderId}`
      );

      await this.logNotification(
        order.worker_id,
        orderId,
        'worker_order_confirmed',
        '工单已完成',
        '客户已确认工单完成',
        templateId,
        result.success ? 'success' : 'failed',
        result.error
      );
    } catch (error) {
      console.error('通知师傅工单完成失败:', error.message);
    }
  }

  /**
   * 场景8: 客户取消 → 通知师傅
   */
  static async notifyWorkerOrderCancelled(orderId, reason) {
    try {
      const [orders] = await db.query(
        `SELECT wo.*, w.openid as worker_openid, w.id as worker_id
         FROM work_orders wo
         LEFT JOIN users w ON wo.worker_id = w.id
         WHERE wo.id = ? AND wo.worker_id IS NOT NULL`,
        [orderId]
      );

      if (orders.length === 0 || !orders[0].worker_openid) return;
      const order = orders[0];

      const templateId = process.env.WECHAT_TEMPLATE_ORDER_CANCELLED || '';

      const data = {
        thing1: { value: order.order_no },
        thing2: { value: reason || '客户取消' }
      };

      const result = await this.sendTemplateMessage(
        order.worker_openid,
        templateId,
        data
      );

      await this.logNotification(
        order.worker_id,
        orderId,
        'worker_order_cancelled',
        '工单已取消',
        '客户已取消工单',
        templateId,
        result.success ? 'success' : 'failed',
        result.error
      );
    } catch (error) {
      console.error('通知师傅工单取消失败:', error.message);
    }
  }

  /**
   * 场景9: 管理员调整价格 → 通知客户
   */
  static async notifyCustomerPriceAdjusted(orderId) {
    try {
      const [orders] = await db.query(
        `SELECT wo.*, c.openid as customer_openid, c.id as customer_id
         FROM work_orders wo
         LEFT JOIN users c ON wo.user_id = c.id
         WHERE wo.id = ?`,
        [orderId]
      );

      if (orders.length === 0 || !orders[0].customer_openid) return;
      const order = orders[0];

      const templateId = process.env.WECHAT_TEMPLATE_PRICE_ADJUSTED || '';

      const data = {
        thing1: { value: order.order_no },
        amount2: { value: `¥${order.final_price}` },
        thing3: { value: '价格已调整，请确认' }
      };

      const result = await this.sendTemplateMessage(
        order.customer_openid,
        templateId,
        data,
        `/pages/orders/detail?id=${orderId}`
      );

      await this.logNotification(
        order.customer_id,
        orderId,
        'customer_price_adjusted',
        '价格已调整',
        '管理员已调整工单价格',
        templateId,
        result.success ? 'success' : 'failed',
        result.error
      );
    } catch (error) {
      console.error('通知客户价格调整失败:', error.message);
    }
  }

  /**
   * 场景10: 工单自动完成 → 通知客户和师傅
   */
  static async notifyOrderAutoCompleted(orderId) {
    try {
      const [orders] = await db.query(
        `SELECT wo.*, 
                c.openid as customer_openid, c.id as customer_id,
                w.openid as worker_openid, w.id as worker_id
         FROM work_orders wo
         LEFT JOIN users c ON wo.user_id = c.id
         LEFT JOIN users w ON wo.worker_id = w.id
         WHERE wo.id = ?`,
        [orderId]
      );

      if (orders.length === 0) return;
      const order = orders[0];

      const templateId = process.env.WECHAT_TEMPLATE_ORDER_AUTO_COMPLETED || '';

      // 通知客户
      if (order.customer_openid) {
        const customerData = {
          thing1: { value: order.order_no },
          thing2: { value: '已自动完成' },
          thing3: { value: '感谢您的使用' }
        };

        const customerResult = await this.sendTemplateMessage(
          order.customer_openid,
          templateId,
          customerData,
          `/pages/orders/detail?id=${orderId}`
        );

        await this.logNotification(
          order.customer_id,
          orderId,
          'customer_auto_completed',
          '工单已自动完成',
          '工单超时未确认，已自动完成',
          templateId,
          customerResult.success ? 'success' : 'failed',
          customerResult.error
        );
      }

      // 通知师傅
      if (order.worker_openid) {
        const workerData = {
          thing1: { value: order.order_no },
          amount2: { value: `¥${order.final_price}` },
          thing3: { value: '已自动完成' }
        };

        const workerResult = await this.sendTemplateMessage(
          order.worker_openid,
          templateId,
          workerData,
          `/pages/orders/detail?id=${orderId}`
        );

        await this.logNotification(
          order.worker_id,
          orderId,
          'worker_auto_completed',
          '工单已自动完成',
          '工单超时未确认，已自动完成',
          templateId,
          workerResult.success ? 'success' : 'failed',
          workerResult.error
        );
      }
    } catch (error) {
      console.error('通知工单自动完成失败:', error.message);
    }
  }
}

module.exports = NotificationService;
