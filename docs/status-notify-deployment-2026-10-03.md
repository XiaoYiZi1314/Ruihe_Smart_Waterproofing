# 工单状态变更通知部署记录（2026-10-03）

## 发布内容
- Git：`a4e9663` `fix: 工单状态变更通知展示工单号与中文状态`
- 后端推送 `order:changed` 时带上 `order_no`
- 管理后台通知展示工单号，状态与列表文案一致（待指派 / 待接单 / 施工中等）

## 服务器
- 备份：`/var/backups/waterproof/20261003-015320-status-notify/`
- 健康检查：本机与 `https://ruihezhihui.cn/health` 均为 200
- 管理端：`https://ruihezhihui.cn/admin/` 200，已更新 `Layout-DqAL5uCV.js`
