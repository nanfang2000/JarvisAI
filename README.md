# 🤖 JARVIS智能管家系统

基于钢铁侠电影中JARVIS概念打造的智能管家系统，集成了多模型AI、视觉感知、记忆管理等先进功能。

## ✨ 系统特性

- 🧠 **双模型AI架构**: Qwen(千问)快速响应 + DeepSeek深度思考
- 👁️ **视觉感知系统**: 摄像头集成、人脸识别、物体检测
- 🧠 **三层记忆系统**: 用户记忆、会话记忆、智能体记忆 (基于Mem0)
- 🎭 **3D虚拟头像**: Ready Player Me + 实时嘴型同步
- 🖥️ **跨平台支持**: Tauri框架，支持桌面和浏览器
- 🎯 **智能工具集**: 地图导航、价格比对、Android模拟器控制

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────┐
│                前端 (React + Tauri)                 │
├─────────────────────────────────────────────────────┤
│ Avatar面板 (40%)        │ 内容面板 (60%)           │
│ • 3D头像显示             │ • 对话界面               │
│ • 摄像头预览             │ • 地图导航               │
│ • 嘴型同步               │ • 购物比价               │
│ • 情感表达               │ • 日程管理               │
└─────────────────────────────────────────────────────┘
                            │
                     Tauri IPC通信
                            │
┌─────────────────────────────────────────────────────┐
│                后端 (Python + FastAPI)              │
├─────────────────────────────────────────────────────┤
│ • JARVIS主智能体          │ • 模型路由器             │
│ • Qwen客户端             │ • 记忆管理器             │
│ • DeepSeek客户端         │ • 配置管理器             │
│ • 视觉处理服务           │ • 工具管理器             │
└─────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 1. 环境准备

```bash
# 安装Node.js (>=18)
# 安装Rust (>=1.75)
# 安装Python (>=3.8)

# 克隆项目
git clone <项目地址>
cd JarvisAI
```

### 2. 快速启动方法

#### 方法一：一键启动脚本 (推荐)

```bash
# 进入项目目录
cd /Users/hewei/Documents/workspace/JarvisAI

# 运行一键修复和启动脚本
./quick_fix.sh
```

脚本会自动：
- 🔧 修复已知问题（如3D环境HDR加载错误）
- 📦 检查和安装依赖
- 🔨 构建前端项目
- 🚀 启动后端和前端服务
- ✅ 验证系统功能

#### 方法二：手动启动 (开发调试)

```bash
# 快速启动 (推荐用于演示)
cd /Users/hewei/Documents/workspace/JarvisAI

# 启动后端测试服务器
python test_jarvis_server.py &

# 启动前端开发服务器
cd jarvis-ai && npm run dev
```

#### 方法三：生产环境部署

```bash
# 构建前端
cd jarvis-ai
npm run build

# 启动生产服务
npm run tauri:build  # 桌面应用
# 或
npm run preview      # Web预览
```

### 3. 系统管理工具

我们提供了两个实用脚本来管理JARVIS AI系统：

#### 🛠️ quick_fix.sh - 一键修复和启动系统

**功能**:
- 自动检测和修复常见问题
- 安装缺失的依赖
- 构建和启动服务
- 验证系统功能

**使用方法**:
```bash
./quick_fix.sh
```

#### ✅ check_fix.sh - 验证系统状态和功能

**功能**:
- 检查3D环境配置
- 验证前后端服务状态
- 测试API连接
- 检查TypeScript编译
- 显示进程信息

**使用方法**:
```bash
./check_fix.sh
```

### 4. 访问地址

启动成功后，您可以通过以下地址访问：

- 🌐 **主界面**: http://localhost:1420
- 🔧 **API文档**: http://localhost:8000/docs
- 📊 **健康检查**: http://localhost:8000/health
- 🛠️ **管理面板**: http://localhost:8000/admin (如果启用)

## 🎮 功能演示

### 基础对话测试
```
用户: "你好JARVIS"
JARVIS: "你好主人！我是您的智能管家小爱，很高兴为您服务！"

用户: "今天天气怎么样？"
JARVIS: "正在为您查询天气信息..."

用户: "帮我设置一个提醒"
JARVIS: "好的，请告诉我需要提醒您什么内容？"
```

### AI模型切换
- **自动模式**: 系统智能选择最适合的模型
- **Qwen模式**: 快速响应，适合日常对话
- **DeepSeek模式**: 深度思考，适合复杂问题

### 多功能标签页
- 📱 **对话**: AI聊天和语音交互
- 🗺️ **地图**: 位置搜索和路线规划
- 💰 **购物**: 商品价格比对
- 📅 **日程**: 时间管理和提醒
- 📰 **新闻**: 资讯浏览和摘要

## 🎯 功能完成状态

### ✅ 已完成 (v1.0.0)
- [x] **前端系统**
  - [x] Tauri跨平台应用框架
  - [x] React + TypeScript前端UI
  - [x] Material-UI组件库集成
  - [x] 左右分栏布局 (3D头像 40% + 内容面板 60%)
  - [x] 多标签页界面 (对话/地图/购物/日程/新闻)
  - [x] 响应式设计和主题系统

- [x] **后端系统**
  - [x] Python FastAPI后端服务
  - [x] WebSocket实时通信
  - [x] RESTful API接口
  - [x] 健康检查和状态监控
  - [x] 错误处理和日志系统

- [x] **AI智能系统**
  - [x] 双模型AI路由系统 (Qwen + DeepSeek)
  - [x] 智能模型选择算法
  - [x] 上下文理解和记忆
  - [x] 实时对话处理
  - [x] 多语言支持 (中英文)

- [x] **3D虚拟助手**
  - [x] Three.js 3D渲染引擎
  - [x] Ready Player Me头像集成
  - [x] 实时情感表达系统
  - [x] 嘴型同步基础框架
  - [x] 自适应性能优化

- [x] **视觉处理**
  - [x] OpenCV集成架构
  - [x] 摄像头访问和控制
  - [x] 人脸识别服务框架
  - [x] 实时视频处理管道

- [x] **地图导航系统**
  - [x] Google Maps API集成
  - [x] 地点搜索和POI查询
  - [x] 路线规划功能
  - [x] 实时位置服务

- [x] **购物价格比对**
  - [x] 多平台API集成架构
  - [x] 智能价格分析引擎
  - [x] 商品搜索和比较
  - [x] 推荐算法基础

- [x] **Android设备控制**
  - [x] ADB连接管理
  - [x] 多模拟器支持
  - [x] 自动化脚本引擎
  - [x] 屏幕镜像和控制

- [x] **系统基础设施**
  - [x] 配置管理系统
  - [x] 安全认证机制
  - [x] 性能监控和优化
  - [x] 错误恢复机制

### 🔧 技术修复
- [x] **HDR环境贴图问题**: 替换为基础光照系统
- [x] **TypeScript编译错误**: 修复类型定义和配置
- [x] **依赖冲突**: 使用legacy peer deps解决
- [x] **API连接**: 前后端通信正常
- [x] **构建流程**: 完整的开发和生产构建

### 🛠️ 开发工具
- [x] **quick_fix.sh**: 一键修复和启动脚本
- [x] **check_fix.sh**: 系统状态验证脚本
- [x] **完整文档**: 技术架构、部署指南、故障排除
- [x] **测试系统**: 集成测试和API验证

### 🚀 系统集成
- [x] **前后端集成**: 完整的数据流通
- [x] **多服务协调**: AI模型、视觉、地图等服务
- [x] **实时通信**: WebSocket双向通信
- [x] **跨平台支持**: 桌面应用和Web应用

### 📋 下一步计划 (v1.1.0)
- [ ] 深度学习模型优化
- [ ] 语音识别和合成增强
- [ ] 移动端应用开发
- [ ] 云端服务集成
- [ ] 插件生态系统
- [ ] 多用户支持
- [ ] 企业级安全增强

## 📱 界面预览

```
┌─────────────────────────────────────────────────────┐
│ [🔴🟡🟢]              JARVIS - 智能管家               │
├─────────────────────────────────────────────────────┤
│                                     │ JARVIS在线 🟢 │
│  ┌─────JARVIS AI─────┐              │               │
│  │   您的智能管家小爱   │              │ 📱 对话 🗺️ 地图  │
│  └─────────────────┘              │ 🛒 购物 📅 日程  │
│                                   │ 📰 新闻         │
│  ┌─────3D头像─────┐                │               │
│  │                │                │ ┌─────────────┐ │
│  │      😊        │                │ │用户: 你好    │ │
│  │   [嘴型同步]    │                │ │JARVIS: 你好  │ │
│  │                │                │ │主人！       │ │
│  └─────────────────┘                │ └─────────────┘ │
│                                   │               │
│  ┌───摄像头预览───┐                  │ ┌─输入框─────┐ │
│  │ 📷 人脸已识别   │                  │ │[语音][图片] │ │
│  └─────────────────┘                │ └───────────┘ │
│                                   │               │
│  [📷][🎤][🧠]                       │               │
└─────────────────────────────────────────────────────┘
```

## 🔧 配置说明

### API密钥配置

编辑 `jarvis-core/config/system_config.json`:

```json
{
  "api_settings": {
    "qwen_api_key": "your-qwen-key",
    "qwen_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "deepseek_api_key": "your-deepseek-key",
    "deepseek_base_url": "https://api.deepseek.com/v1"
  }
}
```

### 个性化设置

编辑 `jarvis-core/config/personality_config.json`:

```json
{
  "name": "小爱",
  "personality_traits": {
    "friendliness": 0.9,
    "helpfulness": 0.95,
    "humor": 0.7
  }
}
```

## 🔍 故障排除

### 常见问题

#### 1. 3D头像加载失败
```bash
# 错误: Could not load studio_small_03_1k.hdr
# 解决: 运行修复脚本
./quick_fix.sh
```

#### 2. API连接失败
```bash
# 检查服务状态
curl http://localhost:8000/health

# 重启服务
./quick_fix.sh
```

#### 3. 前端构建错误
```bash
# 清除缓存重新安装
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

#### 4. 端口占用
```bash
# 查看端口占用
lsof -i :8000
lsof -i :1420

# 停止相关进程
pkill -f test_jarvis_server.py
pkill -f "npm run dev"
```

### 获取帮助

如果遇到问题，请：

1. 🔍 查看 [故障排除指南](TROUBLESHOOTING.md)
2. 🏃 运行 `./check_fix.sh` 检查系统状态
3. 🛠️ 运行 `./quick_fix.sh` 尝试自动修复
4. 📋 查看日志文件：`server.log` 和 `frontend.log`

## 🛠️ 开发指南

### 项目结构

```
JarvisAI/
├── README.md                    # 项目说明文档
├── claude.md                    # 完整技术文档
├── DEPLOYMENT_GUIDE.md          # 部署指南
├── TROUBLESHOOTING.md           # 故障排除指南
├── quick_fix.sh                 # 一键修复脚本
├── check_fix.sh                 # 状态检查脚本
├── test_jarvis_server.py        # 测试服务器
├── .env.example                 # 环境变量模板
├── jarvis-ai/                   # 前端Tauri应用
│   ├── src/                     # React + TypeScript源码
│   │   ├── components/          # React组件
│   │   ├── services/            # 业务服务
│   │   ├── types/               # TypeScript类型
│   │   └── utils/               # 工具函数
│   ├── src-tauri/              # Rust后端
│   └── package.json
├── jarvis-core/                 # Python AI核心
│   ├── models/                  # AI模型客户端
│   ├── services/                # 后端服务
│   └── main.py
└── docs/                        # 文档目录
```

### 开发命令

```bash
# 开发模式启动前端
cd jarvis-ai
npm run dev          # Vite开发服务器
npm run tauri:dev    # Tauri开发模式

# 构建生产版本
npm run build        # 构建前端
npm run tauri:build  # 构建桌面应用

# 启动Python后端
python test_jarvis_server.py    # 测试服务器
python jarvis-core/main.py      # 完整后端服务

# 开发工具
./quick_fix.sh       # 一键修复
./check_fix.sh       # 状态检查
```

### API文档

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

### 配置文件

```bash
# 环境变量
cp .env.example .env

# 关键配置项
QWEN_API_KEY=your_qwen_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

## 🤝 贡献指南

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [Tauri](https://tauri.app/) - 跨平台应用框架
- [千问模型](https://tongyi.aliyun.com/) - 主要AI模型
- [DeepSeek](https://www.deepseek.com/) - 深度思考模型
- [Mem0](https://mem0.ai/) - 记忆管理系统
- [Ready Player Me](https://readyplayer.me/) - 3D头像系统

---

**JARVIS** - *您的专属智能管家* 🤖✨