# 瑞和防水小程序

> 专业的防水服务平台，为客户提供便捷的防水施工服务预约和信息查询。

## 📋 目录

- [项目简介](#项目简介)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [功能特性](#功能特性)
- [文档](#文档)
- [开发计划](#开发计划)

---

## 项目简介

瑞和防水小程序是一个前后端分离的小程序项目，包含：
- **后端服务** (Node.js + Express + MySQL)
- **小程序端** (微信原生小程序)

**当前状态**：✅ 第一阶段完成（基础搭建）

---

## 快速开始

### 📦 前置要求

- Node.js 18+
- MySQL 8.0+
- 微信开发者工具

### 🚀 本地开发（5分钟上手）

#### 1. 克隆项目

```bash
git clone <your-repo-url>
cd Ruihe_Smart_Waterproofing
```

#### 2. 配置数据库

```bash
# 登录 MySQL
mysql -u root -p

# 创建数据库和用户
CREATE DATABASE waterproof_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'waterproof_user'@'localhost' IDENTIFIED BY 'waterproof123';
GRANT ALL PRIVILEGES ON waterproof_system.* TO 'waterproof_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### 3. 配置后端

```bash
cd backend

# 安装依赖
npm install

# 复制环境变量
copy .env.example .env

# 编辑 .env 文件，修改以下配置：
# - DB_PASSWORD=waterproof123
# - WECHAT_APPID=你的测试号AppID
# - WECHAT_SECRET=你的测试号AppSecret

# 初始化数据库
npm run migrate

# 启动服务
npm run dev
```

访问 http://localhost:3000/health 验证后端服务。

#### 4. 配置小程序

编辑 `miniapp/project.config.json`：
```json
{
  "appid": "你的测试号AppID"
}
```

编辑 `miniapp/app.js`：
```javascript
globalData: {
  apiBaseUrl: 'http://localhost:3000'
}
```

#### 5. 导入小程序

1. 打开微信开发者工具
2. 导入项目 → 选择 `miniapp` 目录
3. 填入 AppID
4. 详情 → 勾选"不校验合法域名"
5. 点击"编译"

🎉 完成！现在可以测试登录和首页功能了。

---

## 项目结构

```
Ruihe_Smart_Waterproofing/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── config/            # 配置（数据库、微信）
│   │   ├── controllers/       # 控制器
│   │   ├── middlewares/       # 中间件（JWT认证）
│   │   ├── models/            # 数据模型
│   │   ├── routes/            # 路由
│   │   ├── utils/             # 工具函数
│   │   └── app.js             # 应用入口
│   ├── scripts/
│   │   └── migrate.js         # 数据库迁移
│   ├── package.json
│   └── .env.example           # 环境变量模板
│
├── miniapp/                    # 小程序
│   ├── pages/
│   │   ├── login/             # 登录页
│   │   └── index/             # 首页
│   ├── utils/
│   │   ├── request.js         # HTTP请求封装
│   │   └── auth.js            # 认证工具
│   ├── app.js                 # 应用配置
│   └── project.config.json    # 项目配置
│
└── docs/                       # 文档
    ├── phase-1-development-guide.md
    ├── deployment-guide.md
    ├── local-test-and-deployment.md
    └── PROJECT_SUMMARY.md
```

---

## 技术栈

### 后端
- **运行环境**: Node.js 18+
- **框架**: Express.js 4.x
- **数据库**: MySQL 8.0+
- **认证**: JWT (jsonwebtoken)
- **其他**: axios, cors, helmet, morgan

### 前端
- **框架**: 微信原生小程序
- **开发工具**: 微信开发者工具

---

## 功能特性

### ✅ 已完成（第一阶段）

**用户端**：
- 微信授权登录
- 首页展示（轮播图、服务项目）
- 联系方式展示
- 关于我们
- 加盟信息

**后端**：
- 微信登录 API
- 用户信息查询
- JWT 认证
- 数据库设计

### 🔲 开发中（第二阶段）

- 服务详情页
- 在线预约功能
- 订单管理
- 师傅端功能
- 消息通知

### 🔲 规划中（第三阶段）

- 微信支付集成
- 会员系统
- 优惠券
- 数据统计后台

---

## 文档

| 文档 | 说明 |
|------|------|
| [本地测试与部署指南](docs/local-test-and-deployment.md) | ⭐ 最详细的本地开发和生产部署教程 |
| [第一阶段开发指南](docs/phase-1-development-guide.md) | 第一阶段的需求和实现说明 |
| [部署文档](docs/deployment-guide.md) | 生产环境部署参考 |
| [项目总结](PROJECT_SUMMARY.md) | 项目功能和技术总览 |
| [后端 README](backend/README.md) | 后端 API 接口文档 |
| [小程序 README](miniapp/README.md) | 小程序开发说明 |

**推荐阅读顺序**：
1. 本地开发：先看本 README 的"快速开始"
2. 遇到问题：查看 [本地测试与部署指南](docs/local-test-and-deployment.md)
3. 生产部署：查看 [本地测试与部署指南](docs/local-test-and-deployment.md) 第二部分

---

## 开发计划

### 当前进度

```
第一阶段 ████████████████████████████████ 100% ✅
第二阶段 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   0%
第三阶段 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   0%
```

### 第二阶段计划

- [ ] 服务详情页（图片、价格、施工流程）
- [ ] 在线预约表单
- [ ] 订单列表和详情
- [ ] 师傅注册和认证
- [ ] 服务评价系统

预计完成时间：2-3 周

---

## API 接口

### 认证接口

#### POST /api/auth/login
微信登录

**请求**:
```json
{
  "code": "微信登录code",
  "nickname": "用户昵称",
  "avatar_url": "头像URL"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "token": "JWT token",
    "user": { /* 用户信息 */ }
  }
}
```

#### GET /api/auth/me
获取当前用户信息

**请求头**:
```
Authorization: Bearer <token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nickname": "用户昵称",
    "avatar_url": "头像URL",
    "role": "customer"
  }
}
```

---

## 常见问题

### ❓ 如何获取微信测试号？

1. 访问 https://mp.weixin.qq.com/wxamp/sandbox
2. 微信扫码登录
3. 获取 AppID 和 AppSecret

### ❓ 登录失败怎么办？

1. 检查后端服务是否启动
2. 检查 `.env` 中的 WECHAT_APPID 是否正确
3. 开发工具勾选"不校验合法域名"
4. 查看控制台错误信息

### ❓ 图片不显示？

当前使用的是 picsum.photos 占位图，需要网络访问。可以替换为实际图片 URL。

### ❓ 更多问题？

查看 [本地测试与部署指南](docs/local-test-and-deployment.md) 的"常见问题"章节。

---

## 部署到生产环境

详细步骤请查看：[本地测试与部署指南](docs/local-test-and-deployment.md) 第二部分

**简要流程**：

1. 准备云服务器（1核2G+）
2. 安装环境（Node.js, MySQL, Nginx）
3. 配置数据库和上传代码
4. 配置 Nginx 反向代理
5. 申请 SSL 证书（HTTPS）
6. 配置微信小程序服务器域名
7. 上传小程序代码并提交审核

---

## 开发规范

### 代码风格
- 使用 2 空格缩进
- 使用单引号
- 变量使用小驼峰命名

### Git 提交规范
```bash
feat: 添加新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 重构
test: 测试相关
chore: 构建/工具相关
```

### 分支管理
```bash
main        # 主分支（生产）
develop     # 开发分支
feature/*   # 功能分支
bugfix/*    # 修复分支
```

---

## 性能指标

- 小程序首屏加载：< 3秒
- 登录响应时间：< 2秒
- API 平均响应时间：< 500ms
- 支持并发用户数：1000+

---

## 安全说明

⚠️ **重要提醒**：

1. **生产环境必须修改**：
   - `JWT_SECRET`：使用强随机字符串
   - 数据库密码：使用复杂密码
   - 微信 AppID/Secret：使用正式小程序的

2. **不要提交到 Git**：
   - `.env` 文件（已在 .gitignore）
   - 包含密钥的任何文件

3. **HTTPS**：
   - 生产环境必须使用 HTTPS
   - 小程序要求服务器域名必须是 HTTPS

---

## 许可证

ISC

---

## 联系方式

如有问题或建议，请联系开发团队。

---

**项目版本**: v1.0.0  
**最后更新**: 2026-08-14  
**状态**: 第一阶段完成 ✅

---

## ⭐ Star

如果这个项目对你有帮助，请给个 Star 支持一下！
