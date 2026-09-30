# 瑞和防水小程序 - 后端服务

## 项目简介

瑞和防水小程序的后端 API 服务，基于 Node.js + Express 开发。

## 技术栈

- **框架**: Express.js
- **数据库**: MySQL 8.0+
- **认证**: JWT
- **其他**: axios, cors, helmet, morgan

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

需要配置的关键参数：
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`: 数据库连接信息
- `WECHAT_APPID`, `WECHAT_SECRET`: 微信小程序凭证
- `JWT_SECRET`: JWT密钥（生产环境必须修改）

### 3. 初始化数据库

```bash
npm run migrate
npm run migrate:phase3
npm run migrate:review
npm run migrate:acceptance
npm run migrate:order-edit
```

### 4. 启动服务

开发模式（自动重启）：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

### 5. 验证服务

访问健康检查接口：
```
GET http://localhost:3000/health
```

## API 接口

### 认证接口

#### 微信登录
```
POST /api/auth/login
Content-Type: application/json

{
  "code": "081xYb0w3oJlWJ2cTH2w38hNLM2xYb0T",
  "nickname": "微信用户",
  "avatar_url": "https://..."
}
```

响应：
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "nickname": "微信用户",
      "avatar_url": "https://...",
      "phone": null,
      "role": "customer"
    }
  }
}
```

#### 获取当前用户信息
```
GET /api/auth/me
Authorization: Bearer <token>
```

响应：
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nickname": "微信用户",
    "avatar_url": "https://...",
    "phone": null,
    "role": "customer",
    "created_at": "2024-08-14T08:00:00.000Z"
  }
}
```

## 项目结构

```
backend/
├── src/
│   ├── config/           # 配置文件
│   │   ├── database.js   # 数据库配置
│   │   └── wechat.js     # 微信配置
│   ├── controllers/      # 控制器
│   │   └── authController.js
│   ├── middlewares/      # 中间件
│   │   └── auth.js       # JWT认证中间件
│   ├── models/           # 数据模型
│   │   └── User.js
│   ├── routes/           # 路由
│   │   └── auth.js
│   ├── utils/            # 工具函数
│   │   └── jwt.js
│   └── app.js            # 主应用
├── scripts/
│   └── migrate.js        # 数据库迁移脚本
├── package.json
├── .env.example
└── README.md
```

## 部署说明

### 当前生产部署信息（2026-08-15）

| 项目 | 值 |
|---|---|
| 服务器 | 8.129.86.190（Ubuntu 22.04，2核1.6G） |
| 域名 | https://ruihezhihui.cn（Nginx + Let's Encrypt 证书） |
| 部署路径 | `/var/www/waterproof-backend` |
| 数据库 | MySQL 8.0，库 `waterproof_system`，用户 `waterproof_user` |
| 进程管理 | PM2，进程名 `waterproof-api`，已配置开机自启 |
| 健康检查 | `curl https://ruihezhihui.cn/health` |

验证命令：

```bash
curl https://ruihezhihui.cn/health                     # 健康检查
curl -X POST https://ruihezhihui.cn/api/auth/login \
  -H "Content-Type: application/json" -d '{"code":"真实code"}'   # 微信登录
```

> 注意：旧版 NestJS 演示项目已备份至 `/var/www/waterproof-backend-nestjs-legacy`（未运行）。

### 使用 PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start src/app.js --name waterproof-api

# 保存进程列表
pm2 save

# 设置开机自启
pm2 startup
```

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 开发说明

### 添加新的API接口

1. 在 `src/controllers/` 创建控制器
2. 在 `src/routes/` 创建路由文件
3. 在 `src/app.js` 中注册路由

### 数据库模型

使用原生 SQL 查询，通过 `mysql2/promise` 连接池操作数据库。

## 常见问题

### 微信登录失败

1. 检查 `WECHAT_APPID` 和 `WECHAT_SECRET` 是否正确
2. 确保服务器能访问微信 API
3. 检查 code 是否在 5 分钟有效期内

### 数据库连接失败

1. 检查 MySQL 服务是否启动
2. 检查数据库配置是否正确
3. 确认数据库用户有足够的权限

## License

ISC
