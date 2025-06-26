"""
JARVIS视觉处理模块
提供人脸识别、物体识别、手势检测等视觉处理功能
"""

from .face_recognition import FaceRecognizer
from .object_recognition import ObjectRecognizer  
from .gesture_detection import GestureDetector

__all__ = [
    'FaceRecognizer',
    'ObjectRecognizer', 
    'GestureDetector'
]

__version__ = '1.0.0'