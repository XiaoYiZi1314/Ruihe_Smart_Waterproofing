# 全仓库功能、跨端集成与安全审查

审查快照：`cdc207a5c050962182b6bb79fce79275de54d1d3`。工作区在审查开始时干净。范围以当前完整代码为准，不是提交差异；未修改业务代码，未连接生产数据库、未调用生产写接口。

需求依据：用户本轮提出的四项要求、`CONTEXT.md`、`docs/adr/0001` 至 `0004`、`docs/UNIFIED-MINIAPP.md`；前端规范依据 `AGENTS.md`。并行子代理因本机 Pi 包解析失败未启动，本报告为主代理直接审查，不是多代理共识。

## 结论

不能判定为“功能完整、后台与小程序连接不会异常、可直接上线”。主要模块和接口已存在，但有可复现的字段丢失、状态流转漏洞、通知链路缺失和部署路由问题。

**单小程序方向已经实现，不需要新做第二个小程序。** `miniapp/app.json` 同时注册顾客和师傅页面；登录页提供顾客微信登录、师傅手机号/工号密码登录；HTTP 后端对管理员、师傅分别做角色校验，并对工单/地址做归属校验。`miniapp-worker/` 在合并文档中明确为不再维护的历史备份，仅发布 `miniapp/`。账号密码登录不等于师傅微信身份已经绑定，更不等于微信通知可达。

没有在线支付是 ADR 0004 的明确决策，不属于功能缺失。没有证据证明生产密钥仍为默认值，也没有对公网进行漏洞利用。

优先级：P1 为上线前应修复的业务阻断、数据一致性或高影响风险；P2 为明确功能缺口/中等风险；P3 为规范与维护性问题。条件性风险会明确标注，不能当作生产已被攻击的证据。

## Standards

### ST01 / P3 / 硬性规范：师傅页绕开设计系统

位置：`miniapp/pages/worker/orders/detail.wxml:21`、`detail.wxss:55`、`detail.wxss:249`；另见同目录 `list.wxss` 与 `pages/worker/profile/index.wxss`。

证据：使用私有 `.card`、`.btn-primary`、原生按钮及硬编码颜色/圆角；不是仅有页面布局。违反 `AGENTS.md:100` 的“按钮、卡片、表单、空态、底栏必须用 rh-*”及 `:111` 的“禁止复制组件已有视觉”。应在合并后的正式师傅页面复用 rh 组件与令牌。历史备份目录不计入此项。

### ST02 / P3 / 判断性异味：重复的封面映射逻辑

位置：`miniapp/pages/index/index.js:26`、`miniapp/pages/services/list.js:4`；组件读取位置 `miniapp/components/rh-service-card/rh-service-card.js:26`。

可能的 Duplicated Code：两页重复 `SERVICE_COVER_MAP` 和 `addRealCovers`，且写入 `cover`，组件却读取 `cover_image`，本地兜底图片没有进入显示字段。建议集中到一个服务展示数据转换函数并测试字段契约。这里的抽象建议是判断性意见；字段不匹配是确定事实。

Standards 小结：2 项；该维度最需处理的是正式师傅页面未遵守 rh 组件复用规范。没有将格式化工具能检查的问题计入。

## Spec

### F01 / P1 / 错误实现：后台 /admin/ 部署路径与路由基准不一致

位置：`admin/src/router/index.js:63`、`admin/vite.config.js:6`。

Vite 资源基准为 `/admin/`，部署文档也使用 `/admin/`，但 `createWebHistory()` 没传该基准。访问 `/admin/` 或 `/admin/orders` 时匹配不到应用定义的 `/`、`/orders`；登录导航又会指向域名根 `/dashboard`。生产根路径不是后台 SPA 时将出现空白/跳离后台/404。应统一 `createWebHistory(import.meta.env.BASE_URL)` 并核验 Nginx SPA 回退。此项为代码及文档契约检查，未验证线上 Nginx 是否做了额外补偿。

本地开发也只代理 `/api`，未代理 `/socket.io` 和 `/uploads`，会导致本地实时通知与上传图片预览失败，需要一并核验。

### F02 / P1 / 错误实现：已删除师傅仍能被指派

位置：`backend/src/controllers/adminController.js:475`、`:482`、`:220`、`:606`；`admin/src/views/Orders.vue:351`。

删除师傅只设 `status='inactive'`；列表既不排除 inactive，又不返回 status，前端的 `w.status !== 'inactive'` 过滤始终放过这些记录。指派接口只检查 role 与 resting，不检查 active。可重现：删除空闲师傅，刷新指派弹窗并指派，返回成功；该师傅因认证中间件禁用检查无法登录/处理新单。隔离复现通过。

修复需同时约束列表、指派及师傅删除与指派的并发事务，不能只隐藏选项。

### F03 / P1 / 缺失：微信通知缺少真实身份与订阅授权链路

位置：`backend/src/controllers/adminController.js:543`、`backend/src/controllers/authController.js:216`、`backend/src/utils/notification.js:186`、`miniapp/pages/login/login.js:61`。

需求：CONTEXT 通知规则要求指派、催单、取消、完工等通知客户/师傅，休息时也应能收到。

新师傅 openid 被写成 `worker_<手机号>_<时间戳>`，师傅密码登录未调用微信换码或绑定真实 openid；通知直接将此伪 openid 作为微信 `touser`。正式 miniapp 中也没有 `wx.requestSubscribeMessage`，没有可用的师傅 Socket 通知或站内通知收件箱作为替代。单纯填写模板 ID 不能使完整链路成立。应明确身份绑定、订阅授权、消息模板及失败补偿，并用真实体验版验证。

### F04 / P1 / 错误实现：创建工单后的通知和日志引用 undefined ID

位置：`backend/src/controllers/orderController.js:73`、`:76`；`backend/src/models/WorkOrder.js:79`。

模型返回 `{ id, order_no }`，控制器却读 `result.insertId`。建单本身成功，但新单通知无法查询对应记录，实时提示缺少有效工单 ID，创建日志缺少工单关联。需求“客户提交工单通知管理员”仅部分实现。隔离复现通过。

另有 `notification.js:125` 仅查询管理员 openid，后续却使用 admin.id 写通知记录的问题，修复 ID 传递后仍需补齐该查询字段。

### F05 / P1 / 错误实现：预约联系人修改被静默丢弃

位置：`miniapp/pages/booking/create.js:210`；`backend/src/controllers/orderController.js:13`、`:64`。

预约页允许并提交新的 contact_name/contact_phone，控制器不读取也不传给模型，模型退回地址簿联系人。用户替他人预约或临时改电话，后台和师傅会拿到旧联系方式。隔离复现通过。应透传并校验联系人，不要通过隐式修改地址簿来补救。

### F06 / P1 / 错误实现：后台联系方式、加盟信息保存成功但小程序不读取

位置：`backend/src/controllers/contentController.js:660`；`backend/src/models/SiteConfig.js:93`；`admin/src/views/SiteConfig.vue:364`；`miniapp/pages/index/index.js:119`、`:236`。

需求：管理员管理站点联系方式与加盟信息，小程序展示这些配置。

后台保存 contact_phone/contact_address/contact_hours，公开接口只返回旧 contact_info。加盟后台保存 join_phone/brand_intro，首页却读取 phone/description，加盟区会被隐藏或电话不可用。服务详情及工单客服按钮还硬编码旧客服电话，营业时间也有静态文本。联系方式映射已隔离复现。应统一配置 schema、迁移旧数据，所有客服入口共用配置。

### F07 / P1 / 错误实现：上传图片返回相对路径，小程序无法作为远程图片加载

位置：`backend/src/controllers/uploadController.js:19`；`backend/src/controllers/contentController.js:719`；`miniapp/pages/index/index.wxml:18`；`miniapp/pages/orders/detail.wxml:56`；`miniapp/pages/worker/orders/detail.wxml:80`。

后台和客户上传均返回 `/uploads/...`，小程序将其原样交给 image/previewImage，没有补生产资源域名。小程序会将根相对路径视作包内资源，而不是 HTTP 后端地址，因此后台浏览器可显示的图片在小程序中会失败。应使用统一的 HTTPS 资源 URL 转换，同时保留合法 `/assets/...` 本地资源，并在微信真机检查下载域名配置。

### F08 / P1 / 错误实现：状态修改非原子，并发请求能覆盖取消/协商

位置：`backend/src/controllers/workerController.js:310`、`:354`；`backend/src/controllers/adminController.js:191`、`:252`；`backend/src/jobs/scheduler.js:120`。

控制器先 SELECT 校验状态，再按 id 无条件 UPDATE；事务中的写入也没有把前置读取放进锁定事务。可重现交错：师傅 start 读到 confirmed，管理员取消成功，随后 start 将 cancelled 覆盖回 in_progress。定时任务扫描后遇到客户发起异议/管理员取消，也可能无条件把它改成 completed。隔离交错复现通过。

应将权限/状态校验与更新置于同一锁定事务，或使用带旧状态、worker_id 的条件更新并检查 affectedRows；任务也需幂等条件更新。通知只能基于真正成功的转换发送。

### F09 / P1 / 错误实现：协商计时仅停止扫描，没有真正暂停

位置：`backend/src/jobs/scheduler.js:98`；`backend/src/controllers/adminController.js:350`。

需求：“价格协商中状态暂停计时”。扫描跳过 price_negotiating，但调价回 pending_review 后仍使用原 completed_at 判断 3 天，没有保存/扣除协商耗时。完工后协商多日，再调价，下一个任务周期可直接完成，客户没有剩余验收时间。查询条件已隔离复现。应保存剩余时长或明确的自动完成截止时间，并在恢复协商时顺延。

### F10 / P2 / 错误实现：单轮价格协商未限制

位置：`backend/src/models/WorkOrder.js:283`；`backend/src/controllers/adminController.js:358`；`miniapp/pages/orders/detail.wxml:147`。

ADR 0002 要求“价格仅协商一轮”。调价后回到 pending_review，disputePrice 仅判断状态，不检查 price_adjusted_at/轮数，界面也继续显示异议按钮。可以无限往返协商。隔离复现通过。服务端必须强制单轮，前端同步隐藏后续入口。

### F11 / P2 / 错误实现：异常工单检测起点与响应定义错误

位置：`backend/src/jobs/scheduler.js:42`；`backend/src/controllers/workerController.js:172`；`backend/src/controllers/adminController.js:248`。

ADR 0003 规定“开始施工才算响应”。现在 accept 就填写 confirmed_at 并清除异常；任务只找 confirmed_at IS NULL，所以只接单不施工的师傅永远不会超时。任务以 updated_at 而非实际指派时间起算，而催单等更新会改变该时间。指派没有独立 assigned_at 记录；师傅页面甚至把 estimated_time 显示为“指派时间”（detail.wxml:124）。需区分指派、接单、开工三个时间。

### F12 / P2 / 部分实现：后台和师傅看不到客户关键预约信息

位置：`admin/src/views/Orders.vue:162`；`miniapp/pages/worker/orders/detail.wxml:66`；`miniapp/pages/booking/create.js:212`。

需求要求期望价格对所有角色可见。两端没有展示 expected_price，问题描述绑定不存在的 description，而客户备注和选定预约时段实际写在 remark 中。后台详情也不展示已返回的现场图片、评价和大部分时间节点。结果是客户能提交，但调度和施工人员看不到关键内容。应以实际返回字段构建完整详情，明确“期望上门”和“预计上门”的区别。

### F13 / P2 / 缺失及错误：施工前取消不完整，施工中却展示催单

位置：`backend/src/models/WorkOrder.js:248`；`miniapp/utils/status.js:12`、`:22`；`miniapp/pages/orders/detail.wxml:113`、`:122`。

CONTEXT 允许客户在 pending/confirmed 取消，而前后端均只允许 pending，已指派未施工时缺少合法取消能力。反过来，施工中页面仍显示催单，但后端只允许 pending/confirmed，点击必然 400。取消 SQL 与状态机冲突已隔离复现。统一服务端规则和前端操作映射。

### F14 / P2 / 错误实现：服务搜索关键词被后端忽略

位置：`backend/src/controllers/serviceController.js:9`；`miniapp/pages/services/list.js:87`。

页面传 keyword，Service.getList 也支持 keyword，但控制器未读取/传入，搜索返回未筛选数据。隔离复现通过。同时 API 查询字符串应编码用户输入，避免 `&` 等字符改变参数结构。

### F15 / P2 / 部分实现：评价删除和视频未形成用户闭环

位置：`miniapp/pages/orders/detail.js:251`、`detail.wxml:73`；`backend/src/controllers/serviceController.js:59`；`backend/src/routes/upload.js:46`。

CONTEXT 要求“客户可删除但不能修改”和可选视频。后端有删除接口，api.js 也封装了 deleteReview，但页面无删除入口/调用；页面无视频选择上传，上传仅支持图片，详情评价查询也没返回 video_url。应实现已约定的入口、上传、展示和删除流程；视频大小/格式/内容审核策略须明确，不能把“无限制”理解为服务器完全不设资源保护。

### F16 / P2 / 错误实现：Excel 不是当前筛选结果

位置：`admin/src/views/Orders.vue:305`；`backend/src/controllers/adminController.js:710`。

CONTEXT 要求“导出当前筛选结果”。列表支持关键词，但导出前端不传 keyword，后端也只接受状态和日期，worker_id 同样未应用。搜索一个客户再导出会得到其他客户的工单。文件命名也不符合约定的 YYYYMMDD.xlsx。应共享筛选构造逻辑并比较列表与导出的工单 ID 集合。

### F17 / P2 / 错误实现：趋势日期映射及完成统计口径不正确

位置：`backend/src/controllers/adminController.js:900`、`:671`、`:680`；`backend/src/config/database.js:4`。

mysql2 默认将 DATE 返回为 Date，`String(r.date).slice(0,10)` 不是 YYYY-MM-DD，和后续 ISO key 对不上，实际有数据也填为 0。已用符合驱动返回类型的 Date 隔离复现。今日/本月“完成数”和收入又按 created_at 限定，之前创建、本期完成的订单被漏算。应显式格式化 SQL 日期，并按 finished_at 统计完成指标。

### F18 / P2 / 缺失：师傅密码遗失后无后台恢复入口

位置：`backend/src/controllers/adminController.js:570`、`:965`；`backend/src/routes/admin.js:59`；`admin/src/views/Workers.vue`。

合并文档采用“初始密码只展示一次”的账号登录，登录错误文案要求管理员重置；实际后台只有创建、编辑姓名/手机、状态和删除，没有重置密码接口或页面，师傅端也没有改密。用户丢失初始密码后无法在产品内恢复；软删除还保留手机，不能靠同手机号重建解决。应提供仅管理员可用的重置流程、审计、临时密码与首次改密，而不是要求操作数据库。

Spec 小结：18 项；该维度最严重的是状态转换并发覆盖、通知未闭环，以及后台部署/跨端字段契约错误。

## Security

### SEC01 / P1 / 条件性风险：JWT 缺配置时退回公开固定密钥

位置：`backend/src/utils/jwt.js:4`；`backend/src/utils/realtime.js:33`。

当 JWT_SECRET 未配置，HTTP 使用源码中的固定密钥。攻击者可签发既有管理员 ID 的 token，数据库角色校验也无法识别伪签名。WebSocket 使用另一个公开默认密钥，既破坏 HTTP/Socket token 兼容，又可在缺配置时伪造 admin 角色接收通知。Socket 还只信 token role、不复核账号 active 状态。

必须在启动时校验高强度非占位密钥、缺失即失败；HTTP/Socket 复用同一认证逻辑。**未读取/确认生产密钥，不声称线上正在使用默认值。**

### SEC02 / P1 / 条件性风险：初始化脚本默认弱密码并输出明文

位置：`backend/scripts/init-admin.js:34`、`:51`、`:68`。

不带 ADMIN_PASSWORD 执行脚本会创建或重置为公开默认密码，而不是注释承诺的交互式输入；并把实际密码打印到日志。运维误执行可能重置生产管理员为弱密码，日志持有者可获得实际凭据。应强制显式设置/安全交互，禁止默认值，重置需明确确认，不输出明文。未尝试生产默认密码。

### SEC03 / P2 / 防护缺失：账号登录没有应用级限流或锁定

位置：`backend/src/routes/auth.js:10`、`:13`；`backend/src/controllers/authController.js:136`、`:216`。

管理员/师傅账号密码端点直接查库并 bcrypt 验证，无账号/IP 节流、失败阈值、退避或验证码，应用层可被持续撞库及消耗计算资源。若生产网关已有防护可降低风险，但仓库不能证明其存在。应同时限制账号和来源，并增加审计告警，避免只依赖前端按钮节流。

### SEC04 / P2 / 已确认数据泄露：客户接口返回师傅拒单理由

位置：`backend/src/models/WorkOrder.js:100`、`:155`；`backend/src/controllers/orderController.js:148`。

CONTEXT 明确“拒单理由仅管理员可见”，客户列表/详情却使用 wo.*，把 reject_reason 和相关内部字段原样输出。自己的工单被拒绝后，客户可直接在响应 JSON 读取理由，即使页面不显示。已隔离复现。应按角色白名单序列化，而不是前端隐藏。

### SEC05 / P2 / 隐私及资源风险：现场照片与公开宣传图片共用匿名静态目录

位置：`backend/src/app.js:31`；`backend/src/routes/upload.js:24`、`:31`。

客户住宅现场图片上传后通过公开 `/uploads/...` 匿名访问；只要 URL 被转发/泄露，工单授权不再生效。图片与 uploader/order 无所有权记录，文件名使用时间戳加有限随机数。上传仅限制单文件 5MB、检查扩展名，无累计配额/次数节流/文件内容识别/孤儿清理，登录用户可持续占用磁盘。

应区分公开业务图片和私有工单附件，私有附件经鉴权或短期签名访问；增加配额、速率、文件内容验证及生命周期清理。不能仅将随机文件名当作访问控制。

### SEC06 / P2 / 依赖风险：两端生产依赖命中已知漏洞公告

依据：`backend/package.json`、`admin/package.json` 及本机未跟踪的 package-lock.json；执行 `npm audit --omit=dev --json`，原始输出位于 `.pi/tasks/session-30808-30808/bcf9a071e.output` 和 `b0b91a55d.output`。

- 后端：6 个 moderate 依赖条目，high/critical 为 0。涉及 qs、body-parser、express，以及 uuid、exceljs、node-cron；包括依赖链传播计数，不是 6 个独立漏洞。
- 后端独立公告：qs 的 GHSA-x5fp-wj9c-mxmx、GHSA-4mjr-xmp4-gh2g，以及 uuid 的 GHSA-w5hq-g745-h8pq。需核验相关解析选项或 UUID buffer API 是否实际使用，不能直接认定当前 HTTP 请求可触发全部问题。
- 后台：ECharts 1 个 moderate 条目，GHSA-fgmj-fm8m-jvvx，公告受影响范围 <6.1.0；high/critical 为 0。当前使用方式的实际 XSS 可利用性未确认。
- npm 给出的修复方案包含 ECharts/node-cron 跨主版本升级，甚至 ExcelJS 降级至 3.4.0；不能直接执行 `npm audit fix --force`。应逐项评估兼容升级/替代依赖，再回归图表、Excel 导出和定时任务。
- 两个锁文件存在于本地但未被 Git 跟踪，扫描结论不保证适用于新的部署或当前线上版本。上线构建应固定并审查依赖解析结果。

Security 小结：6 项（5 项代码级风险，加 1 项依赖治理风险）；最严重的是缺配置时的固定 JWT 签名密钥及初始化脚本弱密码回退。未证明生产正使用默认凭据或已被利用。

## 验证记录

- `node miniapp/scripts/check-routes.js`：通过，跳转目标存在且 switchTab 目标合法；这不是微信页面渲染测试，也不检查 Vue Router 基准。
- `node miniapp/scripts/test-http-error.js`：通过。
- `node backend/scripts/test-worker-login-lookup.js`：通过。
- backend/src 和 miniapp 下 118 个 JS/JSON 文件：语法/JSON 解析通过。
- `node .scratch/review-reproductions.cjs`：10 组当前缺陷隔离复现通过。使用 VM 和替身依赖，不连接数据库/网络；通过表示证据成立，不表示功能符合要求，也不代替真实 SQL 事务测试。
- `npm --prefix admin run build -- --outDir ../.scratch/review-admin-dist`：通过，Vite 4.5.14，2268 模块，18.62 秒；仅大包体积警告（约 1.05 MB 和 1.21 MB 的 JS chunk）。输出放在 .scratch，未覆盖已跟踪的 admin/dist。构建不能验证 /admin/ 路由或微信运行时。
- `npm --prefix admin audit --omit=dev --json`：完成并以退出码 1 报告漏洞，1 项 moderate，high/critical 为 0。ECharts 命中 GHSA-fgmj-fm8m-jvvx（<6.1.0 的 XSS 公告），npm 建议升级至 6.1.0，属于跨主版本变更；尚未证明当前图表使用方式满足利用条件。扫描针对本机锁文件的生产依赖，不代表线上实际版本。
- `npm --prefix backend audit --omit=dev --json`：完成并以退出码 1 报告漏洞，6 个 moderate 依赖条目，high/critical 为 0；详细解释见 SEC06。退出码 1 表示发现漏洞，不是扫描工具崩溃。
- 未运行现有写入式全生命周期/E2E 脚本：它们会创建账号工单、调用通知、写操作日志，阶段五脚本还直接覆盖站点配置且未恢复。没有确认隔离数据库，因此不对实际配置执行。
- 未验证：真实微信换码、订阅消息送达、微信体验版渲染、线上 Nginx/TLS/WebSocket/域名白名单、真实数据库迁移状态及并发事务、生产密钥与依赖版本。不能承诺“不会出现异常”或“没有其他漏洞”。

## 上线前处理顺序

1. 封闭默认凭据/JWT 风险；修复原子状态转换及已删除师傅指派。
2. 修复后台路由、联系人/配置/图片契约；明确微信身份绑定和订阅通知方案。
3. 修复单轮协商、暂停计时、异常检测与取消/催单规则。
4. 补齐评价、后台/师傅详情、导出、统计与密码重置；处理依赖扫描结果。
5. 使用隔离数据库做三角色完整流程与越权/并发回归，再用同一个小程序体验版验证顾客和师傅入口。只发布 miniapp/，不发布历史 miniapp-worker/。
