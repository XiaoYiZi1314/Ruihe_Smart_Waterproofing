<template>
  <el-container class="layout">
    <el-aside v-if="!isMobile" width="220px" class="aside">
      <div class="aside-logo">
        <div class="logo-icon">瑞</div>
        <span class="logo-text">瑞和防水</span>
      </div>
      <AdminNavMenu :active="activeMenu" />
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <button v-if="isMobile" class="menu-btn" type="button" aria-label="打开菜单" @click="navOpen = true">
            <el-icon :size="22"><Menu /></el-icon>
          </button>
          <div class="header-title">{{ route.meta.title }}</div>
        </div>
        <div class="header-right">
          <!-- 连接状态 -->
          <el-tooltip :content="connected ? '实时通知已连接' : '实时通知未连接'" placement="bottom">
            <span class="ws-status" :class="connected ? 'ws-status--on' : 'ws-status--off'"></span>
          </el-tooltip>

          <!-- 通知铃铛 -->
          <el-popover placement="bottom-end" :width="notifyWidth" trigger="click">
            <template #reference>
              <span class="bell-wrap">
                <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99">
                  <el-icon :size="20"><Bell /></el-icon>
                </el-badge>
              </span>
            </template>

            <div class="notify-panel">
              <div class="notify-panel__header">
                <span>通知（{{ notifications.length }}）</span>
                <div class="notify-panel__actions">
                  <el-button link size="small" @click="markAllRead">全部已读</el-button>
                  <el-button link size="small" @click="clearAll">清空</el-button>
                </div>
              </div>

              <div class="notify-panel__list">
                <div v-if="notifications.length === 0" class="notify-empty">
                  暂无通知
                </div>
                <div
                  v-for="n in notifications"
                  :key="n.id"
                  class="notify-item"
                  :class="{ 'notify-item--unread': !n.read }"
                  @click="goToOrder(n)"
                >
                  <div class="notify-item__title">{{ n.title }}</div>
                  <div class="notify-item__content">{{ n.content }}</div>
                  <div class="notify-item__time">{{ n.time }}</div>
                </div>
              </div>
            </div>
          </el-popover>

          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-icon><UserFilled /></el-icon>
              <span class="user-info__name">管理员</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 主内容 -->
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>

  <el-drawer
    v-model="navOpen"
    direction="ltr"
    size="240px"
    :with-header="false"
    append-to-body
    class="nav-drawer"
  >
    <div class="aside aside--drawer">
      <div class="aside-logo">
        <div class="logo-icon">瑞</div>
        <span class="logo-text">瑞和防水</span>
      </div>
      <AdminNavMenu :active="activeMenu" @select="navOpen = false" />
    </div>
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import AdminNavMenu from '../components/AdminNavMenu.vue';
import { useMobile } from '../composables/useMobile';
import { useRealtimeNotify } from '../composables/useRealtimeNotify';

const route = useRoute();
const router = useRouter();
const { isMobile } = useMobile();
const navOpen = ref(false);
const notifyWidth = computed(() => (isMobile.value ? Math.min(320, window.innerWidth - 24) : 360));

const activeMenu = computed(() => route.path);
watch(() => route.path, () => { navOpen.value = false; });

// 实时通知
const {
  notifications,
  connected,
  unreadCount,
  markAllRead,
  clearAll
} = useRealtimeNotify();

function goToOrder(n) {
  if (n.order_id) {
    router.push('/orders');
  }
}

function handleCommand(command) {
  if (command === 'logout') {
    localStorage.removeItem('admin_token');
    ElMessage.success('已退出登录');
    router.push('/login');
  }
}
</script>

<style scoped>
.layout {
  height: 100%;
}

.aside {
  background: #1f2937;
  display: flex;
  flex-direction: column;
}

.aside-logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.logo-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #1a5cff, #2b7be4);
  color: #fff;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.menu-btn {
  border: none;
  background: transparent;
  padding: 6px;
  display: flex;
  align-items: center;
  color: #1f2937;
  cursor: pointer;
}

.header-title {
  font-size: 17px;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.aside--drawer {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.ws-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.ws-status--on {
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
}

.ws-status--off {
  background: #d1d5db;
}

.bell-wrap {
  cursor: pointer;
  display: flex;
  align-items: center;
  color: #4b5563;
}

.notify-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.notify-panel__actions {
  display: flex;
  gap: 4px;
}

.notify-panel__list {
  max-height: 360px;
  overflow-y: auto;
}

.notify-empty {
  text-align: center;
  padding: 40px 0;
  color: #9ca3af;
  font-size: 13px;
}

.notify-item {
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 6px;
}

.notify-item:hover {
  background: #f5f7fa;
}

.notify-item--unread {
  background: #eff6ff;
}

.notify-item--unread:hover {
  background: #dbeafe;
}

.notify-item__title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
}

.notify-item__content {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
  line-height: 1.5;
}

.notify-item__time {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 4px;
  text-align: right;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #4b5563;
  font-size: 14px;
}

.main {
  background: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 768px) {
  .header {
    padding: 0 8px 0 4px;
    height: 56px;
  }
  .header-title {
    font-size: 16px;
  }
  .header-right {
    gap: 12px;
  }
  .user-info__name {
    display: none;
  }
  .main {
    padding: 12px;
  }
}
</style>

<style>
.nav-drawer {
  background: #1f2937 !important;
}
.nav-drawer .el-drawer__body {
  padding: 0;
  height: 100%;
  background: #1f2937;
}
</style>
