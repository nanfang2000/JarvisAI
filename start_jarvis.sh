#!/bin/bash

# JARVIS智能管家启动脚本

echo "🤖 启动JARVIS智能管家系统..."

# 检查Python是否可用
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3未安装，请先安装Python3"
    exit 1
fi

# 检查是否在正确的目录
if [ ! -f "test_jarvis_server.py" ]; then
    echo "❌ 请在JarvisAI项目根目录运行此脚本"
    exit 1
fi

# 安装Python依赖（简化版）
echo "📦 检查Python依赖..."
pip3 install fastapi uvicorn pydantic &> /dev/null

# 启动测试服务器
echo "🚀 启动JARVIS核心服务..."
python3 test_jarvis_server.py &
PYTHON_PID=$!

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 3

# 检查服务是否启动成功
if curl -s http://127.0.0.1:8000/status > /dev/null; then
    echo "✅ JARVIS核心服务启动成功!"
    echo "📍 服务地址: http://127.0.0.1:8000"
    echo "📖 API文档: http://127.0.0.1:8000/docs"
else
    echo "❌ JARVIS核心服务启动失败"
    kill $PYTHON_PID 2>/dev/null
    exit 1
fi

# 进入Tauri应用目录并启动
if [ -d "jarvis-ai" ]; then
    echo "🖥️  启动Tauri前端应用..."
    cd jarvis-ai
    npm run tauri dev &
    TAURI_PID=$!
    cd ..
    
    echo "✨ JARVIS系统启动完成!"
    echo "🎯 前端应用将在几秒钟后打开"
    echo ""
    echo "按Ctrl+C停止所有服务"
    
    # 等待用户中断
    trap "echo ''; echo '🛑 正在停止JARVIS系统...'; kill $PYTHON_PID $TAURI_PID 2>/dev/null; exit 0" INT
    wait
else
    echo "⚠️  Tauri应用目录不存在，仅启动后端服务"
    echo "按Ctrl+C停止服务"
    
    trap "echo ''; echo '🛑 正在停止JARVIS服务...'; kill $PYTHON_PID 2>/dev/null; exit 0" INT
    wait $PYTHON_PID
fi