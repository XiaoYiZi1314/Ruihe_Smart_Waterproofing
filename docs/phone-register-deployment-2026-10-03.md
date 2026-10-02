# 电话登记工单部署记录（2026-10-03）

## 发布内容
- Git：`9959dd2` `feat: 管理后台支持电话登记工单`
- 后端：`POST /api/admin/orders` 电话登记；工单增加 `booking_source`（`miniapp` / `phone`）
- 管理后台：工单页增加「电话登记」、来源列与筛选

## 服务器
- API：`/var/www/waterproof-backend`，PM2 `waterproof-api`
- 管理端：`/var/www/waterproof-admin`
- 备份：`/var/backups/waterproof/20261003-014335-phone-register/`

## 步骤
1. 替换后端 7 个文件（含新增 `orderRegister.js`、`migrate-phone-register.js`）
2. `node scripts/migrate-phone-register.js`（幂等）
3. `pm2 restart waterproof-api --update-env`
4. 整包替换管理端 `dist`（24 个文件）

## 验收
- 本机健康：`200` `服务运行正常`
- 公网 `https://ruihezhihui.cn/health`：`200`
- 管理端 `https://ruihezhihui.cn/admin/`：`200`

未带登录态的登记接口应返回 401，而不是 404。实际登记请在后台登录后点「电话登记」验证。
