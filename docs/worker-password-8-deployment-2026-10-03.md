# 师傅密码 8 位规则部署记录

## 发布结果

- 发布时间：2026-10-03 01:22:39 +08:00（服务器健康检查时间）。
- 发布批次：`20261003-012228-worker-password-8`。
- 服务器：`8.129.86.190`；使用本机已有 known_hosts 校验主机公钥。
- 更新文件：
  - `/var/www/waterproof-backend/src/utils/password.js`（新增）
  - `/var/www/waterproof-backend/src/controllers/adminController.js`
  - `/var/www/waterproof-backend/src/controllers/authController.js`
- `waterproof-api` 重启成功，PM2 状态为 `online`；PID 为 `444604`。

## 改动范围

师傅新建/重置时生成 8 位字母数字临时密码；师傅改密最低长度由 12 位改为 8 位，仍需同时包含字母和数字。管理员初始化密码规则未改。

小程序改密提示文案属于客户端，不在本次服务器发布范围内。本次未上传或发布小程序，未部署管理后台。

## 验证结果

- 三个目标文件 SHA-256 与本地提交 `c3b4fbc` 一致。
- 本机 API `/health`：200，`success=true`。
- 公网 `https://ruihezhihui.cn/health`：200，`success=true`。
- `.env` 仅备份哈希，未覆盖。
- 回滚脚本通过 `bash -n`；未为测试回滚而切换生产版本。

本次未安装依赖、运行迁移/seed、修改真实工单或覆盖上传目录、Nginx 配置。

## 文件校验与回滚

备份目录：`/var/backups/waterproof/20261003-012228-worker-password-8/`（仅 root 可访问）。

确认需要回退本次发布后，在服务器执行：

```bash
bash /var/backups/waterproof/20261003-012228-worker-password-8/rollback.sh
```

回滚会恢复两个控制器，并删除本次新增的 `password.js`，然后重启 API。不回滚数据库或其他文件。

本记录不保存密码、私钥或令牌。建议维护完成后轮换已在聊天中提供的 root 密码，并改用 SSH 密钥和最小权限部署账号。
