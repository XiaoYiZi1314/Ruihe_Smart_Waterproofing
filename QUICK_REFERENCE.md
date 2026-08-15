# 🚀 快速参考手册

> 常用命令和配置的速查表

---

## 📌 本地开发快速命令

### 后端服务

```bash
# 进入后端目录
cd D:\PROJECT\Ruihe_Smart_Waterproofing\backend

# 安装依赖（首次）
npm install

# 初始化数据库（首次）
npm run migrate

# 启动开发服务器
npm run dev

# 启动生产服务器
npm start

# 健康检查
curl http://localhost:3000/health
```

### 数据库

```bash
# 登录 MySQL
mysql -u root -p

# 登录项目数据库
mysql -u waterproof_user -p waterproof_system

# 创建数据库（首次）
CREATE DATABASE waterproof_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'waterproof_user'@'localhost' IDENTIFIED BY 'waterproof123';
GRANT ALL PRIVILEGES ON waterproof_system.* TO 'waterproof_user'@'localhost';
FLUSH PRIVILEGES;
```

### 小程序

```bash
# 1. 打开微信开发者工具
# 2. 导入项目 → 选择 miniapp 目录
# 3. 填入 AppID
# 4. 勾选"不校验合法域名"
# 5. 编译运行
```

---

## 📝 关键配置文件

### backend/.env（本地开发）

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_NAME=waterproof_system
DB_USER=waterproof_user
DB_PASSWORD=waterproof123

WECHAT_APPID=你的测试号AppID
WECHAT_SECRET=你的测试号AppSecret

JWT_SECRET=dev_secret_key_for_testing
JWT_EXPIRES_IN=7d
```

### miniapp/project.config.json

```json
{
  "appid": "你的测试号AppID",
  "projectname": "waterproof-miniapp"
}
```

### miniapp/app.js

```javascript
// 本地开发
apiBaseUrl: 'http://localhost:3000'

// 生产环境
apiBaseUrl: 'https://api.yourdomain.com'
```

---

## 🌐 生产部署快速命令

### 服务器环境安装

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 MySQL
sudo apt install -y mysql-server
sudo mysql_secure_installation

# 安装 Nginx
sudo apt install -y nginx

# 安装 PM2
sudo npm install -g pm2
```

### 部署后端

```bash
# 进入项目目录
cd /var/www/waterproof/backend

# 安装依赖
npm install --production

# 初始化数据库
npm run migrate

# 启动服务
pm2 start src/app.js --name waterproof-api
pm2 save
pm2 startup

# 查看状态
pm2 status
pm2 logs waterproof-api
```

### Nginx 配置

```bash
# 创建配置
sudo vim /etc/nginx/sites-available/waterproof-api

# 启用配置
sudo ln -s /etc/nginx/sites-available/waterproof-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 申请 SSL 证书
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### 小程序发布

```bash
# 1. 修改配置（使用生产 AppID 和域名）
# 2. 微信开发者工具 → 上传代码
# 3. 微信公众平台 → 配置服务器域名
# 4. 设为体验版 → 测试
# 5. 提交审核 → 发布
```

---

## 🔍 故障排查

### 后端无法启动

```bash
# 检查端口占用
netstat -tuln | grep 3000

# 查看 PM2 日志
pm2 logs waterproof-api

# 重启服务
pm2 restart waterproof-api

# 测试数据库连接
mysql -u waterproof_user -p waterproof_system
```

### 小程序登录失败

```bash
# 1. 检查后端服务
curl http://localhost:3000/health

# 2. 检查开发者工具设置
# 勾选"不校验合法域名"

# 3. 查看控制台错误
# 开发者工具 → 调试器 → Console

# 4. 检查配置一致性
# backend/.env 的 WECHAT_APPID
# miniapp/project.config.json 的 appid
# 两者必须一致
```

### Nginx 502 错误

```bash
# 检查后端状态
pm2 status

# 检查 Nginx 配置
sudo nginx -t

# 查看日志
sudo tail -f /var/log/nginx/error.log

# 重启 Nginx
sudo systemctl restart nginx
```

---

## 📊 API 端点

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/health` | GET | 健康检查 | ❌ |
| `/api/auth/login` | POST | 微信登录 | ❌ |
| `/api/auth/me` | GET | 获取用户信息 | ✅ |

---

## 🔐 获取微信测试号

```
1. 访问：https://mp.weixin.qq.com/wxamp/sandbox
2. 微信扫码登录
3. 获取 AppID 和 AppSecret
```

---

## 🗂️ 目录结构速查

```
backend/
├── src/
│   ├── config/      # 配置
│   ├── controllers/ # 控制器
│   ├── middlewares/ # 中间件
│   ├── models/      # 模型
│   ├── routes/      # 路由
│   └── app.js       # 入口
├── .env             # 环境变量
└── package.json

miniapp/
├── pages/
│   ├── login/       # 登录页
│   └── index/       # 首页
├── utils/
│   ├── request.js   # 请求封装
│   └── auth.js      # 认证工具
├── app.js           # 应用配置
└── project.config.json
```

---

## 📚 文档导航

| 文档 | 用途 |
|------|------|
| `README.md` | 项目介绍和快速开始 |
| `docs/local-test-and-deployment.md` | ⭐ 详细的本地测试和部署教程 |
| `docs/phase-1-development-guide.md` | 第一阶段开发说明 |
| `docs/deployment-guide.md` | 生产环境部署指南 |
| `PROJECT_SUMMARY.md` | 项目功能总结 |
| `backend/README.md` | 后端接口文档 |
| `miniapp/README.md` | 小程序开发说明 |

---

## 🛠️ 常用工具

### 生成 JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 数据库备份

```bash
mysqldump -u waterproof_user -p waterproof_system > backup_$(date +%Y%m%d).sql
```

### 数据库恢复

```bash
mysql -u waterproof_user -p waterproof_system < backup_20240814.sql
```

### PM2 常用命令

```bash
pm2 list                    # 列出所有进程
pm2 logs waterproof-api     # 查看日志
pm2 restart waterproof-api  # 重启
pm2 stop waterproof-api     # 停止
pm2 delete waterproof-api   # 删除
pm2 monit                   # 监控
pm2 save                    # 保存进程列表
pm2 startup                 # 设置开机自启
```

---

## 🌟 版本信息

- **项目版本**: v1.0.0
- **Node.js**: 18+
- **MySQL**: 8.0+
- **微信小程序基础库**: 3.0.0

---

## 📞 帮助

遇到问题时：

1. 查看 [本地测试与部署指南](docs/local-test-and-deployment.md)
2. 查看项目文档
3. 联系开发团队

---

**最后更新**: 2026-08-14
