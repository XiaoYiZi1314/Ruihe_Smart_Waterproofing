# 瑞和防水小程序 - 第二阶段部署指南

## 概述

第二阶段已完成以下功能：
- ✅ 后端API完整实现（轮播图、分类、服务、地址、工单、配置）
- ✅ 数据库模型和关系定义
- ✅ 前端所有页面开发（服务列表/详情、地址管理、预约、工单、个人中心）
- ✅ 数据库迁移和种子数据脚本
- ✅ API集成和数据流打通

## 部署步骤

### 1. 环境准备

确保已安装：
- Node.js >= 14
- MySQL >= 5.7
- 微信开发者工具

### 2. 数据库初始化

```bash
# 进入后端目录
cd backend

# 安装依赖（如果还没安装）
npm install

# 运行数据库迁移（创建表结构）
node scripts/migrate.js

# 填充测试数据
node scripts/seed.js
```

### 3. 启动后端服务

```bash
# 在 backend 目录下
npm run dev

# 或生产环境
npm start
```

服务将在 `http://localhost:3000` 启动

### 4. 测试后端API

```bash
# 运行API测试脚本
node scripts/test-api.js
```

应该看到所有测试通过的提示。

### 5. 配置小程序

1. 在微信开发者工具中打开项目
2. 确保 `miniapp/utils/config.js` 中的 `API_BASE_URL` 正确指向后端地址
3. 编译小程序项目

### 6. 测试小程序功能

按以下顺序测试：

1. **登录页面** (`pages/login/login`)
   - 输入手机号和验证码
   - 验证登录成功

2. **首页** (`pages/index/index`)
   - 查看轮播图
   - 查看热门服务
   - 查看联系信息
   - 点击服务卡片跳转

3. **服务列表** (`pages/services/list`)
   - 查看所有服务
   - 分类筛选
   - 搜索功能

4. **服务详情** (`pages/services/detail`)
   - 查看服务详情
   - 查看服务图片
   - 点击立即预约

5. **地址管理** (`pages/address/list`)
   - 查看地址列表
   - 新增地址
   - 编辑地址
   - 删除地址
   - 设置默认地址

6. **预约页面** (`pages/booking/create`)
   - 选择服务地址
   - 选择预约时间
   - 填写备注
   - 提交预约

7. **工单列表** (`pages/orders/list`)
   - 查看所有工单
   - 状态筛选
   - 查看工单详情

8. **工单详情** (`pages/orders/detail`)
   - 查看工单信息
   - 查看进度状态
   - 取消工单
   - 评价服务

9. **个人中心** (`pages/profile/index`)
   - 查看用户信息
   - 快速入口
   - 系统设置
   - 退出登录

## API接口列表

### 认证相关
- `POST /api/auth/send-code` - 发送验证码
- `POST /api/auth/login` - 登录
- `POST /api/auth/refresh` - 刷新token

### 轮播图
- `GET /api/banners` - 获取轮播图列表

### 分类
- `GET /api/categories` - 获取分类列表

### 服务
- `GET /api/services` - 获取服务列表
- `GET /api/services/:id` - 获取服务详情

### 地址
- `GET /api/addresses` - 获取地址列表
- `POST /api/addresses` - 创建地址
- `PUT /api/addresses/:id` - 更新地址
- `DELETE /api/addresses/:id` - 删除地址
- `PUT /api/addresses/:id/default` - 设置默认地址

### 工单
- `GET /api/orders` - 获取工单列表
- `GET /api/orders/:id` - 获取工单详情
- `POST /api/orders` - 创建工单
- `PUT /api/orders/:id/cancel` - 取消工单
- `POST /api/orders/:id/evaluate` - 评价工单

### 配置
- `GET /api/config` - 获取网站配置

## 数据库表结构

### users - 用户表
- id, phone, nickname, avatar, created_at, updated_at

### categories - 分类表
- id, name, description, icon, sort_order, is_active, created_at

### services - 服务表
- id, category_id, name, description, cover_image, images, price_min, price_max, unit, duration, features, is_hot, is_active, sort_order, created_at

### banners - 轮播图表
- id, title, image_url, link_type, link_url, sort_order, is_active, created_at

### addresses - 地址表
- id, user_id, contact_name, contact_phone, province, city, district, detail_address, is_default, created_at

### work_orders - 工单表
- id, order_no, user_id, service_id, address_id, appointment_time, status, total_amount, actual_amount, remark, cancel_reason, rating, comment, created_at, updated_at

### site_config - 网站配置表
- id, config_key, config_value, description, updated_at

## 常见问题

### 1. 数据库连接失败
检查 `.env` 文件中的数据库配置是否正确：
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ruihe_waterproof
```

### 2. API返回401错误
- 确保已登录并获取token
- 检查token是否过期
- 验证请求头中是否包含 `Authorization: Bearer <token>`

### 3. 小程序无法调用API
- 检查网络连接
- 确认后端服务已启动
- 验证 `API_BASE_URL` 配置正确
- 在微信开发者工具中检查"详情-本地设置-不校验合法域名"是否勾选

### 4. 图片无法显示
- 确保图片URL正确
- 检查网络访问权限
- 验证图片服务器是否可访问

## 下一步计划

第三阶段待开发功能：
- [ ] 支付功能集成
- [ ] 实时消息推送
- [ ] 师傅端小程序
- [ ] 管理后台系统
- [ ] 数据统计分析
- [ ] 优惠券系统
- [ ] 会员积分系统

## 技术栈

### 后端
- Node.js + Express
- MySQL + Sequelize ORM
- JWT认证
- bcrypt密码加密

### 前端
- 微信小程序原生开发
- 自适应深色主题设计
- RESTful API集成

## 联系方式

如有问题，请联系开发团队。
