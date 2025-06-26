"""
JARVIS主智能体
协调各个子系统，提供智能管家服务
"""

import asyncio
import logging
import json
from typing import Dict, Any, List, Optional
from datetime import datetime

from models.model_router import ModelRouter
from memory.unified_memory_manager import UnifiedMemoryManager
from memory.enhanced_memory_manager import MemoryType
from config.config_manager import ConfigManager

logger = logging.getLogger(__name__)

class JarvisAgent:
    """JARVIS主智能体"""
    
    def __init__(
        self,
        model_router: ModelRouter,
        memory_manager: UnifiedMemoryManager,
        config_manager: ConfigManager
    ):
        """初始化JARVIS智能体"""
        self.model_router = model_router
        self.memory_manager = memory_manager
        self.config_manager = config_manager
        
        # 当前会话状态
        self.current_session_id = None
        self.conversation_context = []
        self.active_tasks = []
        
        # 个性化设置
        self.personality = config_manager.get_personality_config()
        self.user_name = config_manager.get_user_config("name") or "主人"
        
        # 工具和功能模块（待集成）
        self.tools = {}
        self.vision_enabled = config_manager.is_vision_enabled()
        self.voice_enabled = config_manager.is_voice_enabled()
        
        logger.info("JARVIS智能体初始化完成")
    
    async def initialize(self):
        """初始化智能体"""
        try:
            # 开始新会话
            self.current_session_id = self.memory_manager.start_new_session()
            
            # 加载用户偏好和历史交互模式
            await self._load_user_context()
            
            # 初始化问候
            greeting = await self._generate_greeting()
            await self._save_interaction("assistant", greeting)
            
            logger.info(f"JARVIS智能体初始化完成，会话ID: {self.current_session_id}")
            
        except Exception as e:
            logger.error(f"JARVIS智能体初始化失败: {e}")
            raise
    
    async def _load_user_context(self):
        """加载用户上下文"""
        try:
            # 加载用户偏好
            response_style = await self.memory_manager.get_user_preference("response_style")
            if response_style:
                self.config_manager.set_user_config("preferences.response_style", response_style, save=False)
            
            # 加载最近的重要记忆
            recent_memories = await self.memory_manager.search_memory(
                query=self.user_name,
                memory_type=MemoryType.USER,
                limit=5
            )
            
            if recent_memories:
                logger.info(f"加载了{len(recent_memories)}条用户记忆")
                
        except Exception as e:
            logger.error(f"加载用户上下文失败: {e}")
    
    async def _generate_greeting(self) -> str:
        """生成个性化问候语"""
        try:
            # 获取当前时间
            current_hour = datetime.now().hour
            time_greeting = ""
            
            if 5 <= current_hour < 12:
                time_greeting = "早上好"
            elif 12 <= current_hour < 18:
                time_greeting = "下午好"
            elif 18 <= current_hour < 22:
                time_greeting = "晚上好"
            else:
                time_greeting = "夜深了"
            
            # 使用个性化响应模式
            greeting_patterns = self.personality.get("response_patterns", {}).get("greeting", [])
            if greeting_patterns:
                import random
                base_greeting = random.choice(greeting_patterns)
            else:
                base_greeting = f"{time_greeting}，{self.user_name}！"
            
            # 添加状态信息
            full_greeting = f"{base_greeting} 我是您的智能管家小爱，随时为您服务！"
            
            return full_greeting
            
        except Exception as e:
            logger.error(f"生成问候语失败: {e}")
            return f"您好{self.user_name}，我是小爱，很高兴为您服务！"
    
    async def process_message(
        self,
        user_message: str,
        mode: str = "auto",
        context: Dict[str, Any] = None
    ) -> str:
        """处理用户消息"""
        try:
            context = context or {}
            
            # 保存用户消息
            await self._save_interaction("user", user_message)
            
            # 准备对话上下文
            conversation_context = await self._prepare_conversation_context(user_message, context)
            
            # 检查是否需要特殊处理
            special_response = await self._handle_special_requests(user_message)
            if special_response:
                await self._save_interaction("assistant", special_response)
                return special_response
            
            # 路由到合适的模型
            routing_context = {
                **context,
                "conversation_context": self._format_conversation_context(),
                "user_name": self.user_name,
                "personality": self.personality
            }
            
            response_data = await self.model_router.route_request(
                message=user_message,
                context=routing_context,
                mode=mode
            )
            
            if response_data["success"]:
                response = response_data["response"]
                
                # 应用个性化处理
                personalized_response = await self._apply_personality(response, user_message)
                
                # 保存助手回复
                await self._save_interaction("assistant", personalized_response)
                
                # 学习用户偏好
                await self._learn_from_interaction(user_message, personalized_response)
                
                return personalized_response
            else:
                error_response = "抱歉主人，我遇到了一些技术问题，请稍后再试。"
                await self._save_interaction("assistant", error_response)
                return error_response
                
        except Exception as e:
            logger.error(f"处理消息失败: {e}")
            error_response = "抱歉主人，处理您的请求时出现了错误。"
            await self._save_interaction("assistant", error_response)
            return error_response
    
    async def _prepare_conversation_context(
        self,
        user_message: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """准备对话上下文"""
        try:
            # 获取会话历史
            session_context = await self.memory_manager.get_session_context(
                self.current_session_id, limit=10
            )
            
            # 搜索相关记忆
            relevant_memories = await self.memory_manager.search_memory(
                query=user_message,
                memory_type="all",
                limit=5
            )
            
            # 构建上下文
            conversation_context = {
                "session_history": session_context,
                "relevant_memories": relevant_memories,
                "user_preferences": {
                    "name": self.user_name,
                    "response_style": self.config_manager.get_response_style(),
                    "use_emoji": self.config_manager.should_use_emoji()
                },
                "current_time": datetime.now().isoformat(),
                **context
            }
            
            return conversation_context
            
        except Exception as e:
            logger.error(f"准备对话上下文失败: {e}")
            return context
    
    async def _handle_special_requests(self, user_message: str) -> Optional[str]:
        """处理特殊请求"""
        try:
            message_lower = user_message.lower()
            
            # 时间查询
            if any(keyword in message_lower for keyword in ["时间", "几点", "现在"]):
                current_time = datetime.now().strftime("%Y年%m月%d日 %H:%M:%S")
                return f"现在是{current_time}，{self.user_name}。"
            
            # 自我介绍
            if any(keyword in message_lower for keyword in ["你是谁", "介绍自己", "自我介绍"]):
                return (f"我是{self.personality.get('name', '小爱')}，您的专属智能管家！"
                       f"我今年{self.personality.get('age', '25000')}岁，"
                       f"性格{self._describe_personality()}，"
                       f"随时为{self.user_name}提供各种服务。")
            
            # 能力询问
            if any(keyword in message_lower for keyword in ["能做什么", "功能", "会什么"]):
                capabilities = [
                    "📱 智能对话和问答",
                    "🖼️ 图像识别和分析" if self.vision_enabled else None,
                    "🎤 语音交互" if self.voice_enabled else None,
                    "🗺️ 地图导航和路线规划",
                    "💰 价格比对和购物建议",
                    "📱 手机应用控制",
                    "🧠 深度思考和复杂推理",
                    "📅 日程管理和提醒",
                    "📰 新闻资讯获取"
                ]
                
                capabilities = [cap for cap in capabilities if cap is not None]
                capability_text = "\n".join(capabilities)
                
                return f"我的主要能力包括：\n{capability_text}\n\n有什么需要帮助的吗，{self.user_name}？"
            
            return None
            
        except Exception as e:
            logger.error(f"处理特殊请求失败: {e}")
            return None
    
    def _describe_personality(self) -> str:
        """描述个性特征"""
        try:
            traits = self.personality.get("personality_traits", {})
            
            descriptions = []
            if traits.get("friendliness", 0) > 0.8:
                descriptions.append("友善")
            if traits.get("helpfulness", 0) > 0.8:
                descriptions.append("乐于助人")
            if traits.get("humor", 0) > 0.7:
                descriptions.append("幽默")
            if traits.get("empathy", 0) > 0.8:
                descriptions.append("善解人意")
            
            return "、".join(descriptions) if descriptions else "甜美可爱"
            
        except Exception as e:
            logger.error(f"描述个性失败: {e}")
            return "甜美可爱"
    
    async def _apply_personality(self, response: str, user_message: str) -> str:
        """应用个性化处理"""
        try:
            # 确保称呼正确
            if "用户" in response:
                response = response.replace("用户", self.user_name)
            
            # 根据个性特征调整语调
            traits = self.personality.get("personality_traits", {})
            
            # 如果用户询问困难问题，表达关心
            if any(keyword in user_message for keyword in ["困难", "问题", "麻烦", "不知道"]):
                if traits.get("empathy", 0) > 0.8:
                    empathy_prefix = f"我理解{self.user_name}的困扰，"
                    if not response.startswith(empathy_prefix):
                        response = empathy_prefix + response
            
            # 添加表情符号（如果启用）
            if self.config_manager.should_use_emoji():
                response = self._add_appropriate_emoji(response, user_message)
            
            return response
            
        except Exception as e:
            logger.error(f"应用个性化处理失败: {e}")
            return response
    
    def _add_appropriate_emoji(self, response: str, user_message: str) -> str:
        """添加合适的表情符号"""
        try:
            # 简单的表情符号添加逻辑
            if any(keyword in user_message for keyword in ["谢谢", "感谢"]):
                return response + " 😊"
            elif any(keyword in user_message for keyword in ["好的", "是的", "对的"]):
                return response + " 👍"
            elif any(keyword in user_message for keyword in ["困难", "问题", "麻烦"]):
                return response + " 🤔"
            elif "时间" in user_message:
                return response + " ⏰"
            
            return response
            
        except Exception:
            return response
    
    async def _save_interaction(self, role: str, content: str):
        """保存交互记录"""
        try:
            # 保存到会话记忆
            await self.memory_manager.save_session_memory(
                session_id=self.current_session_id,
                role=role,
                content=content,
                metadata={"timestamp": datetime.now().isoformat()}
            )
            
            # 更新对话上下文
            self.conversation_context.append({
                "role": role,
                "content": content,
                "timestamp": datetime.now().isoformat()
            })
            
            # 保持对话上下文长度
            if len(self.conversation_context) > 20:
                self.conversation_context = self.conversation_context[-20:]
                
        except Exception as e:
            logger.error(f"保存交互记录失败: {e}")
    
    def _format_conversation_context(self) -> str:
        """格式化对话上下文"""
        try:
            if not self.conversation_context:
                return ""
            
            context_lines = []
            for item in self.conversation_context[-10:]:  # 最近10轮对话
                role = "用户" if item["role"] == "user" else "助手"
                context_lines.append(f"{role}: {item['content']}")
            
            return "\n".join(context_lines)
            
        except Exception as e:
            logger.error(f"格式化对话上下文失败: {e}")
            return ""
    
    async def _learn_from_interaction(self, user_message: str, assistant_response: str):
        """从交互中学习"""
        try:
            # 分析用户偏好
            if any(keyword in user_message for keyword in ["喜欢", "偏好", "希望"]):
                await self.memory_manager.save_memory(
                    memory_type=MemoryType.USER,
                    content=f"用户表达偏好: {user_message}",
                    metadata={"type": "preference", "content": user_message},
                    importance=0.8
                )
            
            # 记录交互模式
            interaction_pattern = {
                "user_message_length": len(user_message),
                "response_length": len(assistant_response),
                "timestamp": datetime.now().isoformat(),
                "conversation_turn": len(self.conversation_context) // 2
            }
            
            await self.memory_manager.save_interaction_pattern(
                interaction_type="chat",
                pattern_data=interaction_pattern
            )
            
        except Exception as e:
            logger.error(f"学习交互失败: {e}")
    
    async def analyze_image(self, image_data: str, question: str = "请描述这张图片") -> str:
        """分析图像"""
        try:
            if not self.vision_enabled:
                return "抱歉主人，视觉功能当前未启用。"
            
            # 使用千问模型分析图像
            context = {
                "image_data": image_data,
                "has_image": True
            }
            
            response_data = await self.model_router.route_request(
                message=question,
                context=context,
                mode="qwen"
            )
            
            if response_data["success"]:
                analysis_result = response_data["response"]
                
                # 保存视觉记忆
                await self.memory_manager.save_vision_memory(
                    image_description=analysis_result,
                    objects_detected=[],  # TODO: 实现物体检测
                    metadata={"question": question}
                )
                
                return f"我看到了：{analysis_result}"
            else:
                return "抱歉主人，图像分析遇到了问题。"
                
        except Exception as e:
            logger.error(f"图像分析失败: {e}")
            return "抱歉主人，图像分析失败。"
    
    async def process_realtime_message(self, message: str) -> str:
        """处理实时消息（WebSocket）"""
        try:
            # 实时消息通常更简短，优先使用快速模型
            context = {"real_time": True}
            
            response_data = await self.model_router.route_request(
                message=message,
                context=context,
                mode="qwen"
            )
            
            if response_data["success"]:
                response = response_data["response"]
                # 应用简化的个性化处理
                if "用户" in response:
                    response = response.replace("用户", self.user_name)
                return response
            else:
                return "收到，让我想想..."
                
        except Exception as e:
            logger.error(f"处理实时消息失败: {e}")
            return "抱歉，请稍后再试。"
    
    async def get_agent_status(self) -> Dict[str, Any]:
        """获取智能体状态"""
        try:
            memory_stats = await self.memory_manager.get_memory_stats()
            
            return {
                "session_id": self.current_session_id,
                "conversation_turns": len(self.conversation_context) // 2,
                "active_tasks": len(self.active_tasks),
                "personality": self.personality.get("name", "小爱"),
                "capabilities": {
                    "vision_enabled": self.vision_enabled,
                    "voice_enabled": self.voice_enabled
                },
                "memory_stats": memory_stats,
                "model_performance": self.model_router.get_performance_report()
            }
            
        except Exception as e:
            logger.error(f"获取智能体状态失败: {e}")
            return {"error": str(e)}
    
    async def cleanup(self):
        """清理资源"""
        try:
            # 保存会话总结
            if self.conversation_context:
                session_summary = f"会话包含{len(self.conversation_context) // 2}轮对话"
                await self.memory_manager.save_memory(
                    memory_type=MemoryType.SESSION,
                    content=session_summary,
                    metadata={"session_id": self.current_session_id},
                    importance=0.6,
                    expires_in_days=30
                )
            
            logger.info("JARVIS智能体清理完成")
            
        except Exception as e:
            logger.error(f"JARVIS智能体清理失败: {e}")