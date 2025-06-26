"""
JARVIS 视觉处理服务
独立的视觉处理服务，提供摄像头数据采集、人脸识别、物体识别、手势检测等功能
"""

import asyncio
import cv2
import base64
import json
import logging
import os
import sys
from datetime import datetime
from typing import Dict, List, Any, Optional
import numpy as np

# 添加父目录到路径，以便导入jarvis-core模块
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# 导入视觉处理模块
from jarvis_core.vision.face_recognition import FaceRecognizer
from jarvis_core.vision.object_recognition import ObjectRecognizer
from jarvis_core.vision.gesture_detection import GestureDetector

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="JARVIS Vision Service", version="1.0.0")

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 数据模型
class VisionRequest(BaseModel):
    """视觉处理请求"""
    image_data: str  # base64编码的图像
    operations: List[str]  # 要执行的操作列表
    options: Dict[str, Any] = {}  # 额外选项

class CameraConfig(BaseModel):
    """摄像头配置"""
    camera_id: int = 0
    width: int = 640
    height: int = 480
    fps: int = 30

class VisionResponse(BaseModel):
    """视觉处理响应"""
    success: bool
    data: Dict[str, Any]
    error: Optional[str] = None
    timestamp: str

# 全局变量
vision_processors = {}
camera_manager = None
websocket_connections = set()

class CameraManager:
    """摄像头管理器"""
    
    def __init__(self):
        self.camera = None
        self.is_running = False
        self.config = CameraConfig()
        
    def initialize_camera(self, config: CameraConfig = None) -> bool:
        """初始化摄像头"""
        try:
            if config:
                self.config = config
                
            # 释放现有摄像头
            if self.camera is not None:
                self.camera.release()
            
            # 初始化新摄像头
            self.camera = cv2.VideoCapture(self.config.camera_id)
            
            if not self.camera.isOpened():
                logger.error(f"无法打开摄像头 {self.config.camera_id}")
                return False
            
            # 设置摄像头参数
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.width)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.height)
            self.camera.set(cv2.CAP_PROP_FPS, self.config.fps)
            
            logger.info(f"摄像头初始化成功: {self.config.camera_id}")
            return True
            
        except Exception as e:
            logger.error(f"摄像头初始化失败: {e}")
            return False
    
    def capture_frame(self) -> Optional[np.ndarray]:
        """捕获一帧"""
        try:
            if self.camera is None or not self.camera.isOpened():
                return None
                
            ret, frame = self.camera.read()
            return frame if ret else None
            
        except Exception as e:
            logger.error(f"捕获帧失败: {e}")
            return None
    
    def start_streaming(self):
        """开始流式传输"""
        self.is_running = True
        logger.info("开始摄像头流式传输")
    
    def stop_streaming(self):
        """停止流式传输"""
        self.is_running = False
        logger.info("停止摄像头流式传输")
    
    def cleanup(self):
        """清理资源"""
        try:
            self.is_running = False
            if self.camera is not None:
                self.camera.release()
                self.camera = None
            logger.info("摄像头资源清理完成")
        except Exception as e:
            logger.error(f"摄像头清理失败: {e}")

class VisionService:
    """视觉处理服务主类"""
    
    def __init__(self):
        self.face_recognizer = None
        self.object_recognizer = None
        self.gesture_detector = None
        self.initialized = False
        
    async def initialize(self):
        """初始化视觉处理器"""
        try:
            logger.info("正在初始化视觉处理器...")
            
            # 初始化各个处理器
            self.face_recognizer = FaceRecognizer()
            self.object_recognizer = ObjectRecognizer()
            self.gesture_detector = GestureDetector()
            
            self.initialized = True
            logger.info("视觉处理器初始化完成")
            
        except Exception as e:
            logger.error(f"视觉处理器初始化失败: {e}")
            raise
    
    async def process_frame(self, frame: np.ndarray, operations: List[str], options: Dict[str, Any] = {}) -> Dict[str, Any]:
        """
        处理单帧图像
        
        Args:
            frame: 输入帧
            operations: 要执行的操作列表
            options: 额外选项
            
        Returns:
            Dict: 处理结果
        """
        if not self.initialized:
            await self.initialize()
            
        results = {
            'timestamp': datetime.now().isoformat(),
            'frame_info': {
                'width': frame.shape[1],
                'height': frame.shape[0],
                'channels': frame.shape[2] if len(frame.shape) > 2 else 1
            }
        }
        
        try:
            # 人脸识别
            if 'face_recognition' in operations:
                faces = self.face_recognizer.detect_faces_in_frame(frame)
                face_stats = self.face_recognizer.get_face_statistics(faces)
                owner_present = self.face_recognizer.is_owner_present(faces)
                
                results['faces'] = {
                    'detected_faces': faces,
                    'statistics': face_stats,
                    'owner_present': owner_present
                }
            
            # 物体识别
            if 'object_recognition' in operations:
                objects = self.object_recognizer.detect_objects(frame)
                scene_analysis = self.object_recognizer.analyze_scene(frame, objects)
                
                results['objects'] = {
                    'detected_objects': objects,
                    'scene_analysis': scene_analysis
                }
            
            # 手势检测
            if 'gesture_detection' in operations:
                hands = self.gesture_detector.detect_hands(frame)
                interaction = self.gesture_detector.analyze_gesture_interaction(hands)
                
                results['gestures'] = {
                    'detected_hands': hands,
                    'interaction_analysis': interaction
                }
            
            # 绘制可视化结果
            if options.get('draw_results', False):
                annotated_frame = frame.copy()
                
                if 'faces' in results:
                    annotated_frame = self.face_recognizer.draw_face_info(
                        annotated_frame, results['faces']['detected_faces']
                    )
                
                if 'objects' in results:
                    annotated_frame = self.object_recognizer.draw_objects(
                        annotated_frame, results['objects']['detected_objects']
                    )
                
                if 'gestures' in results:
                    annotated_frame = self.gesture_detector.draw_hands(
                        annotated_frame, results['gestures']['detected_hands']
                    )
                
                # 转换为base64
                _, buffer = cv2.imencode('.jpg', annotated_frame)
                results['annotated_image'] = base64.b64encode(buffer).decode('utf-8')
            
            return results
            
        except Exception as e:
            logger.error(f"帧处理失败: {e}")
            results['error'] = str(e)
            return results
    
    def cleanup(self):
        """清理资源"""
        try:
            if self.face_recognizer:
                self.face_recognizer.cleanup()
            if self.object_recognizer:
                self.object_recognizer.cleanup()
            if self.gesture_detector:
                self.gesture_detector.cleanup()
            logger.info("视觉服务清理完成")
        except Exception as e:
            logger.error(f"视觉服务清理失败: {e}")

# 全局实例
vision_service = VisionService()

@app.on_event("startup")
async def startup_event():
    """启动事件"""
    global camera_manager
    try:
        # 初始化摄像头管理器
        camera_manager = CameraManager()
        
        # 检查摄像头可用性
        if camera_manager.initialize_camera():
            logger.info("服务启动成功，摄像头可用")
        else:
            logger.warning("服务启动成功，但摄像头不可用")
            
    except Exception as e:
        logger.error(f"服务启动失败: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """关闭事件"""
    try:
        if camera_manager:
            camera_manager.cleanup()
        vision_service.cleanup()
        logger.info("服务关闭完成")
    except Exception as e:
        logger.error(f"服务关闭失败: {e}")

@app.get("/")
async def root():
    """根路径"""
    return {
        "service": "JARVIS Vision Service",
        "version": "1.0.0",
        "status": "running",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """健康检查"""
    camera_status = "available" if (camera_manager and camera_manager.camera and camera_manager.camera.isOpened()) else "unavailable"
    
    return {
        "status": "healthy",
        "camera_status": camera_status,
        "vision_service_initialized": vision_service.initialized,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/camera/info")
async def get_camera_info():
    """获取摄像头信息"""
    if not camera_manager or not camera_manager.camera:
        raise HTTPException(status_code=404, detail="摄像头未初始化")
    
    try:
        width = camera_manager.camera.get(cv2.CAP_PROP_FRAME_WIDTH)
        height = camera_manager.camera.get(cv2.CAP_PROP_FRAME_HEIGHT)
        fps = camera_manager.camera.get(cv2.CAP_PROP_FPS)
        
        return {
            "camera_id": camera_manager.config.camera_id,
            "resolution": {"width": int(width), "height": int(height)},
            "fps": int(fps),
            "is_opened": camera_manager.camera.isOpened()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取摄像头信息失败: {e}")

@app.post("/camera/config")
async def update_camera_config(config: CameraConfig):
    """更新摄像头配置"""
    if not camera_manager:
        raise HTTPException(status_code=500, detail="摄像头管理器未初始化")
    
    try:
        success = camera_manager.initialize_camera(config)
        if success:
            return {"success": True, "message": "摄像头配置更新成功"}
        else:
            raise HTTPException(status_code=500, detail="摄像头配置更新失败")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"配置更新失败: {e}")

@app.get("/camera/capture")
async def capture_single_frame():
    """捕获单帧图像"""
    if not camera_manager or not camera_manager.camera:
        raise HTTPException(status_code=404, detail="摄像头未初始化")
    
    try:
        frame = camera_manager.capture_frame()
        if frame is None:
            raise HTTPException(status_code=500, detail="捕获帧失败")
        
        # 转换为base64
        _, buffer = cv2.imencode('.jpg', frame)
        image_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return {
            "success": True,
            "image_data": image_base64,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"捕获失败: {e}")

@app.post("/vision/process")
async def process_vision_request(request: VisionRequest):
    """处理视觉识别请求"""
    try:
        # 解码base64图像
        image_bytes = base64.b64decode(request.image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            raise HTTPException(status_code=400, detail="图像解码失败")
        
        # 处理帧
        results = await vision_service.process_frame(frame, request.operations, request.options)
        
        return VisionResponse(
            success=True,
            data=results,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"视觉处理请求失败: {e}")
        return VisionResponse(
            success=False,
            data={},
            error=str(e),
            timestamp=datetime.now().isoformat()
        )

@app.websocket("/ws/camera")
async def websocket_camera_stream(websocket: WebSocket):
    """WebSocket摄像头流"""
    await websocket.accept()
    websocket_connections.add(websocket)
    
    try:
        logger.info("WebSocket连接建立，开始摄像头流")
        
        if not camera_manager or not camera_manager.camera:
            await websocket.send_json({
                "error": "摄像头未初始化",
                "timestamp": datetime.now().isoformat()
            })
            return
        
        camera_manager.start_streaming()
        
        while camera_manager.is_running:
            try:
                # 捕获帧
                frame = camera_manager.capture_frame()
                if frame is None:
                    await asyncio.sleep(0.033)  # 30fps
                    continue
                
                # 接收客户端配置
                try:
                    data = await asyncio.wait_for(websocket.receive_json(), timeout=0.001)
                    operations = data.get('operations', ['face_recognition'])
                    options = data.get('options', {'draw_results': True})
                except asyncio.TimeoutError:
                    # 使用默认配置
                    operations = ['face_recognition', 'object_recognition', 'gesture_detection']
                    options = {'draw_results': True}
                
                # 处理帧
                results = await vision_service.process_frame(frame, operations, options)
                
                # 发送结果
                await websocket.send_json({
                    "type": "vision_data",
                    "data": results,
                    "timestamp": datetime.now().isoformat()
                })
                
                # 控制帧率
                await asyncio.sleep(0.033)  # 约30fps
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket流处理错误: {e}")
                await websocket.send_json({
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                })
                
    except WebSocketDisconnect:
        logger.info("WebSocket连接断开")
    except Exception as e:
        logger.error(f"WebSocket连接错误: {e}")
    finally:
        websocket_connections.discard(websocket)
        if camera_manager:
            camera_manager.stop_streaming()

@app.post("/face/register")
async def register_face(name: str, image_data: str):
    """注册新人脸"""
    try:
        if not vision_service.initialized:
            await vision_service.initialize()
        
        # 解码图像
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            raise HTTPException(status_code=400, detail="图像解码失败")
        
        # 临时保存图像用于注册
        temp_path = f"temp_face_{name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        cv2.imwrite(temp_path, frame)
        
        try:
            # 注册人脸
            success = vision_service.face_recognizer.register_new_face(temp_path, name)
            
            if success:
                return {"success": True, "message": f"人脸注册成功: {name}"}
            else:
                raise HTTPException(status_code=400, detail="人脸注册失败，未检测到清晰的人脸")
                
        finally:
            # 清理临时文件
            try:
                os.remove(temp_path)
            except:
                pass
                
    except Exception as e:
        logger.error(f"人脸注册失败: {e}")
        raise HTTPException(status_code=500, detail=f"人脸注册失败: {e}")

if __name__ == "__main__":
    # 运行服务
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=False,
        log_level="info"
    )