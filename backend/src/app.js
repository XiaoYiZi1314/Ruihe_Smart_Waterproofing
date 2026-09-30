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
app.set('trust proxy', 'loopback');
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');

// 中间件
app.use(helmet({
  // 小程序 <image> 与后台预览都不是本域文档，same-origin 会导致现场图一直 binderror
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({ origin: process.env.PUBLIC_ORIGIN || 'https://ruihezhihui.cn' }));
app.use(express.json()); // 解析JSON请求体
app.use(express.urlencoded({ extended: true })); // 解析URL编码请求体
app.use('/uploads', require('./utils/attachments').protectLegacy, express.static(path.join(__dirname, '../uploads')));
app.use(morgan('dev')); // 日志记录

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res, next) => {
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value !== 'string') return res.status(400).json({ success: false, message: '查询参数格式无效' });
    if (['page', 'limit', 'days'].includes(key) && (!/^\d+$/.test(value) || Number(value) < 1 || (key !== 'page' && Number(value) > 200))) return res.status(400).json({ success: false, message: '分页参数无效' });
  }
  next();
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
app.use('/api/notifications', require('./routes/notifications'));
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
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : (err.status || (err.name === 'MulterError' ? 400 : 500));
  res.status(status).json({
    success: false,
    message: status < 500 ? (err.code === 'LIMIT_FILE_SIZE' ? '文件超出上传大小限制' : err.message) : '服务器内部错误',
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
