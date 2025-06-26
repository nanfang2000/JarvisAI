"""
会话记忆管理
管理会话上下文、任务状态和对话历史
"""

import asyncio
import logging
import json
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from .enhanced_memory_manager import EnhancedMemoryManager, MemoryType

logger = logging.getLogger(__name__)

class SessionMemoryManager:
    """会话记忆管理器"""
    
    def __init__(self, memory_manager: EnhancedMemoryManager):
        """初始化会话记忆管理器"""
        self.memory_manager = memory_manager
        self.active_sessions = {}  # 活跃会话缓存
        self.session_contexts = {}  # 会话上下文缓存
        self.session_tasks = {}  # 会话任务状态
        
    async def start_session(self, user_id: str, session_type: str = "chat", metadata: Dict[str, Any] = None) -> str:
        """开始新会话"""
        try:
            session_id = self.memory_manager.start_new_session(user_id)
            
            session_info = {
                "session_id": session_id,
                "user_id": user_id,
                "session_type": session_type,
                "start_time": datetime.now().isoformat(),
                "status": "active",
                "metadata": metadata or {},
                "message_count": 0,
                "task_count": 0
            }
            
            # 缓存会话信息
            self.active_sessions[session_id] = session_info
            self.session_contexts[session_id] = []
            self.session_tasks[session_id] = []
            
            # 保存会话开始记录
            await self.memory_manager.save_memory(
                memory_type=MemoryType.SESSION,
                content=f"会话开始 - 类型: {session_type}",
                metadata={
                    "type": "session_start",
                    "session_id": session_id,
                    "session_type": session_type,
                    "user_id": user_id,
                    **metadata
                },
                importance=0.6,
                user_id=user_id
            )
            
            logger.info(f"开始新会话: {session_id} (用户: {user_id}, 类型: {session_type})")
            return session_id
            
        except Exception as e:
            logger.error(f"开始会话失败: {e}")
            raise
    
    async def end_session(self, session_id: str, summary: str = None) -> bool:
        """结束会话"""
        try:
            if session_id not in self.active_sessions:
                logger.warning(f"会话不存在: {session_id}")
                return False
            
            session_info = self.active_sessions[session_id]
            session_info["status"] = "ended"
            session_info["end_time"] = datetime.now().isoformat()
            
            # 计算会话时长
            start_time = datetime.fromisoformat(session_info["start_time"])
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            session_info["duration_seconds"] = duration
            
            # 生成会话总结
            if not summary:
                summary = await self._generate_session_summary(session_id)
            
            # 保存会话结束记录
            await self.memory_manager.save_memory(
                memory_type=MemoryType.SESSION,
                content=f"会话结束 - {summary}",
                metadata={
                    "type": "session_end",
                    "session_id": session_id,
                    "session_info": session_info,
                    "summary": summary
                },
                importance=0.7,
                user_id=session_info["user_id"]
            )
            
            # 清理缓存
            del self.active_sessions[session_id]
            if session_id in self.session_contexts:
                del self.session_contexts[session_id]
            if session_id in self.session_tasks:
                del self.session_tasks[session_id]
            
            logger.info(f"会话结束: {session_id} (时长: {duration:.1f}秒)")
            return True
            
        except Exception as e:
            logger.error(f"结束会话失败: {e}")
            return False
    
    async def save_message(self, session_id: str, role: str, content: str, 
                          metadata: Dict[str, Any] = None) -> str:
        """保存消息到会话"""
        try:
            # 更新会话信息
            if session_id in self.active_sessions:
                self.active_sessions[session_id]["message_count"] += 1
                self.active_sessions[session_id]["last_activity"] = datetime.now().isoformat()
            
            # 保存到会话记忆
            memory_id = await self.memory_manager.save_session_memory(
                session_id=session_id,
                role=role,
                content=content,
                metadata=metadata
            )
            
            # 添加到上下文缓存
            if session_id in self.session_contexts:
                self.session_contexts[session_id].append({
                    "id": memory_id,
                    "role": role,
                    "content": content,
                    "metadata": metadata or {},
                    "timestamp": datetime.now().isoformat()
                })
                
                # 限制上下文长度
                if len(self.session_contexts[session_id]) > 100:
                    self.session_contexts[session_id] = self.session_contexts[session_id][-100:]
            
            return memory_id
            
        except Exception as e:
            logger.error(f"保存消息失败: {e}")
            raise
    
    async def get_session_context(self, session_id: str, limit: int = 20, 
                                 include_metadata: bool = True) -> List[Dict[str, Any]]:
        """获取会话上下文"""
        try:
            # 先从缓存获取
            if session_id in self.session_contexts:
                context = self.session_contexts[session_id][-limit:]
            else:
                # 从数据库获取
                context = await self.memory_manager.get_session_context(
                    session_id=session_id,
                    limit=limit,
                    include_summary=True
                )
            
            # 过滤元数据
            if not include_metadata:
                for msg in context:
                    if "metadata" in msg:
                        del msg["metadata"]
            
            return context
            
        except Exception as e:
            logger.error(f"获取会话上下文失败: {e}")
            return []
    
    async def create_task(self, session_id: str, task_title: str, 
                         task_data: Dict[str, Any]) -> str:
        """创建任务"""
        try:
            task_id = f"task_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{len(self.session_tasks.get(session_id, []))}"
            
            task_info = {
                "task_id": task_id,
                "session_id": session_id,
                "title": task_title,
                "status": "pending",
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "priority": task_data.get("priority", "medium"),
                "description": task_data.get("description", ""),
                "due_date": task_data.get("due_date"),
                "progress": 0,
                "subtasks": task_data.get("subtasks", []),
                "dependencies": task_data.get("dependencies", []),
                "metadata": task_data.get("metadata", {})
            }
            
            # 添加到会话任务列表
            if session_id not in self.session_tasks:
                self.session_tasks[session_id] = []
            self.session_tasks[session_id].append(task_info)
            
            # 更新会话信息
            if session_id in self.active_sessions:
                self.active_sessions[session_id]["task_count"] += 1
            
            # 保存任务记录
            await self.memory_manager.save_memory(
                memory_type=MemoryType.SESSION,
                content=f"任务创建: {task_title} - {task_data.get('description', '')}",
                metadata={
                    "type": "task",
                    "task_id": task_id,
                    "session_id": session_id,
                    "task_info": task_info
                },
                importance=0.8,
                user_id=self.active_sessions.get(session_id, {}).get("user_id", "default")
            )
            
            logger.info(f"创建任务: {task_id} 在会话 {session_id}")
            return task_id
            
        except Exception as e:
            logger.error(f"创建任务失败: {e}")
            raise
    
    async def update_task_status(self, session_id: str, task_id: str, 
                                status: str, progress: int = None) -> bool:
        """更新任务状态"""
        try:
            if session_id not in self.session_tasks:
                return False
            
            # 查找任务
            task_found = False
            for task in self.session_tasks[session_id]:
                if task["task_id"] == task_id:
                    task["status"] = status
                    task["updated_at"] = datetime.now().isoformat()
                    if progress is not None:
                        task["progress"] = min(max(progress, 0), 100)
                    
                    # 如果任务完成，记录完成时间
                    if status == "completed":
                        task["completed_at"] = datetime.now().isoformat()
                    
                    task_found = True
                    break
            
            if not task_found:
                return False
            
            # 保存任务更新记录
            await self.memory_manager.save_memory(
                memory_type=MemoryType.SESSION,
                content=f"任务状态更新: {task_id} -> {status}",
                metadata={
                    "type": "task_update",
                    "task_id": task_id,
                    "session_id": session_id,
                    "old_status": task.get("status"),
                    "new_status": status,
                    "progress": progress
                },
                importance=0.7,
                user_id=self.active_sessions.get(session_id, {}).get("user_id", "default")
            )
            
            logger.info(f"更新任务状态: {task_id} -> {status}")
            return True
            
        except Exception as e:
            logger.error(f"更新任务状态失败: {e}")
            return False
    
    async def get_session_tasks(self, session_id: str, status: str = None) -> List[Dict[str, Any]]:
        """获取会话任务"""
        try:
            if session_id not in self.session_tasks:
                return []
            
            tasks = self.session_tasks[session_id]
            
            # 按状态过滤
            if status:
                tasks = [task for task in tasks if task["status"] == status]
            
            # 按优先级和创建时间排序
            priority_order = {"high": 3, "medium": 2, "low": 1}
            tasks.sort(key=lambda x: (
                priority_order.get(x["priority"], 0),
                x["created_at"]
            ), reverse=True)
            
            return tasks
            
        except Exception as e:
            logger.error(f"获取会话任务失败: {e}")
            return []
    
    async def save_context_state(self, session_id: str, context_name: str, 
                                state_data: Dict[str, Any]) -> str:
        """保存上下文状态"""
        try:
            content = f"上下文状态: {context_name}"
            
            metadata = {
                "type": "context_state",
                "context_name": context_name,
                "session_id": session_id,
                "state_data": state_data,
                "timestamp": datetime.now().isoformat()
            }
            
            return await self.memory_manager.save_memory(
                memory_type=MemoryType.SESSION,
                content=content,
                metadata=metadata,
                importance=0.6,
                user_id=self.active_sessions.get(session_id, {}).get("user_id", "default")
            )
            
        except Exception as e:
            logger.error(f"保存上下文状态失败: {e}")
            raise
    
    async def get_context_state(self, session_id: str, context_name: str) -> Optional[Dict[str, Any]]:
        """获取上下文状态"""
        try:
            results = await self.memory_manager.search_memory(
                query=f"上下文状态: {context_name}",
                memory_type=MemoryType.SESSION,
                limit=1,
                user_id=self.active_sessions.get(session_id, {}).get("user_id", "default")
            )
            
            for result in results:
                metadata = result.get("metadata", {})
                if (metadata.get("type") == "context_state" and 
                    metadata.get("context_name") == context_name and
                    metadata.get("session_id") == session_id):
                    return metadata.get("state_data")
            
            return None
            
        except Exception as e:
            logger.error(f"获取上下文状态失败: {e}")
            return None
    
    async def track_user_intent(self, session_id: str, intent: str, 
                               confidence: float, entities: Dict[str, Any] = None) -> str:
        """跟踪用户意图"""
        try:
            content = f"用户意图: {intent} (置信度: {confidence:.2f})"
            
            metadata = {
                "type": "user_intent",
                "intent": intent,
                "confidence": confidence,
                "entities": entities or {},
                "session_id": session_id,
                "timestamp": datetime.now().isoformat()
            }
            
            # 根据置信度调整重要性
            importance = 0.5 + (confidence * 0.3)
            
            return await self.memory_manager.save_memory(
                memory_type=MemoryType.SESSION,
                content=content,
                metadata=metadata,
                importance=importance,
                user_id=self.active_sessions.get(session_id, {}).get("user_id", "default")
            )
            
        except Exception as e:
            logger.error(f"跟踪用户意图失败: {e}")
            raise
    
    async def get_session_insights(self, session_id: str) -> Dict[str, Any]:
        """获取会话洞察"""
        try:
            insights = {}
            
            # 基础会话信息
            if session_id in self.active_sessions:
                session_info = self.active_sessions[session_id]
                insights["session_info"] = session_info
                
                # 计算会话时长
                start_time = datetime.fromisoformat(session_info["start_time"])
                current_time = datetime.now()
                duration = (current_time - start_time).total_seconds()
                insights["duration_seconds"] = duration
                insights["duration_formatted"] = self._format_duration(duration)
            
            # 消息统计
            context = await self.get_session_context(session_id, limit=1000)
            if context:
                user_messages = [msg for msg in context if msg["role"] == "user"]
                assistant_messages = [msg for msg in context if msg["role"] == "assistant"]
                
                insights["message_stats"] = {
                    "total_messages": len(context),
                    "user_messages": len(user_messages),
                    "assistant_messages": len(assistant_messages),
                    "avg_user_message_length": sum(len(msg["content"]) for msg in user_messages) / len(user_messages) if user_messages else 0,
                    "avg_assistant_message_length": sum(len(msg["content"]) for msg in assistant_messages) / len(assistant_messages) if assistant_messages else 0
                }
            
            # 任务统计
            if session_id in self.session_tasks:
                tasks = self.session_tasks[session_id]
                task_stats = {
                    "total_tasks": len(tasks),
                    "pending_tasks": len([t for t in tasks if t["status"] == "pending"]),
                    "in_progress_tasks": len([t for t in tasks if t["status"] == "in_progress"]),
                    "completed_tasks": len([t for t in tasks if t["status"] == "completed"]),
                    "cancelled_tasks": len([t for t in tasks if t["status"] == "cancelled"])
                }
                
                if tasks:
                    task_stats["completion_rate"] = task_stats["completed_tasks"] / len(tasks)
                
                insights["task_stats"] = task_stats
            
            # 意图分析
            intent_results = await self.memory_manager.search_memory(
                query="用户意图",
                memory_type=MemoryType.SESSION,
                limit=50,
                user_id=self.active_sessions.get(session_id, {}).get("user_id", "default")
            )
            
            if intent_results:
                intents = {}
                for result in intent_results:
                    metadata = result.get("metadata", {})
                    if (metadata.get("type") == "user_intent" and 
                        metadata.get("session_id") == session_id):
                        intent = metadata.get("intent")
                        if intent:
                            intents[intent] = intents.get(intent, 0) + 1
                
                insights["intent_distribution"] = intents
                insights["most_common_intent"] = max(intents.items(), key=lambda x: x[1])[0] if intents else None
            
            return insights
            
        except Exception as e:
            logger.error(f"获取会话洞察失败: {e}")
            return {}
    
    def _format_duration(self, seconds: float) -> str:
        """格式化时长"""
        if seconds < 60:
            return f"{seconds:.0f}秒"
        elif seconds < 3600:
            minutes = seconds / 60
            return f"{minutes:.1f}分钟"
        else:
            hours = seconds / 3600
            return f"{hours:.1f}小时"
    
    async def _generate_session_summary(self, session_id: str) -> str:
        """生成会话总结"""
        try:
            # 获取会话上下文
            context = await self.get_session_context(session_id, limit=50)
            
            # 提取关键信息
            user_messages = [msg for msg in context if msg["role"] == "user"]
            assistant_messages = [msg for msg in context if msg["role"] == "assistant"]
            
            summary_parts = []
            
            if user_messages:
                summary_parts.append(f"用户发送了{len(user_messages)}条消息")
                
                # 提取主要话题（简单的关键词提取）
                all_content = " ".join([msg["content"] for msg in user_messages])
                if len(all_content) > 100:
                    summary_parts.append(f"讨论了关于{all_content[:100]}...的内容")
            
            if assistant_messages:
                summary_parts.append(f"助手回复了{len(assistant_messages)}条消息")
            
            # 任务信息
            if session_id in self.session_tasks:
                tasks = self.session_tasks[session_id]
                if tasks:
                    completed_tasks = [t for t in tasks if t["status"] == "completed"]
                    summary_parts.append(f"创建了{len(tasks)}个任务，完成了{len(completed_tasks)}个")
            
            return "，".join(summary_parts) if summary_parts else "简短对话"
            
        except Exception as e:
            logger.error(f"生成会话总结失败: {e}")
            return "对话会话"
    
    async def cleanup_expired_sessions(self, max_age_hours: int = 24):
        """清理过期会话"""
        try:
            cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
            expired_sessions = []
            
            for session_id, session_info in self.active_sessions.items():
                last_activity = session_info.get("last_activity", session_info.get("start_time"))
                if last_activity:
                    activity_time = datetime.fromisoformat(last_activity)
                    if activity_time < cutoff_time:
                        expired_sessions.append(session_id)
            
            # 结束过期会话
            for session_id in expired_sessions:
                await self.end_session(session_id, "会话超时自动结束")
            
            logger.info(f"清理了{len(expired_sessions)}个过期会话")
            return len(expired_sessions)
            
        except Exception as e:
            logger.error(f"清理过期会话失败: {e}")
            return 0
    
    async def export_session_data(self, session_id: str) -> Dict[str, Any]:
        """导出会话数据"""
        try:
            session_data = {}
            
            # 基础信息
            if session_id in self.active_sessions:
                session_data["session_info"] = self.active_sessions[session_id]
            
            # 会话上下文
            session_data["context"] = await self.get_session_context(session_id, limit=1000)
            
            # 任务数据
            if session_id in self.session_tasks:
                session_data["tasks"] = self.session_tasks[session_id]
            
            # 洞察数据
            session_data["insights"] = await self.get_session_insights(session_id)
            
            return session_data
            
        except Exception as e:
            logger.error(f"导出会话数据失败: {e}")
            return {}