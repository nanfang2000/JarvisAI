"""
JARVIS AI Core - FastAPI主服务器
负责AI模型管理、工具调用和与Tauri前端的通信
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from typing import Dict, Any

from models.qwen_client import QwenClient
from models.deepseek_client import DeepSeekClient
from models.model_router import ModelRouter
from agents.jarvis_agent import JarvisAgent
from memory.memory_manager import MemoryManager
from config.config_manager import ConfigManager

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 全局变量
jarvis_agent = None
model_router = None
memory_manager = None
config_manager = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    global jarvis_agent, model_router, memory_manager, config_manager
    
    # 启动时初始化
    logger.info("正在初始化JARVIS核心服务...")
    
    # 配置管理器
    config_manager = ConfigManager()
    
    # 记忆管理器
    memory_manager = MemoryManager()
    await memory_manager.initialize()
    
    # 模型路由器
    model_router = ModelRouter()
    await model_router.initialize()
    
    # JARVIS智能体
    jarvis_agent = JarvisAgent(
        model_router=model_router,
        memory_manager=memory_manager,
        config_manager=config_manager
    )
    await jarvis_agent.initialize()
    
    logger.info("JARVIS核心服务初始化完成!")
    
    yield
    
    # 关闭时清理
    logger.info("正在关闭JARVIS核心服务...")
    if jarvis_agent:
        await jarvis_agent.cleanup()
    if memory_manager:
        await memory_manager.cleanup()
    logger.info("JARVIS核心服务已关闭")

# 创建FastAPI应用
app = FastAPI(
    title="JARVIS AI Core",
    description="JARVIS智能管家核心服务",
    version="1.0.0",
    lifespan=lifespan
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket连接管理
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"新的WebSocket连接，当前连接数: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket连接断开，当前连接数: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # 连接已断开，移除
                self.active_connections.remove(connection)

manager = ConnectionManager()

@app.get("/")
async def root():
    """健康检查端点"""
    return {"message": "JARVIS AI Core is running", "status": "healthy"}

@app.get("/status")
async def get_status():
    """获取系统状态"""
    return {
        "jarvis_agent": jarvis_agent is not None,
        "model_router": model_router is not None,
        "memory_manager": memory_manager is not None,
        "config_manager": config_manager is not None,
        "active_connections": len(manager.active_connections)
    }

@app.post("/chat")
async def chat(request: Dict[str, Any]):
    """处理聊天请求"""
    try:
        user_message = request.get("message", "")
        mode = request.get("mode", "qwen")  # qwen, deepseek, auto
        
        if not jarvis_agent:
            return JSONResponse(
                status_code=500,
                content={"error": "JARVIS agent not initialized"}
            )
        
        response = await jarvis_agent.process_message(user_message, mode=mode)
        return {"response": response}
        
    except Exception as e:
        logger.error(f"Chat处理错误: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.post("/image_analysis")
async def analyze_image(request: Dict[str, Any]):
    """图像分析接口"""
    try:
        image_data = request.get("image_data", "")
        question = request.get("question", "请描述这张图片")
        
        if not jarvis_agent:
            return JSONResponse(
                status_code=500,
                content={"error": "JARVIS agent not initialized"}
            )
        
        response = await jarvis_agent.analyze_image(image_data, question)
        return {"response": response}
        
    except Exception as e:
        logger.error(f"图像分析错误: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket实时通信端点"""
    await manager.connect(websocket)
    try:
        while True:
            # 接收前端消息
            data = await websocket.receive_text()
            logger.info(f"收到WebSocket消息: {data}")
            
            # 这里可以处理实时消息
            if jarvis_agent:
                response = await jarvis_agent.process_realtime_message(data)
                await manager.send_personal_message(response, websocket)
            else:
                await manager.send_personal_message("JARVIS agent not ready", websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("WebSocket连接断开")
    except Exception as e:
        logger.error(f"WebSocket错误: {e}")
        manager.disconnect(websocket)

@app.post("/memory/save")
async def save_memory(request: Dict[str, Any]):
    """保存记忆"""
    try:
        if not memory_manager:
            return JSONResponse(
                status_code=500,
                content={"error": "Memory manager not initialized"}
            )
        
        memory_type = request.get("type", "user")
        content = request.get("content", "")
        metadata = request.get("metadata", {})
        
        result = await memory_manager.save_memory(memory_type, content, metadata)
        return {"success": True, "memory_id": result}
        
    except Exception as e:
        logger.error(f"保存记忆错误: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.get("/memory/search")
async def search_memory(query: str, memory_type: str = "all"):
    """搜索记忆"""
    try:
        if not memory_manager:
            return JSONResponse(
                status_code=500,
                content={"error": "Memory manager not initialized"}
            )
        
        results = await memory_manager.search_memory(query, memory_type)
        return {"results": results}
        
    except Exception as e:
        logger.error(f"搜索记忆错误: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )