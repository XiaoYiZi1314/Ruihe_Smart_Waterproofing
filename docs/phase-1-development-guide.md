# 第一阶段开发方案：基础搭建

## 概述

**阶段目标**：搭建项目基础框架，完成开发环境配置，实现微信登录功能，展示假数据的小程序首页。

**验收标准**：
- ✅ 能打开小程序
- ✅ 看到登录页面
- ✅ 能成功登录
- ✅ 看到包含假数据的首页框架

**里程碑**：项目基础框架搭建完成，可跑通登录流程

**工期**：不限（根据实际进度调整）

---

## 一、前置准备清单

### 1.1 已准备完毕
- ✅ 微信小程序已注册并完成个体工商户认证
- ✅ 云服务器已准备完毕
- ✅ 域名已准备完毕

### 1.2 需要提供的信息

#### 微信小程序信息
- [ ] AppID（微信小程序后台获取）
- [ ] AppSecret（微信小程序后台获取）
- [ ] 已配置的服务器域名（用于小程序API请求）

#### 服务器信息
- [ ] 服务器IP地址
- [ ] SSH登录账号和密码/密钥
- [ ] 操作系统版本（如：Ubuntu 22.04）
- [ ] 已开放的端口（建议：80、443、3306、6379等）

#### 域名信息
- [ ] 域名名称（如：api.example.com）
- [ ] 域名是否已备案
- [ ] DNS是否已指向服务器IP

#### 数据库选择
- [ ] 使用云服务器自建数据库（MySQL/PostgreSQL）
- [ ] 还是使用云厂商的数据库服务（如阿里云RDS）

---

## 二、技术栈选型

### 2.1 小程序端
- **框架**：微信原生小程序
- **开发工具**：微信开发者工具
- **兼容性**：支持所有微信版本

### 2.2 后端服务
- **语言**：Node.js（推荐）/ Java / Python（根据团队技术栈选择）
- **框架**：
  - Node.js: Express / Koa / Egg.js
  - Java: Spring Boot
  - Python: FastAPI / Django
- **数据库**：MySQL 8.0+（推荐）/ PostgreSQL
- **缓存**：Redis（可选，用于session管理和消息队列）

### 2.3 管理后台
- **框架**：Vue 3 + Element Plus（推荐）/ React + Ant Design
- **构建工具**：Vite
- **访问方式**：浏览器访问，无需安装

### 2.4 文件存储
- **方案一**：腾讯云COS（推荐，小程序原生集成方便）
- **方案二**：阿里云OSS
- **方案三**：服务器本地存储（不推荐，扩展性差）

### 2.5 部署方案
- **反向代理**：Nginx
- **HTTPS证书**：Let's Encrypt（免费）/ 云厂商SSL证书
- **进程管理**：PM2（Node.js）/ Systemd

---

## 三、第一阶段开发任务清单

### 3.1 服务器环境搭建

#### 3.1.1 基础环境安装
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装必要工具
sudo apt install -y git curl wget vim

# 安装Nginx
sudo apt install -y nginx

# 安装Node.js（如选用Node.js）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 安装MySQL
sudo apt install -y mysql-server
sudo mysql_secure_installation

# 安装Redis（可选）
sudo apt install -y redis-server
```

#### 3.1.2 创建数据库
```sql
CREATE DATABASE waterproof_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'waterproof_user'@'localhost' IDENTIFIED BY 'strong_password_here';

GRANT ALL PRIVILEGES ON waterproof_system.* TO 'waterproof_user'@'localhost';

FLUSH PRIVILEGES;
```

#### 3.1.3 配置Nginx
```nginx
# /etc/nginx/sites-available/waterproof-api
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# 管理后台
server {
    listen 80;
    server_name admin.yourdomain.com;

    root /var/www/waterproof-admin/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 3.2 数据库设计（第一阶段简化版）

第一阶段只需创建用户表，用于实现登录功能。

#### 3.2.1 用户表（users）
```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    openid VARCHAR(100) UNIQUE NOT NULL COMMENT '微信openid',
    union_id VARCHAR(100) COMMENT '微信unionid',
    nickname VARCHAR(100) COMMENT '昵称',
    avatar_url VARCHAR(500) COMMENT '头像URL',
    phone VARCHAR(20) COMMENT '手机号',
    role ENUM('customer', 'worker', 'admin') DEFAULT 'customer' COMMENT '角色：客户/师傅/管理员',
    status ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_openid (openid),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
```

**说明**：
- 第一阶段不包含角色识别，所以 `role` 字段暂时不使用
- 后续阶段会扩展此表或创建独立的 `workers`（师傅）和 `admins`（管理员）表

### 3.3 后端API开发

#### 3.3.1 项目结构（以Node.js + Express为例）
```
waterproof-backend/
├── src/
│   ├── config/           # 配置文件
│   │   ├── database.js
│   │   └── wechat.js
│   ├── controllers/      # 控制器
│   │   └── authController.js
│   ├── middlewares/      # 中间件
│   │   └── auth.js
│   ├── models/           # 数据模型
│   │   └── User.js
│   ├── routes/           # 路由
│   │   └── auth.js
│   ├── utils/            # 工具函数
│   │   └── jwt.js
│   └── app.js            # 主应用
├── package.json
└── .env                  # 环境变量
```

#### 3.3.2 核心API接口

**1. 微信登录接口**

```javascript
// POST /api/auth/login
// 功能：通过微信code获取openid，创建或更新用户，返回JWT token

Request:
{
  "code": "081xYb0w3oJlWJ2cTH2w38hNLM2xYb0T"
}

Response:
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "nickname": "微信用户",
      "avatar_url": "https://...",
      "role": "customer"
    }
  }
}
```

**实现逻辑**：
1. 接收小程序传来的 `code`
2. 调用微信API `https://api.weixin.qq.com/sns/jscode2session` 获取 `openid`
3. 查询数据库是否存在该 `openid`
   - 存在：更新 `updated_at`
   - 不存在：创建新用户
4. 生成JWT token
5. 返回token和用户信息

**2. 获取用户信息接口**

```javascript
// GET /api/auth/me
// 功能：通过token获取当前用户信息
// Headers: Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "nickname": "微信用户",
    "avatar_url": "https://...",
    "role": "customer",
    "phone": "13800138000"
  }
}
```

#### 3.3.3 环境变量配置（.env）
```env
# 服务器配置
PORT=3000
NODE_ENV=development

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=waterproof_system
DB_USER=waterproof_user
DB_PASSWORD=strong_password_here

# 微信小程序配置
WECHAT_APPID=your_appid_here
WECHAT_SECRET=your_secret_here

# JWT配置
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Redis配置（可选）
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3.4 小程序端开发

#### 3.4.1 项目结构
```
waterproof-miniapp/
├── pages/
│   ├── index/              # 首页
│   │   ├── index.js
│   │   ├── index.json
│   │   ├── index.wxml
│   │   └── index.wxss
│   └── login/              # 登录页
│       ├── login.js
│       ├── login.json
│       ├── login.wxml
│       └── login.wxss
├── utils/
│   ├── request.js          # 封装的HTTP请求
│   └── auth.js             # 登录相关工具
├── app.js
├── app.json
├── app.wxss
└── project.config.json
```

#### 3.4.2 核心功能实现

**1. 登录页面（pages/login/login.js）**

```javascript
Page({
  onGetUserProfile() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        this.login(res.userInfo);
      }
    });
  },

  login(userInfo) {
    wx.login({
      success: (res) => {
        if (res.code) {
          wx.request({
            url: 'https://api.yourdomain.com/api/auth/login',
            method: 'POST',
            data: {
              code: res.code,
              nickname: userInfo.nickName,
              avatar_url: userInfo.avatarUrl
            },
            success: (response) => {
              if (response.data.success) {
                wx.setStorageSync('token', response.data.data.token);
                wx.setStorageSync('userInfo', response.data.data.user);
                wx.switchTab({
                  url: '/pages/index/index'
                });
              }
            }
          });
        }
      }
    });
  }
});
```

**2. 首页（pages/index/index.js） - 假数据展示**

```javascript
Page({
  data: {
    banners: [
      { id: 1, image: '/images/banner1.jpg', link: '' },
      { id: 2, image: '/images/banner2.jpg', link: '' }
    ],
    services: [
      { id: 1, name: '屋顶防水', price: '500-1000', image: '/images/service1.jpg' },
      { id: 2, name: '卫生间防水', price: '300-800', image: '/images/service2.jpg' },
      { id: 3, name: '阳台防水', price: '200-600', image: '/images/service3.jpg' },
      { id: 4, name: '外墙防水', price: '800-2000', image: '/images/service4.jpg' }
    ],
    contact: {
      address: '北京市朝阳区某某街道123号',
      phone: '400-123-4567',
      hours: '周一至周日 8:00-18:00'
    },
    aboutUs: '瑞和防水是一家专业从事防水施工的企业，拥有10年以上行业经验...',
    joinInfo: {
      description: '诚邀全国各地优质防水施工团队加盟',
      phone: '400-123-4567'
    }
  },

  onLoad() {
    // 检查登录状态
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }
  },

  onBannerTap(e) {
    const link = e.currentTarget.dataset.link;
    if (link) {
      wx.navigateTo({ url: link });
    }
  },

  onServiceTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({
      title: '服务详情页开发中',
      icon: 'none'
    });
  },

  onCallPhone() {
    wx.makePhoneCall({
      phoneNumber: this.data.contact.phone
    });
  }
});
```

**3. 首页布局（pages/index/index.wxml）**

```xml
<view class="container">
  <!-- 轮播图 -->
  <swiper class="banner-swiper" indicator-dots autoplay interval="3000">
    <swiper-item wx:for="{{banners}}" wx:key="id" bindtap="onBannerTap" data-link="{{item.link}}">
      <image src="{{item.image}}" mode="aspectFill" />
    </swiper-item>
  </swiper>

  <!-- 热门服务 -->
  <view class="section">
    <view class="section-title">热门服务</view>
    <view class="services-grid">
      <view class="service-item" wx:for="{{services}}" wx:key="id" bindtap="onServiceTap" data-id="{{item.id}}">
        <image class="service-image" src="{{item.image}}" mode="aspectFill" />
        <text class="service-name">{{item.name}}</text>
        <text class="service-price">¥{{item.price}}</text>
      </view>
    </view>
  </view>

  <!-- 联系我们 -->
  <view class="section">
    <view class="section-title">联系我们</view>
    <view class="contact-info">
      <view class="contact-item">
        <text class="contact-label">地址：</text>
        <text>{{contact.address}}</text>
      </view>
      <view class="contact-item">
        <text class="contact-label">电话：</text>
        <text class="contact-phone" bindtap="onCallPhone">{{contact.phone}}</text>
      </view>
      <view class="contact-item">
        <text class="contact-label">营业时间：</text>
        <text>{{contact.hours}}</text>
      </view>
    </view>
  </view>

  <!-- 关于我们 -->
  <view class="section">
    <view class="section-title">关于我们</view>
    <text class="about-text">{{aboutUs}}</text>
  </view>

  <!-- 加盟信息 -->
  <view class="section">
    <view class="section-title">加盟我们</view>
    <view class="join-info">
      <text class="join-desc">{{joinInfo.description}}</text>
      <text class="join-phone">加盟热线：{{joinInfo.phone}}</text>
    </view>
  </view>
</view>
```

#### 3.4.3 app.json配置

```json
{
  "pages": [
    "pages/login/login",
    "pages/index/index"
  ],
  "window": {
    "navigationBarTitleText": "瑞和防水",
    "navigationBarBackgroundColor": "#1890ff",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#f5f5f5"
  },
  "permission": {
    "scope.userLocation": {
      "desc": "你的位置信息将用于为你提供更好的服务"
    }
  },
  "requiredPrivateInfos": [
    "getLocation",
    "chooseAddress"
  ]
}
```

#### 3.4.4 请求封装（utils/request.js）

```javascript
const BASE_URL = 'https://api.yourdomain.com';

function request(options) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    
    wx.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // token过期，跳转登录
          wx.removeStorageSync('token');
          wx.redirectTo({
            url: '/pages/login/login'
          });
          reject(new Error('未授权'));
        } else {
          wx.showToast({
            title: res.data.message || '请求失败',
            icon: 'none'
          });
          reject(res.data);
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
        reject(err);
      }
    });
  });
}

module.exports = {
  get: (url, data) => request({ url, method: 'GET', data }),
  post: (url, data) => request({ url, method: 'POST', data }),
  put: (url, data) => request({ url, method: 'PUT', data }),
  delete: (url, data) => request({ url, method: 'DELETE', data })
};
```

### 3.5 管理后台开发（第一阶段暂不实现）

第一阶段聚焦在小程序端，管理后台留到阶段四开发。但需要预留后端API的设计空间。

---

## 四、测试验证清单

### 4.1 服务器环境测试
- [ ] Nginx正常启动，能访问80端口
- [ ] 数据库连接成功
- [ ] Redis连接成功（如使用）
- [ ] 后端服务正常启动，能响应健康检查接口

### 4.2 微信登录测试
- [ ] 点击登录按钮，弹出授权框
- [ ] 授权后能成功获取用户信息
- [ ] 后端能正确获取openid
- [ ] 数据库正确创建用户记录
- [ ] 返回有效的JWT token
- [ ] token能通过验证

### 4.3 首页展示测试
- [ ] 轮播图正常滚动
- [ ] 服务项目网格正常展示
- [ ] 点击服务项目有反馈（Toast提示）
- [ ] 联系方式正常展示
- [ ] 点击电话能唤起拨号
- [ ] 关于我们和加盟信息正常展示

### 4.4 跨页面测试
- [ ] 登录成功后跳转到首页
- [ ] 未登录时访问首页自动跳转到登录页
- [ ] token过期后自动跳转到登录页

---

## 五、部署上线流程

### 5.1 后端部署
```bash
# 1. 拉取代码
cd /var/www
git clone <your-repo-url> waterproof-backend
cd waterproof-backend

# 2. 安装依赖
npm install --production

# 3. 配置环境变量
cp .env.example .env
vim .env  # 填写实际配置

# 4. 运行数据库迁移
npm run migrate

# 5. 启动服务（使用PM2）
npm install -g pm2
pm2 start src/app.js --name waterproof-api
pm2 save
pm2 startup
```

### 5.2 小程序部署
1. 在微信开发者工具中点击"上传"
2. 填写版本号（如：1.0.0）和项目备注
3. 登录微信公众平台 -> 开发管理 -> 版本管理
4. 将开发版本设置为体验版
5. 测试无误后提交审核
6. 审核通过后发布上线

### 5.3 域名和HTTPS配置
```bash
# 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d api.yourdomain.com

# 自动续期
sudo certbot renew --dry-run
```

### 5.4 微信小程序服务器域名配置
登录微信公众平台 -> 开发管理 -> 开发设置 -> 服务器域名

添加以下域名：
- request合法域名：`https://api.yourdomain.com`
- uploadFile合法域名：`https://api.yourdomain.com`（如果文件上传到自己服务器）
- downloadFile合法域名：`https://api.yourdomain.com`

---

## 六、常见问题处理

### 6.1 微信登录失败
**问题**：调用 `wx.login()` 返回code，但后端获取openid失败

**解决方案**：
1. 检查AppID和AppSecret是否正确
2. 检查服务器能否访问微信API（`https://api.weixin.qq.com`）
3. 检查code是否在5分钟内使用（code有效期5分钟）
4. 检查微信API返回的错误信息

### 6.2 小程序无法请求后端API
**问题**：小程序请求后端API时报"不在合法域名列表中"

**解决方案**：
1. 确保域名已在微信公众平台配置
2. 确保域名使用HTTPS
3. 确保域名已备案
4. 开发阶段可在微信开发者工具中勾选"不校验合法域名"

### 6.3 数据库连接失败
**问题**：后端启动时报数据库连接错误

**解决方案**：
1. 检查MySQL服务是否启动：`sudo systemctl status mysql`
2. 检查数据库用户权限：`SHOW GRANTS FOR 'waterproof_user'@'localhost';`
3. 检查防火墙是否阻止3306端口
4. 检查.env中的数据库配置是否正确

### 6.4 Nginx 502 Bad Gateway
**问题**：访问域名时返回502错误

**解决方案**：
1. 检查后端服务是否启动：`pm2 status`
2. 检查后端端口是否正确：`netstat -tuln | grep 3000`
3. 检查Nginx配置是否正确：`sudo nginx -t`
4. 查看Nginx错误日志：`sudo tail -f /var/log/nginx/error.log`

---

## 七、交付物清单

第一阶段完成后，应交付以下内容：

### 7.1 代码仓库
- [ ] 后端代码仓库（包含README和部署文档）
- [ ] 小程序代码仓库（包含README和开发说明）

### 7.2 部署环境
- [ ] 服务器已部署后端服务，能正常响应
- [ ] 数据库已创建并初始化
- [ ] Nginx已配置并启动
- [ ] HTTPS证书已配置

### 7.3 小程序
- [ ] 小程序已上传到微信平台
- [ ] 设置为体验版，提供体验二维码

### 7.4 文档
- [ ] 服务器环境配置文档
- [ ] API接口文档（Swagger/Postman）
- [ ] 数据库设计文档
- [ ] 小程序页面结构说明

### 7.5 账号信息
- [ ] 服务器SSH账号
- [ ] 数据库账号
- [ ] 微信小程序后台账号（客户提供）
- [ ] 后端管理员账号（第一阶段暂无）

---

## 八、进入第二阶段的前提条件

在进入第二阶段之前，需要确认以下事项：

1. **功能验收**：
   - ✅ 客户能打开小程序并成功登录
   - ✅ 首页假数据正常展示
   - ✅ 所有UI组件样式符合预期

2. **性能验收**：
   - ✅ 小程序加载速度 < 3秒
   - ✅ 登录响应时间 < 2秒
   - ✅ 页面切换流畅无卡顿

3. **稳定性验收**：
   - ✅ 服务器连续运行24小时无异常
   - ✅ 多次登录登出无报错
   - ✅ 后端日志无严重错误

4. **准备第二阶段素材**：
   - [ ] 企业资料（真实的企业简介、联系方式）
   - [ ] 宣传图片（轮播图、服务项目图片）
   - [ ] 员工信息（师傅姓名、电话、微信号）

确认以上所有项目后，即可开始**第二阶段：小程序核心功能开发**。

---

## 九、附录

### 9.1 微信小程序注册流程参考
1. 访问 https://mp.weixin.qq.com/
2. 点击"立即注册" -> 选择"小程序"
3. 填写邮箱和密码
4. 邮箱验证
5. 选择主体类型"企业"
6. 填写企业信息并上传营业执照
7. 管理员微信扫码验证
8. 完成注册，获取AppID

### 9.2 推荐的开发工具
- **后端开发**：Visual Studio Code + Thunder Client插件
- **小程序开发**：微信开发者工具
- **数据库管理**：DBeaver / Navicat
- **API测试**：Postman / Apifox
- **服务器管理**：FinalShell / Xshell

### 9.3 参考资源
- 微信小程序官方文档：https://developers.weixin.qq.com/miniprogram/dev/framework/
- 微信登录接口文档：https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/login/auth.code2Session.html
- Nginx官方文档：https://nginx.org/en/docs/
- PM2文档：https://pm2.keymetrics.io/docs/usage/quick-start/

---

**文档版本**：v1.0  
**最后更新**：2026-08-14  
**维护者**：开发团队
