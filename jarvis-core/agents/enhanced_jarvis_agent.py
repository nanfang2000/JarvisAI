"""
增强版JARVIS主智能体
深度集成Mem0记忆系统，提供智能管家服务
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

class EnhancedJarvisAgent:
    """增强版JARVIS主智能体"""
    
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
        self.current_user_id = "default"
        self.conversation_context = []
        self.active_tasks = []
        
        # 个性化设置
        self.personality = config_manager.get_personality_config()
        self.user_name = config_manager.get_user_config("name") or "主人"
        
        # 工具和功能模块
        self.tools = {}
        self.vision_enabled = config_manager.is_vision_enabled()
        self.voice_enabled = config_manager.is_voice_enabled()
        
        # 学习和适应机制
        self.learning_enabled = True
        self.personalization_level = config_manager.get_user_config("personalization_level", 0.8)
        
        # 性能监控
        self.performance_metrics = {
            "total_interactions": 0,
            "successful_responses": 0,
            "response_times": [],
            "user_satisfaction_scores": []
        }
        
        logger.info("增强版JARVIS智能体初始化完成")
    
    async def initialize(self, user_id: str = "default"):
        """初始化智能体"""
        try:
            self.current_user_id = user_id
            
            # 初始化记忆系统
            await self.memory_manager.initialize()
            
            # 开始新会话
            self.current_session_id = await self.memory_manager.start_session(
                user_id=user_id,
                session_type="chat",
                metadata={"agent_version": "enhanced", "initialized_at": datetime.now().isoformat()}
            )
            
            # 加载用户档案和偏好
            await self._load_user_context()
            
            # 初始化系统知识
            await self._initialize_system_knowledge()
            
            # 生成个性化问候
            greeting = await self._generate_personalized_greeting()
            await self._save_interaction("assistant", greeting)
            
            logger.info(f"增强版JARVIS智能体完全初始化完成 (用户: {user_id}, 会话: {self.current_session_id})")
            return greeting
            
        except Exception as e:
            logger.error(f"JARVIS智能体初始化失败: {e}")
            raise
    
    async def _load_user_context(self):
        """加载用户上下文"""
        try:
            # 获取或创建用户档案
            user_profile = await self.memory_manager.get_user_profile(self.current_user_id)
            if not user_profile:
                # 创建默认用户档案
                default_profile = {
                    "name": self.user_name,
                    "created_at": datetime.now().isoformat(),
                    "preferences": {},
                    "communication_style": "friendly",
                    "interests": []
                }
                await self.memory_manager.create_user_profile(self.current_user_id, default_profile)
                user_profile = default_profile
            
            # 更新用户名
            if user_profile.get("name"):
                self.user_name = user_profile["name"]
            
            # 加载用户偏好
            preferences = await self.memory_manager.get_user_preferences(self.current_user_id)
            
            # 应用偏好设置
            if "response_style" in preferences:
                self.personality["response_style"] = preferences["response_style"]
            
            if "use_emoji" in preferences:
                self.config_manager.set_user_config("preferences.use_emoji", preferences["use_emoji"], save=False)
            
            # 获取用户目标
            active_goals = await self.memory_manager.get_user_goals(self.current_user_id, "active")
            if active_goals:
                logger.info(f"用户有{len(active_goals)}个活跃目标")
            
            logger.info(f"用户上下文加载完成: {self.user_name}")
                
        except Exception as e:
            logger.error(f"加载用户上下文失败: {e}")
    
    async def _initialize_system_knowledge(self):
        """初始化系统知识"""
        try:
            # 注册核心技能
            await self.memory_manager.register_skill(
                skill_name="conversational_ai",
                skill_data={
                    "description": "自然语言对话和理解",
                    "category": "communication",
                    "difficulty": "medium",
                    "version": "1.0"
                }
            )
            
            await self.memory_manager.register_skill(
                skill_name="personalized_response",
                skill_data={
                    "description": "基于用户偏好生成个性化回复",
                    "category": "personalization",
                    "difficulty": "medium",
                    "version": "1.0"
                }
            )
            
            if self.vision_enabled:
                await self.memory_manager.register_skill(
                    skill_name="image_analysis",
                    skill_data={
                        "description": "图像识别和分析",
                        "category": "vision",
                        "difficulty": "hard",
                        "version": "1.0"
                    }
                )
            
        except Exception as e:
            logger.error(f"初始化系统知识失败: {e}")
    
    async def _generate_personalized_greeting(self) -> str:
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
            
            # 获取用户偏好的问候方式
            preferences = await self.memory_manager.get_user_preferences(self.current_user_id, "communication")
            greeting_style = preferences.get("greeting_style", "formal")
            
            # 检查最近的交互历史
            recent_interactions = await self.memory_manager.smart_search(
                query="问候",
                context={
                    "user_id": self.current_user_id,
                    "memory_types": ["session"],
                    "limit": 3
                }
            )
            
            # 生成个性化问候
            if greeting_style == "casual":
                base_greeting = f"{time_greeting}，{self.user_name}！"
            elif greeting_style == "formal":
                base_greeting = f"{time_greeting}，{self.user_name}先生/女士。"
            else:
                base_greeting = f"{time_greeting}，{self.user_name}！"
            
            # 添加个性化元素
            personality_name = self.personality.get("name", "小爱")
            full_greeting = f"{base_greeting} 我是您的智能管家{personality_name}，"
            
            # 根据时间和用户活动添加建议
            if len(recent_interactions.get("unified_results", [])) == 0:
                full_greeting += "很高兴第一次为您服务！有什么我可以帮助您的吗？"
            else:
                full_greeting += "很高兴再次为您服务！今天需要我帮您做些什么呢？"
            
            # 添加表情符号（如果用户喜欢）
            if self.config_manager.should_use_emoji():
                full_greeting += " 😊"
            
            return full_greeting
            
        except Exception as e:
            logger.error(f"生成个性化问候语失败: {e}")
            return f"您好{self.user_name}，我是您的智能管家，很高兴为您服务！"
    
    async def process_message(
        self,
        user_message: str,
        mode: str = "auto",
        context: Dict[str, Any] = None
    ) -> str:
        """处理用户消息"""
        try:
            start_time = datetime.now()
            context = context or {}
            
            # 更新性能指标
            self.performance_metrics["total_interactions"] += 1
            
            # 保存用户消息
            await self._save_interaction("user", user_message)
            
            # 智能意图识别
            intent_data = await self._analyze_user_intent(user_message)
            if intent_data:
                await self.memory_manager.session_memory.track_user_intent(
                    session_id=self.current_session_id,
                    intent=intent_data["intent"],
                    confidence=intent_data["confidence"],
                    entities=intent_data.get("entities", {})
                )
            
            # 准备智能对话上下文
            conversation_context = await self._prepare_intelligent_context(user_message, context)
            
            # 检查特殊请求处理
            special_response = await self._handle_special_requests(user_message)
            if special_response:
                await self._save_interaction("assistant", special_response)
                await self._record_successful_interaction(start_time)
                return special_response
            
            # 检查是否需要创建任务
            task_info = await self._analyze_task_creation(user_message)
            if task_info:
                task_id = await self.memory_manager.create_task(
                    session_id=self.current_session_id,
                    task_title=task_info["title"],
                    task_data=task_info["data"]
                )
                self.active_tasks.append(task_id)
            
            # 路由到合适的模型
            routing_context = {
                **context,
                "conversation_context": conversation_context,
                "user_profile": await self.memory_manager.get_user_profile(self.current_user_id),
                "user_preferences": await self.memory_manager.get_user_preferences(self.current_user_id),
                "personality": self.personality,
                "intent_data": intent_data
            }
            
            response_data = await self.model_router.route_request(
                message=user_message,
                context=routing_context,
                mode=mode
            )
            
            if response_data["success"]:
                response = response_data["response"]
                
                # 应用高级个性化处理
                personalized_response = await self._apply_advanced_personalization(
                    response, user_message, intent_data
                )
                
                # 保存助手回复
                await self._save_interaction("assistant", personalized_response)
                
                # 智能学习和适应
                if self.learning_enabled:
                    await self._learn_from_interaction(user_message, personalized_response, intent_data)
                
                # 记录成功交互
                await self._record_successful_interaction(start_time)
                
                return personalized_response
            else:
                error_response = await self._generate_error_response(response_data.get("error", "未知错误"))
                await self._save_interaction("assistant", error_response)
                return error_response
                
        except Exception as e:
            logger.error(f"处理消息失败: {e}")
            
            # 记录错误模式
            await self.memory_manager.save_error_pattern(
                error_type="message_processing",
                error_description=f"处理用户消息时发生错误: {str(e)}",
                solution="检查系统日志，优化错误处理机制"
            )
            
            error_response = f"抱歉{self.user_name}，处理您的请求时遇到了一些问题，请稍后再试。"
            await self._save_interaction("assistant", error_response)
            return error_response
    
    async def _analyze_user_intent(self, user_message: str) -> Optional[Dict[str, Any]]:
        """分析用户意图"""
        try:
            # 简单的意图识别（可以扩展为更复杂的NLU）
            message_lower = user_message.lower()
            
            intent_patterns = {
                "greeting": ["你好", "hello", "hi", "早上好", "下午好", "晚上好"],
                "question": ["什么", "为什么", "怎么", "如何", "where", "what", "why", "how"],
                "request": ["请", "帮我", "能否", "可以", "help", "please"],
                "task_creation": ["提醒我", "计划", "安排", "记住", "添加到", "创建"],
                "preference": ["我喜欢", "我不喜欢", "偏好", "设置", "配置"],
                "goodbye": ["再见", "拜拜", "goodbye", "bye"],
                "complaint": ["不满意", "问题", "错误", "bug", "不好"]
            }
            
            detected_intent = "general"
            confidence = 0.5
            entities = {}
            
            for intent, keywords in intent_patterns.items():
                for keyword in keywords:
                    if keyword in message_lower:
                        detected_intent = intent
                        confidence = 0.8
                        break
                if detected_intent != "general":
                    break
            
            # 提取简单实体
            if "时间" in message_lower or "点" in message_lower:
                entities["time_mentioned"] = True
            
            if "明天" in message_lower or "今天" in message_lower or "后天" in message_lower:
                entities["date_mentioned"] = True
            
            return {
                "intent": detected_intent,
                "confidence": confidence,
                "entities": entities
            }
            
        except Exception as e:
            logger.error(f"分析用户意图失败: {e}")
            return None
    
    async def _prepare_intelligent_context(self, user_message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """准备智能对话上下文"""
        try:
            # 使用智能搜索获取相关记忆
            relevant_memories = await self.memory_manager.smart_search(
                query=user_message,
                context={
                    "user_id": self.current_user_id,
                    "session_id": self.current_session_id,
                    "memory_types": ["user", "session", "agent"],
                    "limit": 8
                }
            )
            
            # 获取会话历史
            session_context = await self.memory_manager.get_session_context(
                self.current_session_id, limit=10
            )
            
            # 获取用户目标（用于上下文感知）
            active_goals = await self.memory_manager.get_user_goals(self.current_user_id, "active")
            
            # 构建智能上下文
            intelligent_context = {
                "session_history": session_context,
                "relevant_memories": relevant_memories.get("unified_results", []),
                "user_goals": active_goals[:3],  # 最重要的3个目标
                "user_preferences": await self.memory_manager.get_user_preferences(self.current_user_id),
                "current_time": datetime.now().isoformat(),
                "conversation_turn": len(session_context),
                "active_tasks": len(self.active_tasks),
                **context
            }
            
            return intelligent_context
            
        except Exception as e:
            logger.error(f"准备智能对话上下文失败: {e}")
            return context
    
    async def _analyze_task_creation(self, user_message: str) -> Optional[Dict[str, Any]]:
        """分析是否需要创建任务"""
        try:
            message_lower = user_message.lower()
            
            # 任务创建关键词
            task_keywords = ["提醒我", "记住", "安排", "计划", "添加到", "创建任务", "别忘了"]
            
            for keyword in task_keywords:
                if keyword in message_lower:
                    # 提取任务标题
                    title = user_message
                    if keyword in user_message:
                        title = user_message.split(keyword)[1].strip()
                    
                    return {
                        "title": title[:100],  # 限制标题长度
                        "data": {
                            "description": user_message,
                            "priority": "medium",
                            "created_from": "conversation",
                            "auto_created": True
                        }
                    }
            
            return None
            
        except Exception as e:
            logger.error(f"分析任务创建失败: {e}")
            return None
    
    async def _handle_special_requests(self, user_message: str) -> Optional[str]:
        """处理特殊请求"""
        try:
            message_lower = user_message.lower()
            
            # 时间查询
            if any(keyword in message_lower for keyword in ["时间", "几点", "现在时间"]):
                current_time = datetime.now().strftime("%Y年%m月%d日 %H:%M:%S")
                return f"现在是{current_time}，{self.user_name}。"
            
            # 自我介绍
            if any(keyword in message_lower for keyword in ["你是谁", "介绍自己", "自我介绍"]):
                personality_name = self.personality.get("name", "小爱")
                return (f"我是{personality_name}，您的专属智能管家！"
                       f"我具备先进的记忆系统，能够学习和适应您的偏好，"
                       f"随时为{self.user_name}提供个性化的智能服务。")
            
            # 能力询问
            if any(keyword in message_lower for keyword in ["能做什么", "功能", "会什么", "技能"]):
                capabilities = [
                    "🧠 智能对话和深度理解",
                    "🎯 个性化服务和偏好学习",
                    "📝 任务管理和目标跟踪",
                    "🔍 智能记忆搜索和关联分析"
                ]
                
                if self.vision_enabled:
                    capabilities.append("👁️ 图像识别和视觉分析")
                if self.voice_enabled:
                    capabilities.append("🎤 语音交互和理解")
                
                capability_text = "\n".join(capabilities)
                return f"我的主要能力包括：\n{capability_text}\n\n有什么特别需要帮助的吗，{self.user_name}？"
            
            # 记忆相关查询
            if any(keyword in message_lower for keyword in ["记忆", "记住了什么", "知道我什么"]):
                return await self._handle_memory_inquiry()
            
            # 目标查询
            if any(keyword in message_lower for keyword in ["我的目标", "目标进展", "计划"]):
                return await self._handle_goals_inquiry()
            
            # 偏好查询
            if any(keyword in message_lower for keyword in ["我的偏好", "偏好设置", "喜好"]):
                return await self._handle_preferences_inquiry()
            
            return None
            
        except Exception as e:
            logger.error(f"处理特殊请求失败: {e}")
            return None
    
    async def _handle_memory_inquiry(self) -> str:
        """处理记忆查询"""
        try:
            # 获取用户的重要记忆
            important_memories = await self.memory_manager.smart_search(
                query="",
                context={
                    "user_id": self.current_user_id,
                    "memory_types": ["user"],
                    "limit": 5
                }
            )
            
            if important_memories.get("unified_results"):
                memory_summary = []
                for memory in important_memories["unified_results"][:3]:
                    content = memory.get("content", "")
                    if len(content) > 50:
                        content = content[:50] + "..."
                    memory_summary.append(f"• {content}")
                
                return f"我记住了关于您的这些重要信息：\n" + "\n".join(memory_summary)
            else:
                return f"我还在学习了解您，{self.user_name}。随着我们的交流增加，我会记住更多关于您的偏好和需求。"
                
        except Exception as e:
            logger.error(f"处理记忆查询失败: {e}")
            return "抱歉，无法获取记忆信息。"
    
    async def _handle_goals_inquiry(self) -> str:
        """处理目标查询"""
        try:
            active_goals = await self.memory_manager.get_user_goals(self.current_user_id, "active")
            completed_goals = await self.memory_manager.get_user_goals(self.current_user_id, "completed")
            
            if active_goals or completed_goals:
                response = f"{self.user_name}，您的目标情况如下：\n\n"
                
                if active_goals:
                    response += f"📋 活跃目标 ({len(active_goals)}个)：\n"
                    for goal in active_goals[:3]:
                        response += f"• {goal['title']}\n"
                    
                    if len(active_goals) > 3:
                        response += f"...还有{len(active_goals) - 3}个目标\n"
                
                if completed_goals:
                    response += f"\n✅ 已完成目标 ({len(completed_goals)}个)\n"
                
                response += "\n需要我帮您管理或更新某个目标吗？"
                return response
            else:
                return f"{self.user_name}，您还没有设置任何目标。要不要我帮您制定一些目标？设定目标有助于保持动力和方向感。"
                
        except Exception as e:
            logger.error(f"处理目标查询失败: {e}")
            return "抱歉，无法获取目标信息。"
    
    async def _handle_preferences_inquiry(self) -> str:
        """处理偏好查询"""
        try:
            preferences = await self.memory_manager.get_user_preferences(self.current_user_id)
            
            if preferences:
                pref_list = []
                for category, items in preferences.items():
                    if isinstance(items, dict):
                        for key, value in items.items():
                            pref_list.append(f"• {category}.{key}: {value}")
                    else:
                        pref_list.append(f"• {category}: {items}")
                
                return f"{self.user_name}，我记录的您的偏好包括：\n" + "\n".join(pref_list[:5])
            else:
                return f"{self.user_name}，我还没有记录您的具体偏好。在我们的交流中，我会逐渐学习您的喜好和习惯。"
                
        except Exception as e:
            logger.error(f"处理偏好查询失败: {e}")
            return "抱歉，无法获取偏好信息。"
    
    async def _apply_advanced_personalization(self, response: str, user_message: str, 
                                            intent_data: Dict[str, Any] = None) -> str:
        """应用高级个性化处理"""
        try:
            # 获取用户偏好
            preferences = await self.memory_manager.get_user_preferences(self.current_user_id)
            
            # 称呼个性化
            if "用户" in response:
                response = response.replace("用户", self.user_name)
            
            # 语言风格调整
            communication_style = preferences.get("communication_style", "friendly")
            if communication_style == "formal":
                response = response.replace("！", "。").replace("呢", "")
            elif communication_style == "casual":
                # 添加更多口语化表达
                if "。" in response and not response.endswith("？"):
                    response = response.replace("。", "～")
            
            # 根据意图调整回复风格
            if intent_data:
                intent = intent_data.get("intent", "general")
                
                if intent == "complaint":
                    # 对抱怨更加同理心
                    empathy_prefix = f"我理解{self.user_name}的感受，"
                    if not response.startswith(empathy_prefix):
                        response = empathy_prefix + response
                
                elif intent == "greeting":
                    # 问候回复更加热情
                    if preferences.get("greeting_enthusiasm", "medium") == "high":
                        response += "！很开心见到您"
            
            # 根据用户目标添加相关建议
            if intent_data and intent_data.get("intent") in ["question", "request"]:
                relevant_goals = await self._find_relevant_goals(user_message)
                if relevant_goals:
                    goal_suggestion = f"\n\n💡 这和您的目标'{relevant_goals[0]['title']}'相关，要不要我帮您跟进一下？"
                    if len(response) < 200:  # 避免回复过长
                        response += goal_suggestion
            
            # 添加表情符号（如果用户喜欢）
            if self.config_manager.should_use_emoji():
                response = self._add_contextual_emoji(response, user_message, intent_data)
            
            # 记录个性化技能使用
            await self.memory_manager.record_skill_usage(
                skill_name="personalized_response",
                success=True,
                result_data={"response_length": len(response), "personalization_applied": True}
            )
            
            return response
            
        except Exception as e:
            logger.error(f"应用高级个性化处理失败: {e}")
            
            # 记录失败
            await self.memory_manager.record_skill_usage(
                skill_name="personalized_response",
                success=False,
                result_data={"error": str(e)}
            )
            
            return response
    
    async def _find_relevant_goals(self, user_message: str) -> List[Dict[str, Any]]:
        """查找相关目标"""
        try:
            active_goals = await self.memory_manager.get_user_goals(self.current_user_id, "active")
            
            # 简单的关键词匹配
            relevant_goals = []
            message_words = set(user_message.lower().split())
            
            for goal in active_goals:
                goal_words = set(goal["title"].lower().split())
                if message_words.intersection(goal_words):
                    relevant_goals.append(goal)
            
            return relevant_goals[:2]  # 最多返回2个相关目标
            
        except Exception as e:
            logger.error(f"查找相关目标失败: {e}")
            return []
    
    def _add_contextual_emoji(self, response: str, user_message: str, 
                            intent_data: Dict[str, Any] = None) -> str:
        """添加上下文相关的表情符号"""
        try:
            # 根据意图添加表情
            if intent_data:
                intent = intent_data.get("intent", "general")
                
                if intent == "greeting" and not any(emoji in response for emoji in ["😊", "👋", "🌟"]):
                    return response + " 😊"
                elif intent == "goodbye" and not any(emoji in response for emoji in ["👋", "😊"]):
                    return response + " 👋"
                elif intent == "question" and not any(emoji in response for emoji in ["🤔", "💭"]):
                    return response + " 🤔"
                elif intent == "task_creation" and not any(emoji in response for emoji in ["📝", "✅"]):
                    return response + " 📝"
            
            # 根据关键词添加表情
            if any(keyword in user_message for keyword in ["谢谢", "感谢"]):
                return response + " 😊"
            elif any(keyword in user_message for keyword in ["时间", "几点"]):
                return response + " ⏰"
            elif any(keyword in user_message for keyword in ["目标", "计划"]):
                return response + " 🎯"
            elif any(keyword in user_message for keyword in ["学习", "知识"]):
                return response + " 📚"
            
            return response
            
        except Exception:
            return response
    
    async def _learn_from_interaction(self, user_message: str, assistant_response: str, 
                                    intent_data: Dict[str, Any] = None):
        """从交互中智能学习"""
        try:
            # 分析用户偏好
            preferences_detected = {}
            
            # 语言风格学习
            if len(user_message) > 50:
                preferences_detected["verbose_communication"] = True
            elif len(user_message) < 10:
                preferences_detected["concise_communication"] = True
            
            # 时间偏好学习
            current_hour = datetime.now().hour
            if current_hour < 9 or current_hour > 22:
                preferences_detected["active_hours"] = "extended"
            
            # 主题兴趣学习
            if intent_data and intent_data.get("intent") == "question":
                topic_keywords = self._extract_topic_keywords(user_message)
                if topic_keywords:
                    preferences_detected["interested_topics"] = topic_keywords
            
            # 保存学习到的偏好
            for pref_key, pref_value in preferences_detected.items():
                await self.memory_manager.save_user_preference(
                    user_id=self.current_user_id,
                    category="learned_preferences",
                    key=pref_key,
                    value=pref_value
                )
            
            # 保存交互模式
            interaction_pattern = {
                "user_message_length": len(user_message),
                "response_length": len(assistant_response),
                "intent": intent_data.get("intent", "general") if intent_data else "general",
                "timestamp": datetime.now().isoformat(),
                "conversation_turn": len(self.conversation_context) // 2,
                "response_time": getattr(self, '_last_response_time', 0)
            }
            
            await self.memory_manager.visual_memory.save_interaction_pattern(
                interaction_type="chat",
                pattern_data=interaction_pattern,
                user_id=self.current_user_id
            )
            
            # 保存学习经验
            if intent_data and intent_data.get("confidence", 0) > 0.8:
                await self.memory_manager.save_learning_experience(
                    experience_type="successful_intent_recognition",
                    title=f"成功识别意图: {intent_data['intent']}",
                    content=f"用户消息: {user_message[:100]}...",
                    metadata={
                        "confidence": intent_data["confidence"],
                        "intent": intent_data["intent"],
                        "user_satisfaction": "unknown"  # 可以后续通过反馈更新
                    }
                )
            
        except Exception as e:
            logger.error(f"智能学习失败: {e}")
            
            # 记录学习失败
            await self.memory_manager.save_error_pattern(
                error_type="learning_failure",
                error_description=f"从交互中学习失败: {str(e)}",
                solution="检查学习算法和数据处理逻辑"
            )
    
    def _extract_topic_keywords(self, text: str) -> List[str]:
        """提取主题关键词"""
        try:
            # 简单的关键词提取（可以扩展为更复杂的NLP）
            import re
            
            # 移除常见停用词
            stop_words = {"的", "是", "在", "有", "和", "或", "但", "如果", "因为", "所以", "这", "那", "什么", "怎么", "为什么"}
            
            # 提取中文词汇
            words = re.findall(r'[\u4e00-\u9fff]+', text)
            keywords = [word for word in words if len(word) > 1 and word not in stop_words]
            
            return keywords[:5]  # 返回前5个关键词
            
        except Exception:
            return []
    
    async def _save_interaction(self, role: str, content: str):
        """保存交互记录"""
        try:
            # 保存到会话记忆
            await self.memory_manager.save_message(
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
            if len(self.conversation_context) > 30:
                self.conversation_context = self.conversation_context[-30:]
                
        except Exception as e:
            logger.error(f"保存交互记录失败: {e}")
    
    async def _record_successful_interaction(self, start_time: datetime):
        """记录成功交互"""
        try:
            end_time = datetime.now()
            response_time = (end_time - start_time).total_seconds() * 1000
            
            self.performance_metrics["successful_responses"] += 1
            self.performance_metrics["response_times"].append(response_time)
            self._last_response_time = response_time
            
            # 保持性能指标列表长度
            if len(self.performance_metrics["response_times"]) > 100:
                self.performance_metrics["response_times"] = self.performance_metrics["response_times"][-100:]
            
        except Exception as e:
            logger.error(f"记录成功交互失败: {e}")
    
    async def _generate_error_response(self, error: str) -> str:
        """生成错误回复"""
        try:
            # 根据错误类型生成个性化错误回复
            if "timeout" in error.lower():
                return f"抱歉{self.user_name}，响应时间较长，请稍后再试。"
            elif "network" in error.lower():
                return f"抱歉{self.user_name}，网络连接有问题，请检查网络状态。"
            else:
                return f"抱歉{self.user_name}，我遇到了一些技术问题，正在努力解决。"
                
        except Exception:
            return f"抱歉{self.user_name}，出现了未知错误。"
    
    async def analyze_image(self, image_data: str, question: str = "请描述这张图片") -> str:
        """分析图像"""
        try:
            if not self.vision_enabled:
                return f"抱歉{self.user_name}，视觉功能当前未启用。"
            
            start_time = datetime.now()
            
            # 使用模型进行图像分析
            context = {
                "image_data": image_data,
                "has_image": True,
                "user_profile": await self.memory_manager.get_user_profile(self.current_user_id)
            }
            
            response_data = await self.model_router.route_request(
                message=question,
                context=context,
                mode="qwen"
            )
            
            if response_data["success"]:
                analysis_result = response_data["response"]
                
                # 构建分析结果
                analysis_data = {
                    "description": analysis_result,
                    "objects": [],  # TODO: 实现物体检测
                    "faces": [],    # TODO: 实现人脸检测
                    "emotions": [], # TODO: 实现情绪检测
                    "scene_type": "unknown",
                    "confidence": 0.8
                }
                
                # 保存视觉记忆
                await self.memory_manager.save_image_analysis(
                    image_data=image_data,
                    analysis_results=analysis_data,
                    metadata={"question": question, "user_id": self.current_user_id}
                )
                
                # 记录技能使用
                execution_time = (datetime.now() - start_time).total_seconds() * 1000
                await self.memory_manager.record_skill_usage(
                    skill_name="image_analysis",
                    success=True,
                    execution_time=execution_time,
                    result_data={"description_length": len(analysis_result)}
                )
                
                return f"我看到了：{analysis_result}"
            else:
                return f"抱歉{self.user_name}，图像分析遇到了问题。"
                
        except Exception as e:
            logger.error(f"图像分析失败: {e}")
            
            # 记录错误
            await self.memory_manager.save_error_pattern(
                error_type="image_analysis",
                error_description=f"图像分析失败: {str(e)}",
                solution="检查图像格式和分析模型状态"
            )
            
            return f"抱歉{self.user_name}，图像分析失败。"
    
    async def get_comprehensive_status(self) -> Dict[str, Any]:
        """获取综合状态"""
        try:
            # 获取记忆系统统计
            memory_stats = await self.memory_manager.get_comprehensive_stats()
            
            # 获取用户洞察
            user_insights = await self.memory_manager.generate_comprehensive_insights(self.current_user_id)
            
            # 计算成功率
            success_rate = 0
            if self.performance_metrics["total_interactions"] > 0:
                success_rate = self.performance_metrics["successful_responses"] / self.performance_metrics["total_interactions"]
            
            # 计算平均响应时间
            avg_response_time = 0
            if self.performance_metrics["response_times"]:
                avg_response_time = sum(self.performance_metrics["response_times"]) / len(self.performance_metrics["response_times"])
            
            return {
                "agent_info": {
                    "session_id": self.current_session_id,
                    "user_id": self.current_user_id,
                    "user_name": self.user_name,
                    "personality": self.personality.get("name", "小爱"),
                    "capabilities": {
                        "vision_enabled": self.vision_enabled,
                        "voice_enabled": self.voice_enabled,
                        "learning_enabled": self.learning_enabled
                    }
                },
                "performance_metrics": {
                    "total_interactions": self.performance_metrics["total_interactions"],
                    "success_rate": round(success_rate, 3),
                    "avg_response_time_ms": round(avg_response_time, 2),
                    "active_tasks": len(self.active_tasks)
                },
                "memory_system": memory_stats,
                "user_insights": user_insights,
                "system_health": memory_stats.get("system_health", {}),
                "generated_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"获取综合状态失败: {e}")
            return {"error": str(e)}
    
    async def cleanup(self):
        """清理资源"""
        try:
            # 结束当前会话
            if self.current_session_id:
                session_summary = f"会话包含{len(self.conversation_context) // 2}轮对话，"
                session_summary += f"成功率{self.performance_metrics['successful_responses']}/{self.performance_metrics['total_interactions']}"
                
                await self.memory_manager.end_session(self.current_session_id, session_summary)
            
            # 保存性能指标
            if self.performance_metrics["total_interactions"] > 0:
                performance_summary = {
                    "total_interactions": self.performance_metrics["total_interactions"],
                    "success_rate": self.performance_metrics["successful_responses"] / self.performance_metrics["total_interactions"],
                    "avg_response_time": sum(self.performance_metrics["response_times"]) / len(self.performance_metrics["response_times"]) if self.performance_metrics["response_times"] else 0
                }
                
                await self.memory_manager.save_learning_experience(
                    experience_type="performance_metrics",
                    title="会话性能总结",
                    content=f"本次会话的性能指标: {json.dumps(performance_summary, ensure_ascii=False)}",
                    metadata=performance_summary
                )
            
            # 清理记忆管理器
            await self.memory_manager.cleanup()
            
            logger.info("增强版JARVIS智能体清理完成")
            
        except Exception as e:
            logger.error(f"JARVIS智能体清理失败: {e}")