"""
智能体记忆管理
存储系统知识、经验积累和学习成果
"""

import asyncio
import logging
import json
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from .enhanced_memory_manager import EnhancedMemoryManager, MemoryType

logger = logging.getLogger(__name__)

class AgentMemoryManager:
    """智能体记忆管理器"""
    
    def __init__(self, memory_manager: EnhancedMemoryManager):
        """初始化智能体记忆管理器"""
        self.memory_manager = memory_manager
        self.knowledge_cache = {}  # 知识缓存
        self.skill_registry = {}  # 技能注册表
        self.learning_logs = []  # 学习日志
        
    async def save_system_knowledge(self, knowledge_type: str, title: str, 
                                   content: str, metadata: Dict[str, Any] = None) -> str:
        """保存系统知识"""
        try:
            full_content = f"系统知识 - {knowledge_type}: {title}\n{content}"
            
            metadata = metadata or {}
            metadata.update({
                "type": "system_knowledge",
                "knowledge_type": knowledge_type,
                "title": title,
                "version": metadata.get("version", "1.0"),
                "source": metadata.get("source", "system"),
                "tags": metadata.get("tags", []),
                "created_at": datetime.now().isoformat()
            })
            
            # 根据知识类型调整重要性
            importance = 0.8
            if knowledge_type in ["core_function", "security", "critical_process"]:
                importance = 0.95
            elif knowledge_type in ["optimization", "best_practice"]:
                importance = 0.85
            elif knowledge_type in ["troubleshooting", "faq"]:
                importance = 0.75
            
            memory_id = await self.memory_manager.save_memory(
                memory_type=MemoryType.AGENT,
                content=full_content,
                metadata=metadata,
                importance=importance,
                user_id="system"
            )
            
            # 更新知识缓存
            cache_key = f"{knowledge_type}_{title}"
            self.knowledge_cache[cache_key] = {
                "id": memory_id,
                "content": content,
                "metadata": metadata,
                "cached_at": datetime.now().isoformat()
            }
            
            logger.info(f"保存系统知识: {knowledge_type} - {title}")
            return memory_id
            
        except Exception as e:
            logger.error(f"保存系统知识失败: {e}")
            raise
    
    async def get_system_knowledge(self, knowledge_type: str = None, 
                                  query: str = None) -> List[Dict[str, Any]]:
        """获取系统知识"""
        try:
            search_query = "系统知识"
            if knowledge_type:
                search_query += f" - {knowledge_type}"
            if query:
                search_query += f" {query}"
            
            results = await self.memory_manager.search_memory(
                query=search_query,
                memory_type=MemoryType.AGENT,
                limit=50,
                user_id="system"
            )
            
            knowledge_items = []
            for result in results:
                metadata = result.get("metadata", {})
                if metadata.get("type") == "system_knowledge":
                    if not knowledge_type or metadata.get("knowledge_type") == knowledge_type:
                        knowledge_items.append({
                            "id": result.get("id"),
                            "title": metadata.get("title"),
                            "knowledge_type": metadata.get("knowledge_type"),
                            "content": result.get("content"),
                            "metadata": metadata,
                            "importance": result.get("importance"),
                            "created_at": metadata.get("created_at")
                        })
            
            # 按重要性和创建时间排序
            knowledge_items.sort(key=lambda x: (x["importance"], x["created_at"]), reverse=True)
            return knowledge_items
            
        except Exception as e:
            logger.error(f"获取系统知识失败: {e}")
            return []
    
    async def register_skill(self, skill_name: str, skill_data: Dict[str, Any]) -> str:
        """注册技能"""
        try:
            content = f"技能注册: {skill_name} - {skill_data.get('description', '')}"
            
            metadata = {
                "type": "skill",
                "skill_name": skill_name,
                "skill_data": skill_data,
                "category": skill_data.get("category", "general"),
                "difficulty": skill_data.get("difficulty", "medium"),
                "usage_count": 0,
                "success_rate": 1.0,
                "last_used": None,
                "registered_at": datetime.now().isoformat()
            }
            
            memory_id = await self.memory_manager.save_memory(
                memory_type=MemoryType.AGENT,
                content=content,
                metadata=metadata,
                importance=0.8,
                user_id="system"
            )
            
            # 更新技能注册表
            self.skill_registry[skill_name] = {
                "id": memory_id,
                "skill_data": skill_data,
                "metadata": metadata
            }
            
            logger.info(f"注册技能: {skill_name}")
            return memory_id
            
        except Exception as e:
            logger.error(f"注册技能失败: {e}")
            raise
    
    async def get_available_skills(self, category: str = None) -> List[Dict[str, Any]]:
        """获取可用技能"""
        try:
            results = await self.memory_manager.search_memory(
                query="技能注册",
                memory_type=MemoryType.AGENT,
                limit=100,
                user_id="system"
            )
            
            skills = []
            for result in results:
                metadata = result.get("metadata", {})
                if metadata.get("type") == "skill":
                    if not category or metadata.get("category") == category:
                        skills.append({
                            "id": result.get("id"),
                            "skill_name": metadata.get("skill_name"),
                            "description": result.get("content"),
                            "category": metadata.get("category"),
                            "difficulty": metadata.get("difficulty"),
                            "usage_count": metadata.get("usage_count", 0),
                            "success_rate": metadata.get("success_rate", 1.0),
                            "last_used": metadata.get("last_used"),
                            "skill_data": metadata.get("skill_data", {})
                        })
            
            # 按使用频率和成功率排序
            skills.sort(key=lambda x: (x["usage_count"], x["success_rate"]), reverse=True)
            return skills
            
        except Exception as e:
            logger.error(f"获取可用技能失败: {e}")
            return []
    
    async def record_skill_usage(self, skill_name: str, success: bool, 
                                execution_time: float = None, result_data: Dict[str, Any] = None) -> bool:
        """记录技能使用"""
        try:
            # 查找技能记录
            skills = await self.get_available_skills()
            skill_info = None
            for skill in skills:
                if skill["skill_name"] == skill_name:
                    skill_info = skill
                    break
            
            if not skill_info:
                logger.warning(f"技能不存在: {skill_name}")
                return False
            
            # 更新技能统计
            skill_id = skill_info["id"]
            usage_count = skill_info["usage_count"] + 1
            
            # 计算新的成功率
            old_success_rate = skill_info["success_rate"]
            new_success_rate = (old_success_rate * skill_info["usage_count"] + (1 if success else 0)) / usage_count
            
            # 更新元数据
            updated_metadata = {
                "usage_count": usage_count,
                "success_rate": new_success_rate,
                "last_used": datetime.now().isoformat(),
                "last_execution_time": execution_time,
                "last_success": success
            }
            
            # 获取当前记忆详情
            memory_details = await self.memory_manager._get_memory_by_id(skill_id)
            if memory_details:
                current_metadata = json.loads(memory_details.get("metadata", "{}"))
                current_metadata.update(updated_metadata)
                
                await self.memory_manager.update_memory(
                    memory_id=skill_id,
                    metadata=current_metadata
                )
            
            # 记录使用日志
            await self.save_skill_execution_log(skill_name, success, execution_time, result_data)
            
            logger.info(f"记录技能使用: {skill_name} (成功: {success}, 成功率: {new_success_rate:.2f})")
            return True
            
        except Exception as e:
            logger.error(f"记录技能使用失败: {e}")
            return False
    
    async def save_skill_execution_log(self, skill_name: str, success: bool, 
                                      execution_time: float = None, result_data: Dict[str, Any] = None) -> str:
        """保存技能执行日志"""
        try:
            content = f"技能执行日志: {skill_name} - {'成功' if success else '失败'}"
            
            metadata = {
                "type": "skill_execution_log",
                "skill_name": skill_name,
                "success": success,
                "execution_time": execution_time,
                "result_data": result_data or {},
                "timestamp": datetime.now().isoformat()
            }
            
            return await self.memory_manager.save_memory(
                memory_type=MemoryType.AGENT,
                content=content,
                metadata=metadata,
                importance=0.6,
                expires_in_days=30,  # 执行日志30天后过期
                user_id="system"
            )
            
        except Exception as e:
            logger.error(f"保存技能执行日志失败: {e}")
            raise
    
    async def save_learning_experience(self, experience_type: str, title: str, 
                                      content: str, metadata: Dict[str, Any] = None) -> str:
        """保存学习经验"""
        try:
            full_content = f"学习经验 - {experience_type}: {title}\n{content}"
            
            metadata = metadata or {}
            metadata.update({
                "type": "learning_experience",
                "experience_type": experience_type,
                "title": title,
                "confidence": metadata.get("confidence", 0.8),
                "evidence_strength": metadata.get("evidence_strength", "medium"),
                "applicable_contexts": metadata.get("applicable_contexts", []),
                "learned_at": datetime.now().isoformat()
            })
            
            # 根据经验类型和置信度调整重要性
            importance = 0.7
            if experience_type in ["error_pattern", "optimization", "best_practice"]:
                importance += 0.1
            
            confidence = metadata.get("confidence", 0.8)
            importance += confidence * 0.2
            
            memory_id = await self.memory_manager.save_memory(
                memory_type=MemoryType.AGENT,
                content=full_content,
                metadata=metadata,
                importance=min(importance, 1.0),
                user_id="system"
            )
            
            # 添加到学习日志
            self.learning_logs.append({
                "id": memory_id,
                "experience_type": experience_type,
                "title": title,
                "confidence": confidence,
                "learned_at": metadata["learned_at"]
            })
            
            # 限制学习日志长度
            if len(self.learning_logs) > 1000:
                self.learning_logs = self.learning_logs[-1000:]
            
            logger.info(f"保存学习经验: {experience_type} - {title}")
            return memory_id
            
        except Exception as e:
            logger.error(f"保存学习经验失败: {e}")
            raise
    
    async def get_learning_experiences(self, experience_type: str = None, 
                                     min_confidence: float = 0.0) -> List[Dict[str, Any]]:
        """获取学习经验"""
        try:
            search_query = "学习经验"
            if experience_type:
                search_query += f" - {experience_type}"
            
            results = await self.memory_manager.search_memory(
                query=search_query,
                memory_type=MemoryType.AGENT,
                limit=100,
                user_id="system"
            )
            
            experiences = []
            for result in results:
                metadata = result.get("metadata", {})
                if metadata.get("type") == "learning_experience":
                    confidence = metadata.get("confidence", 0.0)
                    if confidence >= min_confidence:
                        if not experience_type or metadata.get("experience_type") == experience_type:
                            experiences.append({
                                "id": result.get("id"),
                                "title": metadata.get("title"),
                                "experience_type": metadata.get("experience_type"),
                                "content": result.get("content"),
                                "confidence": confidence,
                                "evidence_strength": metadata.get("evidence_strength"),
                                "applicable_contexts": metadata.get("applicable_contexts", []),
                                "learned_at": metadata.get("learned_at"),
                                "importance": result.get("importance")
                            })
            
            # 按置信度和重要性排序
            experiences.sort(key=lambda x: (x["confidence"], x["importance"]), reverse=True)
            return experiences
            
        except Exception as e:
            logger.error(f"获取学习经验失败: {e}")
            return []
    
    async def save_error_pattern(self, error_type: str, error_description: str, 
                                solution: str, metadata: Dict[str, Any] = None) -> str:
        """保存错误模式"""
        try:
            content = f"错误模式: {error_type}\n描述: {error_description}\n解决方案: {solution}"
            
            metadata = metadata or {}
            metadata.update({
                "type": "error_pattern",
                "error_type": error_type,
                "error_description": error_description,
                "solution": solution,
                "occurrence_count": 1,
                "last_occurred": datetime.now().isoformat(),
                "severity": metadata.get("severity", "medium"),
                "context": metadata.get("context", [])
            })
            
            # 检查是否已存在相似的错误模式
            existing_patterns = await self.get_error_patterns(error_type)
            for pattern in existing_patterns:
                if self._is_similar_error(error_description, pattern["error_description"]):
                    # 更新现有模式的出现次数
                    pattern_id = pattern["id"]
                    await self._update_error_pattern_occurrence(pattern_id)
                    return pattern_id
            
            # 保存新的错误模式
            memory_id = await self.memory_manager.save_memory(
                memory_type=MemoryType.AGENT,
                content=content,
                metadata=metadata,
                importance=0.85,  # 错误模式很重要
                user_id="system"
            )
            
            logger.info(f"保存错误模式: {error_type}")
            return memory_id
            
        except Exception as e:
            logger.error(f"保存错误模式失败: {e}")
            raise
    
    async def get_error_patterns(self, error_type: str = None) -> List[Dict[str, Any]]:
        """获取错误模式"""
        try:
            search_query = "错误模式"
            if error_type:
                search_query += f": {error_type}"
            
            results = await self.memory_manager.search_memory(
                query=search_query,
                memory_type=MemoryType.AGENT,
                limit=50,
                user_id="system"
            )
            
            patterns = []
            for result in results:
                metadata = result.get("metadata", {})
                if metadata.get("type") == "error_pattern":
                    if not error_type or metadata.get("error_type") == error_type:
                        patterns.append({
                            "id": result.get("id"),
                            "error_type": metadata.get("error_type"),
                            "error_description": metadata.get("error_description"),
                            "solution": metadata.get("solution"),
                            "content": result.get("content"),
                            "occurrence_count": metadata.get("occurrence_count", 1),
                            "last_occurred": metadata.get("last_occurred"),
                            "severity": metadata.get("severity"),
                            "context": metadata.get("context", [])
                        })
            
            # 按出现频率排序
            patterns.sort(key=lambda x: x["occurrence_count"], reverse=True)
            return patterns
            
        except Exception as e:
            logger.error(f"获取错误模式失败: {e}")
            return []
    
    def _is_similar_error(self, error1: str, error2: str, threshold: float = 0.8) -> bool:
        """判断两个错误是否相似"""
        try:
            # 简单的相似度计算
            words1 = set(error1.lower().split())
            words2 = set(error2.lower().split())
            
            if not words1 or not words2:
                return False
            
            intersection = words1.intersection(words2)
            union = words1.union(words2)
            
            similarity = len(intersection) / len(union)
            return similarity >= threshold
            
        except Exception:
            return False
    
    async def _update_error_pattern_occurrence(self, pattern_id: str) -> bool:
        """更新错误模式出现次数"""
        try:
            memory_details = await self.memory_manager._get_memory_by_id(pattern_id)
            if not memory_details:
                return False
            
            metadata = json.loads(memory_details.get("metadata", "{}"))
            metadata["occurrence_count"] = metadata.get("occurrence_count", 1) + 1
            metadata["last_occurred"] = datetime.now().isoformat()
            
            return await self.memory_manager.update_memory(
                memory_id=pattern_id,
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"更新错误模式出现次数失败: {e}")
            return False
    
    async def save_optimization_insight(self, optimization_type: str, title: str, 
                                       description: str, impact: Dict[str, Any]) -> str:
        """保存优化洞察"""
        try:
            content = f"优化洞察 - {optimization_type}: {title}\n{description}"
            
            metadata = {
                "type": "optimization_insight",
                "optimization_type": optimization_type,
                "title": title,
                "description": description,
                "impact": impact,
                "performance_gain": impact.get("performance_gain", 0),
                "resource_savings": impact.get("resource_savings", 0),
                "implementation_difficulty": impact.get("implementation_difficulty", "medium"),
                "discovered_at": datetime.now().isoformat()
            }
            
            # 根据性能提升和资源节省调整重要性
            importance = 0.8
            performance_gain = impact.get("performance_gain", 0)
            resource_savings = impact.get("resource_savings", 0)
            
            if performance_gain > 0.2 or resource_savings > 0.2:
                importance = 0.9
            elif performance_gain > 0.5 or resource_savings > 0.5:
                importance = 0.95
            
            return await self.memory_manager.save_memory(
                memory_type=MemoryType.AGENT,
                content=content,
                metadata=metadata,
                importance=importance,
                user_id="system"
            )
            
        except Exception as e:
            logger.error(f"保存优化洞察失败: {e}")
            raise
    
    async def get_optimization_insights(self, optimization_type: str = None) -> List[Dict[str, Any]]:
        """获取优化洞察"""
        try:
            search_query = "优化洞察"
            if optimization_type:
                search_query += f" - {optimization_type}"
            
            results = await self.memory_manager.search_memory(
                query=search_query,
                memory_type=MemoryType.AGENT,
                limit=50,
                user_id="system"
            )
            
            insights = []
            for result in results:
                metadata = result.get("metadata", {})
                if metadata.get("type") == "optimization_insight":
                    if not optimization_type or metadata.get("optimization_type") == optimization_type:
                        insights.append({
                            "id": result.get("id"),
                            "title": metadata.get("title"),
                            "optimization_type": metadata.get("optimization_type"),
                            "description": metadata.get("description"),
                            "content": result.get("content"),
                            "impact": metadata.get("impact", {}),
                            "performance_gain": metadata.get("performance_gain", 0),
                            "resource_savings": metadata.get("resource_savings", 0),
                            "implementation_difficulty": metadata.get("implementation_difficulty"),
                            "discovered_at": metadata.get("discovered_at"),
                            "importance": result.get("importance")
                        })
            
            # 按重要性和性能提升排序
            insights.sort(key=lambda x: (x["importance"], x["performance_gain"]), reverse=True)
            return insights
            
        except Exception as e:
            logger.error(f"获取优化洞察失败: {e}")
            return []
    
    async def get_agent_performance_metrics(self) -> Dict[str, Any]:
        """获取智能体性能指标"""
        try:
            metrics = {}
            
            # 技能统计
            skills = await self.get_available_skills()
            if skills:
                total_usage = sum(skill["usage_count"] for skill in skills)
                avg_success_rate = sum(skill["success_rate"] for skill in skills) / len(skills)
                
                metrics["skills"] = {
                    "total_skills": len(skills),
                    "total_usage": total_usage,
                    "average_success_rate": round(avg_success_rate, 3),
                    "most_used_skill": max(skills, key=lambda x: x["usage_count"]) if skills else None,
                    "best_performing_skill": max(skills, key=lambda x: x["success_rate"]) if skills else None
                }
            
            # 学习经验统计
            experiences = await self.get_learning_experiences()
            if experiences:
                avg_confidence = sum(exp["confidence"] for exp in experiences) / len(experiences)
                
                experience_types = {}
                for exp in experiences:
                    exp_type = exp["experience_type"]
                    experience_types[exp_type] = experience_types.get(exp_type, 0) + 1
                
                metrics["learning"] = {
                    "total_experiences": len(experiences),
                    "average_confidence": round(avg_confidence, 3),
                    "experience_types": experience_types,
                    "recent_learning": len([
                        exp for exp in experiences
                        if datetime.fromisoformat(exp["learned_at"]) > datetime.now() - timedelta(days=7)
                    ])
                }
            
            # 错误模式统计
            error_patterns = await self.get_error_patterns()
            if error_patterns:
                total_occurrences = sum(pattern["occurrence_count"] for pattern in error_patterns)
                
                error_types = {}
                for pattern in error_patterns:
                    error_type = pattern["error_type"]
                    error_types[error_type] = error_types.get(error_type, 0) + pattern["occurrence_count"]
                
                metrics["errors"] = {
                    "total_patterns": len(error_patterns),
                    "total_occurrences": total_occurrences,
                    "error_types": error_types,
                    "most_common_error": max(error_patterns, key=lambda x: x["occurrence_count"]) if error_patterns else None
                }
            
            # 优化洞察统计
            insights = await self.get_optimization_insights()
            if insights:
                total_performance_gain = sum(insight["performance_gain"] for insight in insights)
                total_resource_savings = sum(insight["resource_savings"] for insight in insights)
                
                metrics["optimization"] = {
                    "total_insights": len(insights),
                    "total_performance_gain": round(total_performance_gain, 3),
                    "total_resource_savings": round(total_resource_savings, 3),
                    "best_optimization": max(insights, key=lambda x: x["performance_gain"]) if insights else None
                }
            
            # 系统知识统计
            knowledge_items = await self.get_system_knowledge()
            if knowledge_items:
                knowledge_types = {}
                for item in knowledge_items:
                    knowledge_type = item["knowledge_type"]
                    knowledge_types[knowledge_type] = knowledge_types.get(knowledge_type, 0) + 1
                
                metrics["knowledge"] = {
                    "total_items": len(knowledge_items),
                    "knowledge_types": knowledge_types,
                    "average_importance": round(
                        sum(item["importance"] for item in knowledge_items) / len(knowledge_items), 3
                    ) if knowledge_items else 0
                }
            
            return metrics
            
        except Exception as e:
            logger.error(f"获取智能体性能指标失败: {e}")
            return {}
    
    async def generate_agent_recommendations(self) -> List[str]:
        """生成智能体改进建议"""
        try:
            recommendations = []
            metrics = await self.get_agent_performance_metrics()
            
            # 基于技能的建议
            skills_metrics = metrics.get("skills", {})
            if skills_metrics:
                avg_success_rate = skills_metrics.get("average_success_rate", 1.0)
                if avg_success_rate < 0.8:
                    recommendations.append("当前技能成功率较低，建议优化技能实现或增加错误处理")
                
                total_skills = skills_metrics.get("total_skills", 0)
                if total_skills < 10:
                    recommendations.append("技能数量较少，建议扩展更多专业技能以提高服务能力")
            
            # 基于学习的建议
            learning_metrics = metrics.get("learning", {})
            if learning_metrics:
                recent_learning = learning_metrics.get("recent_learning", 0)
                if recent_learning == 0:
                    recommendations.append("最近缺乏新的学习经验，建议主动学习和总结新知识")
                
                avg_confidence = learning_metrics.get("average_confidence", 0.0)
                if avg_confidence < 0.7:
                    recommendations.append("学习经验置信度较低，建议加强经验验证和知识巩固")
            
            # 基于错误的建议
            error_metrics = metrics.get("errors", {})
            if error_metrics:
                total_patterns = error_metrics.get("total_patterns", 0)
                if total_patterns > 20:
                    recommendations.append("错误模式较多，建议系统性优化以减少错误发生")
                
                most_common_error = error_metrics.get("most_common_error")
                if most_common_error and most_common_error["occurrence_count"] > 10:
                    recommendations.append(f"'{most_common_error['error_type']}'错误频繁出现，需要重点解决")
            
            # 基于优化的建议
            optimization_metrics = metrics.get("optimization", {})
            if optimization_metrics:
                total_insights = optimization_metrics.get("total_insights", 0)
                if total_insights < 5:
                    recommendations.append("优化洞察较少，建议主动寻找性能和效率改进机会")
            
            # 基于知识的建议
            knowledge_metrics = metrics.get("knowledge", {})
            if knowledge_metrics:
                total_items = knowledge_metrics.get("total_items", 0)
                if total_items < 20:
                    recommendations.append("系统知识库内容较少，建议补充更多核心知识和最佳实践")
            
            return recommendations
            
        except Exception as e:
            logger.error(f"生成智能体建议失败: {e}")
            return []