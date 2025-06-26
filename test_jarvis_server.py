#!/usr/bin/env python3
"""
JARVIS测试服务器
简化版本用于测试Tauri-Python通信
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import logging
from typing import Dict, Any

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建FastAPI应用
app = FastAPI(
    title="JARVIS Test Server",
    description="JARVIS智能管家测试服务器",
    version="1.0.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 请求模型
class ChatRequest(BaseModel):
    message: str
    mode: str = "auto"

# 全局状态
app_state = {
    "startup_time": None,
    "request_count": 0,
    "is_healthy": True
}

@app.on_event("startup")
async def startup_event():
    """应用启动事件"""
    from datetime import datetime
    app_state["startup_time"] = datetime.now().isoformat()
    logger.info("🚀 JARVIS测试服务器启动成功!")

@app.get("/")
async def root():
    """根路径健康检查"""
    return {
        "message": "JARVIS Test Server is running",
        "status": "healthy",
        "version": "1.0.0"
    }

@app.get("/status")
async def get_status():
    """获取服务状态"""
    return {
        "jarvis_agent": True,
        "model_router": True,
        "memory_manager": True,
        "config_manager": True,
        "startup_time": app_state["startup_time"],
        "request_count": app_state["request_count"],
        "is_healthy": app_state["is_healthy"],
        "conversation_turns": 0,
        "active_tasks": 0
    }

@app.post("/chat")
async def chat(request: ChatRequest):
    """处理聊天请求"""
    try:
        app_state["request_count"] += 1
        
        user_message = request.message.strip()
        mode = request.mode
        
        logger.info(f"收到消息 (模式: {mode}): {user_message}")
        
        # 简单的响应逻辑
        if "你好" in user_message or "hello" in user_message.lower():
            response = f"你好主人！我是您的智能管家小爱。我收到了您的消息：'{user_message}'"
        elif "时间" in user_message:
            from datetime import datetime
            current_time = datetime.now().strftime("%Y年%m月%d日 %H:%M:%S")
            response = f"现在是{current_time}，主人。"
        elif "测试" in user_message:
            response = f"测试成功！JARVIS正在正常运行。当前模式：{mode}"
        elif "状态" in user_message:
            response = f"JARVIS状态良好！已处理{app_state['request_count']}个请求。"
        else:
            response = f"我理解了您的请求：'{user_message}'。目前这是测试模式，更多功能正在开发中！"
        
        # 根据模式添加标识
        if mode == "qwen":
            response += " [Qwen模式]"
        elif mode == "deepseek":
            response += " [DeepSeek深度思考模式]"
        else:
            response += " [智能路由模式]"
        
        return {
            "response": response,
            "model_used": mode,
            "success": True,
            "request_id": app_state["request_count"]
        }
        
    except Exception as e:
        logger.error(f"处理聊天请求时出错: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/image_analysis")
async def analyze_image(request: Dict[str, Any]):
    """图像分析接口 (测试版)"""
    try:
        app_state["request_count"] += 1
        
        image_data = request.get("image_data", "")
        question = request.get("question", "请描述这张图片")
        
        # 模拟图像分析
        response = f"我看到了一张图片。您问的是：{question}。这是测试模式的回复，实际的图像分析功能正在开发中。"
        
        return {
            "response": response,
            "success": True
        }
        
    except Exception as e:
        logger.error(f"图像分析出错: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/memory/search")
async def search_memory(query: str, memory_type: str = "all"):
    """搜索记忆 (测试版)"""
    try:
        # 模拟记忆搜索
        results = [
            {
                "type": "user",
                "content": f"与'{query}'相关的记忆内容",
                "importance": 0.8,
                "timestamp": app_state["startup_time"]
            }
        ]
        
        return {"results": results}
        
    except Exception as e:
        logger.error(f"搜索记忆出错: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/memory/save")
async def save_memory(request: Dict[str, Any]):
    """保存记忆 (测试版)"""
    try:
        memory_type = request.get("type", "user")
        content = request.get("content", "")
        
        # 模拟保存记忆
        memory_id = f"mem_{app_state['request_count']}"
        
        logger.info(f"保存记忆: {memory_type} - {content[:50]}...")
        
        return {
            "success": True,
            "memory_id": memory_id
        }
        
    except Exception as e:
        logger.error(f"保存记忆出错: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy" if app_state["is_healthy"] else "unhealthy",
        "uptime": app_state["startup_time"],
        "requests_processed": app_state["request_count"]
    }

if __name__ == "__main__":
    print("🤖 启动JARVIS测试服务器...")
    print("📍 服务地址: http://127.0.0.1:8000")
    print("📖 API文档: http://127.0.0.1:8000/docs")
    
    uvicorn.run(
        "test_jarvis_server:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )