# 阶段五审查修复记录

日期：2026-09-21

对应审查：`docs/mcp-stage5-acceptance-review-2026-09-21.md`。

## 本轮结果

已完成可在当前工作区落实的代码修复、补充回归测试及构建验证。**未部署线上、未执行数据库迁移或数据写入、未上传小程序，也未把客户文案和平台配置缺项标记为已完成。**

修改/新增 19 个源码与测试文件，另新增本记录。所有现有文件先读后改，使用版本哈希保护补丁，并逐个读回核对。保留了用户已有未提交修改，没有执行 reset、clean、提交或推送。

## 与审查问题的对应关系

| 问题 | 本轮处理 | 状态与边界 |
|---|---|---|
| SPEC-01 旧校验删除新登录 | 引入共享会话快照与 revision；启动校验提供 sessionReady；旧响应不再更新/清理新会话；登录等待启动校验；仅当前凭据的 401 清除会话，网络/500 不误清。普通请求和上传请求也拒绝旧会话响应。 | 已修复，回归通过；真机登录仍待验。 |
| SPEC-02 首页旧数据覆盖新数据 | 首页加入请求序号，忽略旧响应和旧错误；仅当前请求结束 loading；卸载页面失效未完成请求；刷新保留有效分类筛选。 | 已修复，乱序、失败、卸载回归通过。 |
| SPEC-03 两端环境不统一风险 | 小程序开发版支持显式接口 origin 覆盖；管理端代理支持环境变量；正式/体验版忽略本地开发覆盖。 | 配置能力已补齐。实际目标服务器/数据库尚需选择与联调；默认行为未擅自改到另一套环境。 |
| SPEC-04 正式文案与营业时间 | 公共配置中的 hours 与 business_hours 使用同一优先级解析结果；保留已有配置值，不写死 18:00 或 20:00。 | 字段兼容问题已修复；客户正式内容核对仍阻塞于缺少《小程序文字信息》。线上尚未部署该修复。 |
| SPEC-05 微信通知模板/说明 | 发现并修复预加载缺口：预约页、师傅个人页预加载配置，用户点击时调用订阅 API；按实际 accept/reject 判断授权，不再把所有 success 回调当作同意。 | 客户端代码已修复；真实模板 ID、字段映射、微信授权及实收仍待配置验证。 |
| SPEC-06 体验版交付 | 重测源码包与构建，整理发布验收步骤。 | 未执行微信上传或发布，未生成体验二维码。 |
| STD-01 绕过品牌令牌 | 新增公共品牌/个人中心渐变令牌；个人中心页面与菜单组件默认渐变改为引用令牌，白色引用表面色令牌。 | 已修复被指出的位置，未改变目标视觉；微信样式继承与渲染待真机核对。 |
| STD-02 时间格式化重复 | 客户工单详情移除本地重复函数，统一调用 theme.formatTime。 | 已修复。 |

## 关键文件

- `miniapp/utils/session.js`：新增会话 capture / isCurrent / save / clear，共享 revision 防止退出后即使相同 token 重登也被旧请求影响。
- `miniapp/app.js`：可等待的启动校验、请求超时、当前凭据判断和师傅角色路由保护。
- `miniapp/utils/request.js`：普通及上传响应均绑定发送时会话；旧结果不触发新会话登出或旧账号数据展示。
- `miniapp/utils/auth.js`、`miniapp/pages/login/login.js`、`miniapp/pages/worker/profile/index.js`：统一会话保存/清理，并保护延迟跳转。
- `miniapp/pages/index/index.js`：首页请求竞态、错误、分类与卸载处理。
- `miniapp/utils/environment.js`、`admin/vite.config.js`：开发环境入口配置。
- `backend/src/models/SiteConfig.js`：营业时间别名统一。
- `miniapp/utils/notifications.js`、`miniapp/pages/booking/create.js`、`miniapp/pages/worker/profile/index.js`：模板预加载及真实授权结果处理。
- `miniapp/styles/tokens.wxss`、`miniapp/pages/profile/index.js`、`miniapp/pages/profile/index.wxss`、`miniapp/components/rh-menu-item/rh-menu-item.js`：品牌令牌复用。
- `miniapp/pages/orders/detail.js`：复用时间格式化函数。
- `miniapp/scripts/test-review-fixes.js`：新增 25 项回归。
- `miniapp/scripts/test-acceptance.js`：原退出登录测试注入共享 session 模块，原有断言保留。

## 验证证据

### 修复前后

先添加 8 个针对原代码的回归用例：修复前 1 通过、7 失败，覆盖启动 Promise 缺失、旧校验清新凭据、旧成功响应覆盖用户信息、网络失败误登出、API 401 竞态、首页乱序和营业时间冲突。

修复后扩展到 25 个新增用例，与原有 23 个用例合计 **48/48 通过**。没有通过删除原断言或跳过测试来获得通过。

新增边界包括：

- 同 token 退出后重登仍由 revision 区分会话。
- 当前会话 401 正常清理 storage/globalData 并返回登录。
- 旧成功响应、旧上传 401 不覆盖或清理新会话。
- 无 token 启动不访问后端；网络及服务器错误保留凭据。
- 登录路由等待校验后的用户资料；师傅登录等待启动校验完成。
- 旧首页错误不覆盖新 loading，当前刷新失败保留已有数据，卸载后忽略响应。
- 开发 origin 格式校验，体验/正式版本及无法识别环境时不能读取开发覆盖。
- 新旧营业时间映射、订阅模板预加载、全部拒绝与部分接受、未配置模板的安全降级。

### 已执行检查

```bash
node --test backend/test/orderNumber.test.js backend/test/review.test.js miniapp/scripts/test-acceptance.js miniapp/scripts/test-package-size.js miniapp/scripts/test-review-fixes.js
node miniapp/scripts/test-page-contracts.js
node miniapp/scripts/test-http-error.js
node miniapp/scripts/check-routes.js
```

结果：48 项测试通过；15 页事件契约及资源转换通过；HTTP 错误处理通过；页面路由和 switchTab 检查通过。

- 小程序源码包：**507,390 bytes / 495.5 KiB**，低于 1.8 MiB 脚本阈值。它不是微信编译上传后的包体积。
- 管理端 Vite 生产构建：**通过，退出码 0，2316 modules transformed**。使用系统临时目录，未覆盖 `admin/dist`。
- 构建仍有原有的大于 500 kB chunk 警告，此轮没有把打包优化扩展为新任务。
- 当前编辑器 diagnostics：0 条 error/warning，不等于已通过微信平台或端到端验证。
- 测试中出现的“账号或密码错误”和“network”日志来自刻意注入的负例；最终失败数为 0。

未执行真实数据库集成测试、真实微信授权/通知接收、真机视觉验收和生产发布。

## 开发环境配置方法

不要仅看“两边刷新了”，应确认两端请求最终到达同一后端实例及数据库。

### 1. 管理端

在本机的 `admin/.env.development.local` 中按实际目标设置：

```dotenv
VITE_API_PROXY_TARGET=http://localhost:3000
```

该变量同时作用于 `/api`、`/uploads` 和 `/socket.io` 开发代理。改后重启 Vite。这里仅给出操作说明，本轮未创建或覆盖你的私有环境文件，也未切换数据库。

### 2. 小程序开发版

在微信开发者工具控制台显式设置目标，例如：

```javascript
// 示例地址必须替换为你实际的测试后端地址，不是已经替你配置好的服务器。
wx.setStorageSync('ruihe_dev_api_origin', 'http://192.168.1.20:3000')
```

随后完全重新编译/启动小程序。建议先退出旧环境账号，重新登录测试环境。

- 仅 `envVersion === 'develop'` 使用此覆盖。
- 体验版 `trial`、正式版 `release`，以及无法识别环境时，均使用 `https://ruihezhihui.cn`，忽略开发覆盖。
- 未设置覆盖时，开发版仍保持原线上域名；管理端未设置变量仍默认本机 3000。**因此新增配置能力不代表两端已自动统一，必须实际设置并核验。**
- origin 只能包含协议、主机及可选端口，不接受路径、查询、账号密码。无效开发配置会明确报错，避免悄悄连到另一环境。
- 真机的 localhost 是手机自己；本地后端应使用手机可达的局域网地址或测试 HTTPS 域名，并按实际环境处理监听地址、防火墙及微信域名限制。
- 不应把线上域名配置成开发写入目标来“凑同步”；先确认测试数据隔离。

恢复默认：

```javascript
wx.removeStorageSync('ruihe_dev_api_origin')
```

再次完整启动生效。

## 营业时间与正式内容

接口输出优先级保持为：

1. `contact_hours`；
2. 旧 `contact_info.hours`；
3. 旧 `contact_info.business_hours`；
4. 空字符串。

输出的 `hours` 与 `business_hours` 都取这个结果。显式配置的空字符串不会被旧值偷偷覆盖。**这解决的是协议别名冲突，不代表哪一套时段获得了客户确认，也不更改数据库。**

仍需客户提供完整《小程序文字信息》，逐字段核对客服、地址、营业时间、关于我们、加盟和轮播；取得签认后再通过管理端更新正式配置。

## 微信订阅消息待办

1. 在微信公众平台确认小程序主体、服务类目和可用模板，取得真实模板 ID。不要填测试字符串或编造模板。
2. 按 `backend/.env.example` 中的 `WECHAT_TEMPLATE_*` 项配置需要启用的通知。已有配置示例包含这些字段，本轮没有改动真实 `.env`。
3. 对照 `backend/src/utils/notification.js` 的对应事件，核对模板字段名称与类型，如 thing/name/time；仅 ID 正确但字段不匹配仍会发送失败。
4. 师傅需完成微信绑定并主动授权，客户需在有效用户操作中授权；订阅拒绝、模板未配时保留站内消息降级，不声称微信已经通知。
5. 配置部署生效后检查公开配置的模板键，再进入预约页/师傅个人页，待预加载完成后点击授权并执行真实业务事件验证。若用户在配置返回前立即点击，当前会安全降级而不会伪造授权成功，需要待加载后重试。
6. 分别记录客户端授权结果、服务端发送结果和真机实收证据。
7. 模板如何开通及费用应按当前微信主体/类目政策与使用的第三方服务确认，本轮未核验收费政策，不作“无额外费用”的承诺。

## 体验版与交付待办

1. 选择可用隔离测试数据库验证取号、通知持久化、附件上传/重试、客户与师傅完整流程。
2. 在微信开发者工具编译当前修复工作区，核对编译后包体积；真机重点验证登录切换、慢网首页、地图、拨号、现场图片和长价格布局。
3. 配置正式请求/下载/上传域名和所需隐私接口，验证模板授权。
4. 上传并记录版本号、构建标识和本次实际提交；在微信后台生成体验二维码并配置体验成员。
5. 提供客户/师傅双角色真机记录及客户逐项签认后，再决定发布。

**本轮完成的是代码修复与自动化验证。仍需提供：客户正式文案、实际测试环境选择、微信模板及平台权限、体验版与真机验收。**
