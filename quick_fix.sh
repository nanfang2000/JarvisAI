#!/bin/bash
# JARVIS AI 快速修复脚本

echo "🤖 JARVIS AI 快速修复工具"
echo "=========================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查当前目录
if [[ ! -f "claude.md" ]]; then
    echo -e "${RED}❌ 请在JarvisAI根目录下运行此脚本${NC}"
    exit 1
fi

echo -e "${BLUE}🔍 检查系统状态...${NC}"

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装${NC}"
    exit 1
fi

# 检查Python
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 未安装${NC}"
    exit 1
fi

# 停止现有进程
echo -e "${YELLOW}🛑 停止现有服务...${NC}"
pkill -f test_jarvis_server.py 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
sleep 2

# 修复3D头像加载问题
echo -e "${BLUE}🎭 修复3D头像加载问题...${NC}"
if [[ -f "jarvis-ai/src/components/avatar/Avatar3D.tsx" ]]; then
    # 检查是否已经修复
    if grep -q "Environment preset" jarvis-ai/src/components/avatar/Avatar3D.tsx; then
        echo -e "${YELLOW}⚠️  检测到HDR加载问题，正在修复...${NC}"
        # 替换Environment组件
        sed -i.bak 's|<Environment preset="studio" background={false} />|<ambientLight intensity={0.5} />\n        <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />\n        <pointLight position={[-10, -10, -10]} intensity={0.3} />|g' jarvis-ai/src/components/avatar/Avatar3D.tsx
        echo -e "${GREEN}✅ 3D环境光照已修复${NC}"
    else
        echo -e "${GREEN}✅ 3D头像配置正常${NC}"
    fi
fi

# 检查并安装依赖
echo -e "${BLUE}📦 检查前端依赖...${NC}"
cd jarvis-ai
if [[ ! -d "node_modules" ]] || [[ ! -f "package-lock.json" ]]; then
    echo -e "${YELLOW}📥 安装前端依赖...${NC}"
    npm install --legacy-peer-deps
    if [[ $? -ne 0 ]]; then
        echo -e "${RED}❌ 前端依赖安装失败${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ 前端依赖已安装${NC}"
fi

# 构建前端
echo -e "${BLUE}🔨 构建前端...${NC}"
npm run build
if [[ $? -ne 0 ]]; then
    echo -e "${RED}❌ 前端构建失败${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 前端构建成功${NC}"

cd ..

# 检查Python依赖
echo -e "${BLUE}🐍 检查Python依赖...${NC}"
if ! python -c "import fastapi" 2>/dev/null; then
    echo -e "${YELLOW}📥 安装Python依赖...${NC}"
    pip install fastapi uvicorn python-multipart aiofiles
fi

# 检查环境变量
echo -e "${BLUE}🔑 检查环境配置...${NC}"
if [[ ! -f ".env" ]]; then
    echo -e "${YELLOW}⚠️  .env文件不存在，创建示例配置...${NC}"
    cp .env.example .env 2>/dev/null || echo "# JARVIS AI 环境配置" > .env
    echo -e "${YELLOW}📝 请编辑.env文件填入您的API密钥${NC}"
fi

# 启动后端服务
echo -e "${BLUE}🚀 启动JARVIS核心服务...${NC}"
if [[ -f "jarvis-core/main_simple.py" ]]; then
    cd jarvis-core
    python main_simple.py > ../server.log 2>&1 &
    BACKEND_PID=$!
    cd ..
    sleep 3
    
    # 检查后端是否启动成功
    if curl -s http://localhost:8000/status > /dev/null 2>&1; then
        echo -e "${GREEN}✅ JARVIS核心服务启动成功 (PID: $BACKEND_PID)${NC}"
    else
        echo -e "${RED}❌ JARVIS核心服务启动失败，查看server.log获取详情${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ 未找到jarvis-core/main_simple.py${NC}"
    exit 1
fi

# 启动前端服务
echo -e "${BLUE}🌐 启动前端服务...${NC}"
cd jarvis-ai
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 5

# 检查前端是否启动成功
if curl -s http://localhost:1420/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 前端服务启动成功 (PID: $FRONTEND_PID)${NC}"
else
    echo -e "${RED}❌ 前端服务启动失败，查看frontend.log获取详情${NC}"
    exit 1
fi

cd ..

# 测试API连接
echo -e "${BLUE}🔗 测试API连接...${NC}"
sleep 2
RESPONSE=$(curl -s -X POST http://localhost:8000/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "系统测试", "mode": "auto"}' | grep -o '"success":true')

if [[ "$RESPONSE" == '"success":true' ]]; then
    echo -e "${GREEN}✅ API连接测试成功${NC}"
else
    echo -e "${YELLOW}⚠️  API连接测试未通过，但服务可能仍然正常${NC}"
fi

# 显示系统信息
echo ""
echo -e "${GREEN}🎉 JARVIS AI 修复完成！${NC}"
echo "=========================="
echo -e "${BLUE}📋 系统信息:${NC}"
echo -e "  🌐 前端地址: ${GREEN}http://localhost:1420${NC}"
echo -e "  🔧 后端地址: ${GREEN}http://localhost:8000${NC}"
echo -e "  📖 API文档: ${GREEN}http://localhost:8000/docs${NC}"
echo -e "  📊 健康检查: ${GREEN}http://localhost:8000/status${NC}"

echo ""
echo -e "${BLUE}📝 进程信息:${NC}"
echo -e "  🔧 后端进程: ${BACKEND_PID}"
echo -e "  🌐 前端进程: ${FRONTEND_PID}"

echo ""
echo -e "${BLUE}📋 日志文件:${NC}"
echo -e "  🔧 后端日志: ${YELLOW}server.log${NC}"
echo -e "  🌐 前端日志: ${YELLOW}frontend.log${NC}"

echo ""
echo -e "${BLUE}🛠️  停止服务:${NC}"
echo -e "  ${YELLOW}kill $BACKEND_PID $FRONTEND_PID${NC}"

echo ""
echo -e "${GREEN}✨ 开始使用JARVIS AI吧！${NC}"

# 可选：自动打开浏览器
if command -v open &> /dev/null; then
    echo -e "${BLUE}🌐 正在打开浏览器...${NC}"
    sleep 2
    open http://localhost:1420
elif command -v xdg-open &> /dev/null; then
    echo -e "${BLUE}🌐 正在打开浏览器...${NC}"
    sleep 2
    xdg-open http://localhost:1420
fi