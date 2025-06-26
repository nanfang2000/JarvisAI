# 🛠️ JARVIS AI 故障排除指南

## 常见问题及解决方案

### 1. 🎭 3D头像加载问题

#### 问题：`Could not load studio_small_03_1k.hdr: Load failed`

**原因**: Environment组件尝试加载HDR环境贴图文件失败

**解决方案**:
```typescript
// ❌ 错误用法
<Environment preset="studio" background={false} />

// ✅ 正确用法
<ambientLight intensity={0.5} />
<directionalLight 
  position={[10, 10, 5]} 
  intensity={1.5}
  castShadow
/>
<pointLight position={[-10, -10, -10]} intensity={0.3} />
```

**已修复**: ✅ 已在 `Avatar3D.tsx` 中替换为基础光照系统

### 2. 🔧 前端构建问题

#### 问题：TypeScript编译错误

**常见错误**:
- `Property 'EXCITED' does not exist on type 'typeof EmotionType'`
- `Module has no exported member 'ColorPicker'`
- `Property 'antialias' does not exist on type 'WebGLRenderer'`

**解决方案**:
```bash
# 1. 清除缓存并重新安装
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# 2. 使用宽松的TypeScript配置
# 在 tsconfig.json 中设置:
{
  "strict": false,
  "noUnusedLocals": false,
  "noImplicitAny": false
}

# 3. 重新构建
npm run build
```

### 3. 🌐 API连接问题

#### 问题：前端无法连接后端

**检查步骤**:
```bash
# 1. 检查后端健康状态
curl http://localhost:8000/health

# 2. 检查端口是否被占用
lsof -i :8000
lsof -i :1420

# 3. 重启服务
pkill -f test_jarvis_server.py
python test_jarvis_server.py &
```

#### 问题：CORS错误

**解决方案**:
```python
# 在 test_jarvis_server.py 中确保CORS配置正确
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 4. 📱 Tauri应用问题

#### 问题：`resource path bin/jarvis-core-x86_64-apple-darwin doesn't exist`

**解决方案**:
```json
// 临时移除 tauri.conf.json 中的 externalBin 配置
{
  "bundle": {
    // "externalBin": [
    //   "bin/jarvis-core",
    //   "bin/vision-service"
    // ]
  }
}
```

#### 问题：Tauri开发模式启动失败

**解决方案**:
```bash
# 1. 确保Rust工具链已安装
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. 安装Tauri CLI
npm install @tauri-apps/cli@latest

# 3. 使用开发模式
npm run tauri:dev
```

### 5. 🎬 动画和渲染问题

#### 问题：3D渲染性能差

**优化方案**:
```typescript
// 1. 降低渲染质量
const performanceSettings = {
  pixelRatio: Math.min(window.devicePixelRatio, 1.5),
  antialias: false,
  shadows: false
};

// 2. 启用自适应质量
const qualityController = new AdaptiveQualityController(renderer);
qualityController.setTargetFPS(30);

// 3. 减少多边形数量
const lodSettings = {
  enableLOD: true,
  maxDistance: 10,
  lowDetailRatio: 0.5
};
```

#### 问题：头像加载缓慢

**解决方案**:
```typescript
// 1. 使用CDN加速
const AVATAR_CDN = 'https://cdn.readyplayer.me/';

// 2. 预加载常用头像
const preloadAvatars = [
  'https://models.readyplayer.me/66c4a73cbc4b2e7c9ff6a0b0.glb'
];

// 3. 启用缓存
const cacheConfig = {
  enableCache: true,
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  cacheTTL: 24 * 60 * 60 * 1000 // 24小时
};
```

### 6. 🗣️ 语音识别问题

#### 问题：麦克风无法访问

**解决方案**:
```javascript
// 1. 检查浏览器权限
navigator.permissions.query({name: 'microphone'})
  .then(result => console.log('Microphone permission:', result.state));

// 2. 确保HTTPS环境
// 语音识别API只在HTTPS或localhost下工作

// 3. 检查浏览器兼容性
if ('webkitSpeechRecognition' in window) {
  // Chrome/Edge
} else if ('SpeechRecognition' in window) {
  // Firefox
} else {
  console.error('Speech recognition not supported');
}
```

### 7. 🔑 API密钥配置问题

#### 问题：AI模型API调用失败

**检查清单**:
```bash
# 1. 验证.env文件存在且配置正确
cat .env | grep API_KEY

# 2. 检查API密钥格式
# Qwen: sk-xxxxxx
# DeepSeek: sk-xxxxxx
# Google Maps: AIzaSyxxxxxx

# 3. 测试API连通性
curl -H "Authorization: Bearer $QWEN_API_KEY" \
     https://dashscope.aliyuncs.com/compatible-mode/v1/models
```

## 🚀 快速修复命令

### 完全重置系统
```bash
#!/bin/bash
# reset_jarvis.sh

echo "🔄 重置JARVIS系统..."

# 停止所有相关进程
pkill -f test_jarvis_server.py
pkill -f "npm run dev"

# 清理前端
cd jarvis-ai
rm -rf node_modules package-lock.json dist
npm install --legacy-peer-deps
npm run build

# 重启服务
cd ..
python test_jarvis_server.py > server.log 2>&1 &
cd jarvis-ai
npm run dev > dev.log 2>&1 &

echo "✅ JARVIS系统重置完成!"
echo "🌐 前端地址: http://localhost:1420"
echo "🔧 后端地址: http://localhost:8000"
```

### 检查系统状态
```bash
#!/bin/bash
# check_jarvis.sh

echo "🔍 检查JARVIS系统状态..."

# 检查后端
echo "📡 后端状态:"
curl -s http://localhost:8000/health || echo "❌ 后端未响应"

# 检查前端
echo "🌐 前端状态:"
curl -s http://localhost:1420/ > /dev/null && echo "✅ 前端运行正常" || echo "❌ 前端未响应"

# 检查进程
echo "⚙️ 运行进程:"
ps aux | grep -E "(test_jarvis_server|npm.*dev)" | grep -v grep

# 检查端口
echo "🔌 端口占用:"
lsof -i :8000 2>/dev/null || echo "端口8000未占用"
lsof -i :1420 2>/dev/null || echo "端口1420未占用"
```

## 📞 获取帮助

### 日志位置
- **前端日志**: `jarvis-ai/dev.log`
- **后端日志**: `server.log`
- **构建日志**: `npm run build` 输出
- **浏览器控制台**: F12 > Console

### 调试模式
```javascript
// 在浏览器控制台中启用调试
localStorage.setItem('jarvis_debug', 'true');
location.reload();

// 查看详细日志
window.jarvis.getSystemInfo();
window.jarvis.getPerformanceStats();
```

### 联系支持
- 📋 **问题反馈**: [GitHub Issues](https://github.com/your-repo/issues)
- 💬 **讨论区**: [GitHub Discussions](https://github.com/your-repo/discussions)
- 📧 **邮件支持**: support@jarvis-ai.com

---

**最后更新**: 2025-06-25  
**版本**: v1.0.0