# 单小程序双角色合并说明（2026-08-31）

## 背景

原客户端（`miniapp/`）与师傅端（`miniapp-worker/`）是两个独立小程序，但使用同一个 AppID——微信平台一个 AppID 只能发布一个小程序，正式发版前必须合并。

## 合并后的架构

**一个小程序，登录页双入口，按角色分流**：

```
登录页（pages/login/login）
├─ 客户：微信快捷登录 → role=customer → reLaunch 到首页 Tab
│   └─ TabBar：首页 / 服务 / 工单 / 我的（pages/index、services、orders、profile）
└─ 师傅：「我是师傅，使用工号登录」→ 手机号+密码（POST /api/auth/worker-login）
    └─ role=worker → reLaunch 到师傅工作台（无 TabBar，页面栈导航）
        ├─ pages/worker/orders/list   工单列表（顶部入口进个人中心）
        ├─ pages/worker/orders/detail 工单详情（接单/拒单/施工/完工填价）
        └─ pages/worker/profile/index 师傅个人中心（业绩、上/休息切换、退出）
```

### 关键设计点

| 点 | 说明 |
|---|------|
| 师傅登录方式 | 管理后台创建师傅时生成初始密码（一次性展示），师傅用手机号+密码登录 |
| 微信登录兼容 | 已有 worker 角色的用户若用微信登录（openid 绑定过），也会自动分流到工作台 |
| token 统一 | 合并后师傅/客户共用 `token` 存储 key（原 worker 端用 `worker_token`） |
| 角色防护 | `pages/worker/*` 页面 onLoad/onShow 校验 `role === 'worker'`，非师傅 reLaunch 回登录页；客户「我的」页遇到 worker 角色自动跳回工作台 |
| TabBar | 师傅工作台页面不在 TabBar 内，用 navigateTo 页面栈导航（worker list ↔ detail / profile） |
| sitemap | `pages/worker/*` 设为 disallow，不被搜索索引 |
| 后端 | 无改动——`/api/auth/worker-login` 与角色权限中间件本就支持 |

### 迁移的文件

从 `miniapp-worker/` 迁入 `miniapp/`：
- `pages/orders/list.*` → `pages/worker/orders/list.*`（新增顶部工作台栏 + 角色防护）
- `pages/orders/detail.*` → `pages/worker/orders/detail.*`（跳转路径修正）
- `pages/profile/index.*` → `pages/worker/profile/index.*`（退出登录 token key 修正）
- `utils/status.js` → `utils/workerStatus.js`（避免与客户端 status.js 冲突）

### 修改的文件

- `pages/login/login.js/.wxml/.wxss`：双模式登录（微信 / 手机号密码），登录后按角色分流
- `app.js`：token 校验发现 worker 角色时 reLaunch 到工作台
- `app.json`：注册 3 个 worker 页面（共 14 页）
- `utils/request.js`：401 统一 reLaunch 登录页；upload 同步
- `sitemap.json`：worker 页面 disallow

## `miniapp-worker/` 目录处置

保留为历史备份，不再维护。发版流程只针对 `miniapp/`。确认稳定后可删除。

## 发版前检查

1. `miniapp/project.config.json` 的 appid 为正式 AppID ✅（wx56041a4f7ca9df14）
2. `app.js` 的 `apiBaseUrl` 指向生产 ✅（https://ruihezhihui.cn）
3. 微信后台「成员管理」添加师傅体验成员，用体验版验证师傅登录
4. 管理后台「师傅管理」创建师傅账号时会显示初始密码，发给师傅即可登录
