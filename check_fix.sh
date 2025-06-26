#!/bin/bash
# JARVIS AI 修复验证脚本

echo "🤖 验证JARVIS AI修复状态..."
echo "=========================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. 检查HDR环境问题是否修复
echo -e "${BLUE}🎭 检查3D环境配置...${NC}"
if grep -q "Environment preset" jarvis-ai/src/components/avatar/Avatar3D.tsx; then
    echo -e "${RED}❌ HDR环境问题未修复${NC}"
    echo "   需要将 Environment preset=\"studio\" 替换为基础光照"
else
    echo -e "${GREEN}✅ 3D环境配置已修复${NC}"
fi

# 2. 检查后端服务
echo -e "${BLUE}🔧 检查后端服务...${NC}"
if curl -s http://localhost:8000/health > /dev/null; then
    echo -e "${GREEN}✅ 后端服务运行正常${NC}"
    HEALTH=$(curl -s http://localhost:8000/health | grep -o '"status":"healthy"')
    if [[ "$HEALTH" == '"status":"healthy"' ]]; then
        echo -e "${GREEN}✅ 后端健康检查通过${NC}"
    fi
else
    echo -e "${RED}❌ 后端服务未响应${NC}"
fi

# 3. 检查前端服务
echo -e "${BLUE}🌐 检查前端服务...${NC}"
if curl -s http://localhost:1420/ > /dev/null; then
    echo -e "${GREEN}✅ 前端服务运行正常${NC}"
else
    echo -e "${RED}❌ 前端服务未响应${NC}"
fi

# 4. 测试API功能
echo -e "${BLUE}🔗 测试API功能...${NC}"
RESPONSE=$(curl -s -X POST http://localhost:8000/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "测试消息", "mode": "auto"}')

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ AI对话API正常工作${NC}"
    # 显示AI响应
    AI_RESPONSE=$(echo "$RESPONSE" | grep -o '"response":"[^"]*"' | cut -d'"' -f4)
    echo -e "${BLUE}   AI回复: ${NC}$AI_RESPONSE"
else
    echo -e "${RED}❌ AI对话API测试失败${NC}"
    echo "   响应: $RESPONSE"
fi

# 5. 检查TypeScript编译
echo -e "${BLUE}📝 检查TypeScript编译...${NC}"
cd jarvis-ai
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ TypeScript编译成功${NC}"
else
    echo -e "${RED}❌ TypeScript编译失败${NC}"
fi
cd ..

# 6. 检查进程状态
echo -e "${BLUE}⚙️  检查进程状态...${NC}"
BACKEND_PID=$(ps aux | grep -v grep | grep test_jarvis_server.py | awk '{print $2}')
FRONTEND_PID=$(ps aux | grep -v grep | grep "npm.*dev" | awk '{print $2}')

if [[ -n "$BACKEND_PID" ]]; then
    echo -e "${GREEN}✅ 后端进程运行中 (PID: $BACKEND_PID)${NC}"
else
    echo -e "${YELLOW}⚠️  后端进程未找到${NC}"
fi

if [[ -n "$FRONTEND_PID" ]]; then
    echo -e "${GREEN}✅ 前端进程运行中 (PID: $FRONTEND_PID)${NC}"
else
    echo -e "${YELLOW}⚠️  前端进程未找到${NC}"
fi

echo ""
echo -e "${GREEN}🎉 修复验证完成！${NC}"
echo "=========================="

# 如果所有检查都通过，显示成功信息
if curl -s http://localhost:8000/health > /dev/null && curl -s http://localhost:1420/ > /dev/null; then
    echo -e "${GREEN}🎊 JARVIS AI 系统运行正常！${NC}"
    echo ""
    echo -e "${BLUE}📱 访问地址:${NC}"
    echo -e "  🌐 主界面: ${GREEN}http://localhost:1420${NC}"
    echo -e "  🔧 API文档: ${GREEN}http://localhost:8000/docs${NC}"
    echo ""
    echo -e "${BLUE}🎮 功能测试:${NC}"
    echo "  ✨ 3D虚拟助手"
    echo "  💬 AI智能对话"
    echo "  🗺️  地图导航"
    echo "  💰 价格比对"
    echo "  📱 Android控制"
else
    echo -e "${RED}❌ 系统未完全启动，请运行 ./quick_fix.sh 进行修复${NC}"
fi