import { ref, onMounted, onBeforeUnmount } from 'vue';
import { io } from 'socket.io-client';
import api from '../api';
import { ElNotification } from 'element-plus';
import { formatDate } from '../utils/datetime';

// 全局通知状态（模块级单例）
const notifications = ref([]);
const connected = ref(false);
const unreadCount = ref(0);

let socket = null;
const MAX_NOTIFICATIONS = 50;
const STATUS_TEXT = {
  pending: '待指派',
  confirmed: '待接单',
  in_progress: '施工中',
  pending_review: '待验收',
  price_negotiating: '价格协商',
  completed: '已完成',
  cancelled: '已取消'
};

function orderStatusText(data = {}) {
  if (data.status === 'confirmed') {
    return data.action === 'accept' || data.confirmed_at ? '已接单，待开工' : '待接单';
  }
  return STATUS_TEXT[data.status] || data.status || '';
}

/**
 * 管理后台实时通知
 */
export function useRealtimeNotify() {
  function connect() {
    if (socket) return;

    const token = localStorage.getItem('admin_token');
    if (!token) return;

    socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      connected.value = true;
      console.log('[WS] 实时通知已连接');
      loadHistory();
      window.dispatchEvent(new CustomEvent('ruihe:orders-changed'));
    });

    socket.on('disconnect', () => {
      connected.value = false;
      console.log('[WS] 实时通知已断开');
    });

    socket.on('connect_error', () => {
      connected.value = false;
    });

    // 管理员通知
    socket.on('admin:notify', ({ event, payload }) => {
      addNotification(event, payload);
      window.dispatchEvent(new CustomEvent('ruihe:orders-changed'));
      if (event === 'order_urged') loadHistory();
    });

    // 工单状态变更：展示工单号和后台同一套状态文案
    socket.on('order:changed', (data) => {
      window.dispatchEvent(new CustomEvent('ruihe:orders-changed'));
      const orderNo = data.order_no || (data.order_id != null ? `#${data.order_id}` : '');
      const statusText = orderStatusText(data);
      addNotification('order_changed', {
        title: '工单状态更新',
        content: orderNo ? `工单 ${orderNo} 状态变更为 ${statusText}` : `状态变更为 ${statusText}`,
        order_id: data.order_id || null
      });
    });
  }

  function disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
      connected.value = false;
    }
  }

  function addNotification(event, payload) {
    const item = {
      id: Date.now() + Math.random(),
      event,
      title: payload.title || '通知',
      content: payload.content || '',
      order_id: payload.order_id || null,
      time: formatDate(new Date()),
      read: false
    };

    notifications.value.unshift(item);
    if (notifications.value.length > MAX_NOTIFICATIONS) {
      notifications.value = notifications.value.slice(0, MAX_NOTIFICATIONS);
    }
    unreadCount.value = notifications.value.filter((n) => !n.read).length;

    // 弹出桌面通知
    const typeMap = {
      order_urged: 'warning',
      new_order: 'success',
      order_rejected: 'warning',
      price_dispute: 'warning',
      exception: 'error',
      order_assigned: 'info',
      work_completed: 'success',
      order_cancelled: 'info'
    };
    ElNotification({
      title: item.title,
      message: item.content,
      type: typeMap[event] || 'info',
      duration: 5000,
      position: 'bottom-right'
    });
  }

  async function loadHistory() {
    try {
      const res = await api.get('/notifications');
      const history = (res.data || []).map(item => ({
        ...item, read: !!item.is_read, persisted: true,
        time: formatDate(item.created_at)
      }));
      const transient = notifications.value.filter(item => !item.persisted && item.event !== 'order_urged');
      notifications.value = [...transient, ...history].slice(0, MAX_NOTIFICATIONS);
      unreadCount.value = notifications.value.filter(item => !item.read).length;
    } catch (error) { /* API interceptor reports errors */ }
  }

  async function markAllRead() {
    try {
      await Promise.all(notifications.value.filter(item => item.persisted && !item.read).map(item => api.put(`/notifications/${item.id}/read`)));
      notifications.value.forEach((n) => (n.read = true));
      unreadCount.value = 0;
    } catch (error) { /* retain unread state if persistence fails */ }
  }

  function clearAll() {
    notifications.value = [];
    unreadCount.value = 0;
  }

  onMounted(() => { connect(); loadHistory(); });
  onBeforeUnmount(() => {
    disconnect();
    notifications.value = [];
    unreadCount.value = 0;
  });

  return {
    notifications,
    connected,
    unreadCount,
    connect,
    disconnect,
    markAllRead,
    clearAll
  };
}
