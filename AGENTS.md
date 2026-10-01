# AGENTS.md

瑞和智慧防水预约小程序的前端开发手册。后续页面与组件开发必须遵循本文，而不是从 `temp/` 原型里复制整页样式。

## 1. 项目介绍

这是「瑞和智慧·防水堵漏预约服务」的微信原生小程序端，对应仓库中的 `miniapp/`。

客户端能力：

- 微信登录
- 浏览服务、提交预约工单
- 查看工单进度、管理地址
- 展示站点配置（轮播、联系方式、关于我们、加盟信息）

视觉来源是 `temp/miniprogram-prototype.html`。当前小程序已经把该原型的颜色、间距、卡片、按钮、标签、表单和页面结构迁移为一套可复用组件，而不是继续使用原来的深色临时样式。

领域规则以根目录 `CONTEXT.md` 和 `docs/adr/` 为准，本文只约束前端实现方式。

## 2. 前端目录结构

```text
miniapp/
├── app.js / app.json / app.wxss     # 应用入口、TabBar、按需注入配置
├── styles/tokens.wxss               # 设计令牌（颜色、圆角、阴影、间距）
├── assets/
│   ├── tabbar/                      # TabBar PNG 图标
│   └── icons/                       # 页面图标
├── components/                      # 可复用 UI 组件（rh-*）
├── pages/                           # 业务页面，只组合组件，不堆叠私有视觉体系
├── utils/
│   ├── api.js / request.js / auth.js
│   ├── theme.js                     # 价格、渐变、手机号脱敏、环境判断
│   └── status.js                    # 工单状态文案、标签、操作按钮
└── scripts/generate-icons.py        # 从图标描边生成 PNG
```

页面职责：

| 页面 | 说明 |
| --- | --- |
| `pages/login/login` | 登录（支持 `?redirect=` 登录后回跳、`?mode=worker`） |
| `pages/index/index` | 首页 Tab（小程序入口页，游客可浏览） |
| `pages/services/list` | 服务 Tab |
| `pages/orders/list` | 工单 Tab |
| `pages/profile/index` | 我的 Tab |
| `pages/services/detail` | 服务详情 |
| `pages/booking/create` | 预约表单 |
| `pages/address/*` | 地址管理 |
| `pages/orders/detail` | 工单详情 |
| `pages/about/index` | 关于我们 |

## 3. 设计系统架构

设计令牌定义在 `miniapp/styles/tokens.wxss`，由 `app.wxss` 引入。原型以 375px 宽度为基准，换算关系是 **1px ≈ 2rpx**。

核心变量：

- 品牌色：`--color-primary #1A5CFF`、`--color-brand #2B7BE4`、`--color-brand-light #5B9AF5`
- 功能色：`--color-orange`、`--color-green`、`--color-red`、`--color-gray`
- 背景：`--color-bg #F4F6FA`，表面 `--color-surface #ffffff`
- 文本：`--color-text #1F2937`、`--color-text-secondary #6B7280`
- 圆角：`--radius-md 16rpx`、`--radius-xl 24rpx`、`--radius-pill 36rpx`
- 阴影：`--shadow`、`--shadow-2`、`--shadow-brand`

导航与 Tab：

- 导航栏白底黑字，背景 `#F4F6FA`
- TabBar 未选中 `#9CA3AF`，选中 `#2B7BE4`

组件按职责分层，不要在页面里重新发明它们：

| 组件 | 用途 | 主要扩展点 |
| --- | --- | --- |
| `rh-button` | 按钮 | `variant`: brand / line / ghost / danger；`size`: sm / md / lg；`block` |
| `rh-card` | 白底卡片 | `padding`、`flush` |
| `rh-search-bar` | 搜索框 | `placeholder`、`value`、`disabled` |
| `rh-tag-bar` | 横向标签 | `items`、`activeKey` |
| `rh-slot-picker` | 预约时段芯片 | `options`、`value` |
| `rh-form-field` | 表单行 | `label`、`required`，内容用 slot |
| `rh-service-card` | 服务列表卡 | `service`、`showBook` |
| `rh-order-card` | 工单列表卡 | `order`，动作通过 `action` 事件抛出 |
| `rh-status-tag` | 状态胶囊 | `status`、`text` |
| `rh-section-title` | 区块标题 | `title`、`more` |
| `rh-contact-line` | 联系人行 | `icon`、`title`、`subtitle` |
| `rh-menu-item` | 个人中心菜单 | `icon`、`title`、`gradient`、`badge` |
| `rh-quick-entry` | 首页四宫格 | `items` |
| `rh-empty` / `rh-load-more` | 空态与加载 | 文案 props；`rh-empty` 传 `action-text` 会显示按钮并触发 `action` 事件（用于“重新加载”“立即登录”） |
| `rh-sticky-bar` | 底部操作栏 | slot |
| `rh-info-row` | 详情键值行 | `label`、`value`、`emphasize` |
| `rh-icon` | 图标 | `name`、`tone`、`size` |

表单输入框使用全局类名：`.rh-input`、`.rh-input--area`、`.rh-form-value`、`.rh-form-tip`。这些类写在 `app.wxss`，页面不要再复制一套输入框样式。

## 4. 组件复用规范

开发任何页面时，按这个顺序做：

1. **先复用现有组件。** 按钮、卡片、搜索、标签、表单行、服务卡、工单卡、空态、底栏都必须用 `rh-*`。
2. **能扩展就扩展，不要新建相似组件。** 优先加 `variant`、`size`、boolean props、slot 或页面级 class。例如新的次要按钮应使用 `rh-button variant="line"`，而不是再写一个 `cancel-btn`。
3. **只有现有组件无法表达新交互时，才新增组件。** 新增组件必须：
   - 放在 `miniapp/components/`
   - 以 `rh-` 为前缀
   - 吃设计令牌，不写硬编码色值（除非令牌尚未覆盖）
   - 在实际使用它的页面或父组件 JSON 的 `usingComponents` 中声明，不在 `app.json` 中全局注册

按需注入约定：`app.json` 保持 `"lazyCodeLoading": "requiredComponents"`。页面和组件分别声明自身 WXML 中实际使用的组件，包含嵌套依赖；删除未使用的声明。共享初始化放在显式依赖的工具模块或应用入口，不依赖未访问页面的 JS 自动执行。当前没有用时注入占位组件需求，不额外添加 `componentPlaceholder`。

禁止事项：

- 禁止在页面 WXSS 中复制组件已有的圆角、阴影、品牌色、按钮高度。
- 禁止再引入深色主题（`#0A0D12`、`#38BDF8` 等旧样式）。
- 禁止为了单页效果把通用卡片拆成互不兼容的私有 class。
- 禁止从 `temp/miniprogram-prototype.html` 直接粘贴大段 CSS 到页面文件。原型只用于核对视觉，实现必须落到令牌和组件。

页面 WXSS 只允许写该页独有的布局：区块间距、轮播高度、头图、图片宫格等。

## 5. 后续开发注意事项

- 先改组件，再改页面。视觉 bug 优先看是不是 `rh-*` 的问题。
- Tab 页之间跳转用 `wx.switchTab`，不要 `navigateTo`。
- 工单状态映射集中在 `utils/status.js`，不要在页面里再写一套「待确认 / 进行中」。
- 价格、封面渐变、手机号脱敏用 `utils/theme.js`。
- 核对还原效果时，用微信开发者工具对照 `temp/miniprogram-prototype.html`：首页、服务列表、工单列表、我的、服务详情、预约表单。
- 图标资源用 `miniapp/scripts/generate-icons.py` 生成，不要手绘一套新的色值。
- 图片和音频按合计体积控制，不是单张 200 KB。上传前运行 `node --test miniapp/scripts/test-code-quality.js miniapp/scripts/test-package-size.js`，并在微信开发者工具重新编译、扫描和真机预览；源码检查不替代实际编译包验收。
- 业务规则变更看 `CONTEXT.md`，不要把原型里的示意文案当成接口合同。

