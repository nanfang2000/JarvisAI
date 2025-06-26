# JARVIS 视觉处理服务

JARVIS的视觉处理服务模块，提供人脸识别、物体识别、手势检测等功能。

## 功能特性

### 🔍 人脸识别
- 实时人脸检测和识别
- 主人身份验证
- 基础情绪分析
- 人脸注册管理

### 📦 物体识别
- 基于YOLO/OpenCV的物体检测
- 支持80种常见物体识别
- 场景分析和描述
- 中英文物体名称映射

### 👋 手势检测
- 基于MediaPipe的手部检测
- 支持多种手势识别（挥手、点赞、OK等）
- 手势交互意图分析
- 双手手势协调识别

### 🤖 AI视觉分析
- 集成千问多模态模型
- 图像内容理解和分析
- 视觉数据智能响应
- 多种分析类型支持

## 安装要求

### Python 依赖
```bash
pip install opencv-python face-recognition mediapipe fastapi uvicorn numpy
```

### 系统要求
- Python 3.8+
- 摄像头设备
- macOS/Linux/Windows

## 快速开始

### 1. 启动服务
```bash
# 使用启动脚本
./start_vision_service.sh

# 或直接运行
cd vision-service
python3 main.py
```

### 2. 访问服务
- 服务地址: http://localhost:8002
- API文档: http://localhost:8002/docs
- 健康检查: http://localhost:8002/health

### 3. WebSocket 实时流
```javascript
const ws = new WebSocket('ws://localhost:8002/ws/camera');

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('视觉数据:', data);
};

// 发送配置
ws.send(JSON.stringify({
    operations: ['face_recognition', 'gesture_detection'],
    options: { draw_results: true }
}));
```

## API 接口

### 健康检查
```http
GET /health
```

### 摄像头信息
```http
GET /camera/info
```

### 捕获单帧
```http
GET /camera/capture
```

### 视觉处理
```http
POST /vision/process
Content-Type: application/json

{
    "image_data": "base64_encoded_image",
    "operations": ["face_recognition", "object_recognition", "gesture_detection"],
    "options": {
        "draw_results": true
    }
}
```

### 注册人脸
```http
POST /face/register?name=用户名
Content-Type: application/json

{
    "image_data": "base64_encoded_image"
}
```

## 使用示例

### Python 客户端
```python
import requests
import base64
import cv2

# 捕获图像
cap = cv2.VideoCapture(0)
ret, frame = cap.read()
cap.release()

# 转换为base64
_, buffer = cv2.imencode('.jpg', frame)
image_base64 = base64.b64encode(buffer).decode('utf-8')

# 发送处理请求
response = requests.post('http://localhost:8002/vision/process', json={
    'image_data': image_base64,
    'operations': ['face_recognition', 'gesture_detection'],
    'options': {'draw_results': True}
})

result = response.json()
print(result)
```

### JavaScript 客户端
```javascript
// WebSocket 连接
const ws = new WebSocket('ws://localhost:8002/ws/camera');

ws.onopen = () => {
    console.log('连接到视觉服务');
    
    // 配置检测选项
    ws.send(JSON.stringify({
        operations: ['face_recognition', 'object_recognition'],
        options: { draw_results: true }
    }));
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'vision_data') {
        // 处理视觉检测结果
        console.log('检测结果:', data.data);
        
        // 显示标注图像
        if (data.data.annotated_image) {
            const img = document.getElementById('camera-feed');
            img.src = 'data:image/jpeg;base64,' + data.data.annotated_image;
        }
    }
};
```

## 配置选项

### 摄像头配置
```json
{
    "camera_id": 0,
    "width": 640,
    "height": 480,
    "fps": 30
}
```

### 检测操作
- `face_recognition`: 人脸识别
- `object_recognition`: 物体识别  
- `gesture_detection`: 手势检测

### 处理选项
- `draw_results`: 是否绘制检测结果
- `confidence_threshold`: 置信度阈值
- `max_objects`: 最大检测物体数

## 返回数据格式

### 视觉处理结果
```json
{
    "success": true,
    "data": {
        "timestamp": "2024-01-01T12:00:00",
        "frame_info": {
            "width": 640,
            "height": 480,
            "channels": 3
        },
        "faces": {
            "detected_faces": [...],
            "statistics": {...},
            "owner_present": false
        },
        "objects": {
            "detected_objects": [...],
            "scene_analysis": {...}
        },
        "gestures": {
            "detected_hands": [...],
            "interaction_analysis": {...}
        },
        "annotated_image": "base64_encoded_image"
    }
}
```

### 人脸检测结果
```json
{
    "name": "张三",
    "confidence": 0.85,
    "location": {
        "top": 100,
        "right": 200,
        "bottom": 180,
        "left": 120
    },
    "emotion": {
        "emotion": "happy",
        "confidence": 0.75
    },
    "timestamp": "2024-01-01T12:00:00"
}
```

### 物体检测结果
```json
{
    "class": "person",
    "chinese_name": "人",
    "confidence": 0.92,
    "bbox": {
        "x": 100,
        "y": 50,
        "width": 200,
        "height": 300
    },
    "center": {
        "x": 200,
        "y": 200
    },
    "timestamp": "2024-01-01T12:00:00"
}
```

### 手势检测结果
```json
{
    "handedness": "Right",
    "confidence": 0.88,
    "gesture": {
        "type": "thumbs_up",
        "chinese_name": "点赞",
        "confidence": 0.91
    },
    "bbox": {
        "x": 150,
        "y": 100,
        "width": 100,
        "height": 120
    },
    "timestamp": "2024-01-01T12:00:00"
}
```

## 故障排除

### 常见问题

1. **摄像头无法访问**
   - 检查摄像头权限设置
   - 确认摄像头未被其他应用占用
   - 尝试不同的camera_id值

2. **依赖安装失败**
   - 确保Python版本>=3.8
   - 使用虚拟环境隔离依赖
   - 检查系统架构兼容性

3. **检测精度低**
   - 确保充足的光照条件
   - 调整摄像头角度和距离
   - 降低置信度阈值

4. **性能问题**
   - 降低图像分辨率
   - 减少同时运行的检测类型
   - 调整帧率设置

### 日志查看
服务运行时会输出详细日志，包括：
- 初始化状态
- 检测结果统计
- 错误信息和警告
- 性能指标

## 开发指南

### 扩展新功能
1. 在相应的视觉模块中添加新方法
2. 更新API接口定义
3. 添加相应的测试用例
4. 更新文档说明

### 自定义检测器
```python
from jarvis_core.vision.base_detector import BaseDetector

class CustomDetector(BaseDetector):
    def detect(self, frame):
        # 实现自定义检测逻辑
        pass
```

### 集成新模型
可以轻松集成其他深度学习模型：
- YOLOv5/YOLOv8
- TensorFlow/PyTorch模型
- 云端API服务

## 许可证

本项目采用MIT许可证。详情请查看LICENSE文件。

## 贡献

欢迎提交问题报告和功能请求！

## 联系方式

- 项目地址: [GitHub](https://github.com/your-repo/jarvis-ai)
- 问题反馈: [Issues](https://github.com/your-repo/jarvis-ai/issues)