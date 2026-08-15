# 瑞和防水小程序 - 第一阶段部署指南

## 概述

本文档详细说明了第一阶段（基础搭建）的部署流程，包括服务器环境配置、数据库初始化、后端部署和小程序发布。

## 一、前置准备

### 1.1 服务器信息清单

在开始部署前，请准备以下信息：

- [ ] 服务器IP地址
- [ ] SSH登录账号和密码/密钥
- [ ] 域名（如：api.yourdomain.com）
- [ ] 微信小程序 AppID
- [ ] 微信小程序 AppSecret

### 1.2 本地环境要求

- Git
- Node.js 18+
- 微信开发者工具

---

## 二、服务器环境搭建

### 2.1 连接服务器

```bash
ssh root@your_server_ip
```

### 2.2 更新系统

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.3 安装基础工具

```bash
sudo apt install -y git curl wget vim
```

### 2.4 安装 Node.js

```bash
# 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node -v
npm -v
```

### 2.5 安装 MySQL

```bash
# 安装 MySQL
sudo apt install -y mysql-server

# 启动 MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# 安全配置（设置root密码等）
sudo mysql_secure_installation
```

配置建议：
- 设置 root 密码：**是**
- 移除匿名用户：**是**
- 禁止 root 远程登录：**是**
- 删除 test 数据库：**是**

### 2.6 安装 Nginx

```bash
# 安装 Nginx
sudo apt install -y nginx

# 启动 Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# 验证安装
sudo systemctl status nginx
```

### 2.7 安装 PM2

```bash
# 全局安装 PM2
sudo npm install -g pm2

# 验证安装
pm2 -v
```

---

## 三、数据库配置

### 3.1 创建数据库和用户

```bash
# 登录 MySQL
sudo mysql -u root -p
```

执行以下 SQL 命令：

```sql
-- 创建数据库
CREATE DATABASE waterproof_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户（请修改密码）
CREATE USER 'waterproof_user'@'localhost' IDENTIFIED BY 'your_strong_password_here';

-- 授权
GRANT ALL PRIVILEGES ON waterproof_system.* TO 'waterproof_user'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;

-- 退出
EXIT;
```

### 3.2 验证数据库

```bash
# 使用新用户登录测试
mysql -u waterproof_user -p waterproof_system
```

---

## 四、后端部署

### 4.1 克隆代码

```bash
# 创建项目目录
sudo mkdir -p /var/www
cd /var/www

# 克隆代码（替换为实际的仓库地址）
sudo git clone <your-repo-url> waterproof

# 设置权限
sudo chown -R $USER:$USER /var/www/waterproof
cd /var/www/waterproof/backend
```

### 4.2 安装依赖

```bash
npm install --production
```

### 4.3 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置
vim .env
```

修改以下配置：

```env
# 服务器配置
PORT=3000
NODE_ENV=production

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=waterproof_system
DB_USER=waterproof_user
DB_PASSWORD=your_strong_password_here  # 修改为实际密码

# 微信小程序配置
WECHAT_APPID=your_appid_here          # 修改为实际AppID
WECHAT_SECRET=your_secret_here        # 修改为实际AppSecret

# JWT配置
JWT_SECRET=your_jwt_secret_change_this_in_production  # 生成随机字符串
JWT_EXPIRES_IN=7d
```

生成 JWT_SECRET：

```bash
# 生成随机字符串作为 JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4.4 初始化数据库

```bash
npm run migrate
```

预期输出：
```
✅ 连接数据库成功
✅ 数据库 waterproof_system 已创建或已存在
✅ 用户表创建成功
🎉 数据库迁移完成！
```

### 4.5 测试启动

```bash
npm start
```

访问 `http://your_server_ip:3000/health` 验证服务是否正常。

### 4.6 使用 PM2 启动

```bash
# 启动服务
pm2 start src/app.js --name waterproof-api

# 保存进程列表
pm2 save

# 设置开机自启
pm2 startup
# 按照提示执行输出的命令

# 查看状态
pm2 status

# 查看日志
pm2 logs waterproof-api
```

常用 PM2 命令：

```bash
pm2 restart waterproof-api  # 重启
pm2 stop waterproof-api     # 停止
pm2 delete waterproof-api   # 删除
pm2 logs waterproof-api     # 查看日志
pm2 monit                   # 监控
```

---

## 五、Nginx 配置

### 5.1 创建配置文件

```bash
sudo vim /etc/nginx/sites-available/waterproof-api
```

添加以下内容（修改域名）：

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;  # 修改为实际域名

    # 日志
    access_log /var/log/nginx/waterproof-api.access.log;
    error_log /var/log/nginx/waterproof-api.error.log;

    # 代理到后端
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.2 启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/waterproof-api /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载配置
sudo systemctl reload nginx
```

### 5.3 配置 HTTPS（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 申请证书（替换为实际域名）
sudo certbot --nginx -d api.yourdomain.com

# 测试自动续期
sudo certbot renew --dry-run
```

按照提示操作，Certbot 会自动修改 Nginx 配置并启用 HTTPS。

### 5.4 验证部署

访问 `https://api.yourdomain.com/health`，应该看到：

```json
{
  "success": true,
  "message": "服务运行正常",
  "timestamp": "2024-08-14T12:00:00.000Z"
}
```

---

## 六、小程序配置

### 6.1 修改后端地址

编辑 `miniapp/app.js`，修改 `apiBaseUrl`：

```javascript
globalData: {
  userInfo: null,
  apiBaseUrl: 'https://api.yourdomain.com'  // 修改为实际域名
}
```

### 6.2 配置 AppID

编辑 `miniapp/project.config.json`：

```json
{
  "appid": "your_appid_here",  // 修改为实际AppID
  "projectname": "waterproof-miniapp"
}
```

### 6.3 微信公众平台配置

登录 [微信公众平台](https://mp.weixin.qq.com/)：

#### 配置服务器域名

开发管理 -> 开发设置 -> 服务器域名

添加以下域名：

- **request合法域名**：`https://api.yourdomain.com`
- **uploadFile合法域名**：`https://api.yourdomain.com`
- **downloadFile合法域名**：`https://api.yourdomain.com`

注意：
- 必须是 HTTPS 域名
- 域名需要备案
- 每月只能修改 5 次

---

## 七、小程序发布

### 7.1 本地开发调试

1. 打开微信开发者工具
2. 导入项目（选择 `miniapp` 目录）
3. 填入 AppID
4. 勾选"不校验合法域名"（仅开发环境）
5. 点击"编译"测试

### 7.2 上传代码

1. 点击工具栏"上传"
2. 填写版本号：`1.0.0`
3. 填写项目备注：`第一阶段：基础功能上线`
4. 点击"上传"

### 7.3 设置体验版

1. 登录微信公众平台
2. 开发管理 -> 版本管理
3. 找到刚上传的开发版本
4. 点击"设为体验版"
5. 扫描体验二维码测试

### 7.4 提交审核

测试无误后：

1. 点击"提交审核"
2. 填写审核信息：
   - 功能页面：首页、登录页
   - 测试账号：提供微信号（如需要）
3. 提交审核

审核时间：一般 1-7 个工作日

### 7.5 发布上线

审核通过后：

1. 版本管理 -> 审核版本
2. 点击"发布"
3. 确认发布

---

## 八、验收测试

### 8.1 后端API测试

使用 curl 或 Postman 测试：

```bash
# 健康检查
curl https://api.yourdomain.com/health

# 登录接口（需要真实的微信code）
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test_code","nickname":"测试用户"}'
```

### 8.2 小程序功能测试

- [ ] 打开小程序
- [ ] 看到登录页面
- [ ] 点击登录，授权成功
- [ ] 跳转到首页
- [ ] 轮播图正常滚动
- [ ] 服务项目正常展示
- [ ] 点击电话能拨打
- [ ] 点击服务提示"功能开发中"

### 8.3 性能测试

- [ ] 小程序首屏加载 < 3秒
- [ ] 登录响应时间 < 2秒
- [ ] 页面切换流畅无卡顿

---

## 九、常见问题排查

### 9.1 后端无法启动

**问题**：`npm start` 报错

**排查步骤**：

1. 检查 Node.js 版本：`node -v`（需要 18+）
2. 检查端口占用：`netstat -tuln | grep 3000`
3. 检查数据库连接：查看 `.env` 配置
4. 查看日志：`pm2 logs waterproof-api`

### 9.2 数据库连接失败

**问题**：`ER_ACCESS_DENIED_ERROR`

**解决方案**：

```sql
-- 重新授权
GRANT ALL PRIVILEGES ON waterproof_system.* TO 'waterproof_user'@'localhost';
FLUSH PRIVILEGES;
```

### 9.3 Nginx 502 错误

**问题**：访问域名返回 502

**排查步骤**：

1. 检查后端是否启动：`pm2 status`
2. 检查端口：`netstat -tuln | grep 3000`
3. 检查 Nginx 配置：`sudo nginx -t`
4. 查看 Nginx 日志：`sudo tail -f /var/log/nginx/error.log`

### 9.4 小程序登录失败

**问题**：点击登录提示失败

**排查步骤**：

1. 检查后端服务是否正常
2. 检查服务器域名是否配置正确
3. 检查 AppID 和 AppSecret 是否正确
4. 开发环境勾选"不校验合法域名"
5. 查看控制台错误信息

### 9.5 HTTPS 证书问题

**问题**：Let's Encrypt 申请失败

**解决方案**：

1. 确认域名已解析到服务器
2. 确认 80 端口可访问
3. 检查防火墙：`sudo ufw status`
4. 手动申请：`sudo certbot certonly --standalone -d api.yourdomain.com`

---

## 十、安全建议

### 10.1 防火墙配置

```bash
# 安装 ufw
sudo apt install -y ufw

# 允许必要端口
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

### 10.2 修改 SSH 端口（可选）

```bash
sudo vim /etc/ssh/sshd_config
# 修改 Port 22 为其他端口
sudo systemctl restart sshd
```

### 10.3 禁用 root 登录（可选）

```bash
sudo vim /etc/ssh/sshd_config
# 设置 PermitRootLogin no
sudo systemctl restart sshd
```

### 10.4 定期更新

```bash
# 每周执行一次
sudo apt update && sudo apt upgrade -y
```

---

## 十一、监控和维护

### 11.1 日志查看

```bash
# 后端日志
pm2 logs waterproof-api

# Nginx 访问日志
sudo tail -f /var/log/nginx/waterproof-api.access.log

# Nginx 错误日志
sudo tail -f /var/log/nginx/waterproof-api.error.log

# 系统日志
sudo journalctl -u nginx
```

### 11.2 数据库备份

```bash
# 创建备份脚本
vim ~/backup_db.sh
```

添加以下内容：

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/mysql"
mkdir -p $BACKUP_DIR

mysqldump -u waterproof_user -p'your_password' waterproof_system > $BACKUP_DIR/waterproof_$DATE.sql

# 保留最近7天的备份
find $BACKUP_DIR -name "waterproof_*.sql" -mtime +7 -delete
```

设置定时任务：

```bash
chmod +x ~/backup_db.sh
crontab -e
# 添加：每天凌晨2点备份
0 2 * * * /home/yourusername/backup_db.sh
```

### 11.3 性能监控

```bash
# 查看系统资源
htop

# 查看磁盘使用
df -h

# 查看内存使用
free -h

# 查看 PM2 进程
pm2 monit
```

---

## 十二、更新部署

后续代码更新时：

```bash
# 进入项目目录
cd /var/www/waterproof/backend

# 拉取最新代码
git pull origin main

# 安装新依赖（如有）
npm install --production

# 运行数据库迁移（如有）
npm run migrate

# 重启服务
pm2 restart waterproof-api
```

---

## 十三、交付清单

部署完成后，应交付：

### 13.1 服务器信息
- [ ] 服务器IP和SSH账号
- [ ] 数据库账号和密码
- [ ] 域名和SSL证书信息

### 13.2 小程序信息
- [ ] AppID 和 AppSecret
- [ ] 体验版二维码
- [ ] 管理员微信号

### 13.3 文档
- [ ] 部署文档（本文档）
- [ ] API接口文档
- [ ] 数据库设计文档
- [ ] 操作手册

---

## 附录

### A. 服务器推荐配置

**最低配置**：
- CPU: 1核
- 内存: 2GB
- 硬盘: 20GB
- 带宽: 1Mbps

**推荐配置**：
- CPU: 2核
- 内存: 4GB
- 硬盘: 40GB
- 带宽: 3Mbps

### B. 域名备案说明

国内服务器需要备案，备案流程：

1. 在云服务商控制台提交备案申请
2. 准备材料：营业执照、身份证、域名证书
3. 等待初审（1-3个工作日）
4. 提交管局审核（10-20个工作日）
5. 备案成功

### C. 参考资源

- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [Node.js 文档](https://nodejs.org/docs/)
- [Nginx 文档](https://nginx.org/en/docs/)
- [PM2 文档](https://pm2.keymetrics.io/docs/)
- [Let's Encrypt 文档](https://letsencrypt.org/docs/)

---

**文档版本**：v1.0  
**最后更新**：2026-08-14  
**维护者**：开发团队
