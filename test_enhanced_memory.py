#!/usr/bin/env python3
"""
测试增强版记忆系统
"""

import asyncio
import logging
import json
from datetime import datetime
import sys
import os

# 添加项目路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'jarvis-core'))

from memory.unified_memory_manager import UnifiedMemoryManager
from memory.config import get_mem0_config, get_database_config, get_memory_config

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_memory_system():
    """测试记忆系统"""
    try:
        logger.info("开始测试增强版记忆系统...")
        
        # 初始化记忆管理器
        config = {
            "mem0": get_mem0_config(),
            "database": get_database_config(),
            "memory": get_memory_config()
        }
        
        memory_manager = UnifiedMemoryManager(
            db_path="test_memory.db",
            config=config
        )
        
        # 初始化
        await memory_manager.initialize()
        logger.info("记忆系统初始化完成")
        
        # 测试用户记忆
        await test_user_memory(memory_manager)
        
        # 测试会话记忆
        await test_session_memory(memory_manager)
        
        # 测试智能体记忆
        await test_agent_memory(memory_manager)
        
        # 测试视觉记忆
        await test_visual_memory(memory_manager)
        
        # 测试智能搜索
        await test_smart_search(memory_manager)
        
        # 测试综合分析
        await test_comprehensive_analysis(memory_manager)
        
        # 清理
        await memory_manager.cleanup()
        logger.info("记忆系统测试完成")
        
    except Exception as e:
        logger.error(f"测试失败: {e}")
        raise

async def test_user_memory(memory_manager: UnifiedMemoryManager):
    """测试用户记忆"""
    logger.info("测试用户记忆...")
    
    user_id = "test_user"
    
    # 创建用户档案
    profile_data = {
        "name": "张三",
        "age": 28,
        "profession": "软件工程师",
        "interests": ["编程", "阅读", "音乐"],
        "communication_style": "friendly"
    }
    
    await memory_manager.create_user_profile(user_id, profile_data)
    
    # 保存用户偏好
    await memory_manager.save_user_preference(user_id, "食物", "favorite_cuisine", "川菜")
    await memory_manager.save_user_preference(user_id, "娱乐", "favorite_music", "古典音乐")
    await memory_manager.save_user_preference(user_id, "工作", "preferred_time", "早晨")
    
    # 保存用户目标
    goal_data = {
        "description": "学习人工智能和机器学习",
        "priority": "high",
        "target_date": "2024-12-31",
        "category": "学习"
    }
    await memory_manager.save_user_goal(user_id, "AI学习计划", goal_data)
    
    # 保存用户习惯
    habit_data = {
        "description": "每天早晨锻炼30分钟",
        "frequency": "daily",
        "target_time": "07:00"
    }
    await memory_manager.user_memory.save_user_habit(user_id, "晨练", habit_data)
    
    # 验证数据
    retrieved_profile = await memory_manager.get_user_profile(user_id)
    preferences = await memory_manager.get_user_preferences(user_id)
    goals = await memory_manager.get_user_goals(user_id)
    
    logger.info(f"用户档案: {retrieved_profile['name']}")
    logger.info(f"用户偏好: {len(preferences)}个")
    logger.info(f"用户目标: {len(goals)}个")

async def test_session_memory(memory_manager: UnifiedMemoryManager):
    """测试会话记忆"""
    logger.info("测试会话记忆...")
    
    user_id = "test_user"
    
    # 开始会话
    session_id = await memory_manager.start_session(user_id, "chat")
    
    # 模拟对话
    conversations = [
        ("user", "你好，今天天气怎么样？"),
        ("assistant", "您好！今天天气不错，温度适宜。有什么我可以帮助您的吗？"),
        ("user", "我想学习Python编程"),
        ("assistant", "Python是一门很好的编程语言！我可以为您推荐一些学习资源。"),
        ("user", "请帮我制定一个学习计划"),
        ("assistant", "好的，我来为您制定一个循序渐进的Python学习计划。")
    ]
    
    for role, content in conversations:
        await memory_manager.save_message(session_id, role, content)
    
    # 创建任务
    task_data = {
        "description": "完成Python基础语法学习",
        "priority": "medium",
        "due_date": "2024-02-01"
    }
    task_id = await memory_manager.create_task(session_id, "Python学习任务", task_data)
    
    # 更新任务状态
    await memory_manager.update_task_status(session_id, task_id, "in_progress", 20)
    
    # 获取会话上下文
    context = await memory_manager.get_session_context(session_id)
    logger.info(f"会话上下文: {len(context)}条消息")
    
    # 结束会话
    await memory_manager.end_session(session_id, "完成Python学习讨论")

async def test_agent_memory(memory_manager: UnifiedMemoryManager):
    """测试智能体记忆"""
    logger.info("测试智能体记忆...")
    
    # 保存系统知识
    await memory_manager.save_system_knowledge(
        knowledge_type="programming",
        title="Python最佳实践",
        content="使用虚拟环境、遵循PEP8规范、编写单元测试、使用类型提示",
        metadata={"tags": ["python", "best_practice"], "difficulty": "intermediate"}
    )
    
    # 注册技能
    skill_data = {
        "description": "Python代码生成和解释",
        "category": "programming",
        "difficulty": "hard",
        "parameters": ["code_type", "complexity"],
        "returns": "generated_code"
    }
    await memory_manager.register_skill("python_code_generation", skill_data)
    
    # 记录技能使用
    await memory_manager.record_skill_usage(
        skill_name="python_code_generation",
        success=True,
        execution_time=1500,
        result_data={"lines_generated": 25, "complexity": "medium"}
    )
    
    # 保存错误模式
    await memory_manager.save_error_pattern(
        error_type="syntax_error",
        error_description="缺少冒号在if语句末尾",
        solution="在条件语句末尾添加冒号",
        metadata={"frequency": "common", "severity": "low"}
    )
    
    # 保存学习经验
    await memory_manager.agent_memory.save_learning_experience(
        experience_type="optimization",
        title="列表推导式性能优化",
        content="使用列表推导式比传统for循环快约2-3倍",
        metadata={"confidence": 0.9, "evidence_strength": "high"}
    )
    
    # 获取智能体性能指标
    metrics = await memory_manager.agent_memory.get_agent_performance_metrics()
    logger.info(f"智能体性能指标: {len(metrics)}个类别")

async def test_visual_memory(memory_manager: UnifiedMemoryManager):
    """测试视觉记忆"""
    logger.info("测试视觉记忆...")
    
    # 模拟图像分析结果
    analysis_results = {
        "description": "一张办公室的照片，有电脑、书本和咖啡杯",
        "objects": [
            {"name": "电脑", "confidence": 0.95},
            {"name": "书本", "confidence": 0.88},
            {"name": "咖啡杯", "confidence": 0.92}
        ],
        "faces": [
            {"name": "张三", "confidence": 0.89, "emotions": ["专注"], "face_id": "face_001"}
        ],
        "emotions": [
            {"emotion": "专注", "confidence": 0.82, "person_id": "face_001"}
        ],
        "scene_type": "办公室",
        "confidence": 0.91
    }
    
    # 保存图像分析
    image_data = "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
    memory_id = await memory_manager.save_image_analysis(image_data, analysis_results)
    
    # 获取人员历史
    person_history = await memory_manager.get_person_history("张三")
    logger.info(f"人员历史记录: {len(person_history)}条")
    
    # 获取情绪模式
    emotion_patterns = await memory_manager.get_emotion_patterns("张三", 30)
    logger.info(f"情绪模式分析: {emotion_patterns.get('total_detections', 0)}次检测")

async def test_smart_search(memory_manager: UnifiedMemoryManager):
    """测试智能搜索"""
    logger.info("测试智能搜索...")
    
    # 执行智能搜索
    search_context = {
        "user_id": "test_user",
        "memory_types": ["all"],
        "limit": 10
    }
    
    # 搜索编程相关内容
    results = await memory_manager.smart_search("Python编程", search_context)
    logger.info(f"搜索'Python编程': {results['total_results']}个结果")
    
    # 搜索用户偏好
    results = await memory_manager.smart_search("偏好", search_context)
    logger.info(f"搜索'偏好': {results['total_results']}个结果")
    
    # 搜索学习相关
    results = await memory_manager.smart_search("学习", search_context)
    logger.info(f"搜索'学习': {results['total_results']}个结果")

async def test_comprehensive_analysis(memory_manager: UnifiedMemoryManager):
    """测试综合分析"""
    logger.info("测试综合分析...")
    
    user_id = "test_user"
    
    # 生成综合洞察
    insights = await memory_manager.generate_comprehensive_insights(user_id)
    logger.info(f"综合洞察: {len(insights.get('recommendations', []))}条建议")
    
    # 获取综合统计
    stats = await memory_manager.get_comprehensive_stats()
    logger.info(f"系统健康评分: {stats.get('system_health', {}).get('overall_score', 0)}")
    
    # 导出记忆数据
    exported_data = await memory_manager.export_all_memories(user_id)
    logger.info(f"导出数据大小: {len(exported_data)} 字符")
    
    # 清理和优化
    optimization_results = await memory_manager.cleanup_and_optimize()
    logger.info(f"优化完成: {len(optimization_results.get('errors', []))}个错误")

async def run_performance_test():
    """运行性能测试"""
    logger.info("开始性能测试...")
    
    config = {
        "mem0": get_mem0_config(),
        "database": get_database_config(),
        "memory": get_memory_config()
    }
    
    memory_manager = UnifiedMemoryManager(
        db_path="performance_test.db",
        config=config
    )
    
    await memory_manager.initialize()
    
    # 批量插入测试
    start_time = datetime.now()
    
    for i in range(100):
        await memory_manager.core_memory.save_memory(
            memory_type="user",
            content=f"测试记忆 {i}: 这是第{i}条测试数据",
            metadata={"test_id": i, "batch": "performance_test"},
            importance=0.5 + (i % 5) * 0.1
        )
    
    insert_time = (datetime.now() - start_time).total_seconds()
    logger.info(f"批量插入100条记忆用时: {insert_time:.2f}秒")
    
    # 批量搜索测试
    start_time = datetime.now()
    
    for i in range(20):
        results = await memory_manager.smart_search(
            f"测试记忆 {i*5}",
            {"user_id": "default", "limit": 10}
        )
    
    search_time = (datetime.now() - start_time).total_seconds()
    logger.info(f"执行20次搜索用时: {search_time:.2f}秒")
    
    await memory_manager.cleanup()

if __name__ == "__main__":
    print("🧠 JARVIS增强版记忆系统测试")
    print("=" * 50)
    
    try:
        # 运行功能测试
        asyncio.run(test_memory_system())
        
        print("\n" + "=" * 50)
        print("✅ 功能测试完成")
        
        # 运行性能测试
        asyncio.run(run_performance_test())
        
        print("✅ 性能测试完成")
        print("🎉 所有测试通过！")
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # 清理测试文件
        for db_file in ["test_memory.db", "performance_test.db"]:
            if os.path.exists(db_file):
                os.remove(db_file)
                print(f"已清理测试文件: {db_file}")