@echo off
REM 第三阶段快速启动脚本 (Windows)

echo ==========================================
echo   瑞和防水系统 - 第三阶段启动
echo ==========================================
echo.

REM 检查当前目录
if not exist "backend\package.json" (
    echo ❌ 错误：请在项目根目录运行此脚本
    exit /b 1
)

echo 📦 步骤 1: 检查依赖...
cd backend
if not exist "node_modules\" (
    echo    安装依赖...
    call npm install
) else (
    echo    ✅ 依赖已安装
)

echo.
echo 🗄️  步骤 2: 数据库迁移...
echo    执行第三阶段数据库迁移...
node scripts\migrate-phase3.js

if %errorlevel% neq 0 (
    echo    ⚠️  数据库迁移失败，请检查配置
    echo    提示：请检查 backend\.env 中的数据库配置
    exit /b 1
)

echo    ✅ 数据库迁移成功

echo.
echo 🚀 步骤 3: 启动后端服务...
echo    正在启动...
start "瑞和防水API服务" /B npm run dev

timeout /t 3 /nobreak >nul

echo.
echo ✅ 启动完成！
echo.
echo ==========================================
echo   访问信息
echo ==========================================
echo   后端服务: http://localhost:3000
echo   健康检查: http://localhost:3000/health
echo.
echo ==========================================
echo   师傅端 API
echo ==========================================
echo   GET    /api/worker/orders           获取工单列表
echo   GET    /api/worker/orders/:id       获取工单详情
echo   PUT    /api/worker/orders/:id/accept    接受工单
echo   PUT    /api/worker/orders/:id/reject    拒绝工单
echo   PUT    /api/worker/orders/:id/start     开始施工
echo   PUT    /api/worker/orders/:id/complete  完工
echo   PUT    /api/worker/status           切换工作状态
echo   GET    /api/worker/stats            获取统计
echo.
echo ==========================================
echo   客户端扩展 API
echo ==========================================
echo   PUT    /api/orders/:id/urge         催单
echo   PUT    /api/orders/:id/confirm      确认完成
echo   PUT    /api/orders/:id/dispute-price    价格异议
echo   POST   /api/orders/:id/review       提交评价
echo   DELETE /api/orders/:id/review       删除评价
echo.
echo ==========================================
echo   测试命令
echo ==========================================
echo   运行 API 测试:
echo   cd backend ^&^& node scripts\test-phase3-api.js
echo.
echo   查看后端日志:
echo   打开新的窗口标题为 "瑞和防水API服务"
echo.
echo ==========================================
echo.
echo 按任意键退出脚本（后端服务将继续运行）...
pause >nul

cd ..
