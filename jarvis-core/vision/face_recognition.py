"""
人脸识别模块
实现实时人脸检测、识别和情绪分析功能
"""

import cv2
import face_recognition
import numpy as np
import logging
import pickle
import os
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime
import base64

logger = logging.getLogger(__name__)

class FaceRecognizer:
    """人脸识别器类"""
    
    def __init__(self, encodings_path: str = "face_encodings.pkl"):
        """
        初始化人脸识别器
        
        Args:
            encodings_path: 人脸编码文件路径
        """
        self.encodings_path = encodings_path
        self.known_face_encodings = []
        self.known_face_names = []
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # 情绪检测相关（基于面部特征）
        self.emotion_labels = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']
        
        # 加载已知人脸编码
        self.load_face_encodings()
        
        logger.info("人脸识别器初始化完成")
    
    def load_face_encodings(self):
        """加载已知人脸编码"""
        try:
            if os.path.exists(self.encodings_path):
                with open(self.encodings_path, 'rb') as f:
                    data = pickle.load(f)
                    self.known_face_encodings = data.get('encodings', [])
                    self.known_face_names = data.get('names', [])
                logger.info(f"加载了 {len(self.known_face_names)} 个已知人脸")
            else:
                logger.info("未找到人脸编码文件，将创建新文件")
        except Exception as e:
            logger.error(f"加载人脸编码失败: {e}")
    
    def save_face_encodings(self):
        """保存人脸编码"""
        try:
            data = {
                'encodings': self.known_face_encodings,
                'names': self.known_face_names
            }
            with open(self.encodings_path, 'wb') as f:
                pickle.dump(data, f)
            logger.info("人脸编码保存成功")
        except Exception as e:
            logger.error(f"保存人脸编码失败: {e}")
    
    def register_new_face(self, image_path: str, name: str) -> bool:
        """
        注册新人脸
        
        Args:
            image_path: 图像文件路径
            name: 人名
            
        Returns:
            bool: 注册是否成功
        """
        try:
            # 加载图像
            image = face_recognition.load_image_file(image_path)
            
            # 获取人脸编码
            face_encodings = face_recognition.face_encodings(image)
            
            if len(face_encodings) == 0:
                logger.warning(f"在图像 {image_path} 中未检测到人脸")
                return False
            
            # 使用第一个检测到的人脸
            face_encoding = face_encodings[0]
            
            # 添加到已知人脸列表
            self.known_face_encodings.append(face_encoding)
            self.known_face_names.append(name)
            
            # 保存编码
            self.save_face_encodings()
            
            logger.info(f"成功注册新人脸: {name}")
            return True
            
        except Exception as e:
            logger.error(f"注册人脸失败: {e}")
            return False
    
    def detect_faces_in_frame(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        在帧中检测人脸
        
        Args:
            frame: 输入帧
            
        Returns:
            List[Dict]: 检测结果列表
        """
        try:
            # 转换为RGB格式
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # 检测人脸位置和编码
            face_locations = face_recognition.face_locations(rgb_frame)
            face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
            
            faces = []
            
            for (face_encoding, face_location) in zip(face_encodings, face_locations):
                # 识别人脸
                matches = face_recognition.compare_faces(self.known_face_encodings, face_encoding)
                name = "Unknown"
                confidence = 0.0
                
                # 计算距离
                face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
                
                if len(face_distances) > 0:
                    best_match_index = np.argmin(face_distances)
                    if matches[best_match_index]:
                        name = self.known_face_names[best_match_index]
                        confidence = 1 - face_distances[best_match_index]
                
                # 提取人脸区域进行情绪分析
                top, right, bottom, left = face_location
                face_image = frame[top:bottom, left:right]
                emotion = self.analyze_emotion(face_image)
                
                face_info = {
                    'name': name,
                    'confidence': float(confidence),
                    'location': {
                        'top': int(top),
                        'right': int(right), 
                        'bottom': int(bottom),
                        'left': int(left)
                    },
                    'emotion': emotion,
                    'timestamp': datetime.now().isoformat()
                }
                
                faces.append(face_info)
            
            return faces
            
        except Exception as e:
            logger.error(f"人脸检测失败: {e}")
            return []
    
    def analyze_emotion(self, face_image: np.ndarray) -> Dict[str, Any]:
        """
        分析情绪（基础版本，使用简单的面部特征分析）
        
        Args:
            face_image: 人脸图像
            
        Returns:
            Dict: 情绪分析结果
        """
        try:
            if face_image.size == 0:
                return {'emotion': 'neutral', 'confidence': 0.0}
            
            # 转换为灰度图
            gray = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY)
            
            # 基础情绪检测（简化版本）
            # 这里使用一些基本的图像处理技术来估计情绪
            
            # 计算图像的亮度和对比度
            mean_brightness = np.mean(gray)
            std_brightness = np.std(gray)
            
            # 检测边缘（可能指示表情变化）
            edges = cv2.Canny(gray, 50, 150)
            edge_density = np.sum(edges > 0) / edges.size
            
            # 简单的启发式规则来判断情绪
            if edge_density > 0.1:  # 高边缘密度可能表示复杂表情
                if mean_brightness > 100:
                    emotion = 'happy'
                    confidence = min(0.8, edge_density * 4)
                else:
                    emotion = 'sad'
                    confidence = min(0.7, edge_density * 3)
            else:
                emotion = 'neutral'
                confidence = 0.6
            
            return {
                'emotion': emotion,
                'confidence': float(confidence),
                'metrics': {
                    'brightness': float(mean_brightness),
                    'contrast': float(std_brightness),
                    'edge_density': float(edge_density)
                }
            }
            
        except Exception as e:
            logger.error(f"情绪分析失败: {e}")
            return {'emotion': 'neutral', 'confidence': 0.0}
    
    def draw_face_info(self, frame: np.ndarray, faces: List[Dict[str, Any]]) -> np.ndarray:
        """
        在帧上绘制人脸信息
        
        Args:
            frame: 输入帧
            faces: 人脸信息列表
            
        Returns:
            np.ndarray: 绘制后的帧
        """
        try:
            for face in faces:
                location = face['location']
                name = face['name']
                confidence = face['confidence']
                emotion = face['emotion']['emotion']
                emotion_conf = face['emotion']['confidence']
                
                # 绘制人脸框
                color = (0, 255, 0) if name != "Unknown" else (0, 0, 255)
                cv2.rectangle(frame, 
                            (location['left'], location['top']), 
                            (location['right'], location['bottom']), 
                            color, 2)
                
                # 绘制标签
                label = f"{name} ({confidence:.2f})"
                emotion_label = f"{emotion} ({emotion_conf:.2f})"
                
                # 背景矩形
                label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
                emotion_size = cv2.getTextSize(emotion_label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
                
                cv2.rectangle(frame, 
                            (location['left'], location['bottom']), 
                            (location['left'] + max(label_size[0], emotion_size[0]) + 10, 
                             location['bottom'] + 50), 
                            color, -1)
                
                # 文字
                cv2.putText(frame, label, 
                          (location['left'] + 5, location['bottom'] + 20), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                
                cv2.putText(frame, emotion_label, 
                          (location['left'] + 5, location['bottom'] + 40), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            return frame
            
        except Exception as e:
            logger.error(f"绘制人脸信息失败: {e}")
            return frame
    
    def is_owner_present(self, faces: List[Dict[str, Any]], owner_name: str = "Owner") -> bool:
        """
        检查主人是否在场
        
        Args:
            faces: 人脸信息列表
            owner_name: 主人姓名
            
        Returns:
            bool: 主人是否在场
        """
        for face in faces:
            if face['name'] == owner_name and face['confidence'] > 0.6:
                return True
        return False
    
    def get_face_statistics(self, faces: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        获取人脸统计信息
        
        Args:
            faces: 人脸信息列表
            
        Returns:
            Dict: 统计信息
        """
        try:
            total_faces = len(faces)
            known_faces = sum(1 for face in faces if face['name'] != "Unknown")
            unknown_faces = total_faces - known_faces
            
            emotions = [face['emotion']['emotion'] for face in faces]
            emotion_counts = {emotion: emotions.count(emotion) for emotion in set(emotions)}
            
            avg_confidence = np.mean([face['confidence'] for face in faces]) if faces else 0.0
            
            return {
                'total_faces': total_faces,
                'known_faces': known_faces,
                'unknown_faces': unknown_faces,
                'emotion_distribution': emotion_counts,
                'average_confidence': float(avg_confidence),
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"获取人脸统计信息失败: {e}")
            return {
                'total_faces': 0,
                'known_faces': 0,
                'unknown_faces': 0,
                'emotion_distribution': {},
                'average_confidence': 0.0,
                'timestamp': datetime.now().isoformat()
            }
    
    def frame_to_base64(self, frame: np.ndarray) -> str:
        """
        将帧转换为base64字符串
        
        Args:
            frame: 输入帧
            
        Returns:
            str: base64编码的图像
        """
        try:
            _, buffer = cv2.imencode('.jpg', frame)
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            return img_base64
        except Exception as e:
            logger.error(f"帧转base64失败: {e}")
            return ""
    
    def cleanup(self):
        """清理资源"""
        try:
            # 保存最新的编码
            self.save_face_encodings()
            logger.info("人脸识别器清理完成")
        except Exception as e:
            logger.error(f"人脸识别器清理失败: {e}")

# 使用示例
if __name__ == "__main__":
    # 初始化人脸识别器
    recognizer = FaceRecognizer()
    
    # 测试摄像头
    cap = cv2.VideoCapture(0)
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # 检测人脸
            faces = recognizer.detect_faces_in_frame(frame)
            
            # 绘制信息
            frame = recognizer.draw_face_info(frame, faces)
            
            # 显示帧
            cv2.imshow('Face Recognition', frame)
            
            # 按q退出
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
    finally:
        cap.release()
        cv2.destroyAllWindows()
        recognizer.cleanup()