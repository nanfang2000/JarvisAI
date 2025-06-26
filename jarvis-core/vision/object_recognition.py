"""
物体识别模块
实现基本物体检测和识别功能
"""

import cv2
import numpy as np
import logging
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime
import base64

logger = logging.getLogger(__name__)

class ObjectRecognizer:
    """物体识别器类"""
    
    def __init__(self, model_path: str = None, config_path: str = None):
        """
        初始化物体识别器
        
        Args:
            model_path: 模型文件路径
            config_path: 配置文件路径
        """
        self.model_path = model_path
        self.config_path = config_path
        self.net = None
        self.output_layers = []
        self.class_names = []
        
        # COCO数据集的类别名称（80个类别）
        self.coco_classes = [
            "person", "bicycle", "car", "motorbike", "aeroplane", "bus", "train", "truck",
            "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench",
            "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra",
            "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
            "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
            "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup",
            "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
            "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "sofa",
            "pottedplant", "bed", "diningtable", "toilet", "tvmonitor", "laptop", "mouse",
            "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
            "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier",
            "toothbrush"
        ]
        
        # 常见物品的中文映射
        self.chinese_mapping = {
            "person": "人", "bicycle": "自行车", "car": "汽车", "motorbike": "摩托车",
            "bus": "公共汽车", "train": "火车", "truck": "卡车", "boat": "船",
            "bird": "鸟", "cat": "猫", "dog": "狗", "horse": "马", "sheep": "羊",
            "cow": "牛", "elephant": "大象", "bear": "熊", "zebra": "斑马",
            "backpack": "背包", "umbrella": "雨伞", "handbag": "手提包", "suitcase": "行李箱",
            "bottle": "瓶子", "wine glass": "酒杯", "cup": "杯子", "fork": "叉子",
            "knife": "刀", "spoon": "勺子", "bowl": "碗", "banana": "香蕉",
            "apple": "苹果", "orange": "橙子", "chair": "椅子", "sofa": "沙发",
            "bed": "床", "laptop": "笔记本电脑", "mouse": "鼠标", "keyboard": "键盘",
            "cell phone": "手机", "book": "书", "clock": "时钟", "vase": "花瓶"
        }
        
        # 尝试加载YOLO模型（如果可用）
        self.load_yolo_model()
        
        # 如果YOLO不可用，使用OpenCV的级联分类器作为备选
        self.init_backup_detectors()
        
        logger.info("物体识别器初始化完成")
    
    def load_yolo_model(self):
        """加载YOLO模型"""
        try:
            # 这里可以配置YOLO模型路径
            # 由于模型文件较大，这里提供框架代码
            yolo_weights = "yolov3.weights"  # 需要下载
            yolo_config = "yolov3.cfg"      # 需要下载
            
            if self.model_path and self.config_path:
                yolo_weights = self.model_path
                yolo_config = self.config_path
            
            # 检查文件是否存在
            import os
            if os.path.exists(yolo_weights) and os.path.exists(yolo_config):
                self.net = cv2.dnn.readNet(yolo_weights, yolo_config)
                layer_names = self.net.getLayerNames()
                self.output_layers = [layer_names[i[0] - 1] for i in self.net.getUnconnectedOutLayers()]
                self.class_names = self.coco_classes
                logger.info("YOLO模型加载成功")
                return True
            else:
                logger.warning("YOLO模型文件未找到，将使用备选检测器")
                return False
                
        except Exception as e:
            logger.error(f"YOLO模型加载失败: {e}")
            return False
    
    def init_backup_detectors(self):
        """初始化备选检测器"""
        try:
            # 使用OpenCV内置的检测器
            self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            self.body_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_fullbody.xml')
            
            # HOG人体检测器
            self.hog = cv2.HOGDescriptor()
            self.hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
            
            logger.info("备选检测器初始化完成")
            
        except Exception as e:
            logger.error(f"备选检测器初始化失败: {e}")
    
    def detect_objects_yolo(self, frame: np.ndarray, confidence_threshold: float = 0.5) -> List[Dict[str, Any]]:
        """
        使用YOLO检测物体
        
        Args:
            frame: 输入帧
            confidence_threshold: 置信度阈值
            
        Returns:
            List[Dict]: 检测结果列表
        """
        if self.net is None:
            return []
        
        try:
            height, width, channels = frame.shape
            
            # 创建blob
            blob = cv2.dnn.blobFromImage(frame, 0.00392, (416, 416), (0, 0, 0), True, crop=False)
            self.net.setInput(blob)
            outputs = self.net.forward(self.output_layers)
            
            # 解析检测结果
            class_ids = []
            confidences = []
            boxes = []
            
            for output in outputs:
                for detection in output:
                    scores = detection[5:]
                    class_id = np.argmax(scores)
                    confidence = scores[class_id]
                    
                    if confidence > confidence_threshold:
                        # 物体位置
                        center_x = int(detection[0] * width)
                        center_y = int(detection[1] * height)
                        w = int(detection[2] * width)
                        h = int(detection[3] * height)
                        
                        # 边界框坐标
                        x = int(center_x - w / 2)
                        y = int(center_y - h / 2)
                        
                        boxes.append([x, y, w, h])
                        confidences.append(float(confidence))
                        class_ids.append(class_id)
            
            # 非最大抑制
            indexes = cv2.dnn.NMSBoxes(boxes, confidences, confidence_threshold, 0.4)
            
            objects = []
            if len(indexes) > 0:
                for i in indexes.flatten():
                    x, y, w, h = boxes[i]
                    class_name = self.class_names[class_ids[i]]
                    chinese_name = self.chinese_mapping.get(class_name, class_name)
                    
                    obj_info = {
                        'class': class_name,
                        'chinese_name': chinese_name,
                        'confidence': confidences[i],
                        'bbox': {
                            'x': max(0, x),
                            'y': max(0, y),
                            'width': min(w, width - x),
                            'height': min(h, height - y)
                        },
                        'center': {
                            'x': x + w // 2,
                            'y': y + h // 2
                        },
                        'timestamp': datetime.now().isoformat()
                    }
                    objects.append(obj_info)
            
            return objects
            
        except Exception as e:
            logger.error(f"YOLO物体检测失败: {e}")
            return []
    
    def detect_objects_backup(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        使用备选方法检测物体
        
        Args:
            frame: 输入帧
            
        Returns:
            List[Dict]: 检测结果列表
        """
        try:
            objects = []
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # 人脸检测
            faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
            for (x, y, w, h) in faces:
                obj_info = {
                    'class': 'face',
                    'chinese_name': '人脸',
                    'confidence': 0.8,
                    'bbox': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)},
                    'center': {'x': int(x + w//2), 'y': int(y + h//2)},
                    'timestamp': datetime.now().isoformat()
                }
                objects.append(obj_info)
            
            # HOG人体检测
            try:
                bodies, weights = self.hog.detectMultiScale(frame, winStride=(8,8))
                for (x, y, w, h), weight in zip(bodies, weights):
                    if weight > 0.5:  # 置信度阈值
                        obj_info = {
                            'class': 'person',
                            'chinese_name': '人',
                            'confidence': float(weight),
                            'bbox': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)},
                            'center': {'x': int(x + w//2), 'y': int(y + h//2)},
                            'timestamp': datetime.now().isoformat()
                        }
                        objects.append(obj_info)
            except Exception as e:
                logger.debug(f"HOG检测失败: {e}")
            
            return objects
            
        except Exception as e:
            logger.error(f"备选物体检测失败: {e}")
            return []
    
    def detect_objects(self, frame: np.ndarray, use_yolo: bool = True) -> List[Dict[str, Any]]:
        """
        检测物体（主要入口）
        
        Args:
            frame: 输入帧
            use_yolo: 是否优先使用YOLO
            
        Returns:
            List[Dict]: 检测结果列表
        """
        try:
            if use_yolo and self.net is not None:
                return self.detect_objects_yolo(frame)
            else:
                return self.detect_objects_backup(frame)
                
        except Exception as e:
            logger.error(f"物体检测失败: {e}")
            return []
    
    def analyze_scene(self, frame: np.ndarray, objects: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        分析场景
        
        Args:
            frame: 输入帧
            objects: 检测到的物体列表
            
        Returns:
            Dict: 场景分析结果
        """
        try:
            height, width = frame.shape[:2]
            
            # 统计物体类别
            class_counts = {}
            for obj in objects:
                class_name = obj['chinese_name']
                class_counts[class_name] = class_counts.get(class_name, 0) + 1
            
            # 分析物体分布
            center_objects = 0  # 中心区域的物体
            edge_objects = 0    # 边缘区域的物体
            
            center_x, center_y = width // 2, height // 2
            center_threshold = min(width, height) // 4
            
            for obj in objects:
                obj_center = obj['center']
                distance_to_center = np.sqrt((obj_center['x'] - center_x)**2 + (obj_center['y'] - center_y)**2)
                
                if distance_to_center < center_threshold:
                    center_objects += 1
                else:
                    edge_objects += 1
            
            # 计算平均置信度
            avg_confidence = np.mean([obj['confidence'] for obj in objects]) if objects else 0.0
            
            # 场景描述
            scene_description = self.generate_scene_description(class_counts, len(objects))
            
            analysis = {
                'total_objects': len(objects),
                'object_classes': class_counts,
                'spatial_distribution': {
                    'center_objects': center_objects,
                    'edge_objects': edge_objects
                },
                'average_confidence': float(avg_confidence),
                'scene_description': scene_description,
                'image_properties': {
                    'width': width,
                    'height': height,
                    'aspect_ratio': width / height
                },
                'timestamp': datetime.now().isoformat()
            }
            
            return analysis
            
        except Exception as e:
            logger.error(f"场景分析失败: {e}")
            return {
                'total_objects': 0,
                'object_classes': {},
                'scene_description': "场景分析失败",
                'timestamp': datetime.now().isoformat()
            }
    
    def generate_scene_description(self, class_counts: Dict[str, int], total_objects: int) -> str:
        """
        生成场景描述
        
        Args:
            class_counts: 物体类别统计
            total_objects: 总物体数
            
        Returns:
            str: 场景描述
        """
        try:
            if total_objects == 0:
                return "画面中没有检测到明显的物体"
            
            descriptions = []
            
            # 按数量排序
            sorted_classes = sorted(class_counts.items(), key=lambda x: x[1], reverse=True)
            
            for class_name, count in sorted_classes[:3]:  # 只描述前3个最多的类别
                if count == 1:
                    descriptions.append(f"1个{class_name}")
                else:
                    descriptions.append(f"{count}个{class_name}")
            
            if len(descriptions) == 1:
                desc = f"画面中有{descriptions[0]}"
            elif len(descriptions) == 2:
                desc = f"画面中有{descriptions[0]}和{descriptions[1]}"
            else:
                desc = f"画面中有{descriptions[0]}、{descriptions[1]}和{descriptions[2]}"
            
            if len(sorted_classes) > 3:
                desc += f"等共{total_objects}个物体"
            
            return desc
            
        except Exception as e:
            logger.error(f"生成场景描述失败: {e}")
            return f"检测到{total_objects}个物体"
    
    def draw_objects(self, frame: np.ndarray, objects: List[Dict[str, Any]]) -> np.ndarray:
        """
        在帧上绘制检测到的物体
        
        Args:
            frame: 输入帧
            objects: 物体列表
            
        Returns:
            np.ndarray: 绘制后的帧
        """
        try:
            for obj in objects:
                bbox = obj['bbox']
                class_name = obj['chinese_name']
                confidence = obj['confidence']
                
                # 绘制边界框
                x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']
                
                # 根据置信度选择颜色
                if confidence > 0.8:
                    color = (0, 255, 0)  # 绿色 - 高置信度
                elif confidence > 0.5:
                    color = (0, 255, 255)  # 黄色 - 中等置信度
                else:
                    color = (0, 0, 255)  # 红色 - 低置信度
                
                cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
                
                # 绘制标签
                label = f"{class_name} {confidence:.2f}"
                label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
                
                # 背景矩形
                cv2.rectangle(frame, (x, y - 30), (x + label_size[0] + 10, y), color, -1)
                
                # 文字
                cv2.putText(frame, label, (x + 5, y - 10), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            return frame
            
        except Exception as e:
            logger.error(f"绘制物体失败: {e}")
            return frame
    
    def get_object_by_location(self, objects: List[Dict[str, Any]], x: int, y: int) -> Optional[Dict[str, Any]]:
        """
        根据坐标获取物体信息
        
        Args:
            objects: 物体列表
            x, y: 坐标点
            
        Returns:
            Optional[Dict]: 物体信息或None
        """
        try:
            for obj in objects:
                bbox = obj['bbox']
                if (bbox['x'] <= x <= bbox['x'] + bbox['width'] and
                    bbox['y'] <= y <= bbox['y'] + bbox['height']):
                    return obj
            return None
            
        except Exception as e:
            logger.error(f"根据位置获取物体失败: {e}")
            return None
    
    def filter_objects_by_class(self, objects: List[Dict[str, Any]], class_names: List[str]) -> List[Dict[str, Any]]:
        """
        根据类别过滤物体
        
        Args:
            objects: 物体列表
            class_names: 要保留的类别名称列表
            
        Returns:
            List[Dict]: 过滤后的物体列表
        """
        try:
            filtered = []
            for obj in objects:
                if obj['class'] in class_names or obj['chinese_name'] in class_names:
                    filtered.append(obj)
            return filtered
            
        except Exception as e:
            logger.error(f"按类别过滤物体失败: {e}")
            return []
    
    def cleanup(self):
        """清理资源"""
        try:
            if self.net is not None:
                # OpenCV DNN模型不需要特殊清理
                pass
            logger.info("物体识别器清理完成")
        except Exception as e:
            logger.error(f"物体识别器清理失败: {e}")

# 使用示例
if __name__ == "__main__":
    # 初始化物体识别器
    recognizer = ObjectRecognizer()
    
    # 测试摄像头
    cap = cv2.VideoCapture(0)
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # 检测物体
            objects = recognizer.detect_objects(frame)
            
            # 分析场景
            analysis = recognizer.analyze_scene(frame, objects)
            
            # 绘制物体
            frame = recognizer.draw_objects(frame, objects)
            
            # 显示场景描述
            cv2.putText(frame, analysis['scene_description'], 
                       (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            # 显示帧
            cv2.imshow('Object Recognition', frame)
            
            # 按q退出
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
    finally:
        cap.release()
        cv2.destroyAllWindows()
        recognizer.cleanup()