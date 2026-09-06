const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const bannerRoutes = require('./routes/banners');
const categoryRoutes = require('./routes/categories');
const serviceRoutes = require('./routes/services');
const addressRoutes = require('./routes/addresses');
const orderRoutes = require('./routes/orders');
const configRoutes = require('./routes/config');
const workerRoutes = require('./routes/worker');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const Scheduler = require('./jobs/scheduler');
const RealtimeService = require('./utils/realtime');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');

// 中间件
app.use(helmet()); // 安全headers
app.use(cors()); // 跨域支持
app.use(express.json()); // 解析JSON请求体
app.use(express.urlencoded({ extended: true })); // 解析URL编码请求体
app.use('/uploads', express.static(path.join(__dirname, '../uploads'))); // 静态图片资源
app.use(morgan('dev')); // 日志记录

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString()
  });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/config', configRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器（http server + WebSocket）
const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`🚀 服务器启动成功！`);
  console.log(`📡 监听地址: ${HOST}:${PORT}`);
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 健康检查: http://127.0.0.1:${PORT}/health`);

  // 启动 WebSocket 实时通知
  RealtimeService.init(server);

  // 启动定时任务
  Scheduler.start();
});

module.exports = { app, server, RealtimeService };
