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

**当前状态**：✅ 全部五个阶段开发完成并已部署到生产环境（https://ruihezhihui.cn）；客户端与师傅端已合并为同一个小程序（登录页双入口）

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

# 填充测试数据
node scripts/seed.js

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
│   │   ├── migrate.js         # 数据库迁移
│   │   ├── seed.js            # 测试数据填充
│   │   └── test-api.js        # API测试脚本
│   ├── package.json
│   └── .env.example           # 环境变量模板
│
├── miniapp/                    # 小程序
│   ├── pages/
│   │   ├── login/             # 登录页
│   │   ├── index/             # 首页
│   │   ├── services/          # 服务列表和详情
│   │   ├── booking/           # 预约页面
│   │   ├── address/           # 地址管理
│   │   ├── orders/            # 工单管理
│   │   └── profile/           # 个人中心
│   ├── utils/
│   │   ├── request.js         # HTTP请求封装
│   │   └── auth.js            # 认证工具
│   ├── app.js                 # 应用配置
│   └── project.config.json    # 项目配置
│
└── docs/                       # 文档
    ├── phase-1-development-guide.md
    ├── phase-2-development-guide.md
    ├── phase-2-deployment.md
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

### ✅ 已完成（第二阶段）

**用户端**：
- 服务列表页（分类筛选、搜索）
- 服务详情页（图片轮播、价格、特点）
- 地址管理（新增、编辑、删除、设置默认）
- 在线预约（选择地址、时间、填写备注）
- 工单管理（列表、详情、状态筛选）
- 工单操作（取消、评价）
- 个人中心（用户信息、快捷入口）

**后端**：
- 完整的 RESTful API
- 轮播图管理接口
- 分类管理接口
- 服务管理接口
- 地址管理接口
- 工单管理接口
- 网站配置接口
- 数据库模型和关系
- 测试数据种子脚本

### ✅ 已完成（第三阶段代码开发 100%）

**工单流转与多端开发**：
- ✅ 工单状态机（完整流转规则）
- ✅ 师傅端 API（接单、拒单、施工、完工）
- ✅ 客户端 API 扩展（催单、确认、价格异议、评价）
- ✅ 角色权限控制
- ✅ 管理员 API（指派、调价、看板、导出、日志）
- ✅ 师傅端工作台（已合并进客户端小程序 `pages/worker/*`，登录页双入口；原独立版备份于 `miniapp-worker/`）
- ✅ 管理后台 Web（admin/，Vue 3 + Element Plus）
- ✅ 微信模板消息（10 个场景，已挂接）
- ✅ 操作日志记录（已挂接）
- ✅ 自动化任务（异常检测、自动完成）
- ✅ 客户端工单详情增强 + 评价系统

**待部署事项**：✅ 已全部完成（2026-08-31 部署验证通过）
- ✅ 数据库迁移已在生产执行
- ✅ 管理员账号已初始化
- ✅ 管理后台已部署：https://ruihezhihui.cn/admin/

### 📝 已排除功能

- ❌ 微信支付（根据 ADR-0004，不配置在线支付）

---

## 文档

| 文档 | 说明 |
|------|------|
| [本地测试与部署指南](docs/local-test-and-deployment.md) | ⭐ 最详细的本地开发和生产部署教程 |
| [第一阶段开发指南](docs/phase-1-development-guide.md) | 第一阶段的需求和实现说明 |
| [第二阶段开发指南](docs/phase-2-development-guide.md) | 第二阶段的需求和实现说明 |
| [第二阶段部署指南](docs/phase-2-deployment.md) | ⭐ 第二阶段部署和测试指南 |
| [第三阶段开发指南](docs/phase-3-development-guide.md) | ⭐ 第三阶段开发计划与任务 |
| [第三阶段进度报告](docs/PHASE-3-PROGRESS.md) | 第三阶段开发进度 |
| [第三阶段最终报告](docs/PHASE-3-FINAL-REPORT.md) | ✅ 第三阶段完成报告（含部署待办） |
| [第四阶段开发指南](docs/phase-4-development-guide.md) | ✅ 第四阶段（管理后台完整功能）开发指南 |
| [第五阶段报告](docs/PHASE-5-REPORT.md) | ✅ 第五阶段（通知与集成）完成报告 |
| [部署完成报告](docs/DEPLOYMENT-2026-08-31.md) | ⭐ 最新部署记录与验证结果 |
| [单小程序双角色合并说明](docs/UNIFIED-MINIAPP.md) | ⭐ 客户端/师傅端合并架构与登录分流 |
| [验收手册](docs/ACCEPTANCE-MANUAL.md) | ⭐ 全功能人工验收清单（114 项检查点） |
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
第二阶段 ████████████████████████████████ 100% ✅
第三阶段 ████████████████████████████████ 100% ✅（已部署验证）
第四阶段 ████████████████████████████████ 100% ✅（已部署验证）
第五阶段 ████████████████████████████████ 100% ✅（已部署验证）
```

### 第三阶段计划

- [x] 工单流转（师傅接单、施工、完工）
- [x] 状态机设计
- [x] 师傅端 API 开发
- [x] 客户端 API 扩展
- [x] 管理员 API 开发
- [x] 师傅端小程序
- [x] 实时消息推送（微信模板消息）
- [x] 服务评价系统
- [x] 管理后台系统
- [x] 数据统计分析（看板 + Excel 导出）
- [x] 自动化任务（异常检测、自动完成）

剩余：部署验证与端到端联调

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

### 其他接口

详细的 API 文档请查看：
- [后端 README](backend/README.md) - 完整的 API 接口文档
- [第二阶段部署指南](docs/phase-2-deployment.md) - API 接口列表

主要接口包括：
- **轮播图**: GET /api/banners
- **服务分类**: GET /api/categories
- **服务项目**: GET /api/services, GET /api/services/:id
- **地址管理**: GET/POST/PUT/DELETE /api/addresses
- **工单管理**: GET/POST /api/orders, PUT /api/orders/:id/cancel
- **站点配置**: GET /api/config

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

**项目版本**: v2.0.0  
**最后更新**: 2026-08-20  
**状态**: 第二阶段完成 ✅

---

## ⭐ Star

如果这个项目对你有帮助，请给个 Star 支持一下！
