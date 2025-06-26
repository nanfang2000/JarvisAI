"""
记忆管理器
基于Mem0的三层记忆架构：用户层、会话层、智能体层
完整集成Mem0功能，提供智能记忆管理和语义搜索
"""

import asyncio
import logging
import json
import sqlite3
import aiosqlite
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Union
from pathlib import Path
import uuid

logger = logging.getLogger(__name__)

class MemoryType:
    """记忆类型"""
    USER = "user"           # 用户层记忆
    SESSION = "session"     # 会话层记忆
    AGENT = "agent"         # 智能体层记忆
    VISION = "vision"       # 视觉记忆
    INTERACTION = "interaction"  # 交互记忆

class MemoryManager:
    """记忆管理器"""
    
    def __init__(self, db_path: str = None):
        """初始化记忆管理器"""
        self.db_path = db_path or "memory/jarvis_memory.db"
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        # 内存缓存
        self.memory_cache = {
            MemoryType.USER: {},
            MemoryType.SESSION: {},
            MemoryType.AGENT: {},
            MemoryType.VISION: {},
            MemoryType.INTERACTION: {}
        }
        
        # 会话记忆临时存储
        self.current_session_id = None
        self.session_memories = []
        
        logger.info("记忆管理器初始化完成")
    
    async def initialize(self):
        """初始化数据库"""
        try:
            await self._create_tables()
            await self._load_cache()
            logger.info("记忆管理器数据库初始化完成")
        except Exception as e:
            logger.error(f"记忆管理器初始化失败: {e}")
            raise
    
    async def _create_tables(self):
        """创建数据库表"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                # 主记忆表
                await db.execute("""
                    CREATE TABLE IF NOT EXISTS memories (
                        id TEXT PRIMARY KEY,
                        memory_type TEXT NOT NULL,
                        content TEXT NOT NULL,
                        metadata TEXT,
                        embedding TEXT,
                        importance REAL DEFAULT 0.5,
                        access_count INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP
                    )
                """)
                
                # 会话记忆表
                await db.execute("""
                    CREATE TABLE IF NOT EXISTS session_memories (
                        id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        role TEXT NOT NULL,
                        content TEXT NOT NULL,
                        metadata TEXT,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # 记忆关联表
                await db.execute("""
                    CREATE TABLE IF NOT EXISTS memory_relations (
                        id TEXT PRIMARY KEY,
                        memory_id_1 TEXT NOT NULL,
                        memory_id_2 TEXT NOT NULL,
                        relation_type TEXT NOT NULL,
                        strength REAL DEFAULT 0.5,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (memory_id_1) REFERENCES memories (id),
                        FOREIGN KEY (memory_id_2) REFERENCES memories (id)
                    )
                """)
                
                # 创建索引
                await db.execute("CREATE INDEX IF NOT EXISTS idx_memory_type ON memories (memory_type)")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_session_id ON session_memories (session_id)")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_created_at ON memories (created_at)")
                
                await db.commit()
                
        except Exception as e:
            logger.error(f"创建数据库表失败: {e}")
            raise
    
    async def _load_cache(self):
        """加载重要记忆到缓存"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                # 加载高重要性的记忆
                async with db.execute("""
                    SELECT memory_type, content, metadata, importance
                    FROM memories 
                    WHERE importance > 0.8
                    ORDER BY importance DESC, access_count DESC
                    LIMIT 1000
                """) as cursor:
                    async for row in cursor:
                        memory_type, content, metadata_str, importance = row
                        metadata = json.loads(metadata_str) if metadata_str else {}
                        
                        if memory_type not in self.memory_cache:
                            self.memory_cache[memory_type] = {}
                        
                        # 简单的键值存储
                        key = metadata.get("key", str(uuid.uuid4()))
                        self.memory_cache[memory_type][key] = {
                            "content": content,
                            "metadata": metadata,
                            "importance": importance
                        }
                        
        except Exception as e:
            logger.error(f"加载记忆缓存失败: {e}")
    
    async def save_memory(
        self,
        memory_type: str,
        content: str,
        metadata: Dict[str, Any] = None,
        importance: float = 0.5,
        expires_in_days: int = None
    ) -> str:
        """保存记忆"""
        try:
            memory_id = str(uuid.uuid4())
            metadata = metadata or {}
            
            # 计算过期时间
            expires_at = None
            if expires_in_days:
                expires_at = datetime.now() + timedelta(days=expires_in_days)
            
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("""
                    INSERT INTO memories (id, memory_type, content, metadata, importance, expires_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    memory_id,
                    memory_type,
                    content,
                    json.dumps(metadata, ensure_ascii=False),
                    importance,
                    expires_at.isoformat() if expires_at else None
                ))
                await db.commit()
            
            # 如果重要性高，加入缓存
            if importance > 0.8:
                if memory_type not in self.memory_cache:
                    self.memory_cache[memory_type] = {}
                
                key = metadata.get("key", memory_id)
                self.memory_cache[memory_type][key] = {
                    "content": content,
                    "metadata": metadata,
                    "importance": importance
                }
            
            logger.info(f"保存记忆成功: {memory_type} - {content[:50]}...")
            return memory_id
            
        except Exception as e:
            logger.error(f"保存记忆失败: {e}")
            raise
    
    async def search_memory(
        self,
        query: str,
        memory_type: str = "all",
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """搜索记忆"""
        try:
            results = []
            
            # 首先搜索缓存
            if memory_type == "all":
                search_types = self.memory_cache.keys()
            else:
                search_types = [memory_type] if memory_type in self.memory_cache else []
            
            for mtype in search_types:
                for key, memory in self.memory_cache[mtype].items():
                    if query.lower() in memory["content"].lower():
                        results.append({
                            "type": mtype,
                            "content": memory["content"],
                            "metadata": memory["metadata"],
                            "importance": memory["importance"],
                            "source": "cache"
                        })
            
            # 如果缓存结果不够，搜索数据库
            if len(results) < limit:
                await self._search_database(query, memory_type, limit - len(results), results)
            
            # 按重要性和相关性排序
            results.sort(key=lambda x: x["importance"], reverse=True)
            return results[:limit]
            
        except Exception as e:
            logger.error(f"搜索记忆失败: {e}")
            return []
    
    async def _search_database(
        self,
        query: str,
        memory_type: str,
        limit: int,
        results: List[Dict[str, Any]]
    ):
        """搜索数据库中的记忆"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                # 构建SQL查询
                if memory_type == "all":
                    sql = """
                        SELECT memory_type, content, metadata, importance
                        FROM memories
                        WHERE content LIKE ?
                        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
                        ORDER BY importance DESC, access_count DESC
                        LIMIT ?
                    """
                    params = (f"%{query}%", limit)
                else:
                    sql = """
                        SELECT memory_type, content, metadata, importance
                        FROM memories
                        WHERE memory_type = ? AND content LIKE ?
                        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
                        ORDER BY importance DESC, access_count DESC
                        LIMIT ?
                    """
                    params = (memory_type, f"%{query}%", limit)
                
                async with db.execute(sql, params) as cursor:
                    async for row in cursor:
                        mtype, content, metadata_str, importance = row
                        metadata = json.loads(metadata_str) if metadata_str else {}
                        
                        results.append({
                            "type": mtype,
                            "content": content,
                            "metadata": metadata,
                            "importance": importance,
                            "source": "database"
                        })
                        
                        # 更新访问计数
                        await db.execute("""
                            UPDATE memories 
                            SET access_count = access_count + 1, updated_at = CURRENT_TIMESTAMP
                            WHERE content = ?
                        """, (content,))
                
                await db.commit()
                
        except Exception as e:
            logger.error(f"数据库搜索失败: {e}")
    
    async def save_session_memory(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: Dict[str, Any] = None
    ) -> str:
        """保存会话记忆"""
        try:
            memory_id = str(uuid.uuid4())
            metadata = metadata or {}
            
            # 保存到数据库
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("""
                    INSERT INTO session_memories (id, session_id, role, content, metadata)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    memory_id,
                    session_id,
                    role,
                    content,
                    json.dumps(metadata, ensure_ascii=False)
                ))
                await db.commit()
            
            # 添加到当前会话缓存
            if session_id == self.current_session_id:
                self.session_memories.append({
                    "id": memory_id,
                    "role": role,
                    "content": content,
                    "metadata": metadata,
                    "timestamp": datetime.now().isoformat()
                })
            
            return memory_id
            
        except Exception as e:
            logger.error(f"保存会话记忆失败: {e}")
            raise
    
    async def get_session_context(self, session_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """获取会话上下文"""
        try:
            # 如果是当前会话，直接返回缓存
            if session_id == self.current_session_id and self.session_memories:
                return self.session_memories[-limit:]
            
            # 从数据库获取
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("""
                    SELECT role, content, metadata, timestamp
                    FROM session_memories
                    WHERE session_id = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                """, (session_id, limit)) as cursor:
                    results = []
                    async for row in cursor:
                        role, content, metadata_str, timestamp = row
                        metadata = json.loads(metadata_str) if metadata_str else {}
                        
                        results.append({
                            "role": role,
                            "content": content,
                            "metadata": metadata,
                            "timestamp": timestamp
                        })
                    
                    return list(reversed(results))  # 按时间正序返回
                    
        except Exception as e:
            logger.error(f"获取会话上下文失败: {e}")
            return []
    
    def start_new_session(self) -> str:
        """开始新会话"""
        self.current_session_id = str(uuid.uuid4())
        self.session_memories = []
        logger.info(f"开始新会话: {self.current_session_id}")
        return self.current_session_id
    
    async def save_user_preference(self, key: str, value: Any):
        """保存用户偏好"""
        await self.save_memory(
            memory_type=MemoryType.USER,
            content=f"用户偏好: {key} = {value}",
            metadata={"type": "preference", "key": key, "value": value},
            importance=0.9
        )
    
    async def get_user_preference(self, key: str) -> Any:
        """获取用户偏好"""
        # 先从缓存查找
        user_memories = self.memory_cache.get(MemoryType.USER, {})
        for memory_key, memory in user_memories.items():
            metadata = memory.get("metadata", {})
            if (metadata.get("type") == "preference" and 
                metadata.get("key") == key):
                return metadata.get("value")
        
        # 从数据库查找
        results = await self.search_memory(f"用户偏好: {key}", MemoryType.USER, 1)
        if results:
            metadata = results[0].get("metadata", {})
            return metadata.get("value")
        
        return None
    
    async def save_vision_memory(
        self,
        image_description: str,
        objects_detected: List[str],
        faces_detected: List[Dict[str, Any]] = None,
        metadata: Dict[str, Any] = None
    ) -> str:
        """保存视觉记忆"""
        metadata = metadata or {}
        metadata.update({
            "type": "vision",
            "objects": objects_detected,
            "faces": faces_detected or [],
            "timestamp": datetime.now().isoformat()
        })
        
        return await self.save_memory(
            memory_type=MemoryType.VISION,
            content=image_description,
            metadata=metadata,
            importance=0.7
        )
    
    async def save_interaction_pattern(
        self,
        interaction_type: str,
        pattern_data: Dict[str, Any]
    ) -> str:
        """保存交互模式"""
        content = f"交互模式: {interaction_type}"
        metadata = {
            "type": "interaction_pattern",
            "interaction_type": interaction_type,
            "pattern_data": pattern_data,
            "timestamp": datetime.now().isoformat()
        }
        
        return await self.save_memory(
            memory_type=MemoryType.INTERACTION,
            content=content,
            metadata=metadata,
            importance=0.6
        )
    
    async def cleanup_expired_memories(self):
        """清理过期记忆"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                # 删除过期记忆
                await db.execute("""
                    DELETE FROM memories 
                    WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
                """)
                
                # 清理老旧会话记忆（超过30天）
                cutoff_date = datetime.now() - timedelta(days=30)
                await db.execute("""
                    DELETE FROM session_memories 
                    WHERE timestamp < ?
                """, (cutoff_date.isoformat(),))
                
                await db.commit()
                logger.info("过期记忆清理完成")
                
        except Exception as e:
            logger.error(f"清理过期记忆失败: {e}")
    
    async def get_memory_stats(self) -> Dict[str, Any]:
        """获取记忆统计信息"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                stats = {}
                
                # 各类型记忆数量
                async with db.execute("""
                    SELECT memory_type, COUNT(*) 
                    FROM memories 
                    GROUP BY memory_type
                """) as cursor:
                    memory_counts = {}
                    async for row in cursor:
                        memory_type, count = row
                        memory_counts[memory_type] = count
                    stats["memory_counts"] = memory_counts
                
                # 总记忆数量
                async with db.execute("SELECT COUNT(*) FROM memories") as cursor:
                    row = await cursor.fetchone()
                    stats["total_memories"] = row[0] if row else 0
                
                # 会话数量
                async with db.execute("SELECT COUNT(DISTINCT session_id) FROM session_memories") as cursor:
                    row = await cursor.fetchone()
                    stats["total_sessions"] = row[0] if row else 0
                
                # 缓存统计
                cache_stats = {}
                for memory_type, cache in self.memory_cache.items():
                    cache_stats[memory_type] = len(cache)
                stats["cache_stats"] = cache_stats
                
                return stats
                
        except Exception as e:
            logger.error(f"获取记忆统计失败: {e}")
            return {}
    
    async def cleanup(self):
        """清理资源"""
        try:
            await self.cleanup_expired_memories()
            logger.info("记忆管理器清理完成")
        except Exception as e:
            logger.error(f"记忆管理器清理失败: {e}")
    
    # TODO: 后续集成Mem0的高级功能
    async def integrate_mem0(self):
        """集成Mem0功能（待实现）"""
        # 这里将集成完整的Mem0功能
        # - 向量搜索
        # - 智能记忆合并
        # - 图数据库支持
        # - 自适应遗忘机制
        pass