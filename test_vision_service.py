#!/usr/bin/env python3
"""
JARVIS 视觉服务测试脚本
测试各个视觉处理模块的功能
"""

import sys
import os
import asyncio
import requests
import json
import base64
import cv2
import time

# 添加项目路径
sys.path.append(os.path.dirname(__file__))

from jarvis_core.vision.face_recognition import FaceRecognizer
from jarvis_core.vision.object_recognition import ObjectRecognizer
from jarvis_core.vision.gesture_detection import GestureDetector
from jarvis_core.models.qwen_client import QwenClient

def test_camera_access():
    """测试摄像头访问"""
    print("测试摄像头访问...")
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("❌ 摄像头访问失败")
        return False
    
    ret, _ = cap.read()
    cap.release()
    
    if ret:
        print("✅ 摄像头访问正常")
        return True
    else:
        print("❌ 摄像头读取失败")
        return False

def test_face_recognition():
    """测试人脸识别模块"""
    print("\n测试人脸识别模块...")
    
    try:
        recognizer = FaceRecognizer()
        
        # 测试摄像头
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("❌ 摄像头不可用，跳过人脸识别测试")
            return False
        
        print("正在测试人脸识别（5秒）...")
        start_time = time.time()
        
        while time.time() - start_time < 5:
            ret, frame = cap.read()
            if not ret:
                continue
                
            faces = recognizer.detect_faces_in_frame(frame)
            
            if faces:
                print(f"检测到 {len(faces)} 张人脸")
                for face in faces:
                    print(f"  - {face['name']} (置信度: {face['confidence']:.2f})")
                    print(f"  - 情绪: {face['emotion']['emotion']} (置信度: {face['emotion']['confidence']:.2f})")
                break
            
            time.sleep(0.1)
        
        cap.release()
        recognizer.cleanup()
        
        print("✅ 人脸识别模块测试完成")
        return True
        
    except Exception as e:
        print(f"❌ 人脸识别测试失败: {e}")
        return False

def test_object_recognition():
    """测试物体识别模块"""
    print("\n测试物体识别模块...")
    
    try:
        recognizer = ObjectRecognizer()
        
        # 测试摄像头
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("❌ 摄像头不可用，跳过物体识别测试")
            return False
        
        print("正在测试物体识别（5秒）...")
        start_time = time.time()
        
        while time.time() - start_time < 5:
            ret, frame = cap.read()
            if not ret:
                continue
                
            objects = recognizer.detect_objects(frame)
            
            if objects:
                print(f"检测到 {len(objects)} 个物体")
                for obj in objects:
                    print(f"  - {obj['chinese_name']} (置信度: {obj['confidence']:.2f})")
                
                # 测试场景分析
                analysis = recognizer.analyze_scene(frame, objects)
                print(f"场景描述: {analysis['scene_description']}")
                break
            
            time.sleep(0.1)
        
        cap.release()
        recognizer.cleanup()
        
        print("✅ 物体识别模块测试完成")
        return True
        
    except Exception as e:
        print(f"❌ 物体识别测试失败: {e}")
        return False

def test_gesture_detection():
    """测试手势检测模块"""
    print("\n测试手势检测模块...")
    
    try:
        detector = GestureDetector()
        
        # 测试摄像头
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("❌ 摄像头不可用，跳过手势检测测试")
            return False
        
        print("正在测试手势检测（5秒）...")
        print("请在摄像头前做手势...")
        start_time = time.time()
        
        while time.time() - start_time < 5:
            ret, frame = cap.read()
            if not ret:
                continue
                
            hands = detector.detect_hands(frame)
            
            if hands:
                print(f"检测到 {len(hands)} 只手")
                for hand in hands:
                    gesture = hand['gesture']
                    print(f"  - {hand['handedness']}: {gesture['chinese_name']} (置信度: {gesture['confidence']:.2f})")
                
                # 测试交互分析
                interaction = detector.analyze_gesture_interaction(hands)
                print(f"交互分析: {interaction['description']}")
                break
            
            time.sleep(0.1)
        
        cap.release()
        detector.cleanup()
        
        print("✅ 手势检测模块测试完成")
        return True
        
    except Exception as e:
        print(f"❌ 手势检测测试失败: {e}")
        return False

async def test_qwen_vision():
    """测试千问视觉分析"""
    print("\n测试千问视觉分析...")
    
    try:
        client = QwenClient()
        
        # 测试连接
        if not await client.test_connection():
            print("❌ 千问API连接失败")
            return False
        
        # 捕获一帧进行分析
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("❌ 摄像头不可用，跳过千问视觉测试")
            return False
        
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            print("❌ 无法捕获图像")
            return False
        
        # 转换为base64
        image_base64 = client.frame_to_base64(frame)
        
        # 测试图像分析
        print("正在分析图像...")
        result = await client.analyze_image(image_base64, "请描述这张图片")
        print(f"分析结果: {result}")
        
        print("✅ 千问视觉分析测试完成")
        return True
        
    except Exception as e:
        print(f"❌ 千问视觉分析测试失败: {e}")
        return False

def test_vision_service_api():
    """测试视觉服务API"""
    print("\n测试视觉服务API...")
    
    try:
        # 测试健康检查
        response = requests.get("http://localhost:8002/health", timeout=5)
        if response.status_code == 200:
            print("✅ 视觉服务API正常运行")
            print(f"服务状态: {response.json()}")
            return True
        else:
            print(f"❌ 视觉服务API响应异常: {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到视觉服务API (请先启动服务)")
        return False
    except Exception as e:
        print(f"❌ 视觉服务API测试失败: {e}")
        return False

def run_all_tests():
    """运行所有测试"""
    print("开始JARVIS视觉服务全面测试")
    print("=" * 50)
    
    results = {}
    
    # 基础测试
    results['camera'] = test_camera_access()
    results['face_recognition'] = test_face_recognition()
    results['object_recognition'] = test_object_recognition()
    results['gesture_detection'] = test_gesture_detection()
    
    # AI测试
    results['qwen_vision'] = asyncio.run(test_qwen_vision())
    
    # API测试
    results['api_service'] = test_vision_service_api()
    
    # 结果统计
    print("\n" + "=" * 50)
    print("测试结果汇总:")
    print("-" * 30)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, result in results.items():
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{test_name:20}: {status}")
    
    print("-" * 30)
    print(f"总计: {passed_tests}/{total_tests} 项测试通过")
    
    if passed_tests == total_tests:
        print("🎉 所有测试通过！JARVIS视觉服务运行正常。")
    else:
        print("⚠️  部分测试失败，请检查相关功能。")
    
    return results

if __name__ == "__main__":
    print("JARVIS 视觉服务测试")
    print("作者: JARVIS开发团队")
    print("版本: 1.0.0")
    print()
    
    # 运行测试
    results = run_all_tests()
    
    # 提供使用指南
    print("\n使用指南:")
    print("1. 启动视觉服务: ./start_vision_service.sh")
    print("2. 访问API文档: http://localhost:8002/docs")
    print("3. WebSocket连接: ws://localhost:8002/ws/camera")
    print("4. 健康检查: http://localhost:8002/health")