# 2026-09-30 提交汇总与后端部署验收

## 状态

生产后端已部署到 `b0e41f6`（含 `47a4459` 起全部后续提交）。健康检查、公开配置、工单更正相关接口鉴权拦截、数据库增量迁移通过。本记录不包含任何登录密码、令牌或密钥。

备份目录：`/var/backups/waterproof/20260930-234039`（部署前后端目录完整打包 16MB + 本次上传包）。自动回滚未触发。

## 提交范围

基准：`47a4459e320d4aa994eab61bd7d55052f10986b8`  
终点：`b0e41f6`（`origin/main`）

| 提交 | 说明 |
| --- | --- |
| `47a4459` | fix(miniapp): 消除页面切换闪烁，新增 rh-image 图片占位组件 |
| `67b4e55` | feat: 评价支持图片（最多 3 张）与视频同时提交 |
| `c7ae559` | feat(backend): 删除评价时立即回收图片与视频附件 |
| `26e3c8f` | build(admin): 重新构建管理后台，订单详情展示评价图片 |
| `aff46b6` | feat: 小程序支持修改头像和昵称，登录不再依赖 wx.getUserProfile |
| `1dacb36` | feat: 落实 UX 扫描修改（游客可浏览、错误态与重试、预约时段校验等） |
| `9b3c6e0` | feat: 支持工单更正、现场变更申请与预约时段结构化 |
| `b0e41f6` | fix: 收紧工单更正规则并补齐部署与文档 |

## 按主题汇总（给验收用）

### 1. 小程序体验（需微信开发者工具发体验版，本次未发小程序包）

- 新增 `rh-image`：占位、渐显、失败可点重试；私有图片重新签名不再导致闪烁重载。
- 首页/列表回到前台时静默刷新，不再先清空再转圈。
- 入口改为首页；游客可浏览首页和服务；预约、工单、地址、消息需登录，登录后回跳。
- 加载失败显示「重新加载」，预约时段过期不可选，订单卡片区分预计上门 / 预约时间 / 下单时间。
- 登录改为 `wx.login`，可改头像和昵称（师傅只能改头像）。
- 评价可同时传最多 3 张图和 1 个视频；工单详情用时间线展示进度，费用被更正时有提示。
- 师傅端可提交现场变更申请；上门时间调整必须选建议时间。

### 2. 评价与附件（后端已上线）

- 评价图片写入 `review_images`（`migrate-review.js`，幂等）。
- 删除评价后立即回收不再被引用的私有文件；失败由每日孤儿清理兜底。
- 工单现场图走签名 URL；公开头像走 `/uploads/`，换头像后回收旧文件。

### 3. 工单更正（后端已上线，管理后台静态包本次未切换）

- 预约日期/时段独立落库；历史备注第一行「预约时间：…」可回填。
- 后台可更正信息/费用/预约、改派、纠正状态、补删现场图、写跟进；每次必须填原因并写变更日志。
- 师傅可提交现场变更申请；费用申请只有「待验收」才能直接改工单；施工中改派会退回已指派，新师傅需重新接单。
- 结束价格协商视为本轮已用完，客户不能再异议。
- 快捷筛选：超时未指派/未接单、催单、协商、异常、待处理申请、已更正。
- 需执行 `migrate-order-edit.js`（本次已在生产执行，回填预约 0 条）。

领域规则见 `CONTEXT.md` 与 `docs/adr/0005-admin-order-correction.md`。

### 4. 管理后台源码（仓库已构建，生产 `/admin/` 仍是旧 bundle）

- 工单详情可更正、改派、状态更正、处理师傅申请。
- 新增「更正复盘」页；变更记录按操作发生时间筛选。
- 工人停用文案、初始密码可复制。

要在浏览器里用这些界面，需要另外把 `admin/dist` 发到 `/var/www/waterproof-admin`。

## 后端部署过程

1. SSH 登录生产机，确认 PM2 进程 `waterproof-api`、目录 `/var/www/waterproof-backend`、`.env` / `uploads` / `private-uploads` 存在。
2. 备份：`/var/backups/waterproof/20260930-234039/waterproof-backend.tgz`（部署前整目录）。
3. 上传后端包（不含 `.env`、`uploads`、`private-uploads`、`node_modules`），SHA-256 与本地一致：`2d1660fb7de6f2df53e0f930d7e4b6b7b695d974e856c22227694cdbc029b423`。
4. `npm ci --omit=dev`：249 个包。
5. 迁移（均幂等）：`migrate-review.js` 成功；`migrate-order-edit.js` 成功，backfilled appointments: 0。
6. `pm2 restart waterproof-api --update-env`，进程 online，监听 `127.0.0.1:3000`。
7. 保留服务器 `.env` 与上传目录。

本次未切换管理后台静态资源，未发布小程序。

## 生产验收证据

- `http://127.0.0.1:3000/health` 与 `https://ruihezhihui.cn/health`：200，`服务运行正常`
- `https://ruihezhihui.cn/api/config`：200
- `https://ruihezhihui.cn/api/admin/orders/edit-meta`：401（未登录拦截，路由已注册）
- PM2 `waterproof-api` online；启动日志：数据库连接成功、WebSocket `/socket.io` 已启动
- 新代码文件存在：`scripts/migrate-order-edit.js`、`src/utils/orderEdit.js`
- Node v20.20.2

## 本地测试证据（部署前）

- `node --test backend/test/*.js`：64 项通过
- `node --test backend/test/order-edit.test.js miniapp/scripts/test-order-edit.js`：24 项通过（含改派退回已指派、费用申请仅待验收可应用、预约备注对齐、时间申请必填）

## 发布产物

- 后端上传包 SHA-256：`2d1660fb7de6f2df53e0f930d7e4b6b7b695d974e856c22227694cdbc029b423`
- 后端目录：`/var/www/waterproof-backend`
- PM2：`waterproof-api`
- 健康检查：`https://ruihezhihui.cn/health`
- 管理后台地址仍为 `https://ruihezhihui.cn/admin/`（静态包未更新）

## 已知限制与待办

1. **小程序包未发布**：上述小程序改动需在微信开发者工具上传体验版 → 真机验收 → 提交发布。
2. **管理后台静态包未切换**：更正工单、更正复盘等新页面现在打后端接口会 401/可用，但旧 JS 没有这些按钮。需要时再原子切换 `/var/www/waterproof-admin`。
3. **数据库逻辑备份未写入备份目录**：`mysqldump` 用 `.env` 账号从本机 socket 连接返回 1045，未在文档中记录凭据。代码回滚可用本次 `waterproof-backend.tgz`。表结构变更（更正相关）已应用到生产库，回滚代码不会自动删列。
4. **微信订阅消息仍未闭环**：历史日志中有 `invalid openid`；师傅需绑定真实微信并授权订阅。站内消息可用。
5. **通知表偶发外键失败、JSON 体超限**：出现在重启前的旧日志里，不是本次启动失败原因；不作为本轮已修复项。
6. **建议轮换**曾通过聊天传递的服务器 root 密码。本文不记录任何密码。

## 回滚

```bash
pm2 stop waterproof-api
# 先确认备份目录无误
tar -tzf /var/backups/waterproof/20260930-234039/waterproof-backend.tgz | head
cd /var/www
mv waterproof-backend waterproof-backend-failed-$(date +%H%M%S)
tar -xzf /var/backups/waterproof/20260930-234039/waterproof-backend.tgz
pm2 restart waterproof-api
```

`migrate-review.js` / `migrate-order-edit.js` 只增不改，回滚代码不会自动删除新表和新列，也不应直接拿旧库覆盖新产生的工单数据。
