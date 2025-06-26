#!/bin/bash

# JARVIS 视觉服务启动脚本

echo "正在启动JARVIS视觉处理服务..."

# 检查Python环境
if ! command -v python3 &> /dev/null; then
    echo "错误: Python3 未安装"
    exit 1
fi

# 检查必要的Python包
echo "检查Python依赖..."
python3 -c "import cv2, face_recognition, mediapipe, fastapi, uvicorn" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "错误: 缺少必要的Python包，请运行: pip install -r requirements.txt"
    exit 1
fi

# 检查摄像头权限（macOS）
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "检查摄像头权限..."
    # 在macOS上，这个检查需要实际运行时进行
fi

# 切换到vision-service目录
cd "$(dirname "$0")/vision-service"

# 启动服务
echo "启动视觉处理服务..."
echo "服务地址: http://localhost:8002"
echo "API文档: http://localhost:8002/docs"
echo "WebSocket: ws://localhost:8002/ws/camera"
echo ""
echo "按Ctrl+C停止服务"

# 运行服务
python3 main.py

echo "视觉服务已停止"