# 阶段五验收差异审查

日期：2026-09-21｜对象：瑞和智慧防水预约管理系统｜方式：code-review 双轴审查

## 结论

**已有较完整的修复实现，但目前不能认定客户反馈全部闭环，也不建议直接签署“全部验收通过”。**

按客户反馈正文和 19 张内嵌截图拆为 19 个核验项：**13 项已有对应代码实现，5 项部分满足或交付证据不足，1 项正式文案尚未完成核对。** 这里的“已有实现”不等于真机或客户验收通过；不据此计算整个项目的完成百分比。

本轮已有测试全部通过，但新增隔离探测复现了两处问题：旧登录校验误清新会话、首页旧请求覆盖新数据。公开线上配置仍未提供微信订阅模板，并存在新旧营业时间字段不一致。

## 审查范围与方法

- 用户明确选择“当前完整工作区”，包括已提交、未提交及新增文件。基线标识为当前 `HEAD cdc207a`，不是仅审查该提交，也没有把未提交内容遗漏掉。
- 项目根目录：`D:/Project/Ruihe_Smart_Waterproofing`。
- 技能来源：用户指定的 `C:/Users/lz200/.agents/skills/code-review/SKILL.md`。
- 需求来源：`C:/Users/lz200/Desktop/阶段五功能验收反馈.docx`，文档署期 2026-09-13。正文与全部 19 张内嵌截图均已读取。下文 P 编号是 `word/document.xml` 中按顺序计数的段落号，不是 Word 页码。
- 规范依据：`AGENTS.md`、`CONTEXT.md`、`CLAUDE.md`、`docs/agents/issue-tracker.md`，并采用技能的代码异味基线。
- 技能适配：经用户确认由固定提交差异审查改为完整工作区核验；当前工具无子代理能力，因此分别执行两个维度、分别报告，没有声称运行了独立并行子代理。工具已能确定的位置采用精确读取，不以空 LSP 结果推断缺失。
- 旧记录 `docs/ACCEPTANCE-FIX-DEPLOYMENT-2026-09-15.md` 仅作线索，不作为本轮验证的替代。
- 本轮未修改业务代码、未执行数据库迁移/种子、未写入生产业务数据、未发布小程序。仅新增本报告。构建产物写入系统临时目录，未覆盖已跟踪的 `admin/dist`。

## Standards

### STD-01｜中｜页面仍绕过设计令牌定义品牌视觉（明确规范偏离）

`AGENTS.md:100-116` 要求复用组件和令牌，禁止页面 WXSS 复制品牌色等通用视觉定义。`miniapp/pages/profile/index.wxss:1-5` 仍直接定义 `linear-gradient(135deg, #1A5CFF, #2B7BE4 60%, #5B9AF5)`；`miniapp/pages/profile/index.js:44-75` 也重复写入多组品牌渐变。建议移入现有令牌或公共主题能力，页面只保留布局。此项来自完整工作区，不声称是本次未提交修改新引入。

### STD-02｜低｜possible Duplicated Code：重复时间格式化（判断性异味）

`miniapp/pages/orders/detail.js:5-11` 与 `miniapp/utils/theme.js:59-64` 重复日期解析、无效值回退、补零和格式拼接，而该详情页已导入 `theme`。建议复用 `theme.formatTime`。这是技能基线中的重复代码判断，不冒充项目明文禁止条款，也不等同功能缺陷。

**本轴合计 2 项：1 项明确规范偏离、1 项判断性异味；本轴最高影响为 STD-01 的设计令牌绕过。**

## Spec

### SPEC-01｜高｜旧凭据异步校验可能清掉新登录（已复现）

需求：P16“退出登录点击之后无反应，不知道怎么切换师傅角色”；P27/A05-A06 要求师傅登录及登录状态正确。

`miniapp/pages/login/login.js:18-19` 等待 `app.sessionReady`，但 `miniapp/app.js:2-10,22-50` 未定义该 Promise。旧 `/api/auth/me` 请求晚返回 401 或失败时直接删除当前 storage，不校验 token 是否已经换新。隔离探测执行“旧 token 发请求→保存新师傅 token→旧请求返回 401”，新 token 确被删除。建议建立可等待的启动校验，并按请求时 token/会话版本有条件更新或清理。

### SPEC-02｜中｜首页刷新仍有响应乱序覆盖（已复现）

需求：P8“小程序和管理端的数据不同步，刷新之后显示空白”。`miniapp/pages/index/index.js:38-78` 没有请求版本保护。两次 `loadData()` 中新请求先返回、旧请求后返回时，旧服务数据覆盖新数据，已用延迟 Promise 复现。服务列表和工单列表已有 requestId 保护，首页也需采用同等保护。

### SPEC-03｜中｜本地两端的数据源未统一（配置风险，非已证实历史根因）

同 P8。`miniapp/app.js:55` 固定线上域名；`admin/vite.config.js:10-14` 把开发请求转到本机 3000 端口。若本机后端使用不同数据库，两端本就不会同步。须明确验收环境及数据库，不应仅修刷新逻辑。客户截图中的管理端在线上，本条不能据此断言就是截图当时的根因。

### SPEC-04｜高｜正式内容没有完成可追溯核对（内容缺口）

P34 要求联系方式、地址、营业时间、关于我们、加盟及轮播与《小程序文字信息》一致。原文未在本次提供材料及限定目录查找中找到，不能声称已逐字一致。线上公开配置还同时返回 `hours=周一至周日 8:00-18:00` 与 `business_hours=周一至周日 8:00-20:00`。应补齐客户原文，统一字段与正式数据并签认。

### SPEC-05｜中｜微信通知配置及说明未闭环（线上配置证据）

P6/image1 询问模板如何配置及是否额外收费。2026-09-21 公开 `/api/config` 的 `subscription_templates` 为空；`miniapp/utils/notifications.js:9-13` 无模板直接跳过订阅；`backend/src/utils/notification.js:54-55` 无模板不发送微信通知。站内消息不是微信服务通知。需补模板、授权与实收验证，并说明适用条件及可能涉及的第三方费用；本轮未核验收费政策，不做免费承诺。

### SPEC-06｜高｜源码修复不等于体验版交付（交付证据缺口）

P31-P33 要求解决真机/上传报错并生成体验二维码。源码包已降至 492.1 KiB；但旧部署记录 `docs/ACCEPTANCE-FIX-DEPLOYMENT-2026-09-15.md:72` 明确当时小程序未发布，本轮未取得更晚的上传成功、体验二维码或真机验收记录。不能断言今天仍未发布，也不能认定已交付。需补开发者工具上传、版本号/构建标识、体验二维码及客户/师傅双角色真机结果。

**本轴合计 6 项：其中 2 项隔离复现、1 项配置风险、3 项内容或交付缺口；本轴最紧迫的已复现问题为 SPEC-01，会导致新会话被清理。**

## 客户要求逐项对照

状态口径：“已有实现”仅表示找到完整的对应代码路径；“部分”表示存在已知差异、缺项或交付证据不足；“待核对”表示缺少完整需求原文，不能完成精确比较。

| # | 客户要求与出处 | 状态 | 当前证据与剩余验收 |
|---|---|---|---|
| 1 | 数据同步、刷新空白；P8-P10 | 部分 | 服务列表 `miniapp/pages/services/list.js:25-32,53-92` 会重拉分类并保护乱序；仍有 SPEC-02 首页乱序及 SPEC-03 环境风险。管理端增改后须对同一服务 ID 联调。 |
| 2 | 看板待处理数变为 10000；P11-P12 | 已有实现 | `backend/src/controllers/adminController.js:375-376` 数字归一化；`admin/src/views/Dashboard.vue:177-185` 显式 Number 相加；字符串聚合回归通过。待处理口径为五类未结束状态之和，不仅 pending。 |
| 3 | 服务名称显示在头图左下；P14-P15 | 已有实现 | `miniapp/pages/services/detail.wxml:29` 标题；同目录 `detail.wxss:24-35` 左下定位及渐变。仍需真机核对长名称。 |
| 4 | 退出登录无反应；P16-P17 | 已有实现 | `miniapp/utils/auth.js:56-73` 导出 clearAuth，清 storage/globalData；`miniapp/pages/profile/index.js:153-165` 调用。退出回归通过；会话竞态另列第 5 项。 |
| 5 | 切换师傅及基础登录状态；P16、P27/A05-A06 | 部分 | `miniapp/pages/profile/index.js:142-150` 进入 worker 模式，`miniapp/pages/login/login.js:15-39,53-84` 支持。SPEC-01 仍会误清新凭据；师傅端全流程尚未真机验证。 |
| 6 | 联系师傅无反应；P18-P19 | 已有实现 | `backend/src/models/WorkOrder.js:99-108` JOIN 师傅电话；`miniapp/pages/orders/list.js:99-105` 与详情 `detail.js:127-130` 拨号并兜底。字段回归通过；实际呼叫待真机。 |
| 7 | 预约按钮缩小、价格尽量两行、两侧约各半；P21/image8 | 已有实现 | `rh-service-card.wxss:61-74` 价格伸缩及单位另起一行；`rh-button.wxss:1-7` 按钮同等 grow。与截图要求方向一致；长价格、按钮 padding 对实际宽度的影响仍待真机验证。不能把客户“约各半”的要求误读成“不要各半”。 |
| 8 | 工单卡按钮超出；P22/image10 | 已有实现 | `miniapp/components/rh-button/rh-button.js:2-5` virtualHost；同组件 WXSS `1-16` 设置 min-width、max-width、flex、box-sizing。未用 Node 测试替代微信排版验证。 |
| 9 | 个人中心按钮分行，站内消息做宽；P22/image11 | 已有实现 | `miniapp/pages/profile/index.wxml:39-42` 三个 block 按钮；`index.wxss:58-65` 纵向布局及宽度。切换身份是新增第三行，需客户确认。 |
| 10 | 地址表单文字裁剪；P23/image12 | 已有实现 | `miniapp/app.wxss:52-71` 统一输入高度、内边距、盒模型；仍需 iOS/Android 输入态和字体缩放验证。 |
| 11 | RH+年月日+五位流水；P20 正文、P21/image9 | 已有实现 | `backend/src/utils/orderNumber.js:1-15` 中国时区、锁内日流水、五位补零和溢出拒绝；`WorkOrder.js:43-78` 在事务内调用。2 项相关测试通过；真实数据库并发未测试。按正文五位要求，而非截图中的旧三位示意。历史编号不重写。 |
| 12 | 地址增加地图选点；P23/image12 | 已有实现 | `miniapp/pages/address/edit.js:65-83` chooseLocation、手填回退和门牌号提示；`miniapp/app.json:78-85` 权限说明及私有信息声明。微信平台权限审批/授权待验。 |
| 13 | 现场图片刷新或重进仍不显示；P23/image13 | 已有实现 | `WorkOrder.js:181-196` 查询并呈现附件；`backend/src/utils/attachments.js:8-12,28-30` 签名；`miniapp/utils/resources.js:2-14` URL 归一化；详情 `detail.js:108-120` 重试及预览。未验证真实附件、域名、签名过期重载，不能判定历史图片已修复。 |
| 14 | 加盟品牌/公司分列、内容修改；P24-P25/image14 | 部分 | `miniapp/pages/index/index.wxml:97-109` 左右分栏；`backend/data/confirmed-join-info.json:2-4` 品牌与热线；公开接口已返回对应内容。完整《小程序文字信息》缺失，布局仍待真机对照。 |
| 15 | 错误密码误报登录过期；P26-P28/image16 | 已有实现 | `admin/src/api/index.js:27-33` 登录接口豁免 401 跳转并显示接口错误；专项回归通过。 |
| 16 | 后台显示催单；P29-P30 | 已有实现 | `backend/src/utils/notification.js:404-449` 管理员持久化和实时推送，未指派也通知；`admin/src/composables/useRealtimeNotify.js:46-49,111-129` 历史及已读；`admin/src/views/Orders.vue:74,160` 次数显示。模拟持久化回归通过，真实 WebSocket/数据库链路待验。 |
| 17 | 包超限、上传和体验二维码；P31-P33 | 部分 | `miniapp/project.config.json:3-10` 打包排除；本轮源码包 503,936 bytes。编译包体积、成功上传、二维码、体验成员权限没有本轮证据，见 SPEC-06。 |
| 18 | 客服/地址/营业时间/关于我们/轮播正式文案；P34 | 待核对 | 配置能力存在，但完整客户原文未取得；公开 hours 与 business_hours 不一致，见 SPEC-04。不能把可配置等同已配置正确。 |
| 19 | 模板如何配置、是否收费；P6/image1 | 部分 | 存在订阅接口和站内降级，但公开模板为空，客户操作答疑未闭环，见 SPEC-05。 |

计数：已有实现 13，部分 5，待核对 1。P27/A01“HTTPS 正常”等原已勾通过项作为背景记录；本轮只复查公开健康接口，不把历史勾选当作当前管理员登录验证。

## 本轮实际验证

### 已执行

| 检查 | 结果 | 能证明什么 / 不能证明什么 |
|---|---|---|
| `node --test backend/test/orderNumber.test.js backend/test/review.test.js miniapp/scripts/test-acceptance.js miniapp/scripts/test-package-size.js` | 23/23 通过 | 主要是单元或模拟依赖测试，不是 MySQL、微信或完整端到端验收。 |
| `node miniapp/scripts/test-page-contracts.js` | 15 页事件契约及资源 URL 检查通过 | 检查事件方法和资源转换；不验证 UI 布局及接口真实可达。 |
| 源码包体积 | 503,936 bytes / 492.1 KiB | 低于脚本的 1.8 MiB 阈值；不是微信上传编译产物测量。 |
| 管理端 Vite 生产构建 | 退出码 0，2316 modules transformed | 临时目录构建成功；仍有超过 500 kB chunk 的工具警告，不重复列为 Standards 人工发现。 |
| `get_diagnostics` errors/warnings | 返回 0 | 仅当前活跃语言服务反馈，不意味着全仓无缺陷。 |
| 旧 token 校验竞态 VM 探测 | 复现缺陷 | 新会话写入后，旧请求 401 清掉新 token；无真实账号或网络写入。 |
| 首页乱序 VM 探测 | 复现缺陷 | 新结果先到、旧结果后到，最终页面为旧数据。 |
| 公开 `/health` 与 `/api/config` | 均 HTTP 200 | 2026-09-21 只读探测；健康状态不能证明数据库业务或权限流程正确。 |

管理端构建在 `admin` 下调用已有 Vite CLI，通过 `--outDir` 写系统临时目录，未安装依赖，也未覆盖 `admin/dist`。

### 公开配置快照摘要

2026-09-21 通过配置接口只读取得：

- 客服：`400-888-6688`。
- 地址：`深圳市南山区科技园瑞和大厦8楼`。
- `contact_info.hours`：`周一至周日 8:00-18:00`。
- `contact_info.business_hours`：`周一至周日 8:00-20:00`。
- 加盟品牌/公司：漳州市瑞和建设工程有限公司、科顺、东方雨虹；加盟热线 `13306944888`。
- `subscription_templates`：`{}`。

上述是“当前返回值”，不是经客户签认的正确文案。两套时间的来源可见 `backend/src/models/SiteConfig.js:92-101`：先保留旧 contact_info，再追加新 hours，旧 business_hours 未归一。

### 新复现的最小操作步骤

**登录竞态：**

1. 用 `vm.runInNewContext` 装载 `miniapp/app.js`，Mock `App`、`wx.request` 和 storage。
2. storage 放旧 token，调用 `app.onLaunch()`，暂不回调 `wx.request`。
3. 模拟登录成功，把新师傅 token 和 userInfo 写入 storage。
4. 回调旧请求 `success({statusCode:401,data:{success:false}})`。
5. 断言新 token 被删除，同时 `app.sessionReady === undefined`。本轮两者均成立。

**首页乱序：**

1. 装载 `miniapp/pages/index/index.js`，Mock `api.getServices` 为可延迟完成的 Promise；其余三个读取接口立即成功。
2. 连续调用两次 `loadData()`。
3. 第二次返回 fresh 服务列表并完成；再让第一次返回 stale 列表。
4. 断言最终 `page.data.services[0].name === 'stale'`。本轮成立。

这些脚本仅使用 Node VM、文件读取和内存 Mock，未新增测试文件到业务目录，未接触真实业务数据库。

### 尚未验证

- MySQL 上的真实并发取号、通知落库与恢复、事务/迁移兼容性。`backend/scripts/test-acceptance-isolated.js:20-28` 会建隔离库，本轮未执行；旧记录提示本地配置涉及生产，因此未盲目跑数据库脚本。
- 微信登录授权、地图权限、订阅授权、实际服务通知接收、拨号与 iOS/Android 页面排版。
- 登录后的管理端与小程序端同一订单完整流程，包括师傅登录、接单、拒单、施工、完工、价格异议、验收和评价。
- 附件真实上传、历史现场图片、过期签名重试、下载域名配置。
- 当前已发布版本是否包含本地工作区这些未提交更改。本轮未取得微信后台版本记录。
- 《小程序文字信息》完整原文。限定查找范围为桌面及其下一层、仓库 docs/temp 的浅层文件名，并非整机穷举，不能据此宣称该文档在电脑上不存在。

## 下一步建议

### 功能与交付闭环

1. 修复 SPEC-01、SPEC-02，并把两条已复现序列加入自动化回归。
2. 明确本地/测试/线上域名与数据库对应关系，固定同一验收版本；保护现有未提交修改，不用 reset/clean 清场。
3. 按 P21 截图验证预约按钮更小、两侧约各半、价格尽量两行的效果，以 320/375/414 宽度及真机长价格场景留图，不通过再调整组件变体。
4. 取得客户《小程序文字信息》原文件；将每个字段与当前数据库值对照签认，统一营业时间别名和最终文案。
5. 配置客户适用的微信订阅模板，记录模板 ID、字段映射、授权步骤及实际收到通知的证据；与站内通知分别验收。
6. 在安全隔离数据库进行订单、附件和通知集成验证，再上传指定小程序版本，提供体验二维码、版本标识和双角色真机验收记录。
7. 由客户逐项确认本报告的 19 个核验项，不以“构建通过”或“测试全绿”替代签认。

### 规范改进

独立处理 STD-01 品牌令牌和 STD-02 时间格式化重复，避免以规范整洁掩盖功能未闭环，或以功能可用掩盖规范偏离。

**最终双轴摘要：Standards 2 项，主要问题是页面绕过品牌令牌；Spec 6 项，最紧迫的已复现问题是新登录会话被旧校验清除。完成的是本轮审查，不是对整个项目验收通过的确认。**
