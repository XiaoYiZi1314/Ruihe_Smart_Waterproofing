const cron = require('node-cron');
const db = require('../config/database');
const Workflow = require('../utils/orderWorkflow');
const NotificationService = require('../utils/notification');

class Scheduler {
  static tasks = [];
  static running = new Set();
  static start() {
    if (this.tasks.length) return;
    this.tasks.push(cron.schedule('30 3 * * *', () => this.run('uploads', () => require('../utils/attachments').cleanupOrphans())));
    this.tasks.push(cron.schedule('5 * * * *', () => this.run('exception', () => this.detectExceptions())));
    this.tasks.push(cron.schedule('10 * * * *', () => this.run('completion', () => this.completeDueOrders())));
  }
  static async run(name, fn) {
    if (this.running.has(name)) return;
    this.running.add(name);
    try { await fn(); } catch (error) { console.error('Scheduler failure:', name, error.message); }
    finally { this.running.delete(name); }
  }
  static async detectExceptions() {
    const [orders] = await db.query(`SELECT id, order_no FROM work_orders WHERE status='confirmed'
      AND worker_id IS NOT NULL AND started_at IS NULL AND assigned_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND is_exception=0`);
    for (const order of orders) {
      const [result] = await db.query(`UPDATE work_orders SET is_exception=1 WHERE id=? AND status='confirmed'
        AND started_at IS NULL AND assigned_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND is_exception=0`, [order.id]);
      if (result.affectedRows) NotificationService.realtimeNotifyAdmins('exception', { order_id: order.id, title: '异常工单提醒', content: `工单 ${order.order_no} 指派后24小时未开工` });
    }
  }
  static async completeDueOrders() {
    const [orders] = await db.query("SELECT id FROM work_orders WHERE status='pending_review' AND auto_complete_at <= NOW()");
    for (const order of orders) {
      try {
        await Workflow.transition(order.id, { role: 'system' }, 'auto_complete');
        await NotificationService.notifyOrderAutoCompleted(order.id);
      } catch (error) { if (error.status !== 409 && error.status !== 404) throw error; }
    }
  }
  static stop() { for (const task of this.tasks) task.stop(); this.tasks = []; }
}
module.exports = Scheduler;
