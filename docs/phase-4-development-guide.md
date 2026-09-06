# 第四阶段开发指南：管理后台完整功能

**里程碑**：管理后台全部功能开发完成，可独立使用

**前置条件**：第三阶段已完成（登录、基础看板、工单管理、师傅管理、日志）

**状态**：✅ 代码开发完成（100%）

---

## 任务清单

| # | 任务 | 说明 | 状态 |
|---|------|------|------|
| 1 | 服务分类管理 API | 增删改查、排序、启用/停用 | ✅ |
| 2 | 服务项目管理 API | 增删改查、上下架、热门设置 | ✅ |
| 3 | 轮播图管理 API | 增删改查、排序、启用/停用 | ✅ |
| 4 | 站点配置 API | 读取/保存联系方式、关于我们、加盟信息 | ✅ |
| 5 | 看板增强 API | 完成趋势（按日）、师傅排行榜 | ✅ |
| 6 | 师傅编辑 API | 编辑信息、修改状态 | ✅ |
| 7 | 管理后台 - 项目管理页 | 分类管理 + 服务项目管理 | ✅ |
| 8 | 管理后台 - 站点配置页 | 轮播图 + 联系方式 + 关于我们 + 加盟信息 | ✅ |
| 9 | 管理后台 - 看板增强 | ECharts 趋势图 + 师傅排行榜 | ✅ |
| 10 | 管理后台 - 师傅编辑 | 编辑弹窗 + 状态切换 | ✅ |
| 11 | 拒单理由查看 | 工单详情中展示 | ✅ |

---

## 后端 API 设计

### 服务分类（/api/admin/categories）
- `GET /` 列表（含服务数量统计）
- `POST /` 新增
- `PUT /:id` 编辑
- `DELETE /:id` 删除（有服务时禁止）
- `PUT /:id/toggle` 启用/停用

### 服务项目（/api/admin/services）
- `GET /` 列表（筛选：分类、状态、关键词）
- `POST /` 新增
- `PUT /:id` 编辑
- `DELETE /:id` 删除（有关联工单时禁止）
- `PUT /:id/toggle` 上架/下架
- `PUT /:id/hot` 设置/取消热门

### 轮播图（/api/admin/banners）
- `GET /` 列表
- `POST /` 新增
- `PUT /:id` 编辑
- `DELETE /:id` 删除
- `PUT /:id/toggle` 启用/停用

### 站点配置（/api/admin/config）
- `GET /` 全部配置
- `PUT /` 批量保存

配置键约定：
- `contact_phone`、`contact_address`、`contact_hours` - 联系方式
- `about_us` - 关于我们（富文本）
- `join_info` - 加盟信息（JSON：品牌介绍、加盟电话）

### 看板增强（/api/admin/dashboard 扩展）
- `GET /api/admin/dashboard/trend?days=30` - 每日新增/完成工单趋势
- `GET /api/admin/dashboard/worker-ranking?limit=10` - 师傅本月完成排行榜

### 师傅管理增强（/api/admin/workers 扩展）
- `PUT /api/admin/workers/:id` - 编辑师傅信息
- `PUT /api/admin/workers/:id/status` - 修改工作状态

---

## 技术说明

- 图片上传：阶段四先实现本地 `/uploads` 上传接口，云存储（COS/OSS）留到阶段五
- 富文本：管理后台使用 textarea 简化实现（富文本编辑器留到阶段五）
- 图表：ECharts 按需引入折线图和柱状图
