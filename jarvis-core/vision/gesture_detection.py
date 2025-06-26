"""
手势检测模块
实现基本手势识别功能，支持挥手、点赞等手势
"""

import cv2
import mediapipe as mp
import numpy as np
import logging
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime
import math

logger = logging.getLogger(__name__)

class GestureDetector:
    """手势检测器类"""
    
    def __init__(self):
        """初始化手势检测器"""
        # 初始化MediaPipe手部检测
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        self.mp_drawing = mp.solutions.drawing_utils
        
        # 手势识别状态
        self.gesture_history = []
        self.max_history = 10
        
        # 定义手势类型
        self.gesture_types = {
            'wave': '挥手',
            'thumbs_up': '点赞',
            'thumbs_down': '点踩', 
            'peace': '胜利手势',
            'ok': 'OK手势',
            'pointing': '指向',
            'fist': '拳头',
            'open_palm': '张开手掌',
            'stop': '停止手势'
        }
        
        # 手势检测阈值
        self.detection_thresholds = {
            'finger_bend_threshold': 0.1,
            'gesture_confidence_threshold': 0.7,
            'wave_motion_threshold': 0.15,
            'consecutive_frames': 3
        }
        
        logger.info("手势检测器初始化完成")
    
    def detect_hands(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        检测手部
        
        Args:
            frame: 输入帧
            
        Returns:
            List[Dict]: 手部检测结果
        """
        try:
            # 转换为RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # 检测手部
            results = self.hands.process(rgb_frame)
            
            hands_data = []
            
            if results.multi_hand_landmarks:
                for idx, hand_landmarks in enumerate(results.multi_hand_landmarks):
                    # 获取手部信息
                    handedness = results.multi_handedness[idx].classification[0].label
                    confidence = results.multi_handedness[idx].classification[0].score
                    
                    # 提取关键点坐标
                    landmarks = []
                    for landmark in hand_landmarks.landmark:
                        landmarks.append({
                            'x': landmark.x,
                            'y': landmark.y,
                            'z': landmark.z
                        })
                    
                    # 识别手势
                    gesture = self.recognize_gesture(landmarks)
                    
                    # 计算手部边界框
                    bbox = self.calculate_hand_bbox(landmarks, frame.shape)
                    
                    hand_data = {
                        'handedness': handedness,  # 左手或右手
                        'confidence': float(confidence),
                        'landmarks': landmarks,
                        'gesture': gesture,
                        'bbox': bbox,
                        'center': self.calculate_hand_center(landmarks),
                        'timestamp': datetime.now().isoformat()
                    }
                    
                    hands_data.append(hand_data)
            
            return hands_data
            
        except Exception as e:
            logger.error(f"手部检测失败: {e}")
            return []
    
    def recognize_gesture(self, landmarks: List[Dict[str, float]]) -> Dict[str, Any]:
        """
        识别手势
        
        Args:
            landmarks: 手部关键点坐标
            
        Returns:
            Dict: 手势识别结果
        """
        try:
            if len(landmarks) != 21:  # MediaPipe手部模型有21个关键点
                return {'type': 'unknown', 'chinese_name': '未知', 'confidence': 0.0}
            
            # 计算手指状态
            finger_states = self.get_finger_states(landmarks)
            
            # 根据手指状态识别手势
            gesture_type = 'unknown'
            confidence = 0.0
            
            # 点赞手势 (拇指向上，其他手指弯曲)
            if (finger_states['thumb'] and 
                not finger_states['index'] and 
                not finger_states['middle'] and 
                not finger_states['ring'] and 
                not finger_states['pinky']):
                gesture_type = 'thumbs_up'
                confidence = 0.9
            
            # 点踩手势 (拇指向下，其他手指弯曲)
            elif (not finger_states['thumb'] and 
                  not finger_states['index'] and 
                  not finger_states['middle'] and 
                  not finger_states['ring'] and 
                  not finger_states['pinky']):
                # 需要额外检查拇指是否向下
                if self.is_thumb_down(landmarks):
                    gesture_type = 'thumbs_down'
                    confidence = 0.8
            
            # 胜利手势 (食指和中指伸直，其他弯曲)
            elif (not finger_states['thumb'] and 
                  finger_states['index'] and 
                  finger_states['middle'] and 
                  not finger_states['ring'] and 
                  not finger_states['pinky']):
                gesture_type = 'peace'
                confidence = 0.85
            
            # OK手势 (拇指和食指形成圆圈)
            elif self.is_ok_gesture(landmarks):
                gesture_type = 'ok'
                confidence = 0.8
            
            # 指向手势 (只有食指伸直)
            elif (not finger_states['thumb'] and 
                  finger_states['index'] and 
                  not finger_states['middle'] and 
                  not finger_states['ring'] and 
                  not finger_states['pinky']):
                gesture_type = 'pointing'
                confidence = 0.8
            
            # 拳头 (所有手指弯曲)
            elif (not finger_states['thumb'] and 
                  not finger_states['index'] and 
                  not finger_states['middle'] and 
                  not finger_states['ring'] and 
                  not finger_states['pinky']):
                gesture_type = 'fist'
                confidence = 0.7
            
            # 张开手掌 (所有手指伸直)
            elif (finger_states['thumb'] and 
                  finger_states['index'] and 
                  finger_states['middle'] and 
                  finger_states['ring'] and 
                  finger_states['pinky']):
                gesture_type = 'open_palm'
                confidence = 0.8
            
            # 停止手势 (四个手指伸直，拇指弯曲或伸直)
            elif (finger_states['index'] and 
                  finger_states['middle'] and 
                  finger_states['ring'] and 
                  finger_states['pinky']):
                gesture_type = 'stop'
                confidence = 0.75
            
            # 检测挥手动作
            wave_result = self.detect_wave_motion(landmarks)
            if wave_result['is_waving']:
                gesture_type = 'wave'
                confidence = wave_result['confidence']
            
            return {
                'type': gesture_type,
                'chinese_name': self.gesture_types.get(gesture_type, '未知'),
                'confidence': float(confidence),
                'finger_states': finger_states,
                'additional_info': {
                    'wave_motion': wave_result if gesture_type == 'wave' else None
                }
            }
            
        except Exception as e:
            logger.error(f"手势识别失败: {e}")
            return {'type': 'unknown', 'chinese_name': '未知', 'confidence': 0.0}
    
    def get_finger_states(self, landmarks: List[Dict[str, float]]) -> Dict[str, bool]:
        """
        获取手指状态（伸直或弯曲）
        
        Args:
            landmarks: 手部关键点
            
        Returns:
            Dict: 各手指状态
        """
        try:
            # MediaPipe手部关键点索引
            # 拇指: 1,2,3,4
            # 食指: 5,6,7,8  
            # 中指: 9,10,11,12
            # 无名指: 13,14,15,16
            # 小指: 17,18,19,20
            
            finger_tips = [4, 8, 12, 16, 20]  # 指尖
            finger_pips = [3, 6, 10, 14, 18]  # 第二关节
            
            finger_states = {}
            finger_names = ['thumb', 'index', 'middle', 'ring', 'pinky']
            
            for i, (tip, pip, name) in enumerate(zip(finger_tips, finger_pips, finger_names)):
                if name == 'thumb':
                    # 拇指特殊处理（横向移动）
                    finger_states[name] = landmarks[tip]['x'] > landmarks[pip]['x']
                else:
                    # 其他手指（纵向移动）
                    finger_states[name] = landmarks[tip]['y'] < landmarks[pip]['y']
            
            return finger_states
            
        except Exception as e:
            logger.error(f"获取手指状态失败: {e}")
            return {name: False for name in ['thumb', 'index', 'middle', 'ring', 'pinky']}
    
    def is_thumb_down(self, landmarks: List[Dict[str, float]]) -> bool:
        """
        检查拇指是否向下
        
        Args:
            landmarks: 手部关键点
            
        Returns:
            bool: 拇指是否向下
        """
        try:
            # 拇指指尖(4)应该在拇指根部(2)下方
            thumb_tip = landmarks[4]
            thumb_base = landmarks[2]
            return thumb_tip['y'] > thumb_base['y']
        except:
            return False
    
    def is_ok_gesture(self, landmarks: List[Dict[str, float]]) -> bool:
        """
        检查是否为OK手势
        
        Args:
            landmarks: 手部关键点
            
        Returns:
            bool: 是否为OK手势
        """
        try:
            # 拇指指尖和食指指尖的距离
            thumb_tip = landmarks[4]
            index_tip = landmarks[8]
            
            distance = math.sqrt(
                (thumb_tip['x'] - index_tip['x'])**2 + 
                (thumb_tip['y'] - index_tip['y'])**2
            )
            
            # 距离小于阈值认为是OK手势
            return distance < 0.05
            
        except:
            return False
    
    def detect_wave_motion(self, landmarks: List[Dict[str, float]]) -> Dict[str, Any]:
        """
        检测挥手动作
        
        Args:
            landmarks: 手部关键点
            
        Returns:
            Dict: 挥手检测结果
        """
        try:
            # 获取手腕位置作为参考点
            wrist_x = landmarks[0]['x']
            
            # 将当前位置添加到历史记录
            self.gesture_history.append(wrist_x)
            
            # 保持历史记录长度
            if len(self.gesture_history) > self.max_history:
                self.gesture_history.pop(0)
            
            # 需要足够的历史数据
            if len(self.gesture_history) < 5:
                return {'is_waving': False, 'confidence': 0.0}
            
            # 计算位置变化
            position_changes = []
            for i in range(1, len(self.gesture_history)):
                change = abs(self.gesture_history[i] - self.gesture_history[i-1])
                position_changes.append(change)
            
            # 检查是否有规律的左右摆动
            avg_change = np.mean(position_changes)
            max_change = max(position_changes)
            
            # 挥手判断条件
            is_waving = (avg_change > self.detection_thresholds['wave_motion_threshold'] and 
                        max_change > avg_change * 1.5)
            
            confidence = min(avg_change * 5, 1.0) if is_waving else 0.0
            
            return {
                'is_waving': is_waving,
                'confidence': float(confidence),
                'avg_motion': float(avg_change),
                'max_motion': float(max_change)
            }
            
        except Exception as e:
            logger.error(f"挥手检测失败: {e}")
            return {'is_waving': False, 'confidence': 0.0}
    
    def calculate_hand_bbox(self, landmarks: List[Dict[str, float]], frame_shape: Tuple[int, int, int]) -> Dict[str, int]:
        """
        计算手部边界框
        
        Args:
            landmarks: 手部关键点
            frame_shape: 帧形状(height, width, channels)
            
        Returns:
            Dict: 边界框坐标
        """
        try:
            height, width = frame_shape[:2]
            
            # 找到最小和最大坐标
            x_coords = [lm['x'] * width for lm in landmarks]
            y_coords = [lm['y'] * height for lm in landmarks]
            
            min_x = max(0, int(min(x_coords)) - 20)
            max_x = min(width, int(max(x_coords)) + 20)
            min_y = max(0, int(min(y_coords)) - 20)
            max_y = min(height, int(max(y_coords)) + 20)
            
            return {
                'x': min_x,
                'y': min_y,
                'width': max_x - min_x,
                'height': max_y - min_y
            }
            
        except Exception as e:
            logger.error(f"计算手部边界框失败: {e}")
            return {'x': 0, 'y': 0, 'width': 0, 'height': 0}
    
    def calculate_hand_center(self, landmarks: List[Dict[str, float]]) -> Dict[str, float]:
        """
        计算手部中心点
        
        Args:
            landmarks: 手部关键点
            
        Returns:
            Dict: 中心点坐标
        """
        try:
            avg_x = np.mean([lm['x'] for lm in landmarks])
            avg_y = np.mean([lm['y'] for lm in landmarks])
            
            return {'x': float(avg_x), 'y': float(avg_y)}
            
        except Exception as e:
            logger.error(f"计算手部中心失败: {e}")
            return {'x': 0.5, 'y': 0.5}
    
    def analyze_gesture_interaction(self, hands: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        分析手势交互
        
        Args:
            hands: 检测到的手部列表
            
        Returns:
            Dict: 交互分析结果
        """
        try:
            if not hands:
                return {
                    'interaction_type': 'no_hands',
                    'description': '未检测到手部',
                    'hands_count': 0
                }
            
            hands_count = len(hands)
            gestures = [hand['gesture']['type'] for hand in hands]
            
            # 分析交互类型
            interaction_type = 'single_hand'
            description = ''
            
            if hands_count == 1:
                gesture = gestures[0]
                chinese_name = hands[0]['gesture']['chinese_name']
                
                if gesture == 'wave':
                    interaction_type = 'greeting'
                    description = f'检测到{chinese_name}手势，可能是在打招呼'
                elif gesture == 'thumbs_up':
                    interaction_type = 'approval'
                    description = f'检测到{chinese_name}手势，表示赞同'
                elif gesture == 'thumbs_down':
                    interaction_type = 'disapproval'
                    description = f'检测到{chinese_name}手势，表示不赞同'
                elif gesture == 'stop':
                    interaction_type = 'stop_command'
                    description = f'检测到{chinese_name}手势，可能是停止指令'
                elif gesture == 'pointing':
                    interaction_type = 'pointing'
                    description = f'检测到{chinese_name}手势，正在指向某处'
                else:
                    description = f'检测到{chinese_name}手势'
            
            elif hands_count == 2:
                interaction_type = 'two_hands'
                left_gesture = None
                right_gesture = None
                
                for hand in hands:
                    if hand['handedness'] == 'Left':
                        left_gesture = hand['gesture']['chinese_name']
                    else:
                        right_gesture = hand['gesture']['chinese_name']
                
                if left_gesture and right_gesture:
                    description = f'检测到双手手势：左手{left_gesture}，右手{right_gesture}'
                else:
                    description = f'检测到{hands_count}只手的手势'
            
            # 计算平均置信度
            avg_confidence = np.mean([hand['gesture']['confidence'] for hand in hands])
            
            return {
                'interaction_type': interaction_type,
                'description': description,
                'hands_count': hands_count,
                'gestures': gestures,
                'average_confidence': float(avg_confidence),
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"分析手势交互失败: {e}")
            return {
                'interaction_type': 'error',
                'description': '手势交互分析失败',
                'hands_count': len(hands) if hands else 0
            }
    
    def draw_hands(self, frame: np.ndarray, hands: List[Dict[str, Any]]) -> np.ndarray:
        """
        在帧上绘制手部信息
        
        Args:
            frame: 输入帧
            hands: 手部信息列表
            
        Returns:
            np.ndarray: 绘制后的帧
        """
        try:
            for hand in hands:
                # 绘制边界框
                bbox = hand['bbox']
                gesture = hand['gesture']
                handedness = hand['handedness']
                
                # 选择颜色
                color = (0, 255, 0) if handedness == 'Right' else (255, 0, 0)
                
                # 绘制边界框
                cv2.rectangle(frame, 
                            (bbox['x'], bbox['y']), 
                            (bbox['x'] + bbox['width'], bbox['y'] + bbox['height']), 
                            color, 2)
                
                # 绘制关键点
                landmarks = hand['landmarks']
                height, width = frame.shape[:2]
                
                for landmark in landmarks:
                    x = int(landmark['x'] * width)
                    y = int(landmark['y'] * height)
                    cv2.circle(frame, (x, y), 3, color, -1)
                
                # 绘制手势标签
                label = f"{handedness}: {gesture['chinese_name']} ({gesture['confidence']:.2f})"
                
                # 背景矩形
                label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
                cv2.rectangle(frame, 
                            (bbox['x'], bbox['y'] - 30), 
                            (bbox['x'] + label_size[0] + 10, bbox['y']), 
                            color, -1)
                
                # 文字
                cv2.putText(frame, label, 
                          (bbox['x'] + 5, bbox['y'] - 10), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            return frame
            
        except Exception as e:
            logger.error(f"绘制手部信息失败: {e}")
            return frame
    
    def is_gesture_stable(self, gesture_type: str, required_frames: int = 3) -> bool:
        """
        检查手势是否稳定（连续帧中出现）
        
        Args:
            gesture_type: 手势类型
            required_frames: 需要的连续帧数
            
        Returns:
            bool: 手势是否稳定
        """
        try:
            # 这里可以实现更复杂的稳定性检查逻辑
            # 简化版本：总是返回True
            return True
            
        except Exception as e:
            logger.error(f"检查手势稳定性失败: {e}")
            return False
    
    def cleanup(self):
        """清理资源"""
        try:
            if hasattr(self, 'hands'):
                self.hands.close()
            logger.info("手势检测器清理完成")
        except Exception as e:
            logger.error(f"手势检测器清理失败: {e}")

# 使用示例
if __name__ == "__main__":
    # 初始化手势检测器
    detector = GestureDetector()
    
    # 测试摄像头
    cap = cv2.VideoCapture(0)
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # 检测手势
            hands = detector.detect_hands(frame)
            
            # 分析交互
            interaction = detector.analyze_gesture_interaction(hands)
            
            # 绘制手部信息
            frame = detector.draw_hands(frame, hands)
            
            # 显示交互描述
            cv2.putText(frame, interaction['description'], 
                       (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            # 显示帧
            cv2.imshow('Gesture Detection', frame)
            
            # 按q退出
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
    finally:
        cap.release()
        cv2.destroyAllWindows()
        detector.cleanup()