"""
千问(Qwen)模型客户端
基于test_qianwen.py，支持文本、流式、图像、视频等多模态功能
"""

import asyncio
import base64
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator
from openai import OpenAI, AsyncOpenAI
from datetime import datetime
import json
import numpy as np

logger = logging.getLogger(__name__)

class QwenClient:
    """千问模型客户端"""
    
    def __init__(self, api_key: str = None, base_url: str = None):
        """初始化千问客户端"""
        # 使用test_qianwen.py中的配置
        self.api_key = api_key or 'sk-e0f5318e73404c91992a6377feb08f96'
        self.base_url = base_url or "https://dashscope.aliyuncs.com/compatible-mode/v1"
        
        # 同步和异步客户端
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )
        
        self.async_client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )
        
        # 支持的模型
        self.models = {
            "text": "qwen-plus",
            "vision": "qwen-vl-plus", 
            "video": "qwen-vl-max",
            "fast": "qwen-turbo"
        }
        
        # 工具定义
        self.tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_current_time",
                    "description": "当你想知道现在的时间时非常有用。",
                    "parameters": {}
                }
            }
        ]
        
        logger.info("千问客户端初始化完成")
    
    def get_current_time(self) -> str:
        """获取当前时间工具函数"""
        current_datetime = datetime.now()
        formatted_time = current_datetime.strftime('%Y-%m-%d %H:%M:%S')
        return f"当前时间：{formatted_time}。"
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "qwen-plus",
        stream: bool = False,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        use_tools: bool = True
    ) -> str:
        """聊天完成"""
        try:
            # 构建请求参数
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            
            if use_tools:
                kwargs["tools"] = self.tools
            
            if stream:
                return await self._stream_chat_completion(**kwargs)
            else:
                return await self._regular_chat_completion(**kwargs)
                
        except Exception as e:
            logger.error(f"聊天完成错误: {e}")
            raise
    
    async def _regular_chat_completion(self, **kwargs) -> str:
        """常规聊天完成"""
        try:
            response = await self.async_client.chat.completions.create(**kwargs)
            
            # 处理工具调用
            message = response.choices[0].message
            if message.tool_calls:
                for tool_call in message.tool_calls:
                    if tool_call.function.name == "get_current_time":
                        return self.get_current_time()
            
            return message.content or ""
            
        except Exception as e:
            logger.error(f"常规聊天完成错误: {e}")
            raise
    
    async def _stream_chat_completion(self, **kwargs) -> str:
        """流式聊天完成"""
        try:
            kwargs["stream"] = True
            response_parts = []
            
            async for chunk in await self.async_client.chat.completions.create(**kwargs):
                if chunk.choices and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    response_parts.append(content)
                    
                # 处理工具调用
                if (chunk.choices and 
                    chunk.choices[0].delta.tool_calls and 
                    chunk.choices[0].delta.tool_calls[0].function.name == "get_current_time"):
                    time_result = self.get_current_time()
                    response_parts.append(time_result)
            
            return "".join(response_parts)
            
        except Exception as e:
            logger.error(f"流式聊天完成错误: {e}")
            raise
    
    async def stream_chat_generator(
        self,
        messages: List[Dict[str, str]],
        model: str = "qwen-plus",
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> AsyncGenerator[str, None]:
        """流式聊天生成器，用于实时响应"""
        try:
            response = await self.async_client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
                tools=self.tools
            )
            
            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
                # 处理工具调用
                if (chunk.choices and 
                    chunk.choices[0].delta.tool_calls and 
                    chunk.choices[0].delta.tool_calls[0].function.name == "get_current_time"):
                    yield self.get_current_time()
                    
        except Exception as e:
            logger.error(f"流式聊天生成器错误: {e}")
            yield f"Error: {str(e)}"
    
    async def analyze_image(
        self,
        image_data: str,
        question: str = "请描述这张图片",
        model: str = "qwen-vl-plus",
        analysis_type: str = "general"
    ) -> str:
        """
        图像分析
        
        Args:
            image_data: base64编码的图像数据
            question: 分析问题
            model: 使用的模型
            analysis_type: 分析类型 (general, detailed, scene, objects, people)
            
        Returns:
            str: 分析结果
        """
        try:
            # 根据分析类型调整问题
            if analysis_type == "detailed":
                question = f"{question}。请详细描述图片中的每个细节，包括人物、物体、环境、颜色、动作等。"
            elif analysis_type == "scene":
                question = f"{question}。请重点分析场景环境，包括位置、时间、氛围等。"
            elif analysis_type == "objects":
                question = f"{question}。请重点识别并列出图片中的所有物体。"
            elif analysis_type == "people":
                question = f"{question}。请重点分析图片中的人物，包括人数、表情、动作、服装等。"
            elif analysis_type == "safety":
                question = f"{question}。请分析图片是否存在安全隐患或异常情况。"
            
            # 构建包含图像的消息
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": question},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_data}"
                            }
                        }
                    ]
                }
            ]
            
            response = await self.async_client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=1500,
                temperature=0.3  # 降低随机性，提高准确性
            )
            
            return response.choices[0].message.content or ""
            
        except Exception as e:
            logger.error(f"图像分析错误: {e}")
            raise
    
    async def analyze_video(
        self,
        video_url: str,
        question: str = "请描述这个视频",
        model: str = "qwen-vl-max"
    ) -> str:
        """视频分析"""
        try:
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": question},
                        {
                            "type": "video",
                            "video": {"url": video_url}
                        }
                    ]
                }
            ]
            
            response = await self.async_client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=1000
            )
            
            return response.choices[0].message.content or ""
            
        except Exception as e:
            logger.error(f"视频分析错误: {e}")
            raise
    
    async def document_understanding(
        self,
        document_content: str,
        question: str = "请总结这个文档的主要内容"
    ) -> str:
        """文档理解和OCR"""
        try:
            messages = [
                {
                    "role": "system",
                    "content": "你是一个专业的文档分析助手，擅长理解和总结各种文档内容。"
                },
                {
                    "role": "user", 
                    "content": f"文档内容：{document_content}\n\n问题：{question}"
                }
            ]
            
            return await self.chat_completion(messages, use_tools=False)
            
        except Exception as e:
            logger.error(f"文档理解错误: {e}")
            raise
    
    async def web_search_integration(
        self,
        query: str,
        search_results: List[Dict[str, Any]]
    ) -> str:
        """网络搜索结果集成"""
        try:
            # 构建包含搜索结果的消息
            search_context = "\n".join([
                f"标题: {result.get('title', '')}\n内容: {result.get('content', '')}\n"
                for result in search_results[:5]  # 限制前5个结果
            ])
            
            messages = [
                {
                    "role": "system",
                    "content": "你是一个智能搜索助手，能够分析网络搜索结果并提供准确的答案。"
                },
                {
                    "role": "user",
                    "content": f"用户问题：{query}\n\n搜索结果：\n{search_context}\n\n请基于搜索结果回答用户的问题。"
                }
            ]
            
            return await self.chat_completion(messages, use_tools=False)
            
        except Exception as e:
            logger.error(f"网络搜索集成错误: {e}")
            raise
    
    def get_available_models(self) -> Dict[str, str]:
        """获取可用模型列表"""
        return self.models.copy()
    
    async def test_connection(self) -> bool:
        """测试连接"""
        try:
            response = await self.chat_completion([
                {"role": "user", "content": "Hello, 请简单回复测试连接成功"}
            ])
            return bool(response)
        except Exception as e:
            logger.error(f"连接测试失败: {e}")
            return False
    
    async def analyze_vision_data(
        self,
        vision_results: Dict[str, Any],
        context: str = "",
        analysis_focus: str = "comprehensive"
    ) -> str:
        """
        分析视觉处理结果
        
        Args:
            vision_results: 视觉处理结果（来自vision service）
            context: 上下文信息
            analysis_focus: 分析重点 (comprehensive, security, interaction, summary)
            
        Returns:
            str: 分析报告
        """
        try:
            # 构建分析提示
            prompt_parts = []
            
            if analysis_focus == "security":
                prompt_parts.append("请从安全角度分析以下视觉检测结果：")
            elif analysis_focus == "interaction":
                prompt_parts.append("请分析以下视觉检测结果中的人机交互意图：")
            elif analysis_focus == "summary":
                prompt_parts.append("请简要总结以下视觉检测结果：")
            else:
                prompt_parts.append("请全面分析以下视觉检测结果：")
            
            # 添加上下文
            if context:
                prompt_parts.append(f"上下文信息：{context}")
            
            # 处理人脸识别结果
            if 'faces' in vision_results:
                faces_data = vision_results['faces']
                if faces_data.get('detected_faces'):
                    face_count = len(faces_data['detected_faces'])
                    known_faces = [f for f in faces_data['detected_faces'] if f['name'] != 'Unknown']
                    emotions = [f['emotion']['emotion'] for f in faces_data['detected_faces']]
                    
                    prompt_parts.append(f"人脸检测：发现{face_count}张人脸")
                    if known_faces:
                        names = [f['name'] for f in known_faces]
                        prompt_parts.append(f"已识别人员：{', '.join(names)}")
                    if emotions:
                        emotion_summary = ', '.join(set(emotions))
                        prompt_parts.append(f"检测到的情绪：{emotion_summary}")
                    
                    if faces_data.get('owner_present'):
                        prompt_parts.append("主人在场")
            
            # 处理物体识别结果
            if 'objects' in vision_results:
                objects_data = vision_results['objects']
                if objects_data.get('detected_objects'):
                    object_count = len(objects_data['detected_objects'])
                    object_types = [obj['chinese_name'] for obj in objects_data['detected_objects']]
                    prompt_parts.append(f"物体检测：发现{object_count}个物体")
                    prompt_parts.append(f"物体类型：{', '.join(set(object_types))}")
                    
                    scene_desc = objects_data.get('scene_analysis', {}).get('scene_description', '')
                    if scene_desc:
                        prompt_parts.append(f"场景描述：{scene_desc}")
            
            # 处理手势识别结果
            if 'gestures' in vision_results:
                gestures_data = vision_results['gestures']
                if gestures_data.get('detected_hands'):
                    hands_count = len(gestures_data['detected_hands'])
                    gestures = [hand['gesture']['chinese_name'] for hand in gestures_data['detected_hands']]
                    prompt_parts.append(f"手势检测：发现{hands_count}只手")
                    prompt_parts.append(f"检测到的手势：{', '.join(gestures)}")
                    
                    interaction = gestures_data.get('interaction_analysis', {})
                    if interaction.get('description'):
                        prompt_parts.append(f"交互分析：{interaction['description']}")
            
            # 添加分析要求
            if analysis_focus == "security":
                prompt_parts.append("请重点关注：1) 是否有陌生人 2) 是否有异常行为 3) 环境安全状况")
            elif analysis_focus == "interaction":
                prompt_parts.append("请重点关注：1) 用户意图 2) 需要的响应 3) 交互建议")
            elif analysis_focus == "summary":
                prompt_parts.append("请用1-2句话简要概括当前情况")
            else:
                prompt_parts.append("请提供详细的分析和建议")
            
            analysis_prompt = "\n".join(prompt_parts)
            
            # 调用千问分析
            messages = [
                {
                    "role": "system",
                    "content": "你是JARVIS的视觉分析助手，擅长分析视觉检测结果并提供智能判断。"
                },
                {
                    "role": "user",
                    "content": analysis_prompt
                }
            ]
            
            response = await self.chat_completion(messages, use_tools=False)
            return response
            
        except Exception as e:
            logger.error(f"视觉数据分析失败: {e}")
            return f"视觉数据分析失败: {str(e)}"
    
    def frame_to_base64(self, frame: np.ndarray, format: str = '.jpg') -> str:
        """
        将OpenCV帧转换为base64字符串
        
        Args:
            frame: OpenCV图像帧
            format: 图像格式 (.jpg, .png等)
            
        Returns:
            str: base64编码的图像
        """
        try:
            import cv2
            _, buffer = cv2.imencode(format, frame)
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            return img_base64
        except Exception as e:
            logger.error(f"帧转base64失败: {e}")
            return ""
    
    async def analyze_frame_with_ai(
        self,
        frame,  # np.ndarray
        question: str = "请分析这张图片中的内容",
        analysis_type: str = "general"
    ) -> str:
        """
        使用AI分析图像帧
        
        Args:
            frame: OpenCV图像帧
            question: 分析问题
            analysis_type: 分析类型
            
        Returns:
            str: AI分析结果
        """
        try:
            # 转换为base64
            image_base64 = self.frame_to_base64(frame)
            if not image_base64:
                return "图像转换失败"
            
            # 调用图像分析
            result = await self.analyze_image(image_base64, question, analysis_type=analysis_type)
            return result
            
        except Exception as e:
            logger.error(f"帧AI分析失败: {e}")
            return f"分析失败: {str(e)}"
    
    async def get_smart_response_for_vision(
        self,
        vision_results: Dict[str, Any],
        user_query: str = "",
        personality: str = "helpful"
    ) -> str:
        """
        根据视觉结果生成智能响应
        
        Args:
            vision_results: 视觉处理结果
            user_query: 用户查询
            personality: 响应个性 (helpful, formal, casual, caring)
            
        Returns:
            str: 智能响应
        """
        try:
            # 构建上下文
            context_parts = []
            
            # 分析当前状况
            analysis = await self.analyze_vision_data(vision_results, analysis_focus="summary")
            context_parts.append(f"当前状况：{analysis}")
            
            if user_query:
                context_parts.append(f"用户询问：{user_query}")
            
            # 根据个性设置响应风格
            personality_prompts = {
                "helpful": "请以乐于助人、专业的语气响应",
                "formal": "请以正式、礼貌的语气响应", 
                "casual": "请以轻松、友好的语气响应",
                "caring": "请以关心、体贴的语气响应"
            }
            
            system_prompt = f"""你是JARVIS智能助手，能够看到周围环境并与用户互动。
{personality_prompts.get(personality, '请以合适的语气响应')}。
如果检测到人脸，可以称呼对方的名字。
如果检测到手势，要理解用户的意图。
如果有安全问题，要及时提醒。"""
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "\n".join(context_parts)}
            ]
            
            response = await self.chat_completion(messages, use_tools=True)
            return response
            
        except Exception as e:
            logger.error(f"智能响应生成失败: {e}")
            return "抱歉，我现在无法处理这个请求。"