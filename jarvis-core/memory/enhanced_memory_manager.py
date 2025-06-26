"""
增强版记忆管理器
完整集成Mem0的三层记忆架构：用户层、会话层、智能体层
提供智能记忆管理、语义搜索和记忆优化功能
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
import os
import hashlib
from contextlib import asynccontextmanager

# Mem0 imports
try:
    from mem0 import Memory
    MEM0_AVAILABLE = True
except ImportError:
    MEM0_AVAILABLE = False
    logging.warning("Mem0 未安装，将使用基础记忆功能")

# Vector database imports
try:
    import numpy as np
    from sentence_transformers import SentenceTransformer
    VECTOR_AVAILABLE = True
except ImportError:
    VECTOR_AVAILABLE = False
    logging.warning("句子变换器未安装，将使用基础文本搜索")

logger = logging.getLogger(__name__)

# 配置日志格式
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

class MemoryType:
    """记忆类型"""
    USER = "user"           # 用户层记忆
    SESSION = "session"     # 会话层记忆
    AGENT = "agent"         # 智能体层记忆
    VISION = "vision"       # 视觉记忆
    INTERACTION = "interaction"  # 交互记忆

class EnhancedMemoryManager:
    """增强版记忆管理器"""
    
    def __init__(self, db_path: str = None, config: Dict[str, Any] = None):
        """初始化记忆管理器"""
        self.db_path = db_path or "memory/jarvis_memory.db"
        self.config = config or {}
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        # 初始化Mem0
        self.mem0_client = None
        self.mem0_config = {
            "version": "v1.1",
            "vector_store": {
                "provider": "chroma",
                "config": {
                    "collection_name": "jarvis_memories",
                    "path": "memory/chroma_db"
                }
            },
            "embedder": {
                "provider": "sentence_transformers",
                "config": {
                    "model": "all-MiniLM-L6-v2"
                }
            },
            "llm": {
                "provider": "openai",
                "config": {
                    "model": "gpt-3.5-turbo",
                    "temperature": 0.1,
                    "max_tokens": 1000
                }
            }
        }
        
        # 句子编码器（用于向量搜索）
        self.sentence_encoder = None
        if VECTOR_AVAILABLE:
            try:
                self.sentence_encoder = SentenceTransformer('all-MiniLM-L6-v2')
            except Exception as e:
                logger.warning(f"无法加载句子编码器: {e}")
        
        # 内存缓存
        self.memory_cache = {
            MemoryType.USER: {},
            MemoryType.SESSION: {},
            MemoryType.AGENT: {},
            MemoryType.VISION: {},
            MemoryType.INTERACTION: {}
        }
        
        # 重要记忆阈值
        self.importance_threshold = 0.8
        self.max_cache_size = 1000
        
        # 会话记忆临时存储
        self.current_session_id = None
        self.session_memories = []
        
        # 记忆去重
        self.memory_hashes = set()
        
        logger.info("增强版记忆管理器初始化完成")
    
    async def initialize(self):
        """初始化数据库和Mem0"""
        try:
            await self._create_tables()
            await self._initialize_mem0()
            await self._load_cache()
            logger.info("记忆管理器完全初始化完成")
        except Exception as e:
            logger.error(f"记忆管理器初始化失败: {e}")
            raise
    
    async def _initialize_mem0(self):
        """初始化Mem0客户端"""
        try:
            if MEM0_AVAILABLE:
                # 确保目录存在
                chroma_path = "memory/chroma_db"
                Path(chroma_path).mkdir(parents=True, exist_ok=True)
                
                # 初始化Mem0客户端
                self.mem0_client = Memory(self.mem0_config)
                logger.info("Mem0客户端初始化成功")
            else:
                logger.warning("Mem0不可用，使用基础记忆功能")
        except Exception as e:
            logger.error(f"Mem0初始化失败: {e}")
            self.mem0_client = None
    
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
                        relevance_score REAL DEFAULT 0.0,
                        user_id TEXT DEFAULT 'default',
                        hash TEXT UNIQUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP
                    )
                """)
                
                # Mem0记忆映射表
                await db.execute("""
                    CREATE TABLE IF NOT EXISTS mem0_mappings (
                        id TEXT PRIMARY KEY,
                        local_memory_id TEXT NOT NULL,
                        mem0_memory_id TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (local_memory_id) REFERENCES memories (id)
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
                await db.execute("CREATE INDEX IF NOT EXISTS idx_importance ON memories (importance)")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_user_id ON memories (user_id)")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_hash ON memories (hash)")
                await db.execute("CREATE INDEX IF NOT EXISTS idx_relevance ON memories (relevance_score)")
                
                await db.commit()
                
        except Exception as e:
            logger.error(f"创建数据库表失败: {e}")
            raise
    
    def _generate_content_hash(self, content: str) -> str:
        """生成内容哈希值"""
        return hashlib.md5(content.encode('utf-8')).hexdigest()
    
    def _calculate_importance(self, content: str, metadata: Dict[str, Any]) -> float:
        """计算记忆重要性"""
        importance = 0.5  # 基础重要性
        
        # 根据内容长度调整
        if len(content) > 100:
            importance += 0.1
        
        # 根据元数据调整
        if metadata.get("type") == "preference":
            importance += 0.3
        elif metadata.get("type") == "goal":
            importance += 0.4
        elif metadata.get("type") == "relationship":
            importance += 0.2
        
        # 根据关键词调整
        important_keywords = ["重要", "关键", "目标", "计划", "偏好", "喜欢", "不喜欢"]
        for keyword in important_keywords:
            if keyword in content:
                importance += 0.1
                break
        
        return min(importance, 1.0)
    
    async def save_memory(
        self,
        memory_type: str,
        content: str,
        metadata: Dict[str, Any] = None,
        importance: float = None,
        expires_in_days: int = None,
        user_id: str = "default"
    ) -> str:
        """保存记忆"""
        try:
            memory_id = str(uuid.uuid4())
            metadata = metadata or {}
            
            # 生成内容哈希
            content_hash = self._generate_content_hash(content)
            
            # 检查是否已存在相同内容
            if content_hash in self.memory_hashes:
                logger.info(f"记忆已存在，跳过保存: {content[:50]}...")
                return await self._get_memory_id_by_hash(content_hash)
            
            # 计算重要性
            if importance is None:
                importance = self._calculate_importance(content, metadata)
            
            # 计算过期时间
            expires_at = None
            if expires_in_days:
                expires_at = datetime.now() + timedelta(days=expires_in_days)
            
            # 生成嵌入向量
            embedding = None
            if self.sentence_encoder:
                try:
                    embedding_vector = self.sentence_encoder.encode(content)
                    embedding = json.dumps(embedding_vector.tolist())
                except Exception as e:
                    logger.warning(f"生成嵌入向量失败: {e}")
            
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("""
                    INSERT INTO memories (id, memory_type, content, metadata, embedding, 
                                        importance, user_id, hash, expires_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    memory_id,
                    memory_type,
                    content,
                    json.dumps(metadata, ensure_ascii=False),
                    embedding,
                    importance,
                    user_id,
                    content_hash,
                    expires_at.isoformat() if expires_at else None
                ))
                await db.commit()
            
            # 保存到Mem0
            mem0_memory_id = None
            if self.mem0_client:
                try:
                    mem0_result = self.mem0_client.add(
                        messages=content,
                        user_id=user_id,
                        metadata={
                            **metadata,
                            "memory_type": memory_type,
                            "importance": importance,
                            "local_id": memory_id
                        }
                    )
                    
                    if mem0_result and hasattr(mem0_result, 'id'):
                        mem0_memory_id = mem0_result.id
                        
                        # 保存映射关系
                        async with aiosqlite.connect(self.db_path) as db:
                            await db.execute("""
                                INSERT INTO mem0_mappings (id, local_memory_id, mem0_memory_id)
                                VALUES (?, ?, ?)
                            """, (str(uuid.uuid4()), memory_id, mem0_memory_id))
                            await db.commit()
                            
                except Exception as e:
                    logger.warning(f"保存到Mem0失败: {e}")
            
            # 添加到哈希集合
            self.memory_hashes.add(content_hash)
            
            # 如果重要性高，加入缓存
            if importance >= self.importance_threshold:
                await self._add_to_cache(memory_type, memory_id, content, metadata, importance)
            
            logger.info(f"保存记忆成功: {memory_type} - {content[:50]}... (重要性: {importance:.2f})")
            return memory_id
            
        except Exception as e:
            logger.error(f"保存记忆失败: {e}")
            raise
    
    async def _get_memory_id_by_hash(self, content_hash: str) -> str:
        """根据哈希值获取记忆ID"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("SELECT id FROM memories WHERE hash = ?", (content_hash,)) as cursor:
                    row = await cursor.fetchone()
                    return row[0] if row else None
        except Exception as e:
            logger.error(f"根据哈希值获取记忆ID失败: {e}")
            return None
    
    async def _add_to_cache(self, memory_type: str, memory_id: str, content: str, 
                          metadata: Dict[str, Any], importance: float):
        """添加到缓存"""
        try:
            if memory_type not in self.memory_cache:
                self.memory_cache[memory_type] = {}
            
            # 检查缓存大小
            if len(self.memory_cache[memory_type]) >= self.max_cache_size:
                # 移除最不重要的记忆
                least_important = min(
                    self.memory_cache[memory_type].items(),
                    key=lambda x: x[1]["importance"]
                )
                del self.memory_cache[memory_type][least_important[0]]
            
            key = metadata.get("key", memory_id)
            self.memory_cache[memory_type][key] = {
                "id": memory_id,
                "content": content,
                "metadata": metadata,
                "importance": importance,
                "cached_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"添加到缓存失败: {e}")
    
    async def search_memory(
        self,
        query: str,
        memory_type: str = "all",
        limit: int = 10,
        user_id: str = "default",
        use_semantic_search: bool = True
    ) -> List[Dict[str, Any]]:
        """智能搜索记忆"""
        try:
            results = []
            
            # 优先使用Mem0语义搜索
            if self.mem0_client and use_semantic_search:
                try:
                    mem0_results = self.mem0_client.search(
                        query=query,
                        user_id=user_id,
                        limit=limit
                    )
                    
                    for mem0_result in mem0_results:
                        # 获取本地记忆详情
                        local_memory = await self._get_local_memory_by_mem0_id(mem0_result.id)
                        if local_memory:
                            results.append({
                                "id": local_memory["id"],
                                "type": local_memory["memory_type"],
                                "content": local_memory["content"],
                                "metadata": json.loads(local_memory["metadata"]) if local_memory["metadata"] else {},
                                "importance": local_memory["importance"],
                                "relevance_score": getattr(mem0_result, 'score', 0.0),
                                "source": "mem0",
                                "created_at": local_memory["created_at"]
                            })
                        else:
                            # 直接使用Mem0结果
                            results.append({
                                "id": mem0_result.id,
                                "type": "unknown",
                                "content": mem0_result.memory,
                                "metadata": getattr(mem0_result, 'metadata', {}),
                                "importance": 0.5,
                                "relevance_score": getattr(mem0_result, 'score', 0.0),
                                "source": "mem0_only",
                                "created_at": getattr(mem0_result, 'created_at', '')
                            })
                    
                    # 如果Mem0搜索结果足够，直接返回
                    if len(results) >= limit:
                        return results[:limit]
                        
                except Exception as e:
                    logger.warning(f"Mem0搜索失败，使用传统搜索: {e}")
            
            # 传统搜索作为备选
            await self._traditional_search(query, memory_type, limit - len(results), results, user_id)
            
            # 使用向量搜索增强结果
            if self.sentence_encoder and len(results) < limit:
                vector_results = await self._vector_search(query, memory_type, limit - len(results), user_id)
                results.extend(vector_results)
            
            # 去重并排序
            results = self._deduplicate_results(results)
            results.sort(key=lambda x: (x.get("relevance_score", 0), x["importance"]), reverse=True)
            
            # 更新访问计数
            await self._update_access_counts([r["id"] for r in results if "id" in r])
            
            return results[:limit]
            
        except Exception as e:
            logger.error(f"搜索记忆失败: {e}")
            return []
    
    async def _get_local_memory_by_mem0_id(self, mem0_id: str) -> Optional[Dict[str, Any]]:
        """根据Mem0 ID获取本地记忆"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute("""
                    SELECT m.id, m.memory_type, m.content, m.metadata, m.importance, m.created_at
                    FROM memories m
                    JOIN mem0_mappings mm ON m.id = mm.local_memory_id
                    WHERE mm.mem0_memory_id = ?
                """, (mem0_id,)) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        return {
                            "id": row[0],
                            "memory_type": row[1],
                            "content": row[2],
                            "metadata": row[3],
                            "importance": row[4],
                            "created_at": row[5]
                        }
            return None
        except Exception as e:
            logger.error(f"获取本地记忆失败: {e}")
            return None
    
    async def _traditional_search(self, query: str, memory_type: str, limit: int, 
                                results: List[Dict[str, Any]], user_id: str):
        """传统关键词搜索"""
        try:
            # 首先搜索缓存
            if memory_type == "all":
                search_types = self.memory_cache.keys()
            else:
                search_types = [memory_type] if memory_type in self.memory_cache else []
            
            for mtype in search_types:
                for key, memory in self.memory_cache[mtype].items():
                    if query.lower() in memory["content"].lower():
                        results.append({
                            "id": memory.get("id", key),
                            "type": mtype,
                            "content": memory["content"],
                            "metadata": memory["metadata"],
                            "importance": memory["importance"],
                            "relevance_score": self._calculate_text_similarity(query, memory["content"]),
                            "source": "cache",
                            "created_at": memory.get("cached_at", "")
                        })
            
            # 搜索数据库
            if len(results) < limit:
                await self._search_database(query, memory_type, limit - len(results), results, user_id)
                
        except Exception as e:
            logger.error(f"传统搜索失败: {e}")
    
    def _calculate_text_similarity(self, query: str, content: str) -> float:
        """计算文本相似度"""
        try:
            query_words = set(query.lower().split())
            content_words = set(content.lower().split())
            
            if not query_words or not content_words:
                return 0.0
            
            intersection = query_words.intersection(content_words)
            union = query_words.union(content_words)
            
            return len(intersection) / len(union) if union else 0.0
            
        except Exception:
            return 0.0
    
    async def _vector_search(self, query: str, memory_type: str, limit: int, user_id: str) -> List[Dict[str, Any]]:
        """向量搜索"""
        try:
            if not self.sentence_encoder:
                return []
            
            # 生成查询向量
            query_vector = self.sentence_encoder.encode(query)
            
            # 从数据库获取记忆和其嵌入向量
            async with aiosqlite.connect(self.db_path) as db:
                if memory_type == "all":
                    sql = """
                        SELECT id, memory_type, content, metadata, importance, embedding, created_at
                        FROM memories
                        WHERE user_id = ? AND embedding IS NOT NULL
                        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
                        ORDER BY importance DESC
                        LIMIT 100
                    """
                    params = (user_id,)
                else:
                    sql = """
                        SELECT id, memory_type, content, metadata, importance, embedding, created_at
                        FROM memories
                        WHERE user_id = ? AND memory_type = ? AND embedding IS NOT NULL
                        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
                        ORDER BY importance DESC
                        LIMIT 100
                    """
                    params = (user_id, memory_type)
                
                results = []
                async with db.execute(sql, params) as cursor:
                    async for row in cursor:
                        memory_id, mtype, content, metadata_str, importance, embedding_str, created_at = row
                        
                        try:
                            # 解析嵌入向量
                            embedding = np.array(json.loads(embedding_str))
                            
                            # 计算余弦相似度
                            similarity = np.dot(query_vector, embedding) / (
                                np.linalg.norm(query_vector) * np.linalg.norm(embedding)
                            )
                            
                            if similarity > 0.3:  # 相似度阈值
                                results.append({
                                    "id": memory_id,
                                    "type": mtype,
                                    "content": content,
                                    "metadata": json.loads(metadata_str) if metadata_str else {},
                                    "importance": importance,
                                    "relevance_score": float(similarity),
                                    "source": "vector",
                                    "created_at": created_at
                                })
                                
                        except Exception as e:
                            logger.debug(f"处理向量搜索结果失败: {e}")
                            continue
                
                # 按相似度排序
                results.sort(key=lambda x: x["relevance_score"], reverse=True)
                return results[:limit]
                
        except Exception as e:
            logger.error(f"向量搜索失败: {e}")
            return []
    
    def _deduplicate_results(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """去重搜索结果"""
        seen_ids = set()
        seen_content = set()
        deduplicated = []
        
        for result in results:
            result_id = result.get("id")
            content = result.get("content", "")
            content_hash = hashlib.md5(content.encode('utf-8')).hexdigest()
            
            if result_id and result_id not in seen_ids:
                seen_ids.add(result_id)
                deduplicated.append(result)
            elif content_hash not in seen_content:
                seen_content.add(content_hash)
                deduplicated.append(result)
        
        return deduplicated
    
    async def _update_access_counts(self, memory_ids: List[str]):
        """更新访问计数"""
        try:
            if not memory_ids:
                return
            
            async with aiosqlite.connect(self.db_path) as db:
                for memory_id in memory_ids:
                    await db.execute("""
                        UPDATE memories 
                        SET access_count = access_count + 1, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    """, (memory_id,))
                await db.commit()
                
        except Exception as e:
            logger.error(f"更新访问计数失败: {e}")
    
    async def _search_database(
        self,
        query: str,
        memory_type: str,
        limit: int,
        results: List[Dict[str, Any]],
        user_id: str = "default"
    ):
        """搜索数据库中的记忆"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                # 构建SQL查询
                if memory_type == "all":
                    sql = """
                        SELECT id, memory_type, content, metadata, importance, created_at
                        FROM memories
                        WHERE user_id = ? AND content LIKE ?
                        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
                        ORDER BY importance DESC, access_count DESC
                        LIMIT ?
                    """
                    params = (user_id, f"%{query}%", limit)
                else:
                    sql = """
                        SELECT id, memory_type, content, metadata, importance, created_at
                        FROM memories
                        WHERE user_id = ? AND memory_type = ? AND content LIKE ?
                        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
                        ORDER BY importance DESC, access_count DESC
                        LIMIT ?
                    """
                    params = (user_id, memory_type, f"%{query}%", limit)
                
                async with db.execute(sql, params) as cursor:
                    async for row in cursor:
                        memory_id, mtype, content, metadata_str, importance, created_at = row
                        metadata = json.loads(metadata_str) if metadata_str else {}
                        
                        results.append({
                            "id": memory_id,
                            "type": mtype,
                            "content": content,
                            "metadata": metadata,
                            "importance": importance,
                            "relevance_score": self._calculate_text_similarity(query, content),
                            "source": "database",
                            "created_at": created_at
                        })
                
        except Exception as e:
            logger.error(f"数据库搜索失败: {e}")
    
    async def _load_cache(self):
        """加载重要记忆到缓存"""
        try:
            # 清空现有缓存
            for memory_type in self.memory_cache:
                self.memory_cache[memory_type].clear()
            
            async with aiosqlite.connect(self.db_path) as db:
                # 加载高重要性的记忆
                async with db.execute("""
                    SELECT id, memory_type, content, metadata, importance, hash, created_at
                    FROM memories 
                    WHERE importance >= ?
                    ORDER BY importance DESC, access_count DESC
                    LIMIT ?
                """, (self.importance_threshold, self.max_cache_size)) as cursor:
                    async for row in cursor:
                        memory_id, memory_type, content, metadata_str, importance, content_hash, created_at = row
                        metadata = json.loads(metadata_str) if metadata_str else {}
                        
                        if memory_type not in self.memory_cache:
                            self.memory_cache[memory_type] = {}
                        
                        # 添加到哈希集合
                        if content_hash:
                            self.memory_hashes.add(content_hash)
                        
                        # 使用记忆ID作为键
                        key = metadata.get("key", memory_id)
                        self.memory_cache[memory_type][key] = {
                            "id": memory_id,
                            "content": content,
                            "metadata": metadata,
                            "importance": importance,
                            "cached_at": datetime.now().isoformat(),
                            "created_at": created_at
                        }
                        
                # 记录缓存加载情况
                total_cached = sum(len(cache) for cache in self.memory_cache.values())
                logger.info(f"记忆缓存加载完成，共缓存{total_cached}条重要记忆")
                        
        except Exception as e:
            logger.error(f"加载记忆缓存失败: {e}")

    # 用户偏好相关方法
    async def save_user_preference(self, key: str, value: Any, user_id: str = "default"):
        """保存用户偏好"""
        await self.save_memory(
            memory_type=MemoryType.USER,
            content=f"用户偏好: {key} = {value}",
            metadata={"type": "preference", "key": key, "value": value},
            importance=0.9,
            user_id=user_id
        )
    
    async def get_user_preference(self, key: str, user_id: str = "default") -> Any:
        """获取用户偏好"""
        # 先从缓存查找
        user_memories = self.memory_cache.get(MemoryType.USER, {})
        for memory_key, memory in user_memories.items():
            metadata = memory.get("metadata", {})
            if (metadata.get("type") == "preference" and 
                metadata.get("key") == key):
                return metadata.get("value")
        
        # 从数据库查找
        results = await self.search_memory(f"用户偏好: {key}", MemoryType.USER, 1, user_id)
        if results:
            metadata = results[0].get("metadata", {})
            return metadata.get("value")
        
        return None

    # 会话记忆相关方法
    def start_new_session(self, user_id: str = "default") -> str:
        """开始新会话"""
        # 保存上一个会话的摘要
        if self.current_session_id and self.session_memories:
            asyncio.create_task(self._save_session_summary())
        
        self.current_session_id = str(uuid.uuid4())
        self.session_memories = []
        logger.info(f"开始新会话: {self.current_session_id} (用户: {user_id})")
        return self.current_session_id
    
    async def _save_session_summary(self):
        """保存会话摘要"""
        try:
            if not self.session_memories:
                return
            
            # 生成会话摘要
            user_messages = [m for m in self.session_memories if m["role"] == "user"]
            assistant_messages = [m for m in self.session_memories if m["role"] == "assistant"]
            
            summary = f"会话摘要(ID: {self.current_session_id}): "
            summary += f"包含{len(user_messages)}条用户消息和{len(assistant_messages)}条助手回复。"
            
            if user_messages:
                # 提取主要话题
                topics = []
                for msg in user_messages[:3]:  # 前3条消息
                    if len(msg["content"]) > 10:
                        topics.append(msg["content"][:50])
                
                if topics:
                    summary += f" 主要话题: {'; '.join(topics)}"
            
            await self.save_memory(
                memory_type=MemoryType.SESSION,
                content=summary,
                metadata={
                    "type": "session_summary",
                    "session_id": self.current_session_id,
                    "message_count": len(self.session_memories),
                    "duration": "unknown"  # TODO: 计算会话持续时间
                },
                importance=0.5,
                expires_in_days=30
            )
            
        except Exception as e:
            logger.error(f"保存会话摘要失败: {e}")
    
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
            metadata["session_id"] = session_id
            metadata["role"] = role
            
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
                
                # 限制会话缓存大小
                if len(self.session_memories) > 100:
                    self.session_memories = self.session_memories[-100:]
            
            # 如果是重要的会话内容，保存为长期记忆
            if self._is_important_session_content(content, role):
                await self.save_memory(
                    memory_type=MemoryType.SESSION,
                    content=f"会话内容({role}): {content}",
                    metadata={
                        "session_id": session_id,
                        "role": role,
                        "type": "important_session"
                    },
                    importance=0.8
                )
            
            return memory_id
            
        except Exception as e:
            logger.error(f"保存会话记忆失败: {e}")
            raise
    
    def _is_important_session_content(self, content: str, role: str) -> bool:
        """判断是否为重要的会话内容"""
        if role == "user":
            # 用户的重要关键词
            important_keywords = ["重要", "记住", "不要忘记", "以后", "下次", "提醒", "目标", "计划"]
            return any(keyword in content for keyword in important_keywords)
        elif role == "assistant":
            # 助手的重要回复（较长的回复或包含具体信息）
            return len(content) > 200 or any(keyword in content for keyword in ["建议", "方案", "步骤", "方法"])
        return False
    
    async def get_session_context(self, session_id: str, limit: int = 20, include_summary: bool = True) -> List[Dict[str, Any]]:
        """获取会话上下文"""
        try:
            context = []
            
            # 如果是当前会话，直接返回缓存
            if session_id == self.current_session_id and self.session_memories:
                context = self.session_memories[-limit:]
            else:
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
                        
                        context = list(reversed(results))  # 按时间正序返回
            
            # 如果需要包含会话摘要且上下文很长
            if include_summary and len(context) >= limit:
                # 查找相关的会话摘要
                summaries = await self.search_memory(
                    query=f"会话摘要 {session_id}",
                    memory_type=MemoryType.SESSION,
                    limit=1
                )
                
                if summaries:
                    # 在上下文开头添加摘要
                    context.insert(0, {
                        "role": "system",
                        "content": f"[会话摘要] {summaries[0]['content']}",
                        "metadata": {"type": "summary"},
                        "timestamp": summaries[0].get("created_at", "")
                    })
            
            return context
                    
        except Exception as e:
            logger.error(f"获取会话上下文失败: {e}")
            return []

    # 视觉记忆相关方法
    async def save_vision_memory(
        self,
        image_description: str,
        objects_detected: List[str],
        faces_detected: List[Dict[str, Any]] = None,
        metadata: Dict[str, Any] = None,
        user_id: str = "default"
    ) -> str:
        """保存视觉记忆"""
        metadata = metadata or {}
        metadata.update({
            "type": "vision",
            "objects": objects_detected,
            "faces": faces_detected or [],
            "timestamp": datetime.now().isoformat(),
            "has_faces": len(faces_detected or []) > 0,
            "object_count": len(objects_detected)
        })
        
        # 根据检测到的内容调整重要性
        importance = 0.7
        if faces_detected:
            importance += 0.2  # 有人脸的图像更重要
        if len(objects_detected) > 5:
            importance += 0.1  # 物体丰富的图像更重要
        
        return await self.save_memory(
            memory_type=MemoryType.VISION,
            content=image_description,
            metadata=metadata,
            importance=min(importance, 1.0),
            user_id=user_id
        )
    
    async def save_interaction_pattern(
        self,
        interaction_type: str,
        pattern_data: Dict[str, Any],
        user_id: str = "default"
    ) -> str:
        """保存交互模式"""
        content = f"交互模式: {interaction_type}"
        metadata = {
            "type": "interaction_pattern",
            "interaction_type": interaction_type,
            "pattern_data": pattern_data,
            "timestamp": datetime.now().isoformat()
        }
        
        # 根据交互频率调整重要性
        importance = 0.6
        if pattern_data.get("frequency", 0) > 10:
            importance += 0.2
        if pattern_data.get("success_rate", 0) > 0.8:
            importance += 0.1
        
        return await self.save_memory(
            memory_type=MemoryType.INTERACTION,
            content=content,
            metadata=metadata,
            importance=min(importance, 1.0),
            user_id=user_id
        )

    # 记忆管理功能
    async def get_memory_stats(self, user_id: str = "default") -> Dict[str, Any]:
        """获取记忆统计信息"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                stats = {}
                
                # 各类型记忆数量
                async with db.execute("""
                    SELECT memory_type, COUNT(*), AVG(importance), MAX(access_count)
                    FROM memories WHERE user_id = ?
                    GROUP BY memory_type
                """, (user_id,)) as cursor:
                    memory_counts = {}
                    async for row in cursor:
                        memory_type, count, avg_importance, max_access = row
                        memory_counts[memory_type] = {
                            "count": count,
                            "avg_importance": round(avg_importance, 2),
                            "max_access_count": max_access
                        }
                    stats["memory_counts"] = memory_counts
                
                # 总记忆数量和平均重要性
                async with db.execute("""
                    SELECT COUNT(*), AVG(importance), AVG(access_count)
                    FROM memories WHERE user_id = ?
                """, (user_id,)) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        stats["total_memories"] = row[0]
                        stats["avg_importance"] = round(row[1], 2) if row[1] else 0
                        stats["avg_access_count"] = round(row[2], 2) if row[2] else 0
                    else:
                        stats["total_memories"] = 0
                        stats["avg_importance"] = 0
                        stats["avg_access_count"] = 0
                
                # 会话数量
                async with db.execute("SELECT COUNT(DISTINCT session_id) FROM session_memories") as cursor:
                    row = await cursor.fetchone()
                    stats["total_sessions"] = row[0] if row else 0
                
                # 高重要性记忆数量
                async with db.execute("""
                    SELECT COUNT(*) FROM memories 
                    WHERE user_id = ? AND importance > 0.8
                """, (user_id,)) as cursor:
                    row = await cursor.fetchone()
                    stats["high_importance_count"] = row[0] if row else 0
                
                # 最近记忆数量
                async with db.execute("""
                    SELECT COUNT(*) FROM memories 
                    WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
                """, (user_id,)) as cursor:
                    row = await cursor.fetchone()
                    stats["recent_memories_count"] = row[0] if row else 0
                
                # 缓存统计
                cache_stats = {}
                total_cached = 0
                for memory_type, cache in self.memory_cache.items():
                    cache_count = len(cache)
                    cache_stats[memory_type] = cache_count
                    total_cached += cache_count
                stats["cache_stats"] = cache_stats
                stats["total_cached"] = total_cached
                
                # Mem0状态
                stats["mem0_enabled"] = self.mem0_client is not None
                stats["vector_search_enabled"] = self.sentence_encoder is not None
                
                # 数据库大小（近似）
                try:
                    db_size = Path(self.db_path).stat().st_size
                    stats["database_size_mb"] = round(db_size / (1024 * 1024), 2)
                except:
                    stats["database_size_mb"] = 0
                
                return stats
                
        except Exception as e:
            logger.error(f"获取记忆统计失败: {e}")
            return {}

    async def cleanup_expired_memories(self):
        """清理过期记忆"""
        try:
            deleted_counts = {"memories": 0, "sessions": 0, "mappings": 0}
            
            async with aiosqlite.connect(self.db_path) as db:
                # 删除过期记忆
                async with db.execute("""
                    DELETE FROM memories 
                    WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
                """) as cursor:
                    deleted_counts["memories"] = cursor.rowcount
                
                # 清理老旧会话记忆（超过30天）
                cutoff_date = datetime.now() - timedelta(days=30)
                async with db.execute("""
                    DELETE FROM session_memories 
                    WHERE timestamp < ?
                """, (cutoff_date.isoformat(),)) as cursor:
                    deleted_counts["sessions"] = cursor.rowcount
                
                # 清理无效的映射关系
                async with db.execute("""
                    DELETE FROM mem0_mappings 
                    WHERE local_memory_id NOT IN (SELECT id FROM memories)
                """) as cursor:
                    deleted_counts["mappings"] = cursor.rowcount
                
                await db.commit()
                
                # 重新加载哈希集合
                self.memory_hashes.clear()
                async with db.execute("SELECT hash FROM memories WHERE hash IS NOT NULL") as cursor:
                    async for row in cursor:
                        self.memory_hashes.add(row[0])
                
                logger.info(f"过期记忆清理完成: 删除{deleted_counts['memories']}条记忆, "
                          f"{deleted_counts['sessions']}条会话记录, {deleted_counts['mappings']}条映射")
                
        except Exception as e:
            logger.error(f"清理过期记忆失败: {e}")

    async def cleanup(self):
        """清理资源"""
        try:
            await self.cleanup_expired_memories()
            
            # 清理Mem0客户端
            if self.mem0_client:
                try:
                    # Mem0可能没有显式的清理方法，但我们可以清空引用
                    self.mem0_client = None
                except Exception as e:
                    logger.warning(f"清理Mem0客户端失败: {e}")
            
            # 清理缓存
            for memory_type in self.memory_cache:
                self.memory_cache[memory_type].clear()
            
            logger.info("增强版记忆管理器清理完成")
        except Exception as e:
            logger.error(f"记忆管理器清理失败: {e}")