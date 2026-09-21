import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: '数据看板' }
      },
      {
        path: 'orders',
        name: 'Orders',
        component: () => import('../views/Orders.vue'),
        meta: { title: '工单管理' }
      },
      {
        path: 'workers',
        name: 'Workers',
        component: () => import('../views/Workers.vue'),
        meta: { title: '师傅管理' }
      },
      {
        path: 'categories',
        name: 'Categories',
        component: () => import('../views/Categories.vue'),
        meta: { title: '服务分类' }
      },
      {
        path: 'services',
        name: 'Services',
        component: () => import('../views/Services.vue'),
        meta: { title: '服务项目' }
      },
      {
        path: 'site-config',
        name: 'SiteConfig',
        component: () => import('../views/SiteConfig.vue'),
        meta: { title: '站点配置' }
      },
      {
        path: 'logs',
        name: 'Logs',
        component: () => import('../views/Logs.vue'),
        meta: { title: '操作日志' }
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

// 路由守卫
router.beforeEach((to, from, next) => {
  document.title = to.meta.title
    ? `${to.meta.title} - 瑞和防水管理后台`
    : '瑞和防水管理后台';

  const token = localStorage.getItem('admin_token');

  if (to.meta.requiresAuth !== false && !token) {
    next('/login');
  } else if (to.path === '/login' && token) {
    next('/dashboard');
  } else {
    next();
  }
});

export default router;
