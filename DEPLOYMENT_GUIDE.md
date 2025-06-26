# JARVIS AI 智能管家系统 - 部署和使用指南

## 🎯 系统概述

JARVIS AI 是一个完整的智能管家系统，集成了3D虚拟助手、多模型AI引擎、语音识别、视觉处理、地图导航、价格比对、Android模拟器控制等功能。

### 核心特性

- 🎭 **3D虚拟助手**: Ready Player Me集成，实时嘴型同步
- 🧠 **多模型AI**: Qwen快速响应 + DeepSeek深度思考
- 👁️ **计算机视觉**: OpenCV人脸识别和用户交互
- 🗺️ **地图导航**: Google Maps集成，路线规划
- 💰 **价格比对**: 多平台商品价格智能比较
- 📱 **Android控制**: 虚拟设备管理和自动化
- 🔒 **安全管理**: 多层安全策略和隐私保护
- 💾 **智能记忆**: 用户/会话/智能体三层记忆系统

## 🚀 快速开始

### 1. 环境要求

**系统要求:**
- macOS 12+ / Windows 10+ / Ubuntu 20.04+
- Node.js 18+ 和 npm
- Python 3.8+
- Rust (用于Tauri构建)

**硬件要求:**
- 内存: 至少8GB，推荐16GB+
- GPU: 支持WebGL 2.0 (用于3D渲染)
- 摄像头: 可选，用于视觉交互
- 麦克风: 可选，用于语音交互

### 2. 一键安装

```bash
# 克隆项目
git clone <repository-url>
cd JarvisAI

# 安装依赖
npm install --legacy-peer-deps
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入您的API密钥

# 构建前端
npm run build

# 启动系统
npm run start
```

### 3. 分步安装

#### 步骤1: 安装Node.js依赖

```bash
cd jarvis-ai
npm install --legacy-peer-deps
```

#### 步骤2: 安装Python依赖

```bash
cd jarvis-core
pip install fastapi uvicorn python-multipart aiofiles
pip install opencv-python face-recognition
pip install requests beautifulsoup4
```

#### 步骤3: 配置API密钥

编辑 `.env` 文件：

```bash
# AI模型配置
QWEN_API_KEY=your_qwen_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key

# 地图服务
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Ready Player Me (3D头像)
RPM_APP_ID=your_rpm_app_id
```

#### 步骤4: 启动服务

```bash
# 终端1: 启动后端服务
cd jarvis-core
python main.py

# 终端2: 启动前端 (开发模式)
cd jarvis-ai  
npm run dev

# 或构建生产版本
npm run build
npm run tauri:build
```

## 📱 使用指南

### 基本操作

1. **启动系统**: 运行上述启动命令后，系统会在浏览器中打开
2. **3D助手交互**: 左侧面板显示3D虚拟助手
3. **对话交互**: 右侧面板进行文字或语音对话
4. **功能标签**: 点击地图、购物、日程等标签切换功能

### 语音交互

```javascript
// 启动语音识别
点击麦克风图标开始录音
支持中英文语音识别
语音转文字后自动发送给AI

// 语音命令示例
"小爱，帮我查看今天的天气"
"在淘宝搜索iPhone 15 Pro的最低价格"
"帮我规划从家到公司的最佳路线"
```

### 3D头像定制

```javascript
// 访问头像配置面板
进入设置 -> 头像配置
选择性别、风格、外观定制
实时预览头像效果
保存个人化设置
```

### 地图和导航

```javascript
// 地点搜索
在地图标签页输入地点名称
支持POI搜索和地址解析
显示详细位置信息

// 路线规划
输入起点和终点
选择出行方式(驾车/步行/公交)
获取详细导航指引
```

### 价格比对

```javascript
// 商品搜索
在购物标签页输入商品名称
系统自动搜索多个电商平台
展示价格对比和推荐商品

// 价格监控
设置心理价位
启用价格变动提醒
自动推送最优购买时机
```

### Android模拟器控制

```javascript
// 设备连接
启动支持的Android模拟器
系统自动检测并连接设备
实时屏幕镜像显示

// 自动化操作
录制操作脚本
语音控制应用操作
批量执行重复任务
```

## 🔧 高级配置

### AI模型配置

```json
{
  "ai": {
    "primary_model": "qwen",
    "secondary_model": "deepseek", 
    "auto_switch": true,
    "response_timeout": 30000,
    "context_length": 8000
  }
}
```

### 3D渲染优化

```json
{
  "rendering": {
    "quality": "high",
    "fps_limit": 60,
    "anti_aliasing": true,
    "shadows": true,
    "texture_quality": "high"
  }
}
```

### 安全策略

```json
{
  "security": {
    "enable_face_recognition": true,
    "data_encryption": true,
    "api_rate_limiting": true,
    "privacy_mode": false
  }
}
```

## 🛠️ 开发者指南

### 添加新功能

```typescript
// 1. 创建新组件
// src/components/features/NewFeature.tsx

// 2. 添加路由
// src/types/navigation.ts
export interface NewFeatureConfig {
  enabled: boolean;
  settings: any;
}

// 3. 集成到主界面
// src/components/layout/ContentPanel.tsx
```

### 自定义AI模型

```python
# jarvis-core/models/custom_model.py
class CustomModel(BaseModel):
    def __init__(self, config):
        super().__init__(config)
    
    async def generate_response(self, prompt: str) -> str:
        # 实现自定义模型逻辑
        return response
```

### 扩展语音命令

```typescript
// src/services/voiceService.ts
const customCommands = {
  "打开音乐": () => openMusicApp(),
  "关闭灯光": () => controlSmartHome("lights", "off"),
  "设置提醒": (text) => createReminder(text)
};
```

## 📊 性能优化

### 前端优化

```javascript
// 1. 启用代码分割
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          three: ['three', '@react-three/fiber'],
          mui: ['@mui/material']
        }
      }
    }
  }
});

// 2. 3D渲染优化
const qualitySettings = {
  low: { pixelRatio: 1, antialias: false },
  medium: { pixelRatio: 1.5, antialias: true },
  high: { pixelRatio: 2, antialias: true }
};
```

### 后端优化

```python
# jarvis-core/config.py
PERFORMANCE_CONFIG = {
    "max_concurrent_requests": 10,
    "response_cache_ttl": 300,
    "model_warm_up": True,
    "gpu_memory_optimization": True
}
```

## 🔒 安全最佳实践

### API密钥管理

```bash
# 使用环境变量
export QWEN_API_KEY="your_key_here"

# 或使用密钥管理服务
# AWS Secrets Manager / Azure Key Vault
```

### 数据加密

```python
# 敏感数据加密存储
from cryptography.fernet import Fernet

def encrypt_user_data(data: str) -> str:
    key = os.environ["ENCRYPTION_KEY"]
    f = Fernet(key)
    return f.encrypt(data.encode()).decode()
```

### 网络安全

```nginx
# nginx配置示例
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📱 移动端部署

### Tauri移动端

```bash
# 安装移动端工具
npm install @tauri-apps/cli@next

# 构建Android版本
tauri android build

# 构建iOS版本  
tauri ios build
```

### PWA部署

```javascript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ]
});
```

## 🐳 Docker部署

### Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine AS frontend
WORKDIR /app
COPY jarvis-ai/package*.json ./
RUN npm install --legacy-peer-deps
COPY jarvis-ai/ ./
RUN npm run build

FROM python:3.9-slim AS backend
WORKDIR /app
COPY jarvis-core/requirements.txt ./
RUN pip install -r requirements.txt
COPY jarvis-core/ ./

FROM nginx:alpine AS production
COPY --from=frontend /app/dist /usr/share/nginx/html
COPY --from=backend /app /backend
EXPOSE 80 8000
```

### docker-compose.yml

```yaml
version: '3.8'
services:
  jarvis-frontend:
    build: 
      context: .
      target: frontend
    ports:
      - "3000:80"
    
  jarvis-backend:
    build:
      context: .
      target: backend
    ports:
      - "8000:8000"
    environment:
      - QWEN_API_KEY=${QWEN_API_KEY}
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
    
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

## 🚨 故障排除

### 常见问题

#### 1. 前端构建失败

```bash
# 清除缓存
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# TypeScript错误
npm run build -- --skipLibCheck
```

#### 2. 后端API连接失败

```bash
# 检查后端服务状态
curl http://localhost:8000/health

# 查看日志
tail -f jarvis-core/logs/app.log
```

#### 3. 3D头像加载失败

```javascript
// 检查WebGL支持
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl2');
console.log('WebGL2 supported:', !!gl);

// 降低渲染质量
const settings = {
  pixelRatio: 1,
  antialias: false,
  shadows: false
};
```

#### 4. 语音识别不工作

```bash
# 检查麦克风权限
# Chrome: Settings > Privacy > Site Settings > Microphone

# HTTPS要求
# 语音识别需要HTTPS或localhost环境
```

### 性能监控

```javascript
// 前端性能监控
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('Performance:', entry.name, entry.duration);
  }
});
observer.observe({entryTypes: ['measure', 'navigation']});

// 后端监控
import time
import psutil

def monitor_performance():
    cpu_usage = psutil.cpu_percent()
    memory_usage = psutil.virtual_memory().percent
    return {"cpu": cpu_usage, "memory": memory_usage}
```

## 📚 API文档

### REST API

#### 聊天接口

```http
POST /chat
Content-Type: application/json

{
  "message": "用户消息",
  "mode": "auto|qwen|deepseek",
  "context": "可选的上下文信息"
}

Response:
{
  "response": "AI回复",
  "model_used": "qwen",
  "success": true,
  "request_id": 123
}
```

#### 地图搜索

```http
GET /api/maps/search?query=地点名称&type=poi

Response:
{
  "results": [
    {
      "name": "地点名称",
      "address": "详细地址", 
      "coordinates": [lat, lng],
      "rating": 4.5
    }
  ]
}
```

#### 价格比对

```http
POST /api/shopping/compare
Content-Type: application/json

{
  "product": "商品名称",
  "platforms": ["taobao", "jd", "pdd"],
  "max_results": 10
}

Response:
{
  "results": [
    {
      "platform": "taobao",
      "title": "商品标题",
      "price": 299.00,
      "url": "商品链接",
      "rating": 4.8
    }
  ],
  "lowest_price": 299.00,
  "recommendations": []
}
```

### WebSocket API

```javascript
// 连接WebSocket
const ws = new WebSocket('ws://localhost:8001');

// 发送消息
ws.send(JSON.stringify({
  type: 'chat',
  data: { message: 'Hello JARVIS' }
}));

// 接收消息
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

## 🤝 贡献指南

### 开发环境设置

```bash
# Fork项目并克隆
git clone https://github.com/your-username/JarvisAI.git
cd JarvisAI

# 创建开发分支
git checkout -b feature/new-feature

# 安装开发依赖
npm install --legacy-peer-deps
pip install -r requirements-dev.txt

# 运行测试
npm test
python -m pytest
```

### 代码规范

```javascript
// ESLint配置
{
  "extends": ["@typescript-eslint/recommended"],
  "rules": {
    "no-unused-vars": "error",
    "prefer-const": "error"
  }
}

// Prettier配置  
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80
}
```

### 提交规范

```bash
# 提交消息格式
git commit -m "feat(avatar): add emotion control system"
git commit -m "fix(api): resolve chat endpoint timeout issue"
git commit -m "docs(readme): update installation guide"

# 类型说明
feat: 新功能
fix: 修复
docs: 文档
style: 格式
refactor: 重构
test: 测试
chore: 构建工具
```

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🙋‍♂️ 技术支持

- **文档**: [项目Wiki](https://github.com/your-repo/wiki)
- **问题反馈**: [GitHub Issues](https://github.com/your-repo/issues)
- **讨论**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **邮件**: support@jarvis-ai.com

---

**注意**: 本系统仅供学习和研究使用。请遵守相关法律法规和服务条款，不得用于非法用途。

## 🎉 致谢

感谢以下开源项目和服务的支持：

- [React](https://reactjs.org/) - 前端框架
- [Tauri](https://tauri.app/) - 跨平台应用框架  
- [Three.js](https://threejs.org/) - 3D图形库
- [FastAPI](https://fastapi.tiangolo.com/) - Python Web框架
- [Ready Player Me](https://readyplayer.me/) - 3D头像服务
- [Material-UI](https://mui.com/) - React UI组件库
- [OpenCV](https://opencv.org/) - 计算机视觉库

---

**版本**: v1.0.0  
**更新时间**: 2025-06-25  
**维护者**: JARVIS AI Team