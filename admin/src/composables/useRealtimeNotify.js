import { ref, onMounted, onBeforeUnmount } from 'vue';
import { io } from 'socket.io-client';
import { ElNotification } from 'element-plus';

// 全局通知状态（模块级单例）
const notifications = ref([]);
const connected = ref(false);
const unreadCount = ref(0);

let socket = null;
const MAX_NOTIFICATIONS = 50;

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
    });

    // 工单状态变更
    socket.on('order:changed', (data) => {
      addNotification('order_changed', {
        title: '工单状态更新',
        content: `工单 #${data.order_id} 状态变更为 ${data.status || ''}`
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
      time: new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      read: false
    };

    notifications.value.unshift(item);
    if (notifications.value.length > MAX_NOTIFICATIONS) {
      notifications.value = notifications.value.slice(0, MAX_NOTIFICATIONS);
    }
    unreadCount.value = notifications.value.filter((n) => !n.read).length;

    // 弹出桌面通知
    const typeMap = {
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

  function markAllRead() {
    notifications.value.forEach((n) => (n.read = true));
    unreadCount.value = 0;
  }

  function clearAll() {
    notifications.value = [];
    unreadCount.value = 0;
  }

  onMounted(connect);
  onBeforeUnmount(() => {
    // 注意：组件卸载不主动断开，保持全局连接
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
