#!/bin/bash
# 第三阶段快速启动脚本

echo "=========================================="
echo "  瑞和防水系统 - 第三阶段启动"
echo "=========================================="
echo ""

# 检查当前目录
if [ ! -f "backend/package.json" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

echo "📦 步骤 1: 检查依赖..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "   安装依赖..."
    npm install
else
    echo "   ✅ 依赖已安装"
fi

echo ""
echo "🗄️  步骤 2: 数据库迁移..."
echo "   执行第三阶段数据库迁移..."
node scripts/migrate-phase3.js

if [ $? -eq 0 ]; then
    echo "   ✅ 数据库迁移成功"
else
    echo "   ⚠️  数据库迁移失败，请检查配置"
    echo "   提示：请检查 backend/.env 中的数据库配置"
    exit 1
fi

echo ""
echo "🚀 步骤 3: 启动后端服务..."
npm run dev &
BACKEND_PID=$!

echo "   后端服务 PID: $BACKEND_PID"
sleep 3

echo ""
echo "✅ 启动完成！"
echo ""
echo "=========================================="
echo "  访问信息"
echo "=========================================="
echo "  后端服务: http://localhost:3000"
echo "  健康检查: http://localhost:3000/health"
echo ""
echo "=========================================="
echo "  师傅端 API"
echo "=========================================="
echo "  GET    /api/worker/orders           获取工单列表"
echo "  GET    /api/worker/orders/:id       获取工单详情"
echo "  PUT    /api/worker/orders/:id/accept    接受工单"
echo "  PUT    /api/worker/orders/:id/reject    拒绝工单"
echo "  PUT    /api/worker/orders/:id/start     开始施工"
echo "  PUT    /api/worker/orders/:id/complete  完工"
echo "  PUT    /api/worker/status           切换工作状态"
echo "  GET    /api/worker/stats            获取统计"
echo ""
echo "=========================================="
echo "  客户端扩展 API"
echo "=========================================="
echo "  PUT    /api/orders/:id/urge         催单"
echo "  PUT    /api/orders/:id/confirm      确认完成"
echo "  PUT    /api/orders/:id/dispute-price    价格异议"
echo "  POST   /api/orders/:id/review       提交评价"
echo "  DELETE /api/orders/:id/review       删除评价"
echo ""
echo "=========================================="
echo "  测试命令"
echo "=========================================="
echo "  运行 API 测试:"
echo "  cd backend && node scripts/test-phase3-api.js"
echo ""
echo "  停止服务:"
echo "  kill $BACKEND_PID"
echo ""
echo "=========================================="

# 等待用户中断
echo ""
echo "按 Ctrl+C 停止服务..."
wait $BACKEND_PID
