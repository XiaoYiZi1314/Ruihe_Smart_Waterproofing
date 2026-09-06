# 第三阶段开发指南

## 概述

第三阶段的核心目标是完成工单的全流程管理，包括师傅端小程序、管理后台系统和消息推送功能。

**开发周期**: 3-4 周  
**优先级**: 高

---

## 阶段目标

### 核心功能
1. ✅ 工单完整流转（师傅接单、施工、完工、价格协商）
2. ✅ 师傅端小程序（工单管理、上下班状态）
3. ✅ 管理后台系统（工单管理、师傅管理、数据看板）
4. ✅ 实时消息推送（模板消息）
5. ✅ 服务评价系统
6. ✅ 数据统计分析

### 排除功能
- ❌ 微信支付（根据 ADR-0004，不配置在线支付）

---

## 技术架构

### 后端扩展
- 新增师傅相关接口
- 新增管理员接口
- 工单状态机完善
- 微信模板消息集成
- 数据统计查询优化

### 前端扩展
- 师傅端小程序（新建 `miniapp-worker/` 目录）
- 管理后台（Web，新建 `admin/` 目录）
- 客户端工单详情页完善

---

## 开发任务清单

### 任务 1：数据库扩展（优先级：高）

#### 1.1 用户表扩展
为师傅添加新字段：

```sql
ALTER TABLE users ADD COLUMN worker_status ENUM('working', 'resting') DEFAULT 'working' COMMENT '师傅状态';
ALTER TABLE users ADD COLUMN reject_count INT DEFAULT 0 COMMENT '拒单次数';
ALTER TABLE users ADD COLUMN assign_count INT DEFAULT 0 COMMENT '指派次数';
```

#### 1.2 工单表扩展
添加新状态和字段：

```sql
-- 状态扩展为完整流程
ALTER TABLE work_orders MODIFY COLUMN status ENUM(
  'pending',           -- 待确认
  'confirmed',         -- 已确认（已指派）
  'in_progress',       -- 施工中
  'pending_review',    -- 完工待验收
  'price_negotiating', -- 价格协商中
  'completed',         -- 已完成
  'cancelled'          -- 已取消
) DEFAULT 'pending';

-- 添加催单、拒单相关字段
ALTER TABLE work_orders ADD COLUMN urge_count INT DEFAULT 0 COMMENT '催单次数';
ALTER TABLE work_orders ADD COLUMN reject_reason TEXT COMMENT '拒单理由';
ALTER TABLE work_orders ADD COLUMN reject_at DATETIME COMMENT '拒单时间';
ALTER TABLE work_orders ADD COLUMN price_dispute_reason TEXT COMMENT '价格异议原因';
ALTER TABLE work_orders ADD COLUMN price_adjusted_at DATETIME COMMENT '价格调整时间';
```

#### 1.3 创建评价表

```sql
CREATE TABLE IF NOT EXISTS reviews (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL COMMENT '工单ID',
  user_id INT NOT NULL COMMENT '客户ID',
  worker_id INT NOT NULL COMMENT '师傅ID',
  service_attitude_score TINYINT COMMENT '服务态度评分(1-5)',
  quality_score TINYINT COMMENT '施工质量评分(1-5)',
  price_score TINYINT COMMENT '收费合理性评分(1-5)',
  comment TEXT COMMENT '文字评价',
  video_url VARCHAR(500) COMMENT '视频评价URL',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES work_orders(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (worker_id) REFERENCES users(id),
  INDEX idx_order (order_id),
  INDEX idx_worker (worker_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评价表';
```

#### 1.4 创建操作日志表

```sql
CREATE TABLE IF NOT EXISTS operation_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '操作人ID',
  order_id INT COMMENT '工单ID',
  action VARCHAR(50) NOT NULL COMMENT '操作类型',
  description TEXT COMMENT '操作描述',
  ip_address VARCHAR(50) COMMENT 'IP地址',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_order (order_id),
  INDEX idx_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';
```

**输出**: `backend/scripts/migrate-phase3.js`

---

### 任务 2：后端 API 开发（优先级：高）

#### 2.1 师傅端接口

**路由**: `backend/src/routes/worker.js`

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 获取指派工单列表 | GET | `/api/worker/orders` | 状态筛选：待接单、施工中、已完成 |
| 工单详情 | GET | `/api/worker/orders/:id` | 包含客户信息、图片 |
| 接受工单 | PUT | `/api/worker/orders/:id/accept` | - |
| 拒绝工单 | PUT | `/api/worker/orders/:id/reject` | body: `{reason}` |
| 开始施工 | PUT | `/api/worker/orders/:id/start` | 状态变为 in_progress |
| 完工 | PUT | `/api/worker/orders/:id/complete` | body: `{door_fee, material_fee, labor_fee}` |
| 切换工作状态 | PUT | `/api/worker/status` | body: `{status: 'working' | 'resting'}` |
| 获取个人统计 | GET | `/api/worker/stats` | 拒单率、完成工单数 |

**输出**: `backend/src/controllers/workerController.js`

#### 2.2 管理员接口

**路由**: `backend/src/routes/admin.js`

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 工单列表 | GET | `/api/admin/orders` | 支持状态、时间筛选、分页 |
| 工单详情 | GET | `/api/admin/orders/:id` | 完整信息 |
| 指派工单 | PUT | `/api/admin/orders/:id/assign` | body: `{worker_id, estimated_time}` |
| 调整价格 | PUT | `/api/admin/orders/:id/adjust-price` | body: `{final_price, door_fee, material_fee, labor_fee}` |
| 取消工单 | PUT | `/api/admin/orders/:id/cancel` | body: `{reason}` |
| 师傅列表 | GET | `/api/admin/workers` | 包含拒单率 |
| 创建师傅账号 | POST | `/api/admin/workers` | body: `{phone, nickname}` |
| 删除师傅 | DELETE | `/api/admin/workers/:id` | - |
| 数据看板 | GET | `/api/admin/dashboard` | 工单统计、师傅统计 |
| 导出工单 | GET | `/api/admin/orders/export` | 返回 Excel 文件 |
| 操作日志 | GET | `/api/admin/logs` | 分页查询 |

**输出**: `backend/src/controllers/adminController.js`

#### 2.3 客户端接口扩展

**扩展**: `backend/src/controllers/orderController.js`

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 催单 | PUT | `/api/orders/:id/urge` | urge_count +1 |
| 确认完成 | PUT | `/api/orders/:id/confirm` | 状态变为 completed |
| 价格异议 | PUT | `/api/orders/:id/dispute-price` | body: `{reason}` |
| 提交评价 | POST | `/api/orders/:id/review` | body: `{scores, comment, video_url}` |
| 删除评价 | DELETE | `/api/orders/:id/review` | - |

#### 2.4 微信模板消息

**新增**: `backend/src/utils/notification.js`

实现以下通知场景：
1. 客户提交工单 → 管理员
2. 管理员指派 → 师傅和客户
3. 师傅拒单 → 管理员
4. 师傅开始施工 → 客户
5. 师傅完工 → 客户
6. 客户催单 → 师傅
7. 客户确认完成 → 师傅
8. 客户取消 → 师傅
9. 管理员调整价格 → 客户
10. 工单自动完成 → 客户和师傅

**依赖**: 微信模板消息 API

---

### 任务 3：师傅端小程序开发（优先级：高）

#### 3.1 目录结构

```
miniapp-worker/
├── app.js / app.json / app.wxss
├── pages/
│   ├── login/           # 登录页
│   ├── orders/
│   │   ├── list/        # 工单列表（Tab）
│   │   └── detail/      # 工单详情
│   ├── profile/         # 个人中心（Tab）
│   └── work-status/     # 工作状态切换
├── utils/
│   ├── request.js
│   └── auth.js
└── components/          # 复用客户端组件
```

#### 3.2 核心页面

**工单列表页** (`pages/orders/list`)
- Tab 筛选：待接单、施工中、已完成
- 工单卡片显示：工单号、客户、地址、服务项目、状态
- 下拉刷新、上拉加载

**工单详情页** (`pages/orders/detail`)
- 基本信息：工单号、创建时间、状态
- 客户信息：姓名、电话（一键拨打）、地址
- 服务信息：项目名称、期望价格、现场图片、备注
- 操作按钮：
  - 待接单：接受、拒绝
  - 已接单：开始施工
  - 施工中：完工（填写价格）

**个人中心页** (`pages/profile/index`)
- 师傅信息：头像、昵称
- 工作状态切换：上班 / 休息
- 统计：本月完成工单、拒单率
- 退出登录

#### 3.3 组件复用

从客户端小程序复用：
- `rh-button`
- `rh-card`
- `rh-status-tag`
- `rh-info-row`
- `rh-form-field`

#### 3.4 登录逻辑

- 师傅使用手机号 + 验证码登录（或管理员分配的账号密码）
- 后端验证 `role = 'worker'`

**输出**: `miniapp-worker/` 目录

---

### 任务 4：管理后台开发（优先级：中）

#### 4.1 技术选型

- **框架**: Vue 3 + Element Plus
- **路由**: Vue Router
- **状态管理**: Pinia
- **HTTP**: Axios
- **构建**: Vite

#### 4.2 目录结构

```
admin/
├── src/
│   ├── views/
│   │   ├── Login.vue          # 登录页
│   │   ├── Dashboard.vue      # 数据看板
│   │   ├── Orders/
│   │   │   ├── List.vue       # 工单列表
│   │   │   └── Detail.vue     # 工单详情
│   │   ├── Workers/
│   │   │   └── List.vue       # 师傅管理
│   │   ├── Services/
│   │   │   └── List.vue       # 服务管理（已有）
│   │   └── Logs.vue           # 操作日志
│   ├── components/
│   ├── api/
│   ├── router/
│   ├── stores/
│   └── utils/
├── package.json
└── vite.config.js
```

#### 4.3 核心页面

**登录页** (`views/Login.vue`)
- 账号密码登录
- 验证 `role = 'admin'`

**数据看板** (`views/Dashboard.vue`)
- 工单统计：待确认、施工中、已完成、异常工单
- 师傅统计：在线师傅、休息师傅
- 今日/本月数据对比
- 图表：趋势图、饼图

**工单列表** (`views/Orders/List.vue`)
- 筛选：状态、时间范围、师傅、关键词
- 表格：工单号、客户、服务、师傅、状态、创建时间
- 操作：查看详情、指派、取消、导出

**工单详情** (`views/Orders/Detail.vue`)
- 工单信息完整展示
- 状态时间轴
- 操作区：
  - 待确认：指派师傅（选择师傅 + 预计上门时间）
  - 价格协商中：调整价格
  - 任何状态：取消工单

**师傅管理** (`views/Workers/List.vue`)
- 表格：师傅姓名、电话、状态、拒单率、操作
- 操作：新增师傅、删除师傅、查看拒单理由

**操作日志** (`views/Logs.vue`)
- 表格：操作人、操作类型、工单、时间、IP
- 筛选：时间范围、操作类型

**输出**: `admin/` 目录

---

### 任务 5：工单状态机实现（优先级：高）

#### 5.1 状态流转规则

```
pending (待确认)
  ├─ 管理员指派 → confirmed (已确认)
  ├─ 客户取消 → cancelled
  └─ 师傅拒单 → pending (保持)

confirmed (已确认)
  ├─ 师傅开始施工 → in_progress (施工中)
  ├─ 客户取消 → cancelled
  └─ 24小时未响应 → confirmed (异常状态标记)

in_progress (施工中)
  ├─ 师傅完工 → pending_review (完工待验收)
  └─ 管理员取消 → cancelled

pending_review (完工待验收)
  ├─ 客户确认 → completed (已完成)
  ├─ 客户异议 → price_negotiating (价格协商中)
  └─ 3天自动 → completed

price_negotiating (价格协商中)
  └─ 管理员调整价格 → pending_review

completed (已完成)
  └─ 终态

cancelled (已取消)
  └─ 终态
```

#### 5.2 实现方式

**新增**: `backend/src/utils/orderStateMachine.js`

```javascript
class OrderStateMachine {
  static canTransition(currentStatus, action, role) {
    // 定义状态转换规则
    const transitions = {
      pending: {
        assign: ['admin'],      // 管理员指派
        reject: ['worker'],     // 师傅拒单
        cancel: ['customer']    // 客户取消
      },
      confirmed: {
        start: ['worker'],      // 师傅开始施工
        cancel: ['customer']    // 客户取消
      },
      in_progress: {
        complete: ['worker'],   // 师傅完工
        cancel: ['admin']       // 管理员取消
      },
      pending_review: {
        confirm: ['customer'],  // 客户确认
        dispute: ['customer'],  // 价格异议
        auto_complete: ['system'] // 自动完成
      },
      price_negotiating: {
        adjust_price: ['admin'] // 管理员调整
      }
    };
    
    // 验证逻辑
  }
  
  static getNextStatus(action) {
    // 返回下一个状态
  }
}
```

**输出**: 状态机工具类

---

### 任务 6：自动化任务（优先级：中）

#### 6.1 定时任务

**新增**: `backend/src/jobs/scheduler.js`

使用 `node-cron` 实现：

1. **异常工单检测**（每小时执行）
   - 查询 `confirmed` 状态且 24 小时未响应的工单
   - 标记为异常（添加标记字段）

2. **自动完成工单**（每小时执行）
   - 查询 `pending_review` 状态且超过 3 天的工单
   - 自动变更为 `completed`
   - 发送通知

**依赖**: 
```bash
npm install node-cron
```

**输出**: `backend/src/jobs/scheduler.js`

---

### 任务 7：前端客户端完善（优先级：中）

#### 7.1 工单详情页扩展

**文件**: `miniapp/pages/orders/detail.wxml`

新增功能：
- 显示师傅信息（已指派后）
- 状态时间轴
- 操作按钮：
  - 待确认 / 已确认：催单、取消
  - 完工待验收：确认完成、价格异议
  - 已完成：评价（如未评价）

#### 7.2 评价页面

**新增**: `miniapp/pages/orders/review.wxml`

- 三维度评分（滑动星星）
- 文字评价（textarea）
- 视频上传（可选）

---

### 任务 8：数据统计与导出（优先级：低）

#### 8.1 数据看板接口

**接口**: `GET /api/admin/dashboard`

返回数据：
```json
{
  "orders": {
    "pending": 5,
    "confirmed": 12,
    "in_progress": 8,
    "pending_review": 3,
    "completed": 120,
    "cancelled": 10,
    "exception": 2
  },
  "workers": {
    "working": 15,
    "resting": 5,
    "total": 20
  },
  "today": {
    "new_orders": 8,
    "completed_orders": 12
  },
  "month": {
    "new_orders": 180,
    "completed_orders": 150
  }
}
```

#### 8.2 工单导出

**接口**: `GET /api/admin/orders/export?status=&start_date=&end_date=`

使用 `exceljs` 生成 Excel：
- 文件名：`工单导出_20260820.xlsx`
- 字段：工单号、客户名称、联系电话、服务项目、地址、状态、创建时间、完成时间、师傅姓名、最终价格、评价内容、评分

**依赖**:
```bash
npm install exceljs
```

---

## 开发顺序建议

### Week 1: 基础设施
1. 数据库扩展（migrate-phase3.js）
2. 工单状态机实现
3. 后端师傅接口开发

### Week 2: 师傅端
4. 师傅端小程序搭建
5. 师傅端核心页面开发
6. 测试师傅端工单流转

### Week 3: 管理后台
7. 管理后台搭建（Vue 3 + Element Plus）
8. 管理后台核心页面开发
9. 数据看板和导出功能

### Week 4: 完善与联调
10. 客户端工单详情页完善
11. 评价系统开发
12. 微信模板消息集成
13. 自动化任务开发
14. 全流程测试

---

## 测试计划

### 单元测试
- 工单状态机逻辑
- 价格计算
- 拒单率计算

### 集成测试
- 完整工单流转：提交 → 指派 → 施工 → 完工 → 完成
- 拒单流程
- 价格协商流程
- 取消流程

### 端到端测试
- 客户端 + 师傅端 + 管理后台联调
- 消息推送验证
- 自动化任务验证

---

## 部署清单

### 环境变量补充

**backend/.env**:
```env
# 微信模板消息
WECHAT_TEMPLATE_ORDER_ASSIGNED=模板ID
WECHAT_TEMPLATE_ORDER_COMPLETED=模板ID
# ... 其他模板
```

### 数据库迁移

```bash
cd backend
node scripts/migrate-phase3.js
```

### 后端部署

```bash
cd backend
npm install
pm2 restart waterproof-api
```

### 师傅端小程序

1. 微信公众平台创建新的小程序（或使用同一个 AppID，通过 role 区分）
2. 配置服务器域名
3. 上传代码并提交审核

### 管理后台

```bash
cd admin
npm install
npm run build
# 部署到 Nginx
```

**Nginx 配置**:
```nginx
server {
  listen 80;
  server_name admin.yourdomain.com;
  
  location / {
    root /var/www/admin/dist;
    try_files $uri $uri/ /index.html;
  }
  
  location /api/ {
    proxy_pass http://localhost:3000;
  }
}
```

---

## 注意事项

1. **工单状态转换严格按照状态机规则**，避免出现非法状态
2. **师傅账号管理**：
   - 初期由管理员手动创建
   - 师傅使用手机号登录
   - 未来可考虑师傅自助注册 + 管理员审核
3. **消息推送**：
   - 需要用户订阅消息
   - 模板需要提前在微信公众平台申请
4. **数据安全**：
   - 管理员后台必须 HTTPS
   - 添加 IP 白名单或登录验证码
5. **性能优化**：
   - 工单列表添加索引
   - 操作日志定期归档
6. **用户体验**：
   - 所有操作添加 loading 提示
   - 关键操作添加二次确认
   - 错误提示友好

---

## 完成标准

### 功能完整性
- [x] 工单可完整流转（8 个状态）
- [x] 师傅可接单、拒单、施工、完工
- [x] 管理员可指派、调整价格、取消
- [x] 客户可催单、确认、异议、评价
- [x] 消息推送覆盖 10 个场景
- [x] 数据看板显示关键指标
- [x] 工单可导出 Excel

### 代码质量
- [x] 关键逻辑有单元测试
- [x] 代码符合 ESLint 规范
- [x] API 文档完整
- [x] 数据库有备份方案

### 部署就绪
- [x] 生产环境配置文件
- [x] Nginx 配置文件
- [x] 数据库迁移脚本
- [x] 部署文档更新

---

## 后续迭代方向

### V2 功能（可选）
- 客户端在线支付（定金）
- 师傅端位置共享（地图）
- 工单评论功能
- 师傅工作日历
- 财务对账系统
- 数据大屏展示

### 技术优化
- 引入 Redis 缓存
- 消息队列（RabbitMQ / Kafka）
- 日志系统（ELK）
- 监控告警（Prometheus + Grafana）

---

**文档版本**: v1.0  
**创建日期**: 2026-08-28  
**负责人**: 开发团队  
**预计完成**: 2026-09-25
