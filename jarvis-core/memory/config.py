"""
Mem0记忆系统配置
"""

import os
from typing import Dict, Any

# Mem0配置
MEM0_CONFIG = {
    "version": "v1.1",
    "vector_store": {
        "provider": "chroma",
        "config": {
            "collection_name": "jarvis_memories",
            "path": "memory/chroma_db",
            "host": os.getenv("CHROMA_HOST", "localhost"),
            "port": int(os.getenv("CHROMA_PORT", "8000"))
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
            "max_tokens": 1000,
            "api_key": os.getenv("OPENAI_API_KEY")
        }
    }
}

# 数据库配置
DATABASE_CONFIG = {
    "path": "memory/jarvis_memory.db",
    "enable_wal": True,
    "cache_size": 10000,
    "timeout": 30.0
}

# 记忆管理配置
MEMORY_CONFIG = {
    "importance_threshold": 0.8,
    "max_cache_size": 1000,
    "cleanup_interval_hours": 24,
    "max_memory_age_days": 365,
    "vector_search_threshold": 0.3,
    "deduplication_threshold": 0.9
}

# 用户记忆配置
USER_MEMORY_CONFIG = {
    "max_goals": 20,
    "max_habits": 15,
    "max_relationships": 100,
    "preference_expiry_days": 180
}

# 会话记忆配置
SESSION_MEMORY_CONFIG = {
    "max_session_age_hours": 24,
    "max_messages_per_session": 1000,
    "context_window_size": 20,
    "auto_summarize_threshold": 50
}

# 智能体记忆配置
AGENT_MEMORY_CONFIG = {
    "max_skills": 100,
    "max_error_patterns": 50,
    "max_learning_experiences": 200,
    "knowledge_retention_days": 730
}

# 视觉记忆配置
VISUAL_MEMORY_CONFIG = {
    "max_face_registry_size": 1000,
    "max_object_knowledge_size": 500,
    "max_scene_patterns": 200,
    "face_confidence_threshold": 0.7,
    "object_confidence_threshold": 0.5
}

def get_mem0_config() -> Dict[str, Any]:
    """获取Mem0配置"""
    config = MEM0_CONFIG.copy()
    
    # 根据环境变量调整配置
    if os.getenv("MEM0_VECTOR_PROVIDER"):
        config["vector_store"]["provider"] = os.getenv("MEM0_VECTOR_PROVIDER")
    
    if os.getenv("MEM0_LLM_PROVIDER"):
        config["llm"]["provider"] = os.getenv("MEM0_LLM_PROVIDER")
    
    if os.getenv("MEM0_EMBEDDER_MODEL"):
        config["embedder"]["config"]["model"] = os.getenv("MEM0_EMBEDDER_MODEL")
    
    return config

def get_database_config() -> Dict[str, Any]:
    """获取数据库配置"""
    config = DATABASE_CONFIG.copy()
    
    if os.getenv("JARVIS_DB_PATH"):
        config["path"] = os.getenv("JARVIS_DB_PATH")
    
    return config

def get_memory_config() -> Dict[str, Any]:
    """获取记忆管理配置"""
    config = MEMORY_CONFIG.copy()
    
    # 从环境变量读取配置
    if os.getenv("MEMORY_IMPORTANCE_THRESHOLD"):
        config["importance_threshold"] = float(os.getenv("MEMORY_IMPORTANCE_THRESHOLD"))
    
    if os.getenv("MEMORY_MAX_CACHE_SIZE"):
        config["max_cache_size"] = int(os.getenv("MEMORY_MAX_CACHE_SIZE"))
    
    return config