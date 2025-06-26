"""
统一记忆管理器
整合用户记忆、会话记忆、智能体记忆和视觉记忆的统一接口
"""

import asyncio
import logging
import json
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta

from .enhanced_memory_manager import EnhancedMemoryManager
from .user_memory import UserMemoryManager
from .session_memory import SessionMemoryManager
from .agent_memory import AgentMemoryManager
from .visual_memory import VisualMemoryManager

logger = logging.getLogger(__name__)

class UnifiedMemoryManager:
    """统一记忆管理器"""
    
    def __init__(self, db_path: str = None, config: Dict[str, Any] = None):
        """初始化统一记忆管理器"""
        self.config = config or {}
        
        # 初始化核心记忆管理器
        self.core_memory = EnhancedMemoryManager(db_path, config)
        
        # 初始化各层记忆管理器
        self.user_memory = UserMemoryManager(self.core_memory)
        self.session_memory = SessionMemoryManager(self.core_memory)
        self.agent_memory = AgentMemoryManager(self.core_memory)
        self.visual_memory = VisualMemoryManager(self.core_memory)
        
        # 记忆管理状态
        self.is_initialized = False
        self.active_sessions = {}
        self.memory_stats_cache = {}
        self.last_stats_update = None
        
        logger.info("统一记忆管理器初始化完成")
    
    async def initialize(self):
        """初始化所有记忆组件"""
        try:
            if self.is_initialized:
                return
            
            # 初始化核心记忆管理器
            await self.core_memory.initialize()
            
            # 初始化系统知识
            await self._initialize_system_knowledge()
            
            # 初始化默认技能
            await self._initialize_default_skills()
            
            self.is_initialized = True
            logger.info("统一记忆管理器完全初始化完成")
            
        except Exception as e:
            logger.error(f"统一记忆管理器初始化失败: {e}")
            raise
    
    async def _initialize_system_knowledge(self):
        """初始化系统知识"""
        try:
            # 核心功能知识
            await self.agent_memory.save_system_knowledge(
                knowledge_type="core_function",
                title="记忆管理系统",
                content="基于Mem0的三层记忆架构，支持用户记忆、会话记忆和智能体记忆的统一管理",
                metadata={
                    "version": "1.0",
                    "source": "system_init",
                    "tags": ["memory", "core", "architecture"]
                }
            )
            
            # 安全知识
            await self.agent_memory.save_system_knowledge(
                knowledge_type="security",
                title="记忆数据安全",
                content="所有记忆数据都需要适当的访问控制和隐私保护，敏感信息不应在日志中显示",
                metadata={
                    "version": "1.0",
                    "source": "system_init",
                    "tags": ["security", "privacy", "data_protection"]
                }
            )
            
            # 最佳实践
            await self.agent_memory.save_system_knowledge(
                knowledge_type="best_practice",
                title="记忆重要性评分",
                content="记忆重要性应根据内容类型、用户偏好、访问频率等多个维度综合评估",
                metadata={
                    "version": "1.0",
                    "source": "system_init",
                    "tags": ["best_practice", "scoring", "importance"]
                }
            )
            
        except Exception as e:
            logger.error(f"初始化系统知识失败: {e}")
    
    async def _initialize_default_skills(self):
        """初始化默认技能"""
        try:
            # 记忆搜索技能
            await self.agent_memory.register_skill(
                skill_name="memory_search",
                skill_data={
                    "description": "智能搜索记忆内容，支持语义搜索和关键词搜索",
                    "category": "memory",
                    "difficulty": "easy",
                    "parameters": ["query", "memory_type", "limit"],
                    "returns": "memory_results"
                }
            )
            
            # 用户偏好分析技能
            await self.agent_memory.register_skill(
                skill_name="preference_analysis",
                skill_data={
                    "description": "分析用户偏好模式，生成个性化建议",
                    "category": "analysis",
                    "difficulty": "medium",
                    "parameters": ["user_id", "analysis_type"],
                    "returns": "preference_insights"
                }
            )
            
            # 视觉记忆处理技能
            await self.agent_memory.register_skill(
                skill_name="visual_memory_processing",
                skill_data={
                    "description": "处理图像分析结果，提取和存储视觉记忆",
                    "category": "vision",
                    "difficulty": "medium",
                    "parameters": ["image_data", "analysis_results"],
                    "returns": "memory_id"
                }
            )
            
        except Exception as e:
            logger.error(f"初始化默认技能失败: {e}")
    
    # 用户记忆相关方法
    async def create_user_profile(self, user_id: str, profile_data: Dict[str, Any]) -> str:
        """创建用户档案"""
        return await self.user_memory.create_user_profile(user_id, profile_data)
    
    async def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """获取用户档案"""
        return await self.user_memory.get_user_profile(user_id)
    
    async def save_user_preference(self, user_id: str, category: str, key: str, value: Any) -> str:
        """保存用户偏好"""
        return await self.user_memory.save_user_preference(user_id, category, key, value)
    
    async def get_user_preferences(self, user_id: str, category: str = None) -> Dict[str, Any]:
        """获取用户偏好"""
        return await self.user_memory.get_user_preferences(user_id, category)
    
    async def save_user_goal(self, user_id: str, goal_title: str, goal_data: Dict[str, Any]) -> str:
        """保存用户目标"""
        return await self.user_memory.save_user_goal(user_id, goal_title, goal_data)
    
    async def get_user_goals(self, user_id: str, status: str = "active") -> List[Dict[str, Any]]:
        """获取用户目标"""
        return await self.user_memory.get_user_goals(user_id, status)
    
    # 会话记忆相关方法
    async def start_session(self, user_id: str, session_type: str = "chat", 
                          metadata: Dict[str, Any] = None) -> str:
        """开始新会话"""
        session_id = await self.session_memory.start_session(user_id, session_type, metadata)
        self.active_sessions[session_id] = {
            "user_id": user_id,
            "session_type": session_type,
            "start_time": datetime.now().isoformat(),
            "status": "active"
        }
        return session_id
    
    async def end_session(self, session_id: str, summary: str = None) -> bool:
        """结束会话"""
        result = await self.session_memory.end_session(session_id, summary)
        if result and session_id in self.active_sessions:
            self.active_sessions[session_id]["status"] = "ended"
            self.active_sessions[session_id]["end_time"] = datetime.now().isoformat()
        return result
    
    async def save_message(self, session_id: str, role: str, content: str, 
                          metadata: Dict[str, Any] = None) -> str:
        """保存消息到会话"""
        return await self.session_memory.save_message(session_id, role, content, metadata)
    
    async def get_session_context(self, session_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """获取会话上下文"""
        return await self.session_memory.get_session_context(session_id, limit)
    
    async def create_task(self, session_id: str, task_title: str, 
                         task_data: Dict[str, Any]) -> str:
        """创建任务"""
        return await self.session_memory.create_task(session_id, task_title, task_data)
    
    async def update_task_status(self, session_id: str, task_id: str, 
                                status: str, progress: int = None) -> bool:
        """更新任务状态"""
        return await self.session_memory.update_task_status(session_id, task_id, status, progress)
    
    # 智能体记忆相关方法
    async def save_system_knowledge(self, knowledge_type: str, title: str, 
                                   content: str, metadata: Dict[str, Any] = None) -> str:
        """保存系统知识"""
        return await self.agent_memory.save_system_knowledge(knowledge_type, title, content, metadata)
    
    async def get_system_knowledge(self, knowledge_type: str = None, 
                                  query: str = None) -> List[Dict[str, Any]]:
        """获取系统知识"""
        return await self.agent_memory.get_system_knowledge(knowledge_type, query)
    
    async def register_skill(self, skill_name: str, skill_data: Dict[str, Any]) -> str:
        """注册技能"""
        return await self.agent_memory.register_skill(skill_name, skill_data)
    
    async def record_skill_usage(self, skill_name: str, success: bool, 
                                execution_time: float = None, result_data: Dict[str, Any] = None) -> bool:
        """记录技能使用"""
        return await self.agent_memory.record_skill_usage(skill_name, success, execution_time, result_data)
    
    async def save_error_pattern(self, error_type: str, error_description: str, 
                                solution: str, metadata: Dict[str, Any] = None) -> str:
        """保存错误模式"""
        return await self.agent_memory.save_error_pattern(error_type, error_description, solution, metadata)
    
    # 视觉记忆相关方法
    async def save_image_analysis(self, image_data: str, analysis_results: Dict[str, Any], 
                                 metadata: Dict[str, Any] = None) -> str:
        """保存图像分析结果"""
        return await self.visual_memory.save_image_analysis(image_data, analysis_results, metadata)
    
    async def get_person_history(self, person_name: str = None, 
                                face_id: str = None) -> List[Dict[str, Any]]:
        """获取人员历史记录"""
        return await self.visual_memory.get_person_history(person_name, face_id)
    
    async def get_emotion_patterns(self, person_name: str = None, 
                                  time_range_days: int = 30) -> Dict[str, Any]:
        """获取情绪模式分析"""
        return await self.visual_memory.get_emotion_patterns(person_name, time_range_days)
    
    # 智能搜索和分析
    async def smart_search(self, query: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """智能搜索所有记忆类型"""
        try:
            search_start_time = datetime.now()
            
            # 解析上下文
            user_id = context.get("user_id", "default") if context else "default"
            session_id = context.get("session_id") if context else None
            memory_types = context.get("memory_types", ["all"]) if context else ["all"]
            limit = context.get("limit", 20) if context else 20
            
            results = {
                "query": query,
                "search_timestamp": search_start_time.isoformat(),
                "results_by_type": {},
                "unified_results": [],
                "total_results": 0,
                "search_time_ms": 0
            }
            
            # 并行搜索不同类型的记忆
            search_tasks = []
            
            if "all" in memory_types or "user" in memory_types:
                search_tasks.append(self._search_user_memories(query, user_id, limit))
            
            if "all" in memory_types or "session" in memory_types:
                search_tasks.append(self._search_session_memories(query, session_id, user_id, limit))
            
            if "all" in memory_types or "agent" in memory_types:
                search_tasks.append(self._search_agent_memories(query, limit))
            
            if "all" in memory_types or "vision" in memory_types:
                search_tasks.append(self._search_visual_memories(query, limit))
            
            # 执行并行搜索
            search_results = await asyncio.gather(*search_tasks, return_exceptions=True)
            
            # 整合搜索结果
            all_results = []
            for i, result in enumerate(search_results):
                if isinstance(result, Exception):
                    logger.warning(f"搜索任务{i}失败: {result}")
                    continue
                
                memory_type, memories = result
                results["results_by_type"][memory_type] = memories
                
                # 为统一结果添加类型标签
                for memory in memories:
                    memory["memory_category"] = memory_type
                    all_results.append(memory)
            
            # 按相关性和重要性排序
            all_results.sort(key=lambda x: (
                x.get("relevance_score", 0),
                x.get("importance", 0)
            ), reverse=True)
            
            results["unified_results"] = all_results[:limit]
            results["total_results"] = len(all_results)
            
            # 计算搜索时间
            search_end_time = datetime.now()
            search_time = (search_end_time - search_start_time).total_seconds() * 1000
            results["search_time_ms"] = round(search_time, 2)
            
            # 记录搜索技能使用
            await self.agent_memory.record_skill_usage(
                skill_name="memory_search",
                success=True,
                execution_time=search_time,
                result_data={"total_results": results["total_results"]}
            )
            
            return results
            
        except Exception as e:
            logger.error(f"智能搜索失败: {e}")
            
            # 记录搜索失败
            await self.agent_memory.record_skill_usage(
                skill_name="memory_search",
                success=False,
                result_data={"error": str(e)}
            )
            
            return {
                "query": query,
                "error": str(e),
                "results_by_type": {},
                "unified_results": [],
                "total_results": 0
            }
    
    async def _search_user_memories(self, query: str, user_id: str, limit: int) -> Tuple[str, List[Dict[str, Any]]]:
        """搜索用户记忆"""
        try:
            results = await self.core_memory.search_memory(
                query=query,
                memory_type="user",
                limit=limit,
                user_id=user_id
            )
            return ("user", results)
        except Exception as e:
            logger.error(f"搜索用户记忆失败: {e}")
            return ("user", [])
    
    async def _search_session_memories(self, query: str, session_id: str, 
                                      user_id: str, limit: int) -> Tuple[str, List[Dict[str, Any]]]:
        """搜索会话记忆"""
        try:
            results = await self.core_memory.search_memory(
                query=query,
                memory_type="session",
                limit=limit,
                user_id=user_id
            )
            return ("session", results)
        except Exception as e:
            logger.error(f"搜索会话记忆失败: {e}")
            return ("session", [])
    
    async def _search_agent_memories(self, query: str, limit: int) -> Tuple[str, List[Dict[str, Any]]]:
        """搜索智能体记忆"""
        try:
            results = await self.core_memory.search_memory(
                query=query,
                memory_type="agent",
                limit=limit,
                user_id="system"
            )
            return ("agent", results)
        except Exception as e:
            logger.error(f"搜索智能体记忆失败: {e}")
            return ("agent", [])
    
    async def _search_visual_memories(self, query: str, limit: int) -> Tuple[str, List[Dict[str, Any]]]:
        """搜索视觉记忆"""
        try:
            results = await self.core_memory.search_memory(
                query=query,
                memory_type="vision",
                limit=limit,
                user_id="default"
            )
            return ("vision", results)
        except Exception as e:
            logger.error(f"搜索视觉记忆失败: {e}")
            return ("vision", [])
    
    async def generate_comprehensive_insights(self, user_id: str) -> Dict[str, Any]:
        """生成综合洞察报告"""
        try:
            insights = {
                "user_id": user_id,
                "generated_at": datetime.now().isoformat(),
                "user_insights": {},
                "session_insights": {},
                "agent_insights": {},
                "visual_insights": {},
                "recommendations": [],
                "summary": ""
            }
            
            # 并行获取各类洞察
            tasks = [
                self.user_memory.get_user_insights(user_id),
                self._get_user_session_insights(user_id),
                self.agent_memory.get_agent_performance_metrics(),
                self.visual_memory.generate_visual_insights()
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 整合洞察结果
            if not isinstance(results[0], Exception):
                insights["user_insights"] = results[0]
            
            if not isinstance(results[1], Exception):
                insights["session_insights"] = results[1]
            
            if not isinstance(results[2], Exception):
                insights["agent_insights"] = results[2]
            
            if not isinstance(results[3], Exception):
                insights["visual_insights"] = results[3]
            
            # 生成综合建议
            recommendations = []
            
            # 用户建议
            user_recommendations = await self.user_memory.generate_user_recommendations(user_id)
            recommendations.extend([f"用户层面: {rec}" for rec in user_recommendations])
            
            # 智能体建议
            agent_recommendations = await self.agent_memory.generate_agent_recommendations()
            recommendations.extend([f"系统层面: {rec}" for rec in agent_recommendations])
            
            insights["recommendations"] = recommendations
            
            # 生成总结
            insights["summary"] = self._generate_insights_summary(insights)
            
            return insights
            
        except Exception as e:
            logger.error(f"生成综合洞察失败: {e}")
            return {"error": str(e)}
    
    async def _get_user_session_insights(self, user_id: str) -> Dict[str, Any]:
        """获取用户会话洞察"""
        try:
            # 获取用户的所有会话
            user_sessions = [
                session_info for session_info in self.active_sessions.values()
                if session_info["user_id"] == user_id
            ]
            
            insights = {
                "total_sessions": len(user_sessions),
                "active_sessions": len([s for s in user_sessions if s["status"] == "active"]),
                "session_types": {}
            }
            
            # 统计会话类型
            for session in user_sessions:
                session_type = session["session_type"]
                insights["session_types"][session_type] = \
                    insights["session_types"].get(session_type, 0) + 1
            
            return insights
            
        except Exception as e:
            logger.error(f"获取用户会话洞察失败: {e}")
            return {}
    
    def _generate_insights_summary(self, insights: Dict[str, Any]) -> str:
        """生成洞察摘要"""
        try:
            summary_parts = []
            
            # 用户洞察摘要
            user_insights = insights.get("user_insights", {})
            if user_insights:
                goals = user_insights.get("goals", {})
                if goals.get("active_count", 0) > 0:
                    summary_parts.append(f"用户设置了{goals['active_count']}个活跃目标")
                
                habits = user_insights.get("habits", {})
                if habits and habits.get("total_count", 0) > 0:
                    summary_parts.append(f"正在培养{habits['total_count']}个习惯")
            
            # 会话洞察摘要
            session_insights = insights.get("session_insights", {})
            if session_insights.get("total_sessions", 0) > 0:
                summary_parts.append(f"进行了{session_insights['total_sessions']}次会话")
            
            # 视觉洞察摘要
            visual_insights = insights.get("visual_insights", [])
            if visual_insights:
                summary_parts.append(f"视觉分析发现{len(visual_insights)}个重要模式")
            
            # 建议摘要
            recommendations = insights.get("recommendations", [])
            if recommendations:
                summary_parts.append(f"生成了{len(recommendations)}条改进建议")
            
            if summary_parts:
                return "；".join(summary_parts) + "。"
            else:
                return "暂无足够数据生成详细洞察。"
                
        except Exception as e:
            logger.error(f"生成洞察摘要失败: {e}")
            return "洞察摘要生成失败。"
    
    async def get_comprehensive_stats(self) -> Dict[str, Any]:
        """获取综合统计信息"""
        try:
            # 检查缓存
            if (self.last_stats_update and 
                datetime.now() - datetime.fromisoformat(self.last_stats_update) < timedelta(minutes=5)):
                return self.memory_stats_cache
            
            stats = {
                "generated_at": datetime.now().isoformat(),
                "core_memory_stats": {},
                "user_memory_stats": {},
                "agent_memory_stats": {},
                "visual_memory_stats": {},
                "session_stats": {},
                "system_health": {}
            }
            
            # 并行获取各类统计
            tasks = [
                self.core_memory.get_memory_stats(),
                self.agent_memory.get_agent_performance_metrics(),
                self._get_session_stats(),
                self._get_visual_stats()
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 整合统计结果
            if not isinstance(results[0], Exception):
                stats["core_memory_stats"] = results[0]
            
            if not isinstance(results[1], Exception):
                stats["agent_memory_stats"] = results[1]
            
            if not isinstance(results[2], Exception):
                stats["session_stats"] = results[2]
            
            if not isinstance(results[3], Exception):
                stats["visual_memory_stats"] = results[3]
            
            # 计算系统健康指标
            stats["system_health"] = self._calculate_system_health(stats)
            
            # 更新缓存
            self.memory_stats_cache = stats
            self.last_stats_update = datetime.now().isoformat()
            
            return stats
            
        except Exception as e:
            logger.error(f"获取综合统计失败: {e}")
            return {"error": str(e)}
    
    async def _get_session_stats(self) -> Dict[str, Any]:
        """获取会话统计"""
        try:
            active_count = len([s for s in self.active_sessions.values() if s["status"] == "active"])
            total_count = len(self.active_sessions)
            
            session_types = {}
            for session_info in self.active_sessions.values():
                session_type = session_info["session_type"]
                session_types[session_type] = session_types.get(session_type, 0) + 1
            
            return {
                "active_sessions": active_count,
                "total_sessions": total_count,
                "session_types": session_types
            }
            
        except Exception as e:
            logger.error(f"获取会话统计失败: {e}")
            return {}
    
    async def _get_visual_stats(self) -> Dict[str, Any]:
        """获取视觉统计"""
        try:
            # 获取视觉记忆统计
            patterns = await self.visual_memory.analyze_visual_patterns(7)  # 最近7天
            
            return {
                "recent_images": patterns.get("total_images", 0),
                "scene_types": len(patterns.get("scene_distribution", {})),
                "detected_objects": len(patterns.get("object_frequency", {})),
                "known_faces": len(patterns.get("face_appearances", {}))
            }
            
        except Exception as e:
            logger.error(f"获取视觉统计失败: {e}")
            return {}
    
    def _calculate_system_health(self, stats: Dict[str, Any]) -> Dict[str, Any]:
        """计算系统健康指标"""
        try:
            health = {
                "overall_score": 1.0,
                "memory_efficiency": 1.0,
                "performance_score": 1.0,
                "data_quality": 1.0,
                "issues": []
            }
            
            # 检查核心记忆统计
            core_stats = stats.get("core_memory_stats", {})
            total_memories = core_stats.get("total_memories", 0)
            
            if total_memories == 0:
                health["issues"].append("没有存储的记忆数据")
                health["data_quality"] -= 0.3
            elif total_memories > 100000:
                health["issues"].append("记忆数据量过大，可能影响性能")
                health["performance_score"] -= 0.2
            
            # 检查缓存效率
            cache_stats = core_stats.get("cache_stats", {})
            total_cached = sum(cache_stats.values()) if cache_stats else 0
            
            if total_cached == 0:
                health["issues"].append("记忆缓存为空")
                health["memory_efficiency"] -= 0.2
            
            # 检查智能体性能
            agent_stats = stats.get("agent_memory_stats", {})
            skills_stats = agent_stats.get("skills", {})
            
            if skills_stats:
                avg_success_rate = skills_stats.get("average_success_rate", 1.0)
                if avg_success_rate < 0.8:
                    health["issues"].append("技能成功率偏低")
                    health["performance_score"] -= 0.3
            
            # 计算总体分数
            health["overall_score"] = (
                health["memory_efficiency"] * 0.3 +
                health["performance_score"] * 0.4 +
                health["data_quality"] * 0.3
            )
            
            return health
            
        except Exception as e:
            logger.error(f"计算系统健康指标失败: {e}")
            return {"overall_score": 0.5, "error": str(e)}
    
    async def cleanup_and_optimize(self) -> Dict[str, Any]:
        """清理和优化记忆系统"""
        try:
            optimization_results = {
                "started_at": datetime.now().isoformat(),
                "core_optimization": {},
                "visual_cleanup": {},
                "session_cleanup": {},
                "cache_rebuild": False,
                "errors": []
            }
            
            # 核心记忆优化
            try:
                core_results = await self.core_memory.optimize_memories()
                optimization_results["core_optimization"] = core_results
            except Exception as e:
                optimization_results["errors"].append(f"核心记忆优化失败: {e}")
            
            # 视觉数据清理
            try:
                await self.visual_memory.cleanup_old_visual_data()
                optimization_results["visual_cleanup"]["success"] = True
            except Exception as e:
                optimization_results["errors"].append(f"视觉数据清理失败: {e}")
            
            # 会话清理
            try:
                expired_count = await self.session_memory.cleanup_expired_sessions()
                optimization_results["session_cleanup"]["expired_sessions"] = expired_count
            except Exception as e:
                optimization_results["errors"].append(f"会话清理失败: {e}")
            
            # 重建缓存
            try:
                await self.core_memory._rebuild_cache()
                optimization_results["cache_rebuild"] = True
                
                # 清空统计缓存
                self.memory_stats_cache = {}
                self.last_stats_update = None
                
            except Exception as e:
                optimization_results["errors"].append(f"缓存重建失败: {e}")
            
            optimization_results["completed_at"] = datetime.now().isoformat()
            
            logger.info(f"记忆系统清理优化完成: {optimization_results}")
            return optimization_results
            
        except Exception as e:
            logger.error(f"记忆系统清理优化失败: {e}")
            return {"error": str(e)}
    
    async def export_all_memories(self, user_id: str = None, format: str = "json") -> str:
        """导出所有记忆数据"""
        try:
            # 如果指定用户，只导出该用户的数据
            if user_id:
                return await self.core_memory.export_memories(user_id, format)
            else:
                # 导出系统所有数据
                all_data = {
                    "export_timestamp": datetime.now().isoformat(),
                    "format": format,
                    "data": {}
                }
                
                # 导出各类记忆
                tasks = [
                    self.core_memory.export_memories("default", format),
                    self.core_memory.export_memories("system", format)
                ]
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                if not isinstance(results[0], Exception):
                    all_data["data"]["default_user"] = json.loads(results[0])
                
                if not isinstance(results[1], Exception):
                    all_data["data"]["system"] = json.loads(results[1])
                
                return json.dumps(all_data, ensure_ascii=False, indent=2)
                
        except Exception as e:
            logger.error(f"导出所有记忆失败: {e}")
            return json.dumps({"error": str(e)})
    
    async def import_memories(self, import_data: str, user_id: str = "default") -> Dict[str, Any]:
        """导入记忆数据"""
        try:
            return await self.core_memory.import_memories(import_data, user_id)
        except Exception as e:
            logger.error(f"导入记忆失败: {e}")
            return {"error": str(e)}
    
    async def cleanup(self):
        """清理所有资源"""
        try:
            await self.core_memory.cleanup()
            self.active_sessions.clear()
            self.memory_stats_cache.clear()
            logger.info("统一记忆管理器清理完成")
        except Exception as e:
            logger.error(f"统一记忆管理器清理失败: {e}")