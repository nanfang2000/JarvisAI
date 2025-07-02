#!/usr/bin/env python3
"""
JARVIS AI Core - 简化版FastAPI主服务器
基于test_jarvis_server.py的成功实现，提供核心JARVIS功能
"""

import asyncio
import logging
import json
import os
import uuid
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from typing import Dict, Any, Optional
from pydantic import BaseModel

# 尝试导入语音识别服务
try:
    import dashscope
    from dashscope.audio.asr import Recognition, RecognitionCallback, RecognitionResult
    SPEECH_RECOGNITION_AVAILABLE = True
    logging.info("✅ 语音识别服务可用") 
except ImportError:
    SPEECH_RECOGNITION_AVAILABLE = False
    logging.warning("⚠️ dashscope库未安装，语音识别功能不可用")

# AI客户端配置
try:
    from openai import OpenAI
    
    # Qwen客户端
    qwen_client = OpenAI(
        api_key=os.getenv("QWEN_API_KEY", "sk-e0f5318e73404c91992a6377feb08f96"),
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )
    
    # DeepSeek客户端  
    deepseek_client = OpenAI(
        api_key=os.getenv("DEEPSEEK_API_KEY", "your_deepseek_key"),
        base_url="https://api.deepseek.com/v1",
    )
    
    # 阿里云语音识别配置 - 按照官方文档设置
    ALIBABA_CLOUD_CONFIG = {
        "api_key": os.getenv("DASHSCOPE_API_KEY", os.getenv("QWEN_API_KEY", "sk-e0f5318e73404c91992a6377feb08f96")),
        "model": "paraformer-realtime-v2"
    }
    
    # 设置dashscope API key - 官方文档推荐的方式
    if SPEECH_RECOGNITION_AVAILABLE:
        dashscope.api_key = ALIBABA_CLOUD_CONFIG["api_key"]
        # 也可以通过环境变量 DASHSCOPE_API_KEY 设置
        os.environ["DASHSCOPE_API_KEY"] = ALIBABA_CLOUD_CONFIG["api_key"]
    
    AI_AVAILABLE = True
    logging.info("✅ AI客户端初始化成功")
    
except ImportError:
    logging.warning("⚠️ OpenAI库未安装，使用模拟模式")
    AI_AVAILABLE = False
except Exception as e:
    logging.error(f"❌ AI客户端初始化失败: {e}")
    AI_AVAILABLE = False

# 配置日志 - 同时输出到控制台和文件
log_formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# 创建logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# 控制台处理器
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(log_formatter)

# 文件处理器
file_handler = logging.FileHandler('../jarvis_core.log', encoding='utf-8')
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(log_formatter)

# 添加处理器
logger.addHandler(console_handler)
logger.addHandler(file_handler)

# 设置根日志级别
logging.basicConfig(level=logging.INFO, handlers=[console_handler, file_handler])

# 请求和响应模型
class ChatRequest(BaseModel):
    message: str
    mode: str = "auto"
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    model_used: str
    session_id: str
    thinking_time: float = 0.0
    success: bool = True

# 全局管理器
class JarvisCore:
    """JARVIS核心管理器"""
    
    def __init__(self):
        self.initialized = False
        self.active_sessions = {}
        self.conversation_history = {}
        self.user_preferences = {}
        
    async def initialize(self):
        """初始化JARVIS核心"""
        logger.info("🚀 正在初始化JARVIS核心服务...")
        
        # 这里可以添加更多初始化逻辑
        self.initialized = True
        logger.info("✅ JARVIS核心服务初始化完成!")
        
    async def cleanup(self):
        """清理资源"""
        logger.info("🧹 正在清理JARVIS核心服务...")
        self.initialized = False
        logger.info("✅ JARVIS核心服务已清理")
        
    async def process_message(self, message: str, mode: str = "auto", session_id: str = None) -> str:
        """处理消息"""
        if not session_id:
            session_id = str(uuid.uuid4())
            
        # 选择模型
        if mode == "auto":
            # 智能选择模型
            model = "qwen" if len(message) < 100 else "deepseek"
        else:
            model = mode
            
        try:
            if AI_AVAILABLE and model == "qwen":
                response = await self._call_qwen(message, session_id)
            elif AI_AVAILABLE and model == "deepseek":
                response = await self._call_deepseek(message, session_id)
            else:
                response = self._fallback_response(message)
                
            # 保存对话历史
            if session_id not in self.conversation_history:
                self.conversation_history[session_id] = []
            self.conversation_history[session_id].append({
                "user": message,
                "assistant": response,
                "timestamp": datetime.now().isoformat(),
                "model": model
            })
            
            return response
            
        except Exception as e:
            logger.error(f"处理消息错误: {e}")
            return self._fallback_response(message)
            
    async def _call_qwen(self, message: str, session_id: str) -> str:
        """调用千问模型"""
        try:
            # 获取对话历史
            history = self.conversation_history.get(session_id, [])
            messages = [{"role": "system", "content": "你是JARVIS，一个智能管家助手。请用中文回答。"}]
            
            # 添加历史对话（最近5轮）
            for conv in history[-5:]:
                messages.append({"role": "user", "content": conv["user"]})
                messages.append({"role": "assistant", "content": conv["assistant"]})
                
            messages.append({"role": "user", "content": message})
            
            response = qwen_client.chat.completions.create(
                model="qwen-plus",
                messages=messages,
                temperature=0.7
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"千问API调用失败: {e}")
            raise
            
    async def _call_deepseek(self, message: str, session_id: str) -> str:
        """调用DeepSeek模型"""
        try:
            # 类似qwen的实现
            history = self.conversation_history.get(session_id, [])
            messages = [{"role": "system", "content": "你是JARVIS，一个专业的AI助手，擅长深度思考和分析。"}]
            
            for conv in history[-5:]:
                messages.append({"role": "user", "content": conv["user"]})
                messages.append({"role": "assistant", "content": conv["assistant"]})
                
            messages.append({"role": "user", "content": message})
            
            response = deepseek_client.chat.completions.create(
                model="deepseek-chat",
                messages=messages,
                temperature=0.3
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"DeepSeek API调用失败: {e}")
            raise
            
    def _fallback_response(self, message: str) -> str:
        """备用响应"""
        message_lower = message.lower()
        
        if any(word in message_lower for word in ["你好", "hello", "hi"]):
            return "你好主人！我是JARVIS，您的智能管家。很高兴为您服务！"
        elif any(word in message_lower for word in ["时间", "现在", "几点"]):
            current_time = datetime.now().strftime("%Y年%m月%d日 %H:%M:%S")
            return f"现在是{current_time}，主人。"
        elif any(word in message_lower for word in ["天气", "温度"]):
            return "抱歉主人，我正在连接天气服务，请稍后再试。"
        elif any(word in message_lower for word in ["帮助", "功能", "能做什么"]):
            return "我可以帮您进行智能对话、查询信息、管理日程、控制设备等。请告诉我您需要什么帮助！"
        else:
            return f"我理解了您的请求。作为您的智能管家，我会尽力帮助您处理这个问题：{message}"

# 全局实例
jarvis_core = JarvisCore()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化
    await jarvis_core.initialize()
    yield
    # 关闭时清理
    await jarvis_core.cleanup()

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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket连接管理
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        logger.info(f"WebSocket连接建立: {session_id}")

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
            logger.info(f"WebSocket连接断开: {session_id}")

    async def send_message(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            try:
                await self.active_connections[session_id].send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"发送WebSocket消息失败: {e}")
                self.disconnect(session_id)

manager = ConnectionManager()

@app.get("/")
async def root():
    """健康检查端点"""
    return {"message": "JARVIS AI Core is running", "status": "healthy"}

@app.get("/status")
async def get_status():
    """获取系统状态"""
    return {
        "jarvis_core": jarvis_core.initialized,
        "speech_recognition": SPEECH_RECOGNITION_AVAILABLE,
        "ai_available": AI_AVAILABLE,
        "active_sessions": len(jarvis_core.active_sessions),
        "active_connections": len(manager.active_connections)
    }

@app.post("/chat")
async def chat(request: ChatRequest):
    """处理聊天请求"""
    try:
        start_time = datetime.now()
        session_id = request.session_id or str(uuid.uuid4())
        
        logger.info(f"💬 收到对话请求 [{session_id[:8]}] (模式: {request.mode}): {request.message}")
        
        response_text = await jarvis_core.process_message(
            request.message, 
            request.mode, 
            session_id
        )
        
        thinking_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"✅ 对话完成 [{session_id[:8]}] 用时: {thinking_time:.2f}s")
        
        return ChatResponse(
            response=response_text,
            model_used=request.mode,
            session_id=session_id,
            thinking_time=thinking_time,
            success=True
        )
        
    except Exception as e:
        logger.error(f"❌ 处理聊天请求失败: {e}")
        return ChatResponse(
            response="抱歉，我遇到了一些技术问题。请稍后再试。",
            model_used="fallback",
            session_id=request.session_id or str(uuid.uuid4()),
            thinking_time=0.0,
            success=False
        )

# 阿里云Paraformer实时语音识别回调类 (按照官方文档实现)
class JarvisRecognitionCallback(RecognitionCallback):
    """JARVIS语音识别回调类 - 按照阿里云官方SDK文档实现"""
    
    def __init__(self, websocket, loop):
        super().__init__()
        self.websocket = websocket
        self.accumulated_text = ""
        self.loop = loop  # 保存事件循环引用
        
    def on_open(self):
        """连接建立时调用"""
        logger.info("🎙️ Paraformer语音识别会话已建立")
        self._schedule_websocket_send({
            "type": "connection",
            "message": "语音识别连接已建立"
        })
    
    def on_close(self):
        """连接关闭时调用"""
        logger.info("🎙️ Paraformer语音识别会话已关闭")
        self._schedule_websocket_send({
            "type": "connection",
            "message": "语音识别连接已关闭"
        })
    
    def on_event(self, result):
        """处理实时识别结果 - 按照官方文档格式"""
        try:
            logger.info(f"🎯 识别句子结果: {result}")
            if result and hasattr(result, 'get_sentence'):
                sentence = result.get_sentence()
                logger.info(f"🎯 识别句子结果: {sentence}")
                
                if sentence and isinstance(sentence, dict) and 'text' in sentence:
                    text = sentence['text']
                    confidence = sentence.get('confidence', 0.9)
                    # Paraformer使用sentence_end字段表示句子结束
                    is_final = RecognitionResult.is_sentence_end(sentence)
                    
                    logger.info(f"✅ 识别文本: '{text}' (置信度: {confidence}, 完成: {is_final})")
                    
                    # 累积文本
                    if text.strip():
                        self.accumulated_text += text
                    
                    # 发送结果到前端
                    result_data = {
                        "type": "result",
                        "transcript": text,
                        "accumulated": self.accumulated_text,
                        "is_final": is_final,
                        "confidence": confidence
                    }
                    logger.info(f"📤 发送识别结果到前端: {result_data}")
                    self._schedule_websocket_send(result_data)
                    
                    # 当is_final为True时，发送完整语音输入到聊天系统
                    if is_final and self.accumulated_text.strip():
                        logger.info(f"🎯 语音识别完成，发送到聊天系统: '{self.accumulated_text}'")
                        self._process_final_speech(self.accumulated_text.strip())
                        # 重置累积文本，准备下一次识别
                        self.accumulated_text = ""
                else:
                    logger.debug(f"🎙️ 无文本内容的句子: {sentence}")
            else:
                logger.debug(f"🎙️ 非句子结果: {type(result)} - {result}")
                    
        except Exception as e:
            logger.error(f"❌ 处理识别结果异常: {e}", exc_info=True)
            self._schedule_websocket_send({
                "type": "error",
                "message": f"处理识别结果异常: {e}"
            })
    
    def on_error(self, error):
        """处理错误"""
        error_msg = f"Paraformer识别错误: {error}"
        logger.error(error_msg)
        self._schedule_websocket_send({
            "type": "error",
            "message": error_msg
        })
    
    def _process_final_speech(self, final_text: str):
        """处理最终的语音识别结果，发送到聊天系统"""
        logger.info(f"🎙️➡️💬 处理最终语音输入: '{final_text}'")
        
        if self.loop and not self.loop.is_closed():
            try:
                # 调度聊天处理任务到事件循环
                future = asyncio.run_coroutine_threadsafe(
                    self._handle_speech_to_chat(final_text), 
                    self.loop
                )
                # 不需要等待future完成，让它在后台异步执行
                logger.info(f"✅ 语音转聊天任务已调度到事件循环")
            except Exception as e:
                logger.error(f"❌ 调度语音转聊天任务失败: {e}")
        else:
            logger.error("❌ 事件循环不可用，无法处理语音输入")
    
    async def _handle_speech_to_chat(self, speech_text: str):
        """异步处理语音转聊天"""
        try:
            logger.info(f"💬 开始处理语音聊天: '{speech_text}'")
            
            # 通过JARVIS核心处理语音输入
            response = await jarvis_core.process_message(
                message=speech_text,
                mode="auto",  # 自动选择模型
                session_id=self.session_id
            )
            
            logger.info(f"🤖 JARVIS回复: '{response}'")
            
            # 发送聊天响应到前端
            chat_response = {
                "type": "chat_response",
                "user_message": speech_text,
                "assistant_response": response,
                "timestamp": datetime.now().isoformat()
            }
            
            await self._async_websocket_send(chat_response)
            
        except Exception as e:
            logger.error(f"❌ 处理语音聊天失败: {e}", exc_info=True)
            error_response = {
                "type": "chat_error",
                "message": f"处理语音输入失败: {e}"
            }
            await self._async_websocket_send(error_response)
    
    async def _async_websocket_send(self, data):
        """异步发送WebSocket消息"""
        try:
            await manager.send_message(self.session_id, data)
            logger.info(f"✅ WebSocket消息发送成功: {data.get('type', 'unknown')}")
        except Exception as e:
            logger.error(f"❌ WebSocket消息发送失败: {e}")

    def _schedule_websocket_send(self, data):
        """线程安全地调度WebSocket发送任务"""
        logger.info(f"🔄 _schedule_websocket_send 被调用，数据: {data}")
        
        if self.loop and not self.loop.is_closed():
            try:
                logger.info(f"🚀 正在调度WebSocket发送任务到事件循环")
                # 在主事件循环中调度协程
                future = asyncio.run_coroutine_threadsafe(
                    self._send_to_websocket(data), 
                    self.loop
                )
                logger.info(f"✅ WebSocket发送任务已调度，future: {future}")
            except Exception as e:
                logger.error(f"❌ 调度WebSocket发送失败: {e}")
        else:
            logger.warning(f"⚠️ 事件循环不可用，无法发送WebSocket消息。Loop: {self.loop}")
            logger.warning(f"⚠️ Loop状态 - 存在: {self.loop is not None}, 关闭: {self.loop.is_closed() if self.loop else 'N/A'}")
    
    async def _send_to_websocket(self, data):
        """发送数据到WebSocket"""
        try:
            logger.info(f"📡 开始发送WebSocket消息: {data}")
            logger.info(f"🔍 WebSocket状态检查 - 对象: {self.websocket}, 类型: {type(self.websocket)}")
            
            # 检查WebSocket连接状态
            if hasattr(self.websocket, 'client_state'):
                logger.info(f"🔍 WebSocket客户端状态: {self.websocket.client_state}")
            
            json_data = json.dumps(data, ensure_ascii=False)
            logger.info(f"📤 准备发送JSON数据: {json_data}")
            
            await self.websocket.send_text(json_data)
            logger.info(f"✅ WebSocket消息发送成功！")
            
        except Exception as e:
            logger.error(f"❌ 发送WebSocket消息失败: {e}")
            logger.error(f"❌ WebSocket错误详情: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"❌ 完整错误堆栈: {traceback.format_exc()}")
    
    def reset(self):
        """重置累积文本"""
        self.accumulated_text = ""

# 全局识别器管理
recognition_sessions = {}
dashscope.api_key = 'sk-e0f5318e73404c91992a6377feb08f96'

async def start_recognition_session(session_id: str, websocket) -> bool:
    """启动Paraformer实时语音识别会话 - 按照官方文档实现"""
    try:
        # 检查是否有真实的API密钥
        has_real_api_key = (
            ALIBABA_CLOUD_CONFIG["api_key"] and 
            ALIBABA_CLOUD_CONFIG["api_key"] != "your_api_key_here" and
            not ALIBABA_CLOUD_CONFIG["api_key"].startswith("sk-test") and
            len(ALIBABA_CLOUD_CONFIG["api_key"]) > 20
        )
        
        if not SPEECH_RECOGNITION_AVAILABLE or not has_real_api_key:
            logger.info("🤖 使用智能模拟模式（API密钥未配置或SDK不可用）")
            recognition_sessions[session_id] = {
                "mode": "mock",
                "accumulated_audio": b"",
                "chunk_count": 0
            }
            return True
        
        logger.info("🔥 启动阿里云Paraformer实时语音识别...")
        
        # 获取当前事件循环
        current_loop = asyncio.get_running_loop()
        
        # 创建回调实例
        callback = JarvisRecognitionCallback(websocket, current_loop)
        
        # 按照官方文档创建Recognition实例
        recognition = Recognition(
            model='paraformer-realtime-v2',  # 官方推荐的多语言模型
            format='pcm',                    # PCM格式，适合实时流
            sample_rate=16000,               # 16kHz采样率
            language_hints=['zh', 'en'],     # 中英文语言提示
            semantic_punctuation_enabled=False,
            callback=callback                # 设置回调
        )
        
        # 启动识别会话
        logger.info("🎙️ 调用recognition.start()启动识别...")
        recognition.start()
        
        # 保存会话信息
        recognition_sessions[session_id] = {
            "mode": "real",
            "recognition": recognition,
            "callback": callback,
            "is_active": True
        }
        
        logger.info(f"✅ Paraformer语音识别会话启动成功: {session_id}")
        
        # 发送启动成功消息
        await websocket.send_text(json.dumps({
            "type": "status",
            "message": "Paraformer语音识别已启动",
            "model": "paraformer-realtime-v2"
        }))
        
        return True
        
    except Exception as e:
        logger.error(f"❌ 启动Paraformer语音识别会话失败: {e}", exc_info=True)
        
        # 发送错误消息
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"语音识别启动失败: {str(e)}"
            }))
        except:
            pass
            
        # 降级到模拟模式
        logger.info("🤖 降级到智能模拟模式")
        recognition_sessions[session_id] = {
            "mode": "mock",
            "accumulated_audio": b"",
            "chunk_count": 0
        }
        return False

async def stop_recognition_session(session_id: str):
    """停止Paraformer语音识别会话 - 按照官方文档实现"""
    try:
        if session_id in recognition_sessions:
            session = recognition_sessions[session_id]
            
            if session["mode"] == "real" and "recognition" in session:
                recognition = session["recognition"]
                logger.info("🛑 调用recognition.stop()停止识别...")
                recognition.stop()
                logger.info(f"✅ Paraformer语音识别会话已停止: {session_id}")
                
                # 重置回调的累积文本
                if "callback" in session:
                    session["callback"].reset()
            
            del recognition_sessions[session_id]
            logger.info(f"🗑️ 清理识别会话: {session_id}")
            
    except Exception as e:
        logger.error(f"❌ 停止Paraformer识别会话失败: {e}", exc_info=True)

def is_pcm_audio_data(audio_data: bytes) -> bool:
    """检查音频数据是否为PCM格式"""
    if len(audio_data) < 4:
        return False
    
    # 检查是否为WebM/MP4容器格式（包含特定的头部标识）
    webm_signatures = [b'pmoof', b'mfhd', b'traf', b'tfhd', b'tfdt', b'trun', b'mdat']
    mp4_signatures = [b'ftyp', b'moov', b'mdat', b'free']
    wav_signature = b'RIFF'
    webm_signature = b'\x1a\x45\xdf\xa3'  # EBML header for WebM
    
    # 检查前64字节中是否包含容器格式标识
    check_range = audio_data[:min(64, len(audio_data))]
    
    # 检查是否为容器格式
    for sig in webm_signatures + mp4_signatures:
        if sig in check_range:
            return False
    
    if check_range.startswith(wav_signature) or check_range.startswith(webm_signature):
        return False
    
    # 基本的PCM数据验证：检查数据长度是否为偶数（16位PCM）
    if len(audio_data) % 2 != 0:
        return False
    
    return True

async def send_audio_to_recognition(session_id: str, audio_data: bytes, websocket) -> Optional[str]:
    """发送音频数据到识别器"""
    try:
        if session_id not in recognition_sessions:
            logger.warning(f"⚠️ 识别会话不存在: {session_id}")
            return None
        
        session = recognition_sessions[session_id]
        
        # 验证音频数据格式
        if not is_pcm_audio_data(audio_data):
            logger.warning(f"⚠️ 接收到非PCM格式音频数据: {len(audio_data)} bytes, 前16字节: {audio_data[:16]}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "音频格式错误：需要PCM格式，请检查前端AudioProcessor配置"
            }))
            return None
        
        if session["mode"] == "mock":
            # 智能模拟模式 - 累积音频数据
            if "accumulated_audio" not in session:
                session["accumulated_audio"] = b""
                session["last_result_time"] = 0
                session["chunk_count"] = 0
            
            # 累积音频数据
            session["accumulated_audio"] += audio_data
            session["chunk_count"] += 1
            
            # 每收到音频块就处理
            accumulated_size = len(session["accumulated_audio"])
            chunk_count = session["chunk_count"]
            
            if chunk_count >= 1 or accumulated_size >= 1000:
                result = generate_smart_mock_result(session["accumulated_audio"])
                logger.info(f"🎯 智能模拟识别结果: {result} (累积 {accumulated_size} bytes)")
                
                await websocket.send_text(json.dumps({
                    "type": "result",
                    "transcript": result,
                    "is_final": True,
                    "confidence": 0.9
                }))
                
                # 重置累积数据
                session["accumulated_audio"] = b""
                session["chunk_count"] = 0
                return result
            
            return None
        
        elif session["mode"] == "real" and "recognition" in session and session.get("is_active"):
            # Paraformer实时识别模式 - 按照官方文档实现
            recognition = session["recognition"]
            
            # 检查识别器状态
            try:
                # 确保是PCM格式后再发送到Paraformer
                logger.debug(f"📤 发送PCM音频帧到Paraformer: {len(audio_data)} bytes")
                recognition.send_audio_frame(audio_data)
                
                # 实时识别结果通过callback异步返回，这里不需要返回值
                return None
            except Exception as e:
                if "stopped" in str(e).lower():
                    logger.warning(f"⚠️ 语音识别会话已停止，尝试重新启动: {e}")
                    # 标记会话为非活跃状态
                    session["is_active"] = False
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "语音识别会话已断开，请重新开始"
                    }))
                    return None
                else:
                    raise e
        else:
            logger.info(f"📤 发送音频帧到Paraformer: {session.get('mode', 'unknown')} mode")
        
    except Exception as e:
        logger.error(f"❌ 发送音频到识别器失败: {e}")
        await websocket.send_text(json.dumps({
            "type": "error", 
            "message": f"音频处理失败: {str(e)}"
        }))
        return None

def generate_smart_mock_result(audio_data: bytes) -> str:
    """生成智能模拟识别结果"""
    data_length = len(audio_data) if audio_data else 0
    
    if data_length < 10000:
        return "嗯"
    elif data_length < 20000:
        return "你好JARVIS"
    elif data_length < 40000:
        return "请帮我查一下天气"
    elif data_length < 70000:
        return "今天天气怎么样，适合出门吗？"
    else:
        return "JARVIS，请帮我安排一下今天的日程，我需要准备明天的会议材料。"

@app.websocket("/ws/speech")
async def speech_websocket_endpoint(websocket: WebSocket):
    """专门的语音识别WebSocket端点"""
    await manager.connect(websocket, "speech")
    
    try:
        # 发送欢迎消息
        await websocket.send_text(json.dumps({
            "type": "status",
            "message": "JARVIS语音识别服务已连接"
        }))
        
        while True:
            # 接收消息
            message = await websocket.receive()
            
            if message["type"] == "websocket.disconnect":
                break
            elif message["type"] == "websocket.receive":
                if "text" in message:
                    # 文本命令
                    try:
                        command = json.loads(message["text"])
                        cmd_type = command.get("type", "")
                        
                        logger.info(f"收到语音识别命令: {cmd_type}")
                        
                        if cmd_type == "start":
                            # 启动语音识别会话
                            success = await start_recognition_session("speech", websocket)
                            await websocket.send_text(json.dumps({
                                "type": "status",
                                "message": "语音识别已开始" if success else "语音识别启动失败，使用模拟模式"
                            }))
                        elif cmd_type == "stop":
                            # 停止语音识别会话
                            await stop_recognition_session("speech")
                            await websocket.send_text(json.dumps({
                                "type": "status", 
                                "message": "语音识别已结束"
                            }))
                        elif cmd_type == "status":
                            await websocket.send_text(json.dumps({
                                "type": "status",
                                "data": {
                                    "is_recognizing": True,
                                    "model": "jarvis-core",
                                    "sample_rate": 16000,
                                    "api_key_configured": True
                                }
                            }))
                    except json.JSONDecodeError:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "无效的JSON格式"
                        }))
                        
                elif "bytes" in message:
                    # 音频数据 - 实时语音识别
                    audio_data = message["bytes"]
                    logger.info(f"收到音频数据: {len(audio_data)} bytes")
                    
                    # 发送音频到识别器
                    await send_audio_to_recognition("speech", audio_data, websocket)
    
    except WebSocketDisconnect:
        manager.disconnect("speech")
        await stop_recognition_session("speech")
        logger.info("语音识别WebSocket连接断开")
    except Exception as e:
        logger.error(f"语音识别WebSocket错误: {e}")
        manager.disconnect("speech")
        await stop_recognition_session("speech")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"WebSocket错误: {str(e)}"
            }))
        except:
            pass

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """通用WebSocket端点"""
    session_id = str(uuid.uuid4())
    await manager.connect(websocket, session_id)
    
    try:
        # 发送连接成功消息
        await manager.send_message(session_id, {
            "type": "connection",
            "status": "connected", 
            "session_id": session_id,
            "features": ["chat", "voice", "vision"]
        })
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            message_type = message.get("type")
            
            if message_type == "chat":
                # 处理聊天消息
                user_message = message.get("message", "")
                mode = message.get("mode", "auto")
                
                response_text = await jarvis_core.process_message(user_message, mode, session_id)
                
                await manager.send_message(session_id, {
                    "type": "chat_response",
                    "response": response_text,
                    "session_id": session_id
                })
                
    except WebSocketDisconnect:
        manager.disconnect(session_id)
        logger.info(f"WebSocket连接断开: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket错误: {e}")
        manager.disconnect(session_id)

if __name__ == "__main__":
    print("🤖 启动JARVIS核心服务器...")
    print("📍 服务地址: http://127.0.0.1:8000")
    print("📖 API文档: http://127.0.0.1:8000/docs")
    
    uvicorn.run(
        "main_simple:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )