# 瑞和防水小程序 - 本地测试与生产部署详细指南

## 目录
- [一、本地开发测试](#一本地开发测试)
- [二、生产环境部署](#二生产环境部署)
- [三、常见问题](#三常见问题)

---

## 一、本地开发测试

### 1.1 前置准备

#### 需要安装的软件

1. **Node.js 18+**
   - 下载地址：https://nodejs.org/
   - 安装后验证：
     ```bash
     node -v
     npm -v
     ```

2. **MySQL 8.0+**
   - Windows 下载：https://dev.mysql.com/downloads/mysql/
   - 安装时设置 root 密码（记住这个密码）
   - 验证安装：
     ```bash
     mysql --version
     ```

3. **微信开发者工具**
   - 下载地址：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
   - 安装后登录微信账号

4. **代码编辑器**（可选但推荐）
   - VS Code：https://code.visualstudio.com/

#### 需要准备的信息

- [ ] 微信小程序测试号（或正式 AppID）
- [ ] MySQL root 密码

---

### 1.2 获取微信小程序测试号

如果你还没有正式的小程序 AppID，可以使用测试号：

1. 访问：https://mp.weixin.qq.com/wxamp/sandbox
2. 使用微信扫码登录
3. 获取测试号的 AppID 和 AppSecret

> **注意**：测试号仅供开发测试，正式发布需要注册正式小程序。

---

### 1.3 配置数据库

#### 步骤 1：启动 MySQL 服务

**Windows**:
```bash
# 以管理员身份运行 PowerShell
net start mysql
```

**Mac**:
```bash
mysql.server start
```

**Linux**:
```bash
sudo systemctl start mysql
```

#### 步骤 2：创建数据库和用户

```bash
# 登录 MySQL（输入你安装时设置的 root 密码）
mysql -u root -p
```

在 MySQL 命令行中执行：

```sql
-- 创建数据库
CREATE DATABASE waterproof_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户（密码设置为 waterproof123，你可以改成其他的）
CREATE USER 'waterproof_user'@'localhost' IDENTIFIED BY 'waterproof123';

-- 授权
GRANT ALL PRIVILEGES ON waterproof_system.* TO 'waterproof_user'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;

-- 退出
EXIT;
```

#### 步骤 3：验证数据库

```bash
# 使用新创建的用户登录测试
mysql -u waterproof_user -p waterproof_system
# 输入密码：waterproof123

# 成功登录后退出
EXIT;
```

---

### 1.4 配置后端服务

#### 步骤 1：进入后端目录

```bash
cd D:\PROJECT\Ruihe_Smart_Waterproofing\backend
```

#### 步骤 2：安装依赖

```bash
npm install
```

> 安装时间约 1-3 分钟，请耐心等待。

#### 步骤 3：创建环境变量文件

```bash
# 复制环境变量模板
copy .env.example .env
```

#### 步骤 4：编辑 .env 文件

使用文本编辑器（记事本或 VS Code）打开 `.env` 文件，修改以下内容：

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=waterproof_system
DB_USER=waterproof_user
DB_PASSWORD=waterproof123              # 改成你设置的数据库密码

# 微信小程序配置
WECHAT_APPID=your_appid_here          # 改成你的测试号 AppID
WECHAT_SECRET=your_secret_here        # 改成你的测试号 AppSecret

# JWT配置
JWT_SECRET=dev_secret_key_for_testing  # 本地测试可以不改
JWT_EXPIRES_IN=7d
```

**重要**：必须修改的配置项：
- `DB_PASSWORD`：你的数据库密码
- `WECHAT_APPID`：你的小程序 AppID
- `WECHAT_SECRET`：你的小程序 AppSecret

#### 步骤 5：初始化数据库

```bash
npm run migrate
```

成功输出应该类似：
```
✅ 连接数据库成功
✅ 数据库 waterproof_system 已创建或已存在
✅ 用户表创建成功
🎉 数据库迁移完成！
```

#### 步骤 6：启动后端服务

```bash
npm run dev
```

成功输出应该类似：
```
服务器运行在端口: 3000
✅ 数据库连接成功
```

> **注意**：保持这个终端窗口打开，不要关闭！

#### 步骤 7：测试后端服务

打开浏览器或新开一个终端，访问：

```bash
# 浏览器访问
http://localhost:3000/health

# 或使用 curl
curl http://localhost:3000/health
```

应该看到响应：
```json
{
  "success": true,
  "message": "服务运行正常",
  "timestamp": "2024-08-14T12:00:00.000Z"
}
```

✅ **后端配置完成！**

---

### 1.5 配置小程序

#### 步骤 1：修改项目配置

编辑 `D:\PROJECT\Ruihe_Smart_Waterproofing\miniapp\project.config.json`：

```json
{
  "appid": "your_appid_here",  // 改成你的测试号 AppID
  "projectname": "waterproof-miniapp",
  // ... 其他配置保持不变
}
```

#### 步骤 2：修改后端地址

编辑 `D:\PROJECT\Ruihe_Smart_Waterproofing\miniapp\app.js`：

```javascript
globalData: {
  userInfo: null,
  apiBaseUrl: 'http://localhost:3000'  // 改成本地地址
}
```

#### 步骤 3：导入小程序项目

1. 打开**微信开发者工具**
2. 点击左侧的 **"+"** 或 **"导入项目"**
3. 填写信息：
   - **项目目录**：点击"选择"，选择 `D:\PROJECT\Ruihe_Smart_Waterproofing\miniapp`
   - **AppID**：选择你刚才在 `project.config.json` 中填的 AppID
   - **项目名称**：自动识别为 "waterproof-miniapp"
4. 点击 **"导入"**

#### 步骤 4：开发环境配置

1. 在微信开发者工具中，点击右上角 **"详情"**
2. 在 **"本地设置"** 标签下
3. **勾选**以下选项：
   - ✅ 不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书
   - ✅ 不校验合法域名
4. 点击 **"编译"** 按钮

✅ **小程序配置完成！**

---

### 1.6 测试功能

#### 测试登录功能

1. 在模拟器中，你应该看到**登录页面**
2. 点击 **"微信快捷登录"** 按钮
3. 如果配置正确，应该会：
   - 显示"登录中..."
   - 跳转到首页
   - 显示"登录成功"提示

#### 测试首页功能

登录成功后，应该看到：
- ✅ 轮播图（3张图片自动轮播）
- ✅ 服务项目网格（6个服务卡片）
- ✅ 联系我们信息
- ✅ 关于我们文案
- ✅ 加盟合作信息

尝试点击：
- 📞 电话号码：应该弹出拨号界面
- 💬 微信号：应该复制成功
- 🏠 服务卡片：显示"功能开发中"

#### 测试控制台

打开微信开发者工具的 **"调试器"** -> **"Console"**：
- 查看是否有红色错误信息
- 正常情况应该看到 "瑞和防水小程序启动" 日志

---

### 1.7 常见问题排查

#### 问题 1：后端启动失败

**错误**：`ECONNREFUSED` 或数据库连接失败

**解决**：
```bash
# 1. 检查 MySQL 是否启动
mysql -u waterproof_user -p

# 2. 检查 .env 中的数据库配置是否正确

# 3. 重新运行迁移脚本
npm run migrate
```

#### 问题 2：小程序登录失败

**错误**：点击登录后提示"登录失败"

**排查步骤**：

1. **检查后端是否运行**
   ```bash
   curl http://localhost:3000/health
   ```

2. **检查开发者工具设置**
   - 确认已勾选"不校验合法域名"
   
3. **查看控制台错误**
   - 打开"调试器" -> "Network"
   - 点击登录按钮
   - 查看请求是否发出，响应是什么

4. **检查 AppID 配置**
   - `miniapp/project.config.json` 中的 AppID
   - `backend/.env` 中的 WECHAT_APPID
   - 两者必须一致

5. **查看后端日志**
   - 回到后端服务的终端窗口
   - 查看是否有错误日志

#### 问题 3：图片不显示

**说明**：当前使用的是 picsum.photos 占位图，需要网络访问。

**临时解决**：
- 确保电脑联网
- 如果仍不显示，说明占位图服务访问不了，这不影响功能测试

**永久解决**：
- 后续替换为实际图片 URL

---

### 1.8 本地测试检查清单

完成以下检查后，本地环境配置成功：

- [ ] Node.js 和 npm 已安装
- [ ] MySQL 已安装并启动
- [ ] 数据库 `waterproof_system` 创建成功
- [ ] 后端依赖安装完成 (`npm install`)
- [ ] `.env` 文件配置完成
- [ ] 数据库迁移成功 (`npm run migrate`)
- [ ] 后端服务启动成功 (`npm run dev`)
- [ ] 健康检查接口正常 (`http://localhost:3000/health`)
- [ ] 小程序项目导入成功
- [ ] `project.config.json` 中 AppID 已配置
- [ ] `app.js` 中 apiBaseUrl 改为 `http://localhost:3000`
- [ ] 勾选"不校验合法域名"
- [ ] 小程序编译成功
- [ ] 登录功能正常
- [ ] 首页展示正常

---

## 二、生产环境部署

### 2.1 准备工作

#### 需要准备的资源

1. **云服务器**
   - 推荐：阿里云、腾讯云、华为云
   - 最低配置：1核2G，20GB硬盘
   - 推荐配置：2核4G，40GB硬盘
   - 操作系统：Ubuntu 20.04 LTS 或 22.04 LTS

2. **域名**
   - 需要备案（使用国内服务器）
   - 建议准备：`api.yourdomain.com`

3. **微信小程序账号**
   - 正式的小程序账号（非测试号）
   - 完成微信认证（300元/年）

#### 域名解析

在你的域名服务商（阿里云、腾讯云等）控制台：

1. 添加 A 记录
   - 主机记录：`api`
   - 记录类型：`A`
   - 记录值：你的服务器 IP
   - TTL：`10分钟`

2. 等待 DNS 解析生效（约 10 分钟）
   ```bash
   # 验证解析
   ping api.yourdomain.com
   ```

---

### 2.2 服务器环境配置

#### 步骤 1：连接服务器

**Windows 用户**：
```bash
# 使用 PowerShell 或 PuTTY
ssh root@your_server_ip
```

**Mac/Linux 用户**：
```bash
ssh root@your_server_ip
```

#### 步骤 2：更新系统

```bash
sudo apt update && sudo apt upgrade -y
```

#### 步骤 3：安装基础工具

```bash
sudo apt install -y git curl wget vim
```

#### 步骤 4：安装 Node.js

```bash
# 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node -v  # 应该显示 v20.x.x
npm -v   # 应该显示 10.x.x
```

#### 步骤 5：安装 MySQL

```bash
# 安装 MySQL
sudo apt install -y mysql-server

# 启动 MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# 安全配置
sudo mysql_secure_installation
```

配置建议：
```
1. 设置 root 密码？ -> Yes，输入强密码
2. 移除匿名用户？ -> Yes
3. 禁止 root 远程登录？ -> Yes
4. 删除 test 数据库？ -> Yes
5. 重新加载权限表？ -> Yes
```

#### 步骤 6：安装 Nginx

```bash
# 安装 Nginx
sudo apt install -y nginx

# 启动 Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# 验证
sudo systemctl status nginx
```

#### 步骤 7：安装 PM2

```bash
# 全局安装 PM2
sudo npm install -g pm2

# 验证
pm2 -v
```

---

### 2.3 部署后端服务

#### 步骤 1：创建项目目录

```bash
sudo mkdir -p /var/www
cd /var/www
```

#### 步骤 2：上传代码

**方式 1：使用 Git（推荐）**
```bash
# 克隆代码仓库
sudo git clone <your-repo-url> waterproof

# 如果还没有 Git 仓库，先在本地创建并推送：
# 1. 在 GitHub/Gitee 创建仓库
# 2. 本地执行：
#    git init
#    git add .
#    git commit -m "初始提交"
#    git branch -M main
#    git remote add origin <your-repo-url>
#    git push -u origin main
```

**方式 2：使用 FTP/SFTP**
```bash
# 使用 FileZilla 或 WinSCP 上传
# 将本地的整个项目文件夹上传到 /var/www/waterproof
```

#### 步骤 3：设置权限

```bash
sudo chown -R $USER:$USER /var/www/waterproof
cd /var/www/waterproof/backend
```

#### 步骤 4：配置生产环境数据库

```bash
# 登录 MySQL
sudo mysql -u root -p
```

执行 SQL：
```sql
-- 创建生产数据库
CREATE DATABASE waterproof_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建生产用户（使用强密码）
CREATE USER 'waterproof_user'@'localhost' IDENTIFIED BY 'Your_Strong_Password_2024!';

-- 授权
GRANT ALL PRIVILEGES ON waterproof_system.* TO 'waterproof_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### 步骤 5：安装依赖

```bash
npm install --production
```

#### 步骤 6：配置生产环境变量

```bash
cp .env.example .env
vim .env
```

修改为生产配置：
```env
# 服务器配置
PORT=3000
NODE_ENV=production

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=waterproof_system
DB_USER=waterproof_user
DB_PASSWORD=Your_Strong_Password_2024!   # 生产数据库密码

# 微信小程序配置（正式小程序的）
WECHAT_APPID=wxabcdef1234567890
WECHAT_SECRET=abcdef1234567890abcdef1234567890

# JWT配置（生成强随机字符串）
JWT_SECRET=5a8f3d9c2b1e6f7a4d8c3b9e2f1a7d6c  # 使用下面命令生成
JWT_EXPIRES_IN=7d
```

生成 JWT_SECRET：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 步骤 7：初始化生产数据库

```bash
npm run migrate
```

#### 步骤 8：使用 PM2 启动服务

```bash
# 启动服务
pm2 start src/app.js --name waterproof-api

# 保存进程列表
pm2 save

# 设置开机自启
pm2 startup
# 复制输出的命令并执行

# 查看状态
pm2 status
pm2 logs waterproof-api
```

---

### 2.4 配置 Nginx

#### 步骤 1：创建 Nginx 配置

```bash
sudo vim /etc/nginx/sites-available/waterproof-api
```

添加配置（修改域名）：
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;  # 改成你的域名

    # 日志
    access_log /var/log/nginx/waterproof-api.access.log;
    error_log /var/log/nginx/waterproof-api.error.log;

    # 代理到后端
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 步骤 2：启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/waterproof-api /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

#### 步骤 3：验证 HTTP 访问

```bash
curl http://api.yourdomain.com/health
```

应该返回：
```json
{
  "success": true,
  "message": "服务运行正常"
}
```

---

### 2.5 配置 HTTPS（SSL证书）

#### 步骤 1：安装 Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

#### 步骤 2：申请 SSL 证书

```bash
# 自动配置（推荐）
sudo certbot --nginx -d api.yourdomain.com

# 按提示操作：
# 1. 输入邮箱（用于证书过期提醒）
# 2. 同意服务条款：Yes
# 3. 是否重定向到 HTTPS：2（推荐）
```

#### 步骤 3：测试自动续期

```bash
sudo certbot renew --dry-run
```

#### 步骤 4：验证 HTTPS

```bash
curl https://api.yourdomain.com/health
```

---

### 2.6 配置小程序

#### 步骤 1：修改小程序配置

编辑本地代码：

**miniapp/project.config.json**:
```json
{
  "appid": "wxabcdef1234567890",  // 正式小程序 AppID
  "projectname": "waterproof-miniapp"
}
```

**miniapp/app.js**:
```javascript
globalData: {
  userInfo: null,
  apiBaseUrl: 'https://api.yourdomain.com'  // 改成生产域名
}
```

#### 步骤 2：配置微信公众平台

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 **开发管理** -> **开发设置**
3. **服务器域名** 配置：

   点击"修改"，添加以下域名：
   - **request合法域名**：`https://api.yourdomain.com`
   - **uploadFile合法域名**：`https://api.yourdomain.com`
   - **downloadFile合法域名**：`https://api.yourdomain.com`

   注意：
   - 必须是 HTTPS
   - 每月只能修改 5 次
   - 需要域名备案

---

### 2.7 发布小程序

#### 步骤 1：本地测试生产配置

1. 打开微信开发者工具
2. **取消勾选** "不校验合法域名"（测试生产配置）
3. 点击"编译"
4. 测试登录和首页功能

#### 步骤 2：上传代码

1. 点击工具栏 **"上传"**
2. 填写版本信息：
   - 版本号：`1.0.0`
   - 项目备注：`第一阶段：基础功能上线`
3. 点击"上传"

#### 步骤 3：设为体验版

1. 登录微信公众平台
2. **开发管理** -> **版本管理**
3. 找到开发版本，点击 **"设为体验版"**
4. 扫描二维码进行体验测试

#### 步骤 4：提交审核

测试无问题后：

1. 点击 **"提交审核"**
2. 填写审核信息：
   - **功能页面**：
     - 首页：首页 (pages/index/index)
     - 登录页：登录 (pages/login/login)
   - **测试账号**：如需要提供
   - **补充说明**：简要说明小程序功能

3. 提交并等待审核（1-7个工作日）

#### 步骤 5：发布上线

审核通过后：

1. **版本管理** -> **审核版本**
2. 点击 **"发布"**
3. 确认发布

✅ **小程序上线成功！**

---

### 2.8 生产环境检查清单

部署完成后检查：

**服务器端**：
- [ ] 服务器可以 SSH 连接
- [ ] Node.js 已安装 (v20+)
- [ ] MySQL 已安装并运行
- [ ] Nginx 已安装并运行
- [ ] PM2 已安装
- [ ] 防火墙已配置（开放 22, 80, 443）

**后端服务**：
- [ ] 代码已上传到服务器
- [ ] 生产数据库已创建
- [ ] `.env` 配置完成（生产配置）
- [ ] 数据库迁移成功
- [ ] PM2 启动成功 (`pm2 status`)
- [ ] 健康检查接口正常 (`https://api.yourdomain.com/health`)

**Nginx**：
- [ ] Nginx 配置文件已创建
- [ ] 配置已启用
- [ ] HTTP 访问正常
- [ ] SSL 证书已申请
- [ ] HTTPS 访问正常

**小程序**：
- [ ] 生产 AppID 已配置
- [ ] 生产后端地址已配置
- [ ] 微信公众平台域名已配置
- [ ] 取消勾选"不校验域名"后测试通过
- [ ] 代码已上传
- [ ] 体验版测试通过
- [ ] 已提交审核
- [ ] 审核通过并发布

---

## 三、常见问题

### 3.1 服务器相关

#### Q1：SSH 连接超时

**原因**：
- 服务器防火墙拦截
- 安全组未开放 22 端口

**解决**：
- 云服务器控制台 -> 安全组 -> 添加规则
- 开放端口：22（SSH）、80（HTTP）、443（HTTPS）

#### Q2：PM2 进程经常挂掉

**排查**：
```bash
# 查看日志
pm2 logs waterproof-api

# 查看详细信息
pm2 describe waterproof-api
```

**常见原因**：
- 内存不足：升级服务器配置
- 数据库连接失败：检查数据库配置
- 端口被占用：修改 `.env` 中的 PORT

#### Q3：Nginx 502 错误

**排查步骤**：
```bash
# 1. 检查后端是否运行
pm2 status

# 2. 检查端口监听
netstat -tuln | grep 3000

# 3. 查看 Nginx 日志
sudo tail -f /var/log/nginx/error.log

# 4. 测试后端
curl http://localhost:3000/health
```

---

### 3.2 小程序相关

#### Q1：request:fail 错误

**原因**：
- 服务器域名未配置
- 域名未备案
- SSL 证书问题

**解决**：
1. 确认域名已在微信公众平台配置
2. 确认 HTTPS 证书有效
3. 测试：`curl https://api.yourdomain.com/health`

#### Q2：登录失败（生产环境）

**排查**：
1. 检查后端 `.env` 中的 WECHAT_APPID 是否正确
2. 检查小程序 `project.config.json` 中的 appid
3. 两者必须一致
4. 查看后端日志：`pm2 logs waterproof-api`

#### Q3：审核被拒

**常见原因**：
- 功能不完整
- 缺少用户协议/隐私政策
- 类目选择不当

**解决**：
- 根据拒绝原因修改
- 补充缺少的页面和功能
- 重新提交审核

---

### 3.3 数据库相关

#### Q1：连接被拒绝

```bash
# 检查 MySQL 状态
sudo systemctl status mysql

# 重启 MySQL
sudo systemctl restart mysql

# 测试连接
mysql -u waterproof_user -p waterproof_system
```

#### Q2：权限不足

```sql
-- 重新授权
GRANT ALL PRIVILEGES ON waterproof_system.* TO 'waterproof_user'@'localhost';
FLUSH PRIVILEGES;
```

---

### 3.4 SSL 证书相关

#### Q1：证书申请失败

**检查**：
```bash
# 1. 域名是否解析到当前服务器
ping api.yourdomain.com

# 2. 80 端口是否开放
sudo netstat -tuln | grep :80

# 3. Nginx 是否运行
sudo systemctl status nginx
```

**手动申请**：
```bash
sudo certbot certonly --standalone -d api.yourdomain.com
```

#### Q2：证书即将过期

Certbot 会自动续期，但如果失败：
```bash
# 手动续期
sudo certbot renew

# 重载 Nginx
sudo systemctl reload nginx
```

---

## 四、维护和监控

### 4.1 日常维护命令

```bash
# 查看后端状态
pm2 status

# 查看后端日志
pm2 logs waterproof-api

# 重启后端
pm2 restart waterproof-api

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/waterproof-api.access.log
sudo tail -f /var/log/nginx/waterproof-api.error.log

# 系统资源监控
htop  # 需要先安装: sudo apt install htop
```

### 4.2 数据库备份

创建备份脚本：
```bash
vim ~/backup_db.sh
```

内容：
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/mysql"
mkdir -p $BACKUP_DIR

mysqldump -u waterproof_user -p'Your_Strong_Password' waterproof_system > $BACKUP_DIR/waterproof_$DATE.sql

# 保留最近7天
find $BACKUP_DIR -name "waterproof_*.sql" -mtime +7 -delete

echo "备份完成: waterproof_$DATE.sql"
```

设置定时任务：
```bash
chmod +x ~/backup_db.sh
crontab -e

# 添加：每天凌晨2点备份
0 2 * * * /home/yourusername/backup_db.sh
```

### 4.3 代码更新流程

当有新代码需要部署：

```bash
# 1. 进入项目目录
cd /var/www/waterproof/backend

# 2. 拉取最新代码
git pull origin main

# 3. 安装新依赖（如有）
npm install --production

# 4. 运行数据库迁移（如有）
npm run migrate

# 5. 重启服务
pm2 restart waterproof-api

# 6. 查看日志确认
pm2 logs waterproof-api
```

---

## 五、性能优化建议

### 5.1 后端优化

- 使用 Redis 缓存热点数据
- 数据库查询添加索引
- 使用 PM2 集群模式：`pm2 start src/app.js -i max`
- 启用 Gzip 压缩

### 5.2 小程序优化

- 图片使用 CDN
- 分包加载
- 数据预加载
- 骨架屏占位

### 5.3 服务器优化

- 使用 CDN 加速
- 配置反向代理缓存
- 开启 HTTP/2
- 定期清理日志

---

## 六、联系支持

遇到问题时：

1. **查看日志**：
   - 后端：`pm2 logs waterproof-api`
   - Nginx：`/var/log/nginx/`
   - 小程序：微信开发者工具调试器

2. **搜索解决方案**：
   - 微信开放社区
   - Stack Overflow
   - GitHub Issues

3. **联系开发团队**

---

**文档版本**：v1.0  
**最后更新**：2026-08-14
