# 2026-09-15 阶段五验收修复与部署记录

## 状态

生产版本已于 2026-09-15 部署完成。部署后健康检查、公开配置、工单号生成、加盟信息、鉴权拦截全部验收通过。本记录不包含任何登录密码、令牌或密钥。

备份目录：`/var/backups/waterproof/20260915-160533`，包含数据库快照（40K）、后端、管理后台。

## 修复范围

对应《阶段五功能验收反馈》（2026-09-13）的问题逐项修复：

| # | 验收问题 | 修复 |
|---|---------|------|
| 1 | 本地测试小程序与管理端数据不同步、刷新后空白 | 列表页刷新不再先清空旧数据（保留至新数据到达）；请求增加竞态保护（requestId）；服务列表 onShow 重新拉取分类和列表 |
| 2 | 管理端待处理工单数与工单界面不一致（1 显示为 10000） | MySQL `SUM()` 返回 DECIMAL 字符串，前端相加发生字符串拼接。后端 `getDashboard` 统一 `Number()` 归一化，前端 `pendingCount` 也做数值转换双保险 |
| 3 | 服务详情页无项目名称 | 头图左下角新增深色渐变遮罩 + 服务名称覆盖层（`.banner-title`） |
| 4 | 工单号格式 | 新增 `order_sequences` 表 + 事务内 `SELECT ... FOR UPDATE` 取号：`RH` + 中国时区日期 + 5 位每日流水（如 RH2026080900001）。并发不重号，超过 99999 拒绝。历史工单号保留不重编 |
| 5 | 退出登录无反应 | `auth.js` 未导出 `clearAuth` 导致点击即抛错；已导出，并同步清理 `globalData` |
| 6 | 不知道怎么切换师傅角色 | 「我的」页新增「切换到师傅登录」按钮；确认后退出并直达登录页师傅模式；登录页支持 `?mode=worker` |
| 7 | 确认后「联系师傅」无反应 | 客户工单列表 SQL 未 JOIN 师傅用户表，`worker_phone` 缺失；列表和详情均可拨号，加了 `makePhoneCall` 失败兜底提示 |
| 8 | UI 细节（按钮溢出、输入框高度） | `rh-button` 组件改 `virtualHost` + `flex:1; min-width:0`（等多按钮等宽不溢出）；全局输入框统一 88rpx 高度；订单卡动作按钮改 `catch:tap` 防事件穿透；价格区间单位换行显示 |
| 9 | 客户催单在后台无任何显示 | 催单通知三处补齐：(a) 管理端铃铛实时提醒 `order_urged` 事件；(b) 通知持久化到 `notifications` 表并支持历史加载/全部已读；(c) 工单列表新增「客户催单」列 + 详情「催单次数」字段。未指派工单的催单也通知管理员 |
| 10 | 主包超 2MB 无法上传/预览 | 压缩 5 张服务图（约 2.3MB → 约 300KB）；`project.config.json` 打包忽略 `scripts/`、README、mock 文件。源码包 491.5KiB |
| 11 | 管理端输错密码提示「登录已过期」 | axios 401 拦截器对登录接口豁免，显示真实错误信息 |
| 12 | 加盟合作内容与提供的《小程序文字信息》不一致 | `site_config.join_info` 新增 `partners` 字段；已录入确认内容：漳州市瑞和建设工程有限公司（企业）、科顺（产品品牌）、东方雨虹（产品品牌）；加盟热线 13306944888。管理端可编辑（合作品牌/公司、合作说明、加盟电话）；首页左右分栏展示品牌与热线 |
| 13 | 图片签名 URL 15 分钟过期 | 工单详情图片加载失败显示重试按钮；`onShow` 重新拉取详情自动刷新签名 URL |
| 14 | 地址无地图选点（截图批注） | 新增 `wx.chooseLocation` 地图选点按钮，选点后填入详细地址可继续补门牌号；纯手动输入仍可用，省市区改为可选 |
| 15 | 联系方式缺微信号 | 公开配置新增 `contact_wechat` 字段，管理端可编辑，小程序可复制 |

同时清理：移除首页/我的页硬编码的公司介绍与轮播兜底文案（改为显示后台配置或空）；`CONTEXT.md` 同步了工单号格式、地址地图选点、催单通知管理员三条领域规则。

## 部署过程

1. 备份：后端目录、管理后台、数据库快照 → `/var/backups/waterproof/20260915-160533`
2. 上传后端 64 个文件（src/scripts/data/package*），SHA-256 校验一致；服务器 `.env`、`uploads/`、`private-uploads/` 保留
3. `npm ci --omit=dev`：249 个包
4. 迁移：`migrate.js` → `migrate-phase3.js` → `migrate-review.js` → `migrate-acceptance.js`（全部幂等可重复）
5. `migrate-acceptance.js` 创建 `order_sequences` 表（首跑遇到 MySQL 8 保留字 `last_value` 语法错误，转义反引号后修复重新执行成功）；同时将已知的演示加盟文案（400-888-9999）替换为验收确认文案，已有自定义内容则保留
6. PM2 重启，管理后台新构建产物原子切换（`waterproof-admin-new` → mv 切换）
7. 部署中修复：`orderNumber.js` 的 SQL 同样存在 `last_value` 保留字问题（本地单测用 mock 未暴露），重新上传并验证

## 生产验收证据（12 项全部通过）

- 健康检查 `https://ruihezhihui.cn/health` 200
- `/api/config` 返回新加盟信息（合作品牌 + 热线 13306944888）、联系方式含 wechat 字段
- `order_sequences` 表存在；服务器端事务取号生成 `RH2026091500001` 后回滚，序号未被消耗
- `/api/admin/dashboard`、`/api/notifications` 未授权 401 拦截正常
- PM2 online、无异常日志
- 服务器 `.env` 与 uploads 目录完好
- 管理后台 `https://ruihezhihui.cn/admin/` 200，新 bundle `index-PrWDVqdV.js`

## 本地测试证据

- `node --test`（backend/test + miniapp/scripts/test-acceptance.js）：23 项通过（工单号格式/时区、并发取号、看板数字归一化、催单持久化、师傅电话字段、退出登录、401 豁免、JSON 图片数组等）
- `miniapp/scripts/test-page-contracts.js`：15 页事件契约 + 资源转换通过
- `miniapp/scripts/test-package-size.js`：源码包 491.5KiB < 1.8MB
- `check-routes.js`、`test-http-error.js`：通过
- `admin npm run build`：通过

## 发布产物

- 后端包 SHA-256：`ef3795e29d95fb1e22ebc0cbc847e27252409839912bd5ab5d28a9c114e777c2`（修复 orderNumber 后增量更新了 3 个文件）
- 管理后台包 SHA-256：`77953cf1d05e8613dae25ad49a368cecfae0bf1613b45fdc93d3a119a630b95b`
- 后端目录：`/var/www/waterproof-backend`，PM2：`waterproof-api`
- 后台目录：`/var/www/waterproof-admin`
- 地址：`https://ruihezhihui.cn/admin/`；健康检查：`https://ruihezhihui.cn/health`
- 生产工单数：2（部署前已有，未受影响）

## 已知限制与待办

1. **小程序包未发布**：本次只部署了后端和管理后台。小程序端修复（包体积、UI、地图选点、催单交互等）需在微信开发者工具上传体验版 → 真机验收 → 提交发布。桌面已提供《阶段五修复手动验证清单.md》
2. **《小程序文字信息》正式文案未核对**：客服电话、地址、营业时间、关于我们、轮播图文字的正式内容仍待甲方提供原文，当前数据库为演示文案（加盟信息已按确认内容更新）
3. **微信订阅消息模板未配置**：与上轮相同，站内消息可用，微信服务通知不发送
4. **本地无法连接服务器 MySQL**：`.env` 的数据库凭据指向生产，本地隔离回归（`test-acceptance-isolated.js`）需在可用数据库环境执行
5. **安全建议**：本轮 SSH 密码通过聊天传递，建议部署完成后轮换服务器 root 密码；本文档不记录任何密码

## 回滚

- 备份目录：`/var/backups/waterproof/20260915-160533`（含 db.sql）
- 回滚步骤：`cp -a /var/backups/waterproof/20260915-160533/waterproof-backend/* /var/www/waterproof-backend/ && pm2 restart waterproof-api`；数据库如需回滚用备份 db.sql（注意会覆盖部署后新数据，当前生产仅 2 条工单）
- `order_sequences` 表和 `join_info` 更新均为增量，不阻碍回滚
