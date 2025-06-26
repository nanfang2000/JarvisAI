"""
模型路由器
负责根据任务类型智能选择最适合的AI模型
"""

import asyncio
import logging
import re
from typing import Dict, Any, List, Optional, Tuple
from enum import Enum
from .qwen_client import QwenClient
from .deepseek_client import DeepSeekClient

logger = logging.getLogger(__name__)

class TaskType(Enum):
    """任务类型枚举"""
    SIMPLE_CHAT = "simple_chat"           # 简单对话
    COMPLEX_REASONING = "complex_reasoning"  # 复杂推理
    IMAGE_ANALYSIS = "image_analysis"      # 图像分析
    VIDEO_ANALYSIS = "video_analysis"      # 视频分析
    MATHEMATICAL = "mathematical"          # 数学计算
    PLANNING = "planning"                  # 规划任务
    OPTIMIZATION = "optimization"          # 优化建议
    REAL_TIME = "real_time"               # 实时交互
    DOCUMENT = "document"                  # 文档处理

class ModelRouter:
    """模型路由器"""
    
    def __init__(self):
        """初始化模型路由器"""
        self.qwen_client = None
        self.deepseek_client = None
        
        # 任务类型到模型的映射
        self.task_model_mapping = {
            TaskType.SIMPLE_CHAT: "qwen",
            TaskType.REAL_TIME: "qwen",
            TaskType.IMAGE_ANALYSIS: "qwen",
            TaskType.VIDEO_ANALYSIS: "qwen", 
            TaskType.DOCUMENT: "qwen",
            TaskType.COMPLEX_REASONING: "deepseek",
            TaskType.MATHEMATICAL: "deepseek",
            TaskType.PLANNING: "deepseek",
            TaskType.OPTIMIZATION: "deepseek"
        }
        
        # 关键词模式匹配
        self.keyword_patterns = {
            TaskType.COMPLEX_REASONING: [
                r"深度思考", r"复杂分析", r"逻辑推理", r"因果关系",
                r"推断", r"分析原因", r"解释为什么", r"深入分析"
            ],
            TaskType.MATHEMATICAL: [
                r"计算", r"数学", r"统计", r"概率", r"方程",
                r"算法", r"数据分析", r"\d+.*[+\-*/].*\d+", r"求解"
            ],
            TaskType.PLANNING: [
                r"计划", r"规划", r"策略", r"方案", r"安排",
                r"如何实现", r"步骤", r"时间表", r"执行", r"项目"
            ],
            TaskType.OPTIMIZATION: [
                r"优化", r"改进", r"提升", r"改善", r"更好",
                r"效率", r"性能", r"调优", r"升级"
            ],
            TaskType.IMAGE_ANALYSIS: [
                r"图片", r"图像", r"照片", r"看.*图", r"描述.*图",
                r"识别.*图", r"分析.*图"
            ],
            TaskType.VIDEO_ANALYSIS: [
                r"视频", r"录像", r"影片", r"看.*视频", r"分析.*视频"
            ],
            TaskType.DOCUMENT: [
                r"文档", r"文件", r"报告", r"总结", r"提取",
                r"OCR", r"识别文字"
            ]
        }
        
        # 性能统计
        self.performance_stats = {
            "qwen": {"total_requests": 0, "avg_response_time": 0.0, "success_rate": 1.0},
            "deepseek": {"total_requests": 0, "avg_response_time": 0.0, "success_rate": 1.0}
        }
        
        logger.info("模型路由器初始化完成")
    
    async def initialize(self):
        """初始化客户端"""
        try:
            self.qwen_client = QwenClient()
            self.deepseek_client = DeepSeekClient()
            
            # 测试连接
            qwen_ok = await self.qwen_client.test_connection()
            deepseek_ok = await self.deepseek_client.test_connection()
            
            logger.info(f"模型连接状态 - Qwen: {qwen_ok}, DeepSeek: {deepseek_ok}")
            
        except Exception as e:
            logger.error(f"模型路由器初始化错误: {e}")
            raise
    
    def classify_task(self, message: str, context: Dict[str, Any] = None) -> TaskType:
        """分类任务类型"""
        try:
            message_lower = message.lower()
            context = context or {}
            
            # 检查是否有图像数据
            if context.get("has_image"):
                return TaskType.IMAGE_ANALYSIS
            
            # 检查是否有视频数据
            if context.get("has_video"):
                return TaskType.VIDEO_ANALYSIS
            
            # 检查是否是实时交互模式
            if context.get("real_time"):
                return TaskType.REAL_TIME
            
            # 关键词匹配
            for task_type, patterns in self.keyword_patterns.items():
                for pattern in patterns:
                    if re.search(pattern, message_lower):
                        logger.info(f"任务分类: {task_type.value} (匹配模式: {pattern})")
                        return task_type
            
            # 消息长度和复杂度判断
            if len(message) > 200 or "如何" in message or "为什么" in message:
                return TaskType.COMPLEX_REASONING
            
            # 默认为简单对话
            return TaskType.SIMPLE_CHAT
            
        except Exception as e:
            logger.error(f"任务分类错误: {e}")
            return TaskType.SIMPLE_CHAT
    
    def select_model(self, task_type: TaskType, performance_priority: bool = False) -> str:
        """选择最适合的模型"""
        try:
            # 基于任务类型的默认选择
            default_model = self.task_model_mapping.get(task_type, "qwen")
            
            # 如果优先考虑性能，选择性能更好的模型
            if performance_priority:
                qwen_perf = self.performance_stats["qwen"]["success_rate"] / max(
                    self.performance_stats["qwen"]["avg_response_time"], 0.1
                )
                deepseek_perf = self.performance_stats["deepseek"]["success_rate"] / max(
                    self.performance_stats["deepseek"]["avg_response_time"], 0.1
                )
                
                if qwen_perf > deepseek_perf:
                    return "qwen"
                else:
                    return "deepseek"
            
            return default_model
            
        except Exception as e:
            logger.error(f"模型选择错误: {e}")
            return "qwen"  # 默认回退到千问
    
    async def route_request(
        self,
        message: str,
        context: Dict[str, Any] = None,
        mode: str = "auto",
        **kwargs
    ) -> Dict[str, Any]:
        """路由请求到合适的模型"""
        import time
        start_time = time.time()
        
        try:
            context = context or {}
            
            # 手动指定模式
            if mode in ["qwen", "deepseek"]:
                selected_model = mode
                task_type = TaskType.SIMPLE_CHAT  # 默认类型
            else:
                # 自动选择模式
                task_type = self.classify_task(message, context)
                selected_model = self.select_model(task_type)
            
            logger.info(f"路由决策: 任务类型={task_type.value}, 选择模型={selected_model}")
            
            # 执行请求
            result = await self._execute_request(
                selected_model, task_type, message, context, **kwargs
            )
            
            # 更新性能统计
            response_time = time.time() - start_time
            self._update_performance_stats(selected_model, response_time, True)
            
            return {
                "response": result,
                "model_used": selected_model,
                "task_type": task_type.value,
                "response_time": response_time,
                "success": True
            }
            
        except Exception as e:
            response_time = time.time() - start_time
            self._update_performance_stats(
                selected_model if 'selected_model' in locals() else "qwen", 
                response_time, 
                False
            )
            
            logger.error(f"请求路由错误: {e}")
            
            # 错误回退策略
            try:
                fallback_result = await self.qwen_client.chat_completion([
                    {"role": "user", "content": f"抱歉，处理您的请求时遇到问题：{message}"}
                ])
                
                return {
                    "response": fallback_result,
                    "model_used": "qwen_fallback",
                    "task_type": "error_fallback",
                    "response_time": time.time() - start_time,
                    "success": False,
                    "error": str(e)
                }
            except:
                return {
                    "response": "抱歉，服务暂时不可用，请稍后再试。",
                    "model_used": "none",
                    "task_type": "error",
                    "response_time": time.time() - start_time,
                    "success": False,
                    "error": str(e)
                }
    
    async def _execute_request(
        self,
        model: str,
        task_type: TaskType,
        message: str,
        context: Dict[str, Any],
        **kwargs
    ) -> str:
        """执行具体的模型请求"""
        try:
            if model == "qwen":
                return await self._execute_qwen_request(task_type, message, context, **kwargs)
            elif model == "deepseek":
                return await self._execute_deepseek_request(task_type, message, context, **kwargs)
            else:
                raise ValueError(f"未知模型: {model}")
                
        except Exception as e:
            logger.error(f"执行{model}请求错误: {e}")
            raise
    
    async def _execute_qwen_request(
        self,
        task_type: TaskType,
        message: str,
        context: Dict[str, Any],
        **kwargs
    ) -> str:
        """执行千问模型请求"""
        try:
            if task_type == TaskType.IMAGE_ANALYSIS:
                image_data = context.get("image_data", "")
                return await self.qwen_client.analyze_image(image_data, message)
            
            elif task_type == TaskType.VIDEO_ANALYSIS:
                video_url = context.get("video_url", "")
                return await self.qwen_client.analyze_video(video_url, message)
            
            elif task_type == TaskType.DOCUMENT:
                document_content = context.get("document_content", "")
                return await self.qwen_client.document_understanding(document_content, message)
            
            else:
                # 构建消息历史
                messages = context.get("messages", [])
                if not messages:
                    messages = [{"role": "user", "content": message}]
                else:
                    messages.append({"role": "user", "content": message})
                
                # 选择合适的模型
                model_name = "qwen-plus"
                if task_type == TaskType.REAL_TIME:
                    model_name = "qwen-turbo"  # 更快的模型
                
                return await self.qwen_client.chat_completion(
                    messages=messages,
                    model=model_name,
                    **kwargs
                )
                
        except Exception as e:
            logger.error(f"千问请求执行错误: {e}")
            raise
    
    async def _execute_deepseek_request(
        self,
        task_type: TaskType,
        message: str,
        context: Dict[str, Any],
        **kwargs
    ) -> str:
        """执行DeepSeek模型请求"""
        try:
            if task_type == TaskType.COMPLEX_REASONING:
                result = await self.deepseek_client.deep_reasoning(
                    problem=message,
                    context=context.get("conversation_context", "")
                )
                return result["reasoning"]
            
            elif task_type == TaskType.MATHEMATICAL:
                data = context.get("data", [])
                result = await self.deepseek_client.mathematical_analysis(message, data)
                return result["analysis"]
            
            elif task_type == TaskType.PLANNING:
                constraints = context.get("constraints", [])
                resources = context.get("resources", {})
                result = await self.deepseek_client.complex_planning(
                    goal=message,
                    constraints=constraints,
                    resources=resources
                )
                return result["plan"]
            
            elif task_type == TaskType.OPTIMIZATION:
                current_strategy = context.get("current_strategy", "")
                performance_data = context.get("performance_data", {})
                optimization_goals = context.get("optimization_goals", [])
                result = await self.deepseek_client.strategy_optimization(
                    current_strategy=current_strategy,
                    performance_data=performance_data,
                    optimization_goals=optimization_goals
                )
                return result["optimization"]
            
            else:
                # 默认深度推理
                result = await self.deepseek_client.deep_reasoning(
                    problem=message,
                    context=context.get("conversation_context", "")
                )
                return result["reasoning"]
                
        except Exception as e:
            logger.error(f"DeepSeek请求执行错误: {e}")
            raise
    
    def _update_performance_stats(self, model: str, response_time: float, success: bool):
        """更新性能统计"""
        try:
            if model not in self.performance_stats:
                return
            
            stats = self.performance_stats[model]
            stats["total_requests"] += 1
            
            # 更新平均响应时间
            current_avg = stats["avg_response_time"]
            total_requests = stats["total_requests"]
            stats["avg_response_time"] = (
                (current_avg * (total_requests - 1) + response_time) / total_requests
            )
            
            # 更新成功率
            if success:
                current_success_rate = stats["success_rate"]
                stats["success_rate"] = (
                    (current_success_rate * (total_requests - 1) + 1.0) / total_requests
                )
            else:
                current_success_rate = stats["success_rate"]
                stats["success_rate"] = (
                    (current_success_rate * (total_requests - 1) + 0.0) / total_requests
                )
                
        except Exception as e:
            logger.error(f"更新性能统计错误: {e}")
    
    async def get_parallel_responses(
        self,
        message: str,
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """获取双模型并行响应（用于重要决策）"""
        try:
            # 并行请求两个模型
            qwen_task = self.route_request(message, context, mode="qwen")
            deepseek_task = self.route_request(message, context, mode="deepseek")
            
            qwen_result, deepseek_result = await asyncio.gather(
                qwen_task, deepseek_task, return_exceptions=True
            )
            
            return {
                "qwen_response": qwen_result if not isinstance(qwen_result, Exception) else str(qwen_result),
                "deepseek_response": deepseek_result if not isinstance(deepseek_result, Exception) else str(deepseek_result),
                "comparison_available": True
            }
            
        except Exception as e:
            logger.error(f"并行响应错误: {e}")
            return {
                "qwen_response": "获取响应失败",
                "deepseek_response": "获取响应失败", 
                "comparison_available": False,
                "error": str(e)
            }
    
    def get_performance_report(self) -> Dict[str, Any]:
        """获取性能报告"""
        return {
            "performance_stats": self.performance_stats.copy(),
            "task_model_mapping": {k.value: v for k, v in self.task_model_mapping.items()},
            "available_models": {
                "qwen": self.qwen_client is not None,
                "deepseek": self.deepseek_client is not None
            }
        }