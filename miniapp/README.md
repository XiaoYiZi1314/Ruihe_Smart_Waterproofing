# 瑞和防水小程序

## 项目简介

瑞和防水小程序是一个专业的防水服务平台，为客户提供各类防水施工服务。

## 功能特性

### 第一阶段（当前版本）
- ✅ 微信授权登录
- ✅ 首页展示（轮播图、服务项目）
- ✅ 联系方式展示
- ✅ 关于我们
- ✅ 加盟信息

### 后续规划
- 🔲 服务详情页
- 🔲 在线预约
- 🔲 订单管理
- 🔲 师傅管理
- 🔲 消息通知

## 技术栈

- **框架**: 微信原生小程序
- **开发工具**: 微信开发者工具
- **后端**: Node.js + Express

## 开发环境配置

### 1. 安装微信开发者工具

下载地址：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

### 2. 导入项目

1. 打开微信开发者工具
2. 选择"导入项目"
3. 选择 `miniapp` 目录
4. 填入 AppID（在 `project.config.json` 中配置）

### 3. 配置后端地址

修改 `app.js` 中的 `apiBaseUrl`：

```javascript
globalData: {
  userInfo: null,
  apiBaseUrl: 'https://api.yourdomain.com' // 修改为实际的后端地址
}
```

开发环境可以在微信开发者工具中勾选"不校验合法域名"。

## 项目结构

```
miniapp/
├── pages/
│   ├── login/              # 登录页
│   │   ├── login.js
│   │   ├── login.json
│   │   ├── login.wxml
│   │   └── login.wxss
│   └── index/              # 首页
│       ├── index.js
│       ├── index.json
│       ├── index.wxml
│       └── index.wxss
├── utils/
│   ├── request.js          # HTTP请求封装
│   └── auth.js             # 登录相关工具
├── app.js                  # 应用入口
├── app.json                # 全局配置
├── app.wxss                # 全局样式
├── project.config.json     # 项目配置
└── sitemap.json            # 索引配置
```

## 页面说明

### 登录页 (pages/login)

- 微信授权登录
- 获取用户昵称和头像
- 调用后端登录接口
- 保存 token 到本地存储

### 首页 (pages/index)

- 轮播图展示
- 服务项目网格展示
- 联系方式（地址、电话、微信）
- 关于我们
- 加盟信息

## API 接口

### 登录接口

```javascript
POST /api/auth/login
Content-Type: application/json

{
  "code": "081xYb0w3oJlWJ2cTH2w38hNLM2xYb0T",
  "nickname": "微信用户",
  "avatar_url": "https://..."
}
```

### 获取用户信息

```javascript
GET /api/auth/me
Authorization: Bearer <token>
```

## 调试说明

### 开启调试模式

在微信开发者工具中：
1. 点击右上角"详情"
2. 勾选"不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书"

### 真机调试

1. 点击工具栏"预览"或"真机调试"
2. 扫描二维码
3. 在手机上查看效果

## 按需注入后的编译与白屏排查

- `app.json` 保持 `lazyCodeLoading: requiredComponents`，组件依赖在页面/父组件 JSON 中声明。
- 公共与本机配置的 `setting.compileHotReLoad` 均保持 `false`；本机
  `project.private.config.json` 会覆盖公共配置，不能只核对 `project.config.json`。
- 修改注入模式或组件依赖后，清除**编译缓存**并完整编译，不只依赖保存后的热更新。
  不需要清除登录信息、Storage 或全部缓存。
- 白屏时先查看 Console 的第一条异常；若完整编译后恢复，只能说明编译/运行状态相关，
  不能在没有复现证据的情况下认定为某个业务接口或组件实现错误。
- 上传前运行 `node --test miniapp/scripts/test-*.js`，还必须在工具内预览并真机验证。
  Node 测试和组件依赖扫描不能代替微信渲染器验证。
- 图片/音频合计预算为 200,000 bytes；本地配置、封面压缩与组件声明修改不需要部署后端。

## 发布流程

### 1. 上传代码

1. 点击工具栏"上传"
2. 填写版本号（如：1.0.0）
3. 填写项目备注

### 2. 提交审核

1. 登录微信公众平台
2. 开发管理 -> 版本管理
3. 选择开发版本，提交审核

### 3. 发布上线

审核通过后，点击"发布"即可上线。

## 配置清单

### 微信公众平台配置

1. **服务器域名配置**
   - request合法域名：`https://api.yourdomain.com`
   - uploadFile合法域名：`https://api.yourdomain.com`
   - downloadFile合法域名：`https://api.yourdomain.com`

2. **业务域名配置**（可选）
   - 如需在小程序内打开网页

### project.config.json 配置

```json
{
  "appid": "your_appid_here",  // 修改为实际的 AppID
  "projectname": "waterproof-miniapp"
}
```

## 常见问题

### 1. 登录失败

**现象**：点击登录按钮后提示登录失败

**排查**：
- 检查后端服务是否启动
- 检查 `app.js` 中的 `apiBaseUrl` 是否正确
- 开发环境勾选"不校验合法域名"
- 查看控制台错误信息

### 2. 图片不显示

**现象**：轮播图或服务图片不显示

**说明**：当前使用的是占位图片（picsum.photos），需要替换为实际图片 URL。

**解决**：
- 上传图片到云存储或服务器
- 修改 `pages/index/index.js` 中的图片 URL

### 3. 无法跳转页面

**现象**：点击服务项目无反应

**说明**：服务详情页尚未开发，点击会提示"功能开发中"。

## 开发规范

### 命名规范

- 页面文件：小写字母，单词间用中划线分隔（如：`service-detail`）
- JS 变量：小驼峰命名法（如：`userName`）
- CSS 类名：小写字母，单词间用中划线分隔（如：`service-card`）

### 代码风格

- 使用 2 空格缩进
- 使用单引号
- 每行代码不超过 100 字符

## 联系方式

如有问题，请联系开发团队。

## License

ISC
