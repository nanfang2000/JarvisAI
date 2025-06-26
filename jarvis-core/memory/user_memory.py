"""
用户记忆管理
处理用户偏好、习惯、长期目标和个人信息
"""

import asyncio
import logging
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from .enhanced_memory_manager import EnhancedMemoryManager, MemoryType

logger = logging.getLogger(__name__)

class UserMemoryManager:
    """用户记忆管理器"""
    
    def __init__(self, memory_manager: EnhancedMemoryManager):
        """初始化用户记忆管理器"""
        self.memory_manager = memory_manager
        self.user_profiles = {}  # 用户档案缓存
        
    async def create_user_profile(self, user_id: str, profile_data: Dict[str, Any]) -> str:
        """创建用户档案"""
        try:
            profile_content = f"用户档案: {profile_data.get('name', user_id)}"
            
            metadata = {
                "type": "user_profile",
                "profile_data": profile_data,
                "created_at": datetime.now().isoformat()
            }
            
            memory_id = await self.memory_manager.save_memory(
                memory_type=MemoryType.USER,
                content=profile_content,
                metadata=metadata,
                importance=1.0,  # 用户档案最重要
                user_id=user_id
            )
            
            # 缓存用户档案
            self.user_profiles[user_id] = profile_data
            
            logger.info(f"创建用户档案成功: {user_id}")
            return memory_id
            
        except Exception as e:
            logger.error(f"创建用户档案失败: {e}")
            raise
    
    async def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """获取用户档案"""
        try:
            # 先从缓存获取
            if user_id in self.user_profiles:
                return self.user_profiles[user_id]
            
            # 从记忆中搜索
            results = await self.memory_manager.search_memory(
                query="用户档案",
                memory_type=MemoryType.USER,
                limit=1,
                user_id=user_id
            )
            
            if results:
                for result in results:
                    metadata = result.get("metadata", {})
                    if metadata.get("type") == "user_profile":
                        profile_data = metadata.get("profile_data", {})
                        # 缓存结果
                        self.user_profiles[user_id] = profile_data
                        return profile_data
            
            return None
            
        except Exception as e:
            logger.error(f"获取用户档案失败: {e}")
            return None
    
    async def update_user_profile(self, user_id: str, updates: Dict[str, Any]) -> bool:
        """更新用户档案"""
        try:
            current_profile = await self.get_user_profile(user_id)
            if not current_profile:
                # 如果不存在档案，创建新的
                return await self.create_user_profile(user_id, updates)
            
            # 合并更新
            updated_profile = {**current_profile, **updates}
            
            # 保存更新后的档案
            await self.create_user_profile(user_id, updated_profile)
            
            logger.info(f"更新用户档案成功: {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"更新用户档案失败: {e}")
            return False
    
    async def save_user_preference(self, user_id: str, category: str, key: str, value: Any) -> str:
        """保存用户偏好"""
        try:
            content = f"用户偏好 - {category}: {key} = {value}"
            
            metadata = {
                "type": "preference",
                "category": category,
                "key": key,
                "value": value,
                "timestamp": datetime.now().isoformat()
            }
            
            return await self.memory_manager.save_memory(
                memory_type=MemoryType.USER,
                content=content,
                metadata=metadata,
                importance=0.9,
                user_id=user_id
            )
            
        except Exception as e:
            logger.error(f"保存用户偏好失败: {e}")
            raise
    
    async def get_user_preferences(self, user_id: str, category: str = None) -> Dict[str, Any]:
        """获取用户偏好"""
        try:
            query = f"用户偏好"
            if category:
                query += f" - {category}"
            
            results = await self.memory_manager.search_memory(
                query=query,
                memory_type=MemoryType.USER,
                limit=50,
                user_id=user_id
            )
            
            preferences = {}
            for result in results:
                metadata = result.get("metadata", {})
                if metadata.get("type") == "preference":
                    if not category or metadata.get("category") == category:
                        key = metadata.get("key")
                        value = metadata.get("value")
                        if key:
                            preferences[key] = value
            
            return preferences
            
        except Exception as e:
            logger.error(f"获取用户偏好失败: {e}")
            return {}
    
    async def save_user_goal(self, user_id: str, goal_title: str, goal_data: Dict[str, Any]) -> str:
        """保存用户目标"""
        try:
            content = f"用户目标: {goal_title} - {goal_data.get('description', '')}"
            
            metadata = {
                "type": "goal",
                "title": goal_title,
                "goal_data": goal_data,
                "status": goal_data.get("status", "active"),
                "priority": goal_data.get("priority", "medium"),
                "created_at": datetime.now().isoformat(),
                "target_date": goal_data.get("target_date")
            }
            
            # 根据优先级调整重要性
            importance = 0.8
            if goal_data.get("priority") == "high":
                importance = 0.95
            elif goal_data.get("priority") == "low":
                importance = 0.6
            
            return await self.memory_manager.save_memory(
                memory_type=MemoryType.USER,
                content=content,
                metadata=metadata,
                importance=importance,
                user_id=user_id
            )
            
        except Exception as e:
            logger.error(f"保存用户目标失败: {e}")
            raise
    
    async def get_user_goals(self, user_id: str, status: str = "active") -> List[Dict[str, Any]]:
        """获取用户目标"""
        try:
            results = await self.memory_manager.search_memory(
                query="用户目标",
                memory_type=MemoryType.USER,
                limit=20,
                user_id=user_id
            )
            
            goals = []
            for result in results:
                metadata = result.get("metadata", {})
                if (metadata.get("type") == "goal" and 
                    (not status or metadata.get("status") == status)):
                    goals.append({
                        "id": result.get("id"),
                        "title": metadata.get("title"),
                        "description": result.get("content"),
                        "goal_data": metadata.get("goal_data", {}),
                        "status": metadata.get("status"),
                        "priority": metadata.get("priority"),
                        "created_at": metadata.get("created_at"),
                        "target_date": metadata.get("target_date")
                    })
            
            # 按优先级和创建时间排序
            priority_order = {"high": 3, "medium": 2, "low": 1}
            goals.sort(key=lambda x: (
                priority_order.get(x["priority"], 0),
                x["created_at"]
            ), reverse=True)
            
            return goals
            
        except Exception as e:
            logger.error(f"获取用户目标失败: {e}")
            return []
    
    async def update_goal_status(self, user_id: str, goal_id: str, new_status: str) -> bool:
        """更新目标状态"""
        try:
            # 首先获取目标详情
            memory_details = await self.memory_manager._get_memory_by_id(goal_id)
            if not memory_details:
                return False
            
            metadata = memory_details.get("metadata", {})
            if metadata.get("type") != "goal":
                return False
            
            # 更新状态
            metadata["status"] = new_status
            metadata["updated_at"] = datetime.now().isoformat()
            
            # 如果目标完成，降低重要性
            importance = memory_details.get("importance", 0.8)
            if new_status == "completed":
                importance = 0.6
            elif new_status == "cancelled":
                importance = 0.3
            
            # 更新记忆
            return await self.memory_manager.update_memory(
                memory_id=goal_id,
                metadata=metadata,
                importance=importance
            )
            
        except Exception as e:
            logger.error(f"更新目标状态失败: {e}")
            return False
    
    async def save_user_habit(self, user_id: str, habit_name: str, habit_data: Dict[str, Any]) -> str:
        """保存用户习惯"""
        try:
            content = f"用户习惯: {habit_name} - {habit_data.get('description', '')}"
            
            metadata = {
                "type": "habit",
                "name": habit_name,
                "habit_data": habit_data,
                "frequency": habit_data.get("frequency", "daily"),
                "last_performed": habit_data.get("last_performed"),
                "streak_count": habit_data.get("streak_count", 0),
                "created_at": datetime.now().isoformat()
            }
            
            return await self.memory_manager.save_memory(
                memory_type=MemoryType.USER,
                content=content,
                metadata=metadata,
                importance=0.7,
                user_id=user_id
            )
            
        except Exception as e:
            logger.error(f"保存用户习惯失败: {e}")
            raise
    
    async def get_user_habits(self, user_id: str) -> List[Dict[str, Any]]:
        """获取用户习惯"""
        try:
            results = await self.memory_manager.search_memory(
                query="用户习惯",
                memory_type=MemoryType.USER,
                limit=20,
                user_id=user_id
            )
            
            habits = []
            for result in results:
                metadata = result.get("metadata", {})
                if metadata.get("type") == "habit":
                    habits.append({
                        "id": result.get("id"),
                        "name": metadata.get("name"),
                        "description": result.get("content"),
                        "habit_data": metadata.get("habit_data", {}),
                        "frequency": metadata.get("frequency"),
                        "last_performed": metadata.get("last_performed"),
                        "streak_count": metadata.get("streak_count", 0),
                        "created_at": metadata.get("created_at")
                    })
            
            return habits
            
        except Exception as e:
            logger.error(f"获取用户习惯失败: {e}")
            return []
    
    async def record_habit_performance(self, user_id: str, habit_id: str, performed_at: str = None) -> bool:
        """记录习惯执行"""
        try:
            performed_at = performed_at or datetime.now().isoformat()
            
            # 获取习惯详情
            memory_details = await self.memory_manager._get_memory_by_id(habit_id)
            if not memory_details:
                return False
            
            metadata = memory_details.get("metadata", {})
            if metadata.get("type") != "habit":
                return False
            
            # 更新习惯数据
            last_performed = metadata.get("last_performed")
            streak_count = metadata.get("streak_count", 0)
            
            # 计算连续天数
            if last_performed:
                last_date = datetime.fromisoformat(last_performed.replace('Z', '+00:00'))
                current_date = datetime.fromisoformat(performed_at.replace('Z', '+00:00'))
                days_diff = (current_date.date() - last_date.date()).days
                
                if days_diff == 1:
                    streak_count += 1
                elif days_diff > 1:
                    streak_count = 1
            else:
                streak_count = 1
            
            metadata["last_performed"] = performed_at
            metadata["streak_count"] = streak_count
            metadata["updated_at"] = datetime.now().isoformat()
            
            # 根据连续天数调整重要性
            importance = 0.7 + min(streak_count * 0.01, 0.2)
            
            # 更新记忆
            return await self.memory_manager.update_memory(
                memory_id=habit_id,
                metadata=metadata,
                importance=importance
            )
            
        except Exception as e:
            logger.error(f"记录习惯执行失败: {e}")
            return False
    
    async def save_relationship_info(self, user_id: str, person_name: str, relationship_data: Dict[str, Any]) -> str:
        """保存人际关系信息"""
        try:
            content = f"人际关系: {person_name} - {relationship_data.get('relationship_type', '未知关系')}"
            
            metadata = {
                "type": "relationship",
                "person_name": person_name,
                "relationship_data": relationship_data,
                "relationship_type": relationship_data.get("relationship_type"),
                "importance_level": relationship_data.get("importance_level", "medium"),
                "last_interaction": relationship_data.get("last_interaction"),
                "created_at": datetime.now().isoformat()
            }
            
            # 根据关系重要性调整记忆重要性
            importance = 0.7
            if relationship_data.get("importance_level") == "high":
                importance = 0.9
            elif relationship_data.get("importance_level") == "low":
                importance = 0.5
            
            return await self.memory_manager.save_memory(
                memory_type=MemoryType.USER,
                content=content,
                metadata=metadata,
                importance=importance,
                user_id=user_id
            )
            
        except Exception as e:
            logger.error(f"保存人际关系信息失败: {e}")
            raise
    
    async def get_relationships(self, user_id: str, relationship_type: str = None) -> List[Dict[str, Any]]:
        """获取人际关系信息"""
        try:
            query = "人际关系"
            if relationship_type:
                query += f" {relationship_type}"
            
            results = await self.memory_manager.search_memory(
                query=query,
                memory_type=MemoryType.USER,
                limit=30,
                user_id=user_id
            )
            
            relationships = []
            for result in results:
                metadata = result.get("metadata", {})
                if (metadata.get("type") == "relationship" and 
                    (not relationship_type or metadata.get("relationship_type") == relationship_type)):
                    relationships.append({
                        "id": result.get("id"),
                        "person_name": metadata.get("person_name"),
                        "description": result.get("content"),
                        "relationship_data": metadata.get("relationship_data", {}),
                        "relationship_type": metadata.get("relationship_type"),
                        "importance_level": metadata.get("importance_level"),
                        "last_interaction": metadata.get("last_interaction"),
                        "created_at": metadata.get("created_at")
                    })
            
            return relationships
            
        except Exception as e:
            logger.error(f"获取人际关系信息失败: {e}")
            return []
    
    async def get_user_insights(self, user_id: str) -> Dict[str, Any]:
        """获取用户洞察分析"""
        try:
            insights = {}
            
            # 获取用户档案
            profile = await self.get_user_profile(user_id)
            if profile:
                insights["profile"] = profile
            
            # 获取偏好分析
            preferences = await self.get_user_preferences(user_id)
            insights["preferences_count"] = len(preferences)
            insights["top_preferences"] = dict(list(preferences.items())[:5])
            
            # 获取目标分析
            active_goals = await self.get_user_goals(user_id, "active")
            completed_goals = await self.get_user_goals(user_id, "completed")
            insights["goals"] = {
                "active_count": len(active_goals),
                "completed_count": len(completed_goals),
                "active_goals": active_goals[:3] if active_goals else []
            }
            
            # 获取习惯分析
            habits = await self.get_user_habits(user_id)
            if habits:
                total_streak = sum(h.get("streak_count", 0) for h in habits)
                avg_streak = total_streak / len(habits) if habits else 0
                insights["habits"] = {
                    "total_count": len(habits),
                    "average_streak": round(avg_streak, 1),
                    "best_habit": max(habits, key=lambda x: x.get("streak_count", 0)) if habits else None
                }
            
            # 获取人际关系分析
            relationships = await self.get_relationships(user_id)
            if relationships:
                relationship_types = {}
                for rel in relationships:
                    rel_type = rel.get("relationship_type", "unknown")
                    relationship_types[rel_type] = relationship_types.get(rel_type, 0) + 1
                
                insights["relationships"] = {
                    "total_count": len(relationships),
                    "types_distribution": relationship_types,
                    "recent_interactions": [
                        rel for rel in relationships
                        if rel.get("last_interaction")
                    ][:3]
                }
            
            return insights
            
        except Exception as e:
            logger.error(f"获取用户洞察失败: {e}")
            return {}
    
    async def generate_user_recommendations(self, user_id: str) -> List[str]:
        """生成用户个性化建议"""
        try:
            recommendations = []
            insights = await self.get_user_insights(user_id)
            
            # 基于目标的建议
            goals = insights.get("goals", {})
            if goals.get("active_count", 0) == 0:
                recommendations.append("建议设置一些个人目标来保持动力和方向感")
            elif goals.get("active_count", 0) > 5:
                recommendations.append("当前活跃目标较多，建议专注于2-3个最重要的目标")
            
            # 基于习惯的建议
            habits = insights.get("habits", {})
            if habits and habits.get("average_streak", 0) < 3:
                recommendations.append("建议选择1-2个简单的习惯开始培养，从小处着手更容易坚持")
            
            # 基于偏好的建议
            if insights.get("preferences_count", 0) < 5:
                recommendations.append("可以多记录一些个人偏好，这将有助于提供更个性化的服务")
            
            # 基于人际关系的建议
            relationships = insights.get("relationships", {})
            if relationships and relationships.get("total_count", 0) > 0:
                recent_count = len(relationships.get("recent_interactions", []))
                if recent_count / relationships["total_count"] < 0.3:
                    recommendations.append("建议定期与重要的人保持联系，维护良好的人际关系")
            
            return recommendations
            
        except Exception as e:
            logger.error(f"生成用户建议失败: {e}")
            return []