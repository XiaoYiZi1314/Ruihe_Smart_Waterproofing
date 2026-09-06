/**
 * 定时任务调度器
 * 实现异常工单检测和自动完成工单
 */

const cron = require('node-cron');
const db = require('../config/database');
const NotificationService = require('../utils/notification');

class Scheduler {
  /**
   * 启动所有定时任务
   */
  static start() {
    console.log('📅 启动定时任务调度器...');

    // 每小时执行一次异常工单检测
    this.scheduleExceptionDetection();

    // 每小时执行一次自动完成工单
    this.scheduleAutoCompletion();

    console.log('✅ 定时任务调度器启动成功');
  }

  /**
   * 异常工单检测
   * 每小时执行，检测指派后24小时未响应的工单
   */
  static scheduleExceptionDetection() {
    // 每小时的第5分钟执行
    cron.schedule('5 * * * *', async () => {
      try {
        console.log('🔍 开始检测异常工单...');

        // 查询已指派但24小时未响应的工单
        const [orders] = await db.query(`
          SELECT id, order_no, worker_id
          FROM work_orders
          WHERE status = 'confirmed'
          AND worker_id IS NOT NULL
          AND confirmed_at IS NULL
          AND TIMESTAMPDIFF(HOUR, updated_at, NOW()) >= 24
          AND is_exception = 0
        `);

        if (orders.length === 0) {
          console.log('   未发现异常工单');
          return;
        }

        console.log(`   发现 ${orders.length} 个异常工单`);

        // 标记为异常
        for (const order of orders) {
          await db.query(
            'UPDATE work_orders SET is_exception = 1 WHERE id = ?',
            [order.id]
          );

          console.log(`   ⚠️  工单 ${order.order_no} 已标记为异常`);

          // 实时通知管理员
          try {
            NotificationService.realtimeNotifyAdmins('exception', {
              order_id: order.id,
              order_no: order.order_no,
              title: '异常工单提醒',
              content: `工单 ${order.order_no} 指派后24小时未响应，已标记为异常`
            });
          } catch (e) {
            // 通知失败不影响主流程
          }
        }

        console.log('✅ 异常工单检测完成');
      } catch (error) {
        console.error('❌ 异常工单检测失败:', error.message);
      }
    });

    console.log('   ✓ 异常工单检测任务已注册（每小时执行）');
  }

  /**
   * 自动完成工单
   * 每小时执行，将完工待验收超过3天的工单自动完成
   */
  static scheduleAutoCompletion() {
    // 每小时的第10分钟执行
    cron.schedule('10 * * * *', async () => {
      try {
        console.log('⏰ 开始检测超时工单...');

        // 查询完工待验收超过3天的工单
        const [orders] = await db.query(`
          SELECT id, order_no, user_id, worker_id
          FROM work_orders
          WHERE status = 'pending_review'
          AND TIMESTAMPDIFF(DAY, completed_at, NOW()) >= 3
        `);

        if (orders.length === 0) {
          console.log('   未发现超时工单');
          return;
        }

        console.log(`   发现 ${orders.length} 个超时工单`);

        // 自动完成
        for (const order of orders) {
          const connection = await db.getConnection();
          await connection.beginTransaction();

          try {
            // 更新工单状态
            await connection.query(
              `UPDATE work_orders 
               SET status = 'completed', finished_at = NOW()
               WHERE id = ?`,
              [order.id]
            );

            await connection.commit();

            console.log(`   ✅ 工单 ${order.order_no} 已自动完成`);

            // 发送通知
            await NotificationService.notifyOrderAutoCompleted(order.id);
          } catch (error) {
            await connection.rollback();
            console.error(`   ❌ 工单 ${order.order_no} 自动完成失败:`, error.message);
          } finally {
            connection.release();
          }
        }

        console.log('✅ 超时工单处理完成');
      } catch (error) {
        console.error('❌ 自动完成工单失败:', error.message);
      }
    });

    console.log('   ✓ 自动完成工单任务已注册（每小时执行）');
  }

  /**
   * 停止所有定时任务
   */
  static stop() {
    console.log('⏹️  停止定时任务调度器...');
    // node-cron 会自动清理任务
  }
}

module.exports = Scheduler;
