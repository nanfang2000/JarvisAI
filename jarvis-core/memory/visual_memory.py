"""
视觉记忆管理
处理图像分析结果、人脸识别、物体检测和情绪分析的记忆存储
"""

import asyncio
import logging
import json
import base64
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from .enhanced_memory_manager import EnhancedMemoryManager, MemoryType

logger = logging.getLogger(__name__)

class VisualMemoryManager:
    """视觉记忆管理器"""
    
    def __init__(self, memory_manager: EnhancedMemoryManager):
        """初始化视觉记忆管理器"""
        self.memory_manager = memory_manager
        self.face_registry = {}  # 人脸注册表
        self.object_knowledge = {}  # 物体知识库
        self.scene_patterns = {}  # 场景模式
        
    async def save_image_analysis(self, image_data: str, analysis_results: Dict[str, Any], 
                                 metadata: Dict[str, Any] = None) -> str:
        """保存图像分析结果"""
        try:
            # 提取分析结果
            description = analysis_results.get("description", "图像分析")
            objects = analysis_results.get("objects", [])
            faces = analysis_results.get("faces", [])
            emotions = analysis_results.get("emotions", [])
            scene_type = analysis_results.get("scene_type", "unknown")
            confidence = analysis_results.get("confidence", 0.8)
            
            content = f"图像分析: {description}"
            
            # 构建元数据
            metadata = metadata or {}
            metadata.update({
                "type": "image_analysis",
                "description": description,
                "objects": objects,
                "faces": faces,
                "emotions": emotions,
                "scene_type": scene_type,
                "confidence": confidence,
                "image_hash": self._generate_image_hash(image_data),
                "analysis_timestamp": datetime.now().isoformat(),
                "object_count": len(objects),
                "face_count": len(faces),
                "has_people": len(faces) > 0,
                "has_emotions": len(emotions) > 0
            })
            
            # 根据内容调整重要性
            importance = 0.7
            if faces:
                importance += 0.1  # 有人脸更重要
            if emotions:
                importance += 0.1  # 有情绪信息更重要
            if len(objects) > 5:
                importance += 0.05  # 复杂场景更重要
            if confidence > 0.9:
                importance += 0.05  # 高置信度更重要
            
            memory_id = await self.memory_manager.save_vision_memory(
                image_description=description,
                objects_detected=objects,
                faces_detected=faces,
                metadata=metadata
            )
            
            # 处理人脸信息
            if faces:
                for face in faces:
                    await self._process_face_detection(face, memory_id)
            
            # 处理物体信息
            if objects:
                await self._process_object_detection(objects, scene_type, memory_id)
            
            # 处理情绪信息
            if emotions:
                await self._process_emotion_detection(emotions, memory_id)
            
            logger.info(f"保存图像分析结果: {description} (对象:{len(objects)}, 人脸:{len(faces)})")
            return memory_id
            
        except Exception as e:
            logger.error(f"保存图像分析结果失败: {e}")
            raise
    
    def _generate_image_hash(self, image_data: str) -> str:
        """生成图像哈希"""
        try:
            import hashlib
            # 如果是base64编码的图像，先解码
            if image_data.startswith('data:image'):
                # 移除data URL前缀
                image_data = image_data.split(',')[1]
            
            # 计算hash
            image_bytes = base64.b64decode(image_data)
            return hashlib.md5(image_bytes).hexdigest()
        except Exception as e:
            logger.warning(f"生成图像哈希失败: {e}")
            return str(hash(image_data))
    
    async def _process_face_detection(self, face_info: Dict[str, Any], memory_id: str):
        """处理人脸检测结果"""
        try:
            face_id = face_info.get("face_id")
            person_name = face_info.get("name", "未知人员")
            confidence = face_info.get("confidence", 0.0)
            emotions = face_info.get("emotions", [])
            attributes = face_info.get("attributes", {})
            
            # 保存人脸记录
            content = f"人脸检测: {person_name} (置信度: {confidence:.2f})"
            
            metadata = {
                "type": "face_detection",
                "source_memory_id": memory_id,
                "face_id": face_id,
                "person_name": person_name,
                "confidence": confidence,
                "emotions": emotions,
                "attributes": attributes,
                "detection_timestamp": datetime.now().isoformat()
            }
            
            face_memory_id = await self.memory_manager.save_memory(
                memory_type=MemoryType.VISION,
                content=content,
                metadata=metadata,
                importance=0.8 if person_name != "未知人员" else 0.6
            )
            
            # 更新人脸注册表
            if face_id:
                if face_id not in self.face_registry:
                    self.face_registry[face_id] = {
                        "person_name": person_name,
                        "first_seen": datetime.now().isoformat(),
                        "last_seen": datetime.now().isoformat(),
                        "encounter_count": 1,
                        "memory_ids": [face_memory_id]
                    }
                else:
                    registry_entry = self.face_registry[face_id]
                    registry_entry["last_seen"] = datetime.now().isoformat()
                    registry_entry["encounter_count"] += 1
                    registry_entry["memory_ids"].append(face_memory_id)
                    
                    # 如果人名更新了，记录名称变化
                    if registry_entry["person_name"] != person_name and person_name != "未知人员":
                        await self._record_name_update(face_id, registry_entry["person_name"], person_name)
                        registry_entry["person_name"] = person_name
            
        except Exception as e:
            logger.error(f"处理人脸检测失败: {e}")
    
    async def _record_name_update(self, face_id: str, old_name: str, new_name: str):
        """记录人名更新"""
        try:
            content = f"人名更新: {old_name} -> {new_name}"
            
            metadata = {
                "type": "name_update",
                "face_id": face_id,
                "old_name": old_name,
                "new_name": new_name,
                "update_timestamp": datetime.now().isoformat()
            }
            
            await self.memory_manager.save_memory(
                memory_type=MemoryType.VISION,
                content=content,
                metadata=metadata,
                importance=0.9  # 人名更新很重要
            )
            
        except Exception as e:
            logger.error(f"记录人名更新失败: {e}")
    
    async def _process_object_detection(self, objects: List[Dict[str, Any]], 
                                       scene_type: str, memory_id: str):
        """处理物体检测结果"""
        try:
            # 更新物体知识库
            for obj in objects:
                obj_name = obj.get("name", "unknown")
                confidence = obj.get("confidence", 0.0)
                
                if obj_name not in self.object_knowledge:
                    self.object_knowledge[obj_name] = {
                        "first_seen": datetime.now().isoformat(),
                        "last_seen": datetime.now().isoformat(),
                        "detection_count": 1,
                        "avg_confidence": confidence,
                        "contexts": [scene_type]
                    }
                else:
                    knowledge_entry = self.object_knowledge[obj_name]
                    knowledge_entry["last_seen"] = datetime.now().isoformat()
                    knowledge_entry["detection_count"] += 1
                    
                    # 更新平均置信度
                    old_avg = knowledge_entry["avg_confidence"]
                    count = knowledge_entry["detection_count"]
                    knowledge_entry["avg_confidence"] = (old_avg * (count - 1) + confidence) / count
                    
                    # 记录新的上下文
                    if scene_type not in knowledge_entry["contexts"]:
                        knowledge_entry["contexts"].append(scene_type)
            
            # 分析场景模式
            await self._analyze_scene_pattern(objects, scene_type, memory_id)
            
        except Exception as e:
            logger.error(f"处理物体检测失败: {e}")
    
    async def _analyze_scene_pattern(self, objects: List[Dict[str, Any]], 
                                    scene_type: str, memory_id: str):
        """分析场景模式"""
        try:
            object_names = [obj.get("name") for obj in objects]
            pattern_key = f"{scene_type}_{hash(tuple(sorted(object_names)))}"
            
            if pattern_key not in self.scene_patterns:
                self.scene_patterns[pattern_key] = {
                    "scene_type": scene_type,
                    "common_objects": object_names,
                    "first_seen": datetime.now().isoformat(),
                    "last_seen": datetime.now().isoformat(),
                    "occurrence_count": 1,
                    "memory_ids": [memory_id]
                }
            else:
                pattern = self.scene_patterns[pattern_key]
                pattern["last_seen"] = datetime.now().isoformat()
                pattern["occurrence_count"] += 1
                pattern["memory_ids"].append(memory_id)
            
            # 如果模式出现频率高，保存为场景知识
            pattern = self.scene_patterns[pattern_key]
            if pattern["occurrence_count"] >= 3:  # 出现3次以上认为是稳定模式
                await self._save_scene_knowledge(pattern)
            
        except Exception as e:
            logger.error(f"分析场景模式失败: {e}")
    
    async def _save_scene_knowledge(self, pattern: Dict[str, Any]):
        """保存场景知识"""
        try:
            scene_type = pattern["scene_type"]
            common_objects = pattern["common_objects"]
            occurrence_count = pattern["occurrence_count"]
            
            content = f"场景知识: {scene_type}场景通常包含{', '.join(common_objects)}"
            
            metadata = {
                "type": "scene_knowledge",
                "scene_type": scene_type,
                "common_objects": common_objects,
                "occurrence_count": occurrence_count,
                "confidence": min(occurrence_count / 10, 1.0),  # 基于出现次数计算置信度
                "learned_at": datetime.now().isoformat()
            }
            
            await self.memory_manager.save_memory(
                memory_type=MemoryType.VISION,
                content=content,
                metadata=metadata,
                importance=0.8
            )
            
            logger.info(f"保存场景知识: {scene_type} (出现{occurrence_count}次)")
            
        except Exception as e:
            logger.error(f"保存场景知识失败: {e}")
    
    async def _process_emotion_detection(self, emotions: List[Dict[str, Any]], memory_id: str):
        """处理情绪检测结果"""
        try:
            for emotion_info in emotions:
                emotion = emotion_info.get("emotion", "neutral")
                confidence = emotion_info.get("confidence", 0.0)
                person_id = emotion_info.get("person_id")
                
                content = f"情绪检测: {emotion} (置信度: {confidence:.2f})"
                
                metadata = {
                    "type": "emotion_detection",
                    "source_memory_id": memory_id,
                    "emotion": emotion,
                    "confidence": confidence,
                    "person_id": person_id,
                    "detection_timestamp": datetime.now().isoformat()
                }
                
                importance = 0.6
                if emotion in ["angry", "sad", "fear"]:
                    importance = 0.8  # 负面情绪更重要
                elif emotion in ["happy", "surprise"]:
                    importance = 0.7  # 正面情绪也比较重要
                
                await self.memory_manager.save_memory(
                    memory_type=MemoryType.VISION,
                    content=content,
                    metadata=metadata,
                    importance=importance
                )
            
        except Exception as e:
            logger.error(f"处理情绪检测失败: {e}")
    
    async def get_person_history(self, person_name: str = None, 
                                face_id: str = None) -> List[Dict[str, Any]]:
        """获取人员历史记录"""
        try:
            search_query = "人脸检测"
            if person_name:
                search_query += f": {person_name}"
            
            results = await self.memory_manager.search_memory(
                query=search_query,
                memory_type=MemoryType.VISION,
                limit=100
            )
            
            person_records = []
            for result in results:
                metadata = result.get("metadata", {})
                if metadata.get("type") == "face_detection":
                    # 按人名或face_id过滤
                    if person_name and metadata.get("person_name") == person_name:
                        person_records.append(result)
                    elif face_id and metadata.get("face_id") == face_id:
                        person_records.append(result)
                    elif not person_name and not face_id:
                        person_records.append(result)
            
            # 按时间排序
            person_records.sort(key=lambda x: x.get("metadata", {}).get("detection_timestamp", ""), reverse=True)
            return person_records
            
        except Exception as e:
            logger.error(f"获取人员历史记录失败: {e}")
            return []
    
    async def get_emotion_patterns(self, person_name: str = None, 
                                  time_range_days: int = 30) -> Dict[str, Any]:
        """获取情绪模式分析"""
        try:
            cutoff_date = datetime.now() - timedelta(days=time_range_days)
            
            results = await self.memory_manager.search_memory(
                query="情绪检测",
                memory_type=MemoryType.VISION,
                limit=200
            )
            
            emotion_data = []
            for result in results:
                metadata = result.get("metadata", {})
                if metadata.get("type") == "emotion_detection":
                    detection_time = metadata.get("detection_timestamp")
                    if detection_time:
                        detection_datetime = datetime.fromisoformat(detection_time)
                        if detection_datetime > cutoff_date:
                            # 如果指定了人名，通过person_id关联
                            if person_name:
                                # 这里需要通过person_id找到对应的人脸记录
                                # 简化处理，直接使用所有记录
                                pass
                            emotion_data.append({
                                "emotion": metadata.get("emotion"),
                                "confidence": metadata.get("confidence", 0),
                                "timestamp": detection_time,
                                "person_id": metadata.get("person_id")
                            })
            
            # 分析情绪模式
            emotion_counts = {}
            emotion_confidences = {}
            
            for data in emotion_data:
                emotion = data["emotion"]
                confidence = data["confidence"]
                
                emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
                if emotion not in emotion_confidences:
                    emotion_confidences[emotion] = []
                emotion_confidences[emotion].append(confidence)
            
            # 计算统计信息
            emotion_stats = {}
            for emotion, count in emotion_counts.items():
                confidences = emotion_confidences[emotion]
                emotion_stats[emotion] = {
                    "count": count,
                    "frequency": count / len(emotion_data) if emotion_data else 0,
                    "avg_confidence": sum(confidences) / len(confidences),
                    "max_confidence": max(confidences),
                    "min_confidence": min(confidences)
                }
            
            # 识别主导情绪
            dominant_emotion = max(emotion_counts.items(), key=lambda x: x[1])[0] if emotion_counts else None
            
            return {
                "time_range_days": time_range_days,
                "total_detections": len(emotion_data),
                "emotion_stats": emotion_stats,
                "dominant_emotion": dominant_emotion,
                "emotion_diversity": len(emotion_counts),
                "analysis_date": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"获取情绪模式失败: {e}")
            return {}
    
    async def get_object_knowledge(self, object_name: str = None) -> Dict[str, Any]:
        """获取物体知识"""
        try:
            if object_name:
                # 返回特定物体的知识
                knowledge = self.object_knowledge.get(object_name, {})
                return {object_name: knowledge} if knowledge else {}
            else:
                # 返回所有物体知识
                return dict(self.object_knowledge)
                
        except Exception as e:
            logger.error(f"获取物体知识失败: {e}")
            return {}
    
    async def get_scene_knowledge(self, scene_type: str = None) -> List[Dict[str, Any]]:
        """获取场景知识"""
        try:
            search_query = "场景知识"
            if scene_type:
                search_query += f": {scene_type}"
            
            results = await self.memory_manager.search_memory(
                query=search_query,
                memory_type=MemoryType.VISION,
                limit=50
            )
            
            scene_knowledge = []
            for result in results:
                metadata = result.get("metadata", {})
                if metadata.get("type") == "scene_knowledge":
                    if not scene_type or metadata.get("scene_type") == scene_type:
                        scene_knowledge.append({
                            "id": result.get("id"),
                            "scene_type": metadata.get("scene_type"),
                            "common_objects": metadata.get("common_objects", []),
                            "occurrence_count": metadata.get("occurrence_count", 0),
                            "confidence": metadata.get("confidence", 0),
                            "content": result.get("content"),
                            "learned_at": metadata.get("learned_at")
                        })
            
            # 按置信度排序
            scene_knowledge.sort(key=lambda x: x["confidence"], reverse=True)
            return scene_knowledge
            
        except Exception as e:
            logger.error(f"获取场景知识失败: {e}")
            return []
    
    async def analyze_visual_patterns(self, days: int = 30) -> Dict[str, Any]:
        """分析视觉模式"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days)
            
            # 获取指定时间范围内的视觉记忆
            results = await self.memory_manager.search_memory(
                query="图像分析",
                memory_type=MemoryType.VISION,
                limit=500
            )
            
            analysis = {
                "time_range_days": days,
                "total_images": 0,
                "scene_distribution": {},
                "object_frequency": {},
                "face_appearances": {},
                "emotion_trends": {},
                "analysis_date": datetime.now().isoformat()
            }
            
            for result in results:
                metadata = result.get("metadata", {})
                if metadata.get("type") == "image_analysis":
                    timestamp = metadata.get("analysis_timestamp")
                    if timestamp:
                        analysis_time = datetime.fromisoformat(timestamp)
                        if analysis_time > cutoff_date:
                            analysis["total_images"] += 1
                            
                            # 场景分布
                            scene_type = metadata.get("scene_type", "unknown")
                            analysis["scene_distribution"][scene_type] = \
                                analysis["scene_distribution"].get(scene_type, 0) + 1
                            
                            # 物体频率
                            objects = metadata.get("objects", [])
                            for obj in objects:
                                obj_name = obj.get("name") if isinstance(obj, dict) else obj
                                analysis["object_frequency"][obj_name] = \
                                    analysis["object_frequency"].get(obj_name, 0) + 1
                            
                            # 人脸出现
                            faces = metadata.get("faces", [])
                            for face in faces:
                                person_name = face.get("name", "未知人员") if isinstance(face, dict) else "未知人员"
                                analysis["face_appearances"][person_name] = \
                                    analysis["face_appearances"].get(person_name, 0) + 1
            
            # 获取情绪趋势
            emotion_patterns = await self.get_emotion_patterns(time_range_days=days)
            analysis["emotion_trends"] = emotion_patterns.get("emotion_stats", {})
            
            return analysis
            
        except Exception as e:
            logger.error(f"分析视觉模式失败: {e}")
            return {}
    
    async def generate_visual_insights(self) -> List[str]:
        """生成视觉洞察"""
        try:
            insights = []
            
            # 分析最近30天的模式
            patterns = await self.analyze_visual_patterns(30)
            
            # 基于场景分布的洞察
            scene_dist = patterns.get("scene_distribution", {})
            if scene_dist:
                most_common_scene = max(scene_dist.items(), key=lambda x: x[1])
                insights.append(f"最常见的场景类型是'{most_common_scene[0]}'，出现了{most_common_scene[1]}次")
            
            # 基于物体频率的洞察
            object_freq = patterns.get("object_frequency", {})
            if object_freq:
                top_objects = sorted(object_freq.items(), key=lambda x: x[1], reverse=True)[:3]
                object_list = [f"{obj}({count}次)" for obj, count in top_objects]
                insights.append(f"最常见的物体包括: {', '.join(object_list)}")
            
            # 基于人脸出现的洞察
            face_appear = patterns.get("face_appearances", {})
            if face_appear:
                known_people = {name: count for name, count in face_appear.items() if name != "未知人员"}
                if known_people:
                    most_frequent_person = max(known_people.items(), key=lambda x: x[1])
                    insights.append(f"最常出现的人员是{most_frequent_person[0]}，出现了{most_frequent_person[1]}次")
                
                unknown_count = face_appear.get("未知人员", 0)
                if unknown_count > 0:
                    insights.append(f"检测到{unknown_count}次未识别的人脸，建议完善人脸数据库")
            
            # 基于情绪趋势的洞察
            emotion_trends = patterns.get("emotion_trends", {})
            if emotion_trends:
                emotions = list(emotion_trends.keys())
                if "happy" in emotions and emotion_trends["happy"]["frequency"] > 0.5:
                    insights.append("检测到较多积极情绪，整体氛围良好")
                elif any(neg_emotion in emotions for neg_emotion in ["sad", "angry", "fear"]):
                    negative_count = sum(
                        emotion_trends[emotion]["count"] 
                        for emotion in ["sad", "angry", "fear"] 
                        if emotion in emotion_trends
                    )
                    if negative_count > 0:
                        insights.append(f"检测到{negative_count}次负面情绪，需要关注情绪健康")
            
            # 基于物体知识的洞察
            if self.object_knowledge:
                familiar_objects = [
                    name for name, knowledge in self.object_knowledge.items()
                    if knowledge.get("detection_count", 0) > 10
                ]
                if familiar_objects:
                    insights.append(f"系统已熟悉{len(familiar_objects)}种常见物体，识别能力不断提升")
            
            return insights
            
        except Exception as e:
            logger.error(f"生成视觉洞察失败: {e}")
            return []
    
    async def cleanup_old_visual_data(self, max_age_days: int = 90):
        """清理旧的视觉数据"""
        try:
            cutoff_date = datetime.now() - timedelta(days=max_age_days)
            
            # 清理人脸注册表中的旧数据
            expired_faces = []
            for face_id, registry in self.face_registry.items():
                last_seen = datetime.fromisoformat(registry["last_seen"])
                if last_seen < cutoff_date:
                    expired_faces.append(face_id)
            
            for face_id in expired_faces:
                del self.face_registry[face_id]
            
            # 清理物体知识中的旧数据
            expired_objects = []
            for obj_name, knowledge in self.object_knowledge.items():
                last_seen = datetime.fromisoformat(knowledge["last_seen"])
                if last_seen < cutoff_date and knowledge["detection_count"] < 5:
                    expired_objects.append(obj_name)
            
            for obj_name in expired_objects:
                del self.object_knowledge[obj_name]
            
            # 清理场景模式中的旧数据
            expired_patterns = []
            for pattern_key, pattern in self.scene_patterns.items():
                last_seen = datetime.fromisoformat(pattern["last_seen"])
                if last_seen < cutoff_date and pattern["occurrence_count"] < 3:
                    expired_patterns.append(pattern_key)
            
            for pattern_key in expired_patterns:
                del self.scene_patterns[pattern_key]
            
            logger.info(f"清理旧视觉数据完成: 人脸{len(expired_faces)}个, 物体{len(expired_objects)}个, 模式{len(expired_patterns)}个")
            
        except Exception as e:
            logger.error(f"清理旧视觉数据失败: {e}")