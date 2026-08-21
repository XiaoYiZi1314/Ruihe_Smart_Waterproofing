# 阶段二开发指南 - 小程序核心功能

## 阶段目标

**里程碑**：小程序端核心页面开发完成，可预览效果

**核心价值**：
- 客户可以浏览真实的服务项目
- 客户可以在线提交预约工单
- 客户可以管理自己的地址信息
- 为阶段三的工单流转打下基础

---

## 开发任务清单

### 1. 数据库设计 ⭐ 优先级最高

#### 1.1 轮播图表 (banners)

```sql
CREATE TABLE banners (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(100) COMMENT '标题',
  image_url VARCHAR(500) NOT NULL COMMENT '图片URL',
  link_type ENUM('none', 'service', 'url') DEFAULT 'none' COMMENT '跳转类型',
  link_value VARCHAR(500) COMMENT '跳转值（服务ID或URL）',
  sort_order INT DEFAULT 0 COMMENT '排序（数字越小越靠前）',
  is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sort (sort_order),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='轮播图表';
```

#### 1.2 服务分类表 (service_categories)

```sql
CREATE TABLE service_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL COMMENT '分类名称',
  icon VARCHAR(200) COMMENT '图标URL',
  sort_order INT DEFAULT 0 COMMENT '排序',
  is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='服务分类表';
```

#### 1.3 服务项目表 (services)

```sql
CREATE TABLE services (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT NOT NULL COMMENT '分类ID',
  name VARCHAR(100) NOT NULL COMMENT '服务名称',
  description TEXT COMMENT '服务描述',
  cover_image VARCHAR(500) COMMENT '封面图',
  images TEXT COMMENT '详情图片（JSON数组）',
  price_min DECIMAL(10,2) COMMENT '价格区间-最低',
  price_max DECIMAL(10,2) COMMENT '价格区间-最高',
  price_unit VARCHAR(20) DEFAULT '元' COMMENT '价格单位',
  is_hot TINYINT(1) DEFAULT 0 COMMENT '是否热门',
  is_active TINYINT(1) DEFAULT 1 COMMENT '是否上架',
  sort_order INT DEFAULT 0 COMMENT '排序',
  view_count INT DEFAULT 0 COMMENT '浏览次数',
  order_count INT DEFAULT 0 COMMENT '预约次数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES service_categories(id),
  INDEX idx_category (category_id),
  INDEX idx_hot (is_hot),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='服务项目表';
```

#### 1.4 地址表 (addresses)

```sql
CREATE TABLE addresses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  contact_name VARCHAR(50) NOT NULL COMMENT '联系人姓名',
  contact_phone VARCHAR(20) NOT NULL COMMENT '联系电话',
  province VARCHAR(50) COMMENT '省份',
  city VARCHAR(50) COMMENT '城市',
  district VARCHAR(50) COMMENT '区县',
  detail_address VARCHAR(200) NOT NULL COMMENT '详细地址',
  is_default TINYINT(1) DEFAULT 0 COMMENT '是否默认地址',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='地址表';
```

#### 1.5 工单表 (work_orders)

```sql
CREATE TABLE work_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(32) UNIQUE NOT NULL COMMENT '工单号',
  user_id INT NOT NULL COMMENT '客户ID',
  service_id INT NOT NULL COMMENT '服务项目ID',
  address_id INT NOT NULL COMMENT '地址ID',
  
  -- 客户信息快照
  contact_name VARCHAR(50) NOT NULL COMMENT '联系人',
  contact_phone VARCHAR(20) NOT NULL COMMENT '联系电话',
  full_address VARCHAR(500) NOT NULL COMMENT '完整地址',
  
  -- 价格信息
  expected_price DECIMAL(10,2) COMMENT '期望价格',
  final_price DECIMAL(10,2) COMMENT '最终价格',
  door_fee DECIMAL(10,2) COMMENT '上门费',
  material_fee DECIMAL(10,2) COMMENT '材料费',
  labor_fee DECIMAL(10,2) COMMENT '工时费',
  
  -- 工单内容
  remark TEXT COMMENT '客户备注',
  
  -- 状态管理
  status ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending' COMMENT '状态',
  
  -- 师傅信息
  worker_id INT COMMENT '师傅ID',
  estimated_time DATETIME COMMENT '预计上门时间',
  
  -- 时间记录
  confirmed_at DATETIME COMMENT '确认时间',
  started_at DATETIME COMMENT '开始施工时间',
  completed_at DATETIME COMMENT '完工时间',
  finished_at DATETIME COMMENT '完成时间',
  cancelled_at DATETIME COMMENT '取消时间',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (worker_id) REFERENCES users(id),
  INDEX idx_order_no (order_no),
  INDEX idx_user (user_id),
  INDEX idx_worker (worker_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工单表';
```

#### 1.6 工单图片表 (work_order_images)

```sql
CREATE TABLE work_order_images (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL COMMENT '工单ID',
  image_url VARCHAR(500) NOT NULL COMMENT '图片URL',
  image_type ENUM('scene', 'before', 'after') DEFAULT 'scene' COMMENT '图片类型',
  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工单图片表';
```

#### 1.7 站点配置表 (site_config)

```sql
CREATE TABLE site_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(50) UNIQUE NOT NULL COMMENT '配置键',
  config_value TEXT COMMENT '配置值',
  config_type ENUM('text', 'json', 'image') DEFAULT 'text' COMMENT '配置类型',
  description VARCHAR(200) COMMENT '配置说明',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站点配置表';
```

---

### 2. 后端API开发

#### 2.1 轮播图接口

**GET /api/banners**
- 获取所有启用的轮播图
- 按 sort_order 排序
- 返回字段：id, title, image_url, link_type, link_value

#### 2.2 服务分类接口

**GET /api/categories**
- 获取所有启用的服务分类
- 按 sort_order 排序

#### 2.3 服务项目接口

**GET /api/services**
- 查询参数：
  - `category_id`: 分类ID（可选）
  - `is_hot`: 是否热门（可选）
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
- 只返回已上架的服务
- 返回字段：id, name, description, cover_image, price_min, price_max, price_unit

**GET /api/services/:id**
- 获取服务详情
- 返回完整信息，包括图片数组
- 浏览次数 +1

#### 2.4 地址管理接口

**GET /api/addresses**
- 获取当前用户的所有地址
- 需要认证
- 按创建时间倒序

**POST /api/addresses**
- 创建新地址
- 需要认证
- 请求体：contact_name, contact_phone, province, city, district, detail_address, is_default
- 如果设置为默认，自动取消其他地址的默认状态

**PUT /api/addresses/:id**
- 更新地址
- 需要认证
- 只能更新自己的地址

**DELETE /api/addresses/:id**
- 删除地址
- 需要认证
- 只能删除自己的地址

**PUT /api/addresses/:id/set-default**
- 设置默认地址
- 需要认证
- 自动取消其他地址的默认状态

#### 2.5 工单接口

**POST /api/orders**
- 创建工单
- 需要认证
- 请求体：
  - service_id: 服务ID
  - address_id: 地址ID
  - expected_price: 期望价格（可选）
  - remark: 备注（可选）
  - images: 图片URL数组（可选，最多5张）
- 自动生成工单号（WO + 时间戳 + 随机数）
- 从地址表读取联系信息并快照到工单

**GET /api/orders**
- 获取当前用户的工单列表
- 需要认证
- 查询参数：
  - `status`: 状态筛选（可选）
  - `page`: 页码
  - `limit`: 每页数量
- 按创建时间倒序

**GET /api/orders/:id**
- 获取工单详情
- 需要认证
- 只能查看自己的工单

#### 2.6 站点配置接口

**GET /api/config**
- 获取站点配置
- 公开接口
- 返回：联系方式、关于我们、加盟信息

---

### 3. 小程序页面开发

#### 3.1 首页改造 (pages/index)

**当前状态**：使用假数据展示  
**目标状态**：从后端获取真实数据

**改造内容**：
1. 轮播图从 API 获取
2. 服务项目从 API 获取（显示热门服务）
3. 联系方式从配置 API 获取
4. 关于我们从配置 API 获取
5. 加盟信息从配置 API 获取

**新增功能**：
- 点击轮播图跳转（根据 link_type）
- 点击服务卡片跳转到服务详情
- "查看更多服务"按钮跳转到服务列表页

#### 3.2 服务列表页 (pages/services/list)

**路径**：`/pages/services/list`

**功能**：
- 顶部分类标签切换（全部 + 各分类）
- 服务网格展示（2列）
- 下拉刷新
- 上拉加载更多
- 点击跳转到服务详情

**UI组件**：
- 分类标签栏（横向滚动）
- 服务卡片（图片、名称、价格区间、预约次数）
- 空状态提示

#### 3.3 服务详情页 (pages/services/detail)

**路径**：`/pages/services/detail?id=xxx`

**功能**：
- 服务图片轮播
- 服务名称和价格区间
- 服务描述（支持富文本）
- 用户评价列表（阶段三实现，暂时显示"暂无评价"）
- 底部"立即预约"按钮

**UI设计**：
- 图片占满宽度，高度自适应
- 内容区域卡片式
- 固定底部按钮栏

#### 3.4 预约页面 (pages/booking/create)

**路径**：`/pages/booking/create?serviceId=xxx`

**功能**：
1. 显示所选服务（不可修改）
2. 填写期望价格（数字输入，可选）
3. 选择地址
   - 显示默认地址
   - 点击可跳转到地址选择页
   - 如果没有地址，提示新增
4. 上传现场图片
   - 最多5张
   - 支持删除
   - 使用 wx.chooseImage
5. 填写备注（可选）
6. 提交按钮

**表单验证**：
- 必须选择地址
- 期望价格如果填写，必须大于0
- 图片不超过5张

#### 3.5 地址管理页 (pages/address/list)

**路径**：`/pages/address/list?mode=select`

**功能**：
- 地址列表展示
- 默认地址标记
- 新增地址按钮
- 编辑地址（点击卡片右侧图标）
- 删除地址（左滑删除）
- 设置默认地址

**两种模式**：
1. `mode=manage`：管理模式，从个人中心进入
2. `mode=select`：选择模式，从预约页进入，点击地址返回并携带地址ID

#### 3.6 地址编辑页 (pages/address/edit)

**路径**：`/pages/address/edit?id=xxx` (编辑) 或 `/pages/address/edit` (新增)

**功能**：
- 联系人姓名（必填）
- 联系电话（必填，校验手机号格式）
- 省市区选择器（使用 picker 组件）
- 详细地址（必填）
- 设为默认地址开关
- 保存按钮

**表单验证**：
- 姓名：1-20字符
- 电话：11位手机号
- 地址：至少5个字符

#### 3.7 个人中心页 (pages/profile/index)

**路径**：`/pages/profile/index`

**功能**：
- 用户信息展示（头像、昵称）
- 功能列表：
  - 我的工单（显示待处理数量）
  - 地址管理
  - 关于我们
  - 联系客服
  - 退出登录

**UI设计**：
- 顶部用户卡片
- 功能列表（图标 + 文字 + 箭头）

---

### 4. 初始数据准备

为了开发和测试，需要准备初始数据：

#### 4.1 服务分类数据

```javascript
const categories = [
  { name: '屋面防水', icon: 'roof.png', sort_order: 1 },
  { name: '卫生间防水', icon: 'bathroom.png', sort_order: 2 },
  { name: '地下室防水', icon: 'basement.png', sort_order: 3 },
  { name: '外墙防水', icon: 'wall.png', sort_order: 4 },
  { name: '阳台防水', icon: 'balcony.png', sort_order: 5 },
  { name: '水池防水', icon: 'pool.png', sort_order: 6 }
];
```

#### 4.2 服务项目数据

每个分类下准备2-3个服务项目，共12-18个服务。

#### 4.3 轮播图数据

准备3-5张轮播图。

#### 4.4 站点配置数据

```javascript
const siteConfigs = [
  {
    config_key: 'contact_info',
    config_value: JSON.stringify({
      address: '深圳市南山区科技园xxx路xxx号',
      phone: '0755-12345678',
      mobile: '138-1234-5678',
      wechat: 'ruihe_waterproof',
      business_hours: '周一至周日 8:00-20:00'
    }),
    config_type: 'json',
    description: '联系方式'
  },
  {
    config_key: 'about_us',
    config_value: '瑞和防水成立于2010年...',
    config_type: 'text',
    description: '关于我们'
  },
  {
    config_key: 'join_info',
    config_value: JSON.stringify({
      title: '诚邀加盟',
      content: '瑞和防水全国招商中...',
      phone: '400-123-4567'
    }),
    config_type: 'json',
    description: '加盟信息'
  }
];
```

---

### 5. 开发顺序建议

#### 第一步：数据库和初始数据（1天）
1. 更新 migrate.js，创建所有表
2. 编写 seed.js，插入初始数据
3. 测试数据库结构

#### 第二步：后端API（2-3天）
1. 创建 models（Service, Category, Address, Order 等）
2. 创建 controllers
3. 创建 routes
4. 使用 Postman 测试所有接口

#### 第三步：小程序页面（3-4天）
1. 改造首页（真实数据）
2. 开发服务列表页
3. 开发服务详情页
4. 开发地址管理（列表+编辑）
5. 开发预约页面
6. 开发个人中心

#### 第四步：联调和优化（1-2天）
1. 完整流程测试
2. UI细节调整
3. 错误处理完善
4. 加载状态优化

---

### 6. 技术要点

#### 6.1 图片上传方案

**阶段二暂不实现真实上传**，使用以下方案：
- 客户端使用 wx.chooseImage 选择图片
- 获取临时路径展示
- 提交时将临时路径数组发送给后端
- 后端暂时存储这些路径（或使用占位图URL）

**阶段五再实现**：
- 配置腾讯云COS或阿里云OSS
- 前端直传
- 后端返回永久URL

#### 6.2 地址选择器

使用小程序的 `picker` 组件：
```javascript
<picker mode="region" bindchange="onRegionChange">
  <view>{{region[0]}} {{region[1]}} {{region[2]}}</view>
</picker>
```

#### 6.3 工单号生成规则

```javascript
function generateOrderNo() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `WO${timestamp}${random}`;
}
```

#### 6.4 默认地址逻辑

用户设置默认地址时：
1. 将其他地址的 is_default 设为 0
2. 将当前地址的 is_default 设为 1

后端实现：
```javascript
// 先取消所有默认
await db.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
// 再设置新默认
await db.query('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [addressId, userId]);
```

---

### 7. 测试用例

#### 7.1 服务浏览
- [ ] 首页能显示热门服务
- [ ] 点击服务跳转到详情页
- [ ] 详情页能显示完整信息
- [ ] 服务列表页能按分类筛选
- [ ] 分页加载正常

#### 7.2 地址管理
- [ ] 能新增地址
- [ ] 能编辑地址
- [ ] 能删除地址
- [ ] 能设置默认地址
- [ ] 设置默认后其他地址自动取消默认
- [ ] 表单验证正常工作

#### 7.3 工单创建
- [ ] 能选择服务
- [ ] 能选择地址
- [ ] 能上传图片（最多5张）
- [ ] 能填写备注和期望价格
- [ ] 提交后能看到工单号
- [ ] 提交的数据正确保存到数据库

---

### 8. 注意事项

⚠️ **重要提醒**：

1. **图片资源**：
   - 阶段二使用占位图或网络图片
   - 真实图片上传在阶段五实现

2. **评价功能**：
   - 详情页暂时显示"暂无评价"
   - 完整的评价系统在阶段三实现

3. **工单状态**：
   - 阶段二只实现创建工单（pending状态）
   - 工单流转在阶段三实现

4. **权限控制**：
   - 所有地址和工单接口都需要认证
   - 用户只能操作自己的数据

5. **数据验证**：
   - 后端必须验证所有输入
   - 前端提供友好的错误提示

---

## 交付标准

阶段二完成后，应该达到以下标准：

✅ **数据库**：
- 所有表创建成功
- 有足够的测试数据

✅ **后端**：
- 所有API接口可用
- 接口文档完整
- Postman测试通过

✅ **小程序**：
- 首页使用真实数据
- 能浏览和搜索服务
- 能管理地址
- 能提交预约工单
- 个人中心功能完整

✅ **用户体验**：
- 页面加载流畅
- 交互反馈及时
- 错误提示友好
- UI风格统一

---

**文档版本**：v1.0  
**创建日期**：2026-08-20  
**维护者**：开发团队
