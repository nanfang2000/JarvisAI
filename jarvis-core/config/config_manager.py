"""
配置管理器
负责管理系统配置、用户偏好和个性化设置
"""

import json
import logging
import os
from typing import Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class ConfigManager:
    """配置管理器"""
    
    def __init__(self, config_dir: str = None):
        """初始化配置管理器"""
        self.config_dir = Path(config_dir) if config_dir else Path("config")
        self.config_dir.mkdir(exist_ok=True)
        
        # 配置文件路径
        self.system_config_path = self.config_dir / "system_config.json"
        self.user_config_path = self.config_dir / "user_config.json"
        self.personality_config_path = self.config_dir / "personality_config.json"
        
        # 默认配置
        self.default_system_config = {
            "version": "1.0.0",
            "debug_mode": False,
            "log_level": "INFO",
            "api_settings": {
                "qwen_api_key": "sk-e0f5318e73404c91992a6377feb08f96",
                "qwen_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
                "deepseek_api_key": "",
                "deepseek_base_url": "https://api.deepseek.com/v1"
            },
            "server_settings": {
                "host": "127.0.0.1",
                "port": 8000,
                "cors_origins": ["*"]
            },
            "model_settings": {
                "default_model": "qwen",
                "auto_fallback": True,
                "performance_priority": False,
                "parallel_threshold": 0.8
            }
        }
        
        self.default_user_config = {
            "user_id": "default_user",
            "name": "主人",
            "language": "zh-CN",
            "timezone": "Asia/Shanghai",
            "preferences": {
                "response_style": "friendly",
                "verbosity": "normal",
                "emoji_usage": False,
                "voice_enabled": True,
                "vision_enabled": True
            },
            "ui_settings": {
                "theme": "dark",
                "avatar_style": "default",
                "layout": "split",
                "avatar_panel_width": 40
            }
        }
        
        self.default_personality_config = {
            "name": "小爱",
            "gender": "female",
            "age": "25000",
            "personality_traits": {
                "friendliness": 0.9,
                "helpfulness": 0.95,
                "humor": 0.7,
                "formality": 0.3,
                "empathy": 0.85
            },
            "response_patterns": {
                "greeting": ["你好主人！", "主人好！", "很高兴见到您！"],
                "acknowledgment": ["好的主人", "明白了", "收到！"],
                "apology": ["抱歉主人", "不好意思", "请原谅我"],
                "farewell": ["再见主人！", "祝您愉快！", "期待下次见面！"]
            },
            "behavioral_rules": [
                "始终称呼用户为'主人'",
                "保持甜美可爱的语调",
                "如有不清楚的信息要直接询问",
                "使用简洁的语句交流",
                "主动关心用户的需求"
            ]
        }
        
        # 加载配置
        self.system_config = self._load_config(
            self.system_config_path, self.default_system_config
        )
        self.user_config = self._load_config(
            self.user_config_path, self.default_user_config
        )
        self.personality_config = self._load_config(
            self.personality_config_path, self.default_personality_config
        )
        
        logger.info("配置管理器初始化完成")
    
    def _load_config(self, config_path: Path, default_config: Dict[str, Any]) -> Dict[str, Any]:
        """加载配置文件"""
        try:
            if config_path.exists():
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                # 合并默认配置（处理新增字段）
                merged_config = self._merge_configs(default_config, config)
                # 如果有新字段，保存更新后的配置
                if merged_config != config:
                    self._save_config(config_path, merged_config)
                return merged_config
            else:
                # 创建默认配置文件
                self._save_config(config_path, default_config)
                return default_config.copy()
        except Exception as e:
            logger.error(f"加载配置文件失败 {config_path}: {e}")
            return default_config.copy()
    
    def _merge_configs(self, default: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
        """合并配置，保留用户设置，补充默认值"""
        merged = default.copy()
        for key, value in user.items():
            if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
                merged[key] = self._merge_configs(merged[key], value)
            else:
                merged[key] = value
        return merged
    
    def _save_config(self, config_path: Path, config: Dict[str, Any]):
        """保存配置文件"""
        try:
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存配置文件失败 {config_path}: {e}")
    
    def get_system_config(self, key: str = None) -> Any:
        """获取系统配置"""
        if key is None:
            return self.system_config
        return self._get_nested_value(self.system_config, key)
    
    def get_user_config(self, key: str = None) -> Any:
        """获取用户配置"""
        if key is None:
            return self.user_config
        return self._get_nested_value(self.user_config, key)
    
    def get_personality_config(self, key: str = None) -> Any:
        """获取个性配置"""
        if key is None:
            return self.personality_config
        return self._get_nested_value(self.personality_config, key)
    
    def _get_nested_value(self, config: Dict[str, Any], key: str) -> Any:
        """获取嵌套配置值，支持 'section.key' 格式"""
        try:
            keys = key.split('.')
            value = config
            for k in keys:
                value = value[k]
            return value
        except (KeyError, TypeError):
            return None
    
    def set_system_config(self, key: str, value: Any, save: bool = True):
        """设置系统配置"""
        self._set_nested_value(self.system_config, key, value)
        if save:
            self._save_config(self.system_config_path, self.system_config)
    
    def set_user_config(self, key: str, value: Any, save: bool = True):
        """设置用户配置"""
        self._set_nested_value(self.user_config, key, value)
        if save:
            self._save_config(self.user_config_path, self.user_config)
    
    def set_personality_config(self, key: str, value: Any, save: bool = True):
        """设置个性配置"""
        self._set_nested_value(self.personality_config, key, value)
        if save:
            self._save_config(self.personality_config_path, self.personality_config)
    
    def _set_nested_value(self, config: Dict[str, Any], key: str, value: Any):
        """设置嵌套配置值"""
        try:
            keys = key.split('.')
            current = config
            for k in keys[:-1]:
                if k not in current:
                    current[k] = {}
                current = current[k]
            current[keys[-1]] = value
        except Exception as e:
            logger.error(f"设置配置值失败 {key}: {e}")
    
    def get_api_config(self) -> Dict[str, Any]:
        """获取API配置"""
        return self.get_system_config("api_settings") or {}
    
    def get_personality_traits(self) -> Dict[str, float]:
        """获取个性特征"""
        return self.get_personality_config("personality_traits") or {}
    
    def get_response_style(self) -> str:
        """获取响应风格"""
        return self.get_user_config("preferences.response_style") or "friendly"
    
    def get_ui_theme(self) -> str:
        """获取UI主题"""
        return self.get_user_config("ui_settings.theme") or "dark"
    
    def get_model_preference(self) -> str:
        """获取模型偏好"""
        return self.get_system_config("model_settings.default_model") or "qwen"
    
    def is_voice_enabled(self) -> bool:
        """是否启用语音"""
        return self.get_user_config("preferences.voice_enabled") or False
    
    def is_vision_enabled(self) -> bool:
        """是否启用视觉"""
        return self.get_user_config("preferences.vision_enabled") or False
    
    def should_use_emoji(self) -> bool:
        """是否使用表情符号"""
        return self.get_user_config("preferences.emoji_usage") or False
    
    def get_avatar_panel_width(self) -> int:
        """获取头像面板宽度"""
        return self.get_user_config("ui_settings.avatar_panel_width") or 40
    
    def update_personality_trait(self, trait: str, value: float, save: bool = True):
        """更新个性特征"""
        if 0.0 <= value <= 1.0:
            self.set_personality_config(f"personality_traits.{trait}", value, save)
        else:
            logger.warning(f"个性特征值超出范围 [0,1]: {trait}={value}")
    
    def add_response_pattern(self, category: str, pattern: str, save: bool = True):
        """添加响应模式"""
        current_patterns = self.get_personality_config(f"response_patterns.{category}") or []
        if pattern not in current_patterns:
            current_patterns.append(pattern)
            self.set_personality_config(f"response_patterns.{category}", current_patterns, save)
    
    def get_random_response_pattern(self, category: str) -> Optional[str]:
        """获取随机响应模式"""
        import random
        patterns = self.get_personality_config(f"response_patterns.{category}") or []
        return random.choice(patterns) if patterns else None
    
    def export_config(self, export_path: str = None) -> str:
        """导出所有配置"""
        try:
            export_data = {
                "system_config": self.system_config,
                "user_config": self.user_config,
                "personality_config": self.personality_config,
                "export_timestamp": import datetime.datetime.now().isoformat()
            }
            
            if export_path is None:
                export_path = self.config_dir / "config_backup.json"
            
            with open(export_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"配置导出成功: {export_path}")
            return str(export_path)
            
        except Exception as e:
            logger.error(f"配置导出失败: {e}")
            raise
    
    def import_config(self, import_path: str, backup: bool = True):
        """导入配置"""
        try:
            if backup:
                self.export_config(self.config_dir / "config_backup_before_import.json")
            
            with open(import_path, 'r', encoding='utf-8') as f:
                import_data = json.load(f)
            
            # 更新配置
            if "system_config" in import_data:
                self.system_config = import_data["system_config"]
                self._save_config(self.system_config_path, self.system_config)
            
            if "user_config" in import_data:
                self.user_config = import_data["user_config"]
                self._save_config(self.user_config_path, self.user_config)
            
            if "personality_config" in import_data:
                self.personality_config = import_data["personality_config"]
                self._save_config(self.personality_config_path, self.personality_config)
            
            logger.info(f"配置导入成功: {import_path}")
            
        except Exception as e:
            logger.error(f"配置导入失败: {e}")
            raise
    
    def reset_to_defaults(self, config_type: str = "all"):
        """重置为默认配置"""
        try:
            if config_type in ["all", "system"]:
                self.system_config = self.default_system_config.copy()
                self._save_config(self.system_config_path, self.system_config)
            
            if config_type in ["all", "user"]:
                self.user_config = self.default_user_config.copy()
                self._save_config(self.user_config_path, self.user_config)
            
            if config_type in ["all", "personality"]:
                self.personality_config = self.default_personality_config.copy()
                self._save_config(self.personality_config_path, self.personality_config)
            
            logger.info(f"配置已重置为默认值: {config_type}")
            
        except Exception as e:
            logger.error(f"重置配置失败: {e}")
            raise