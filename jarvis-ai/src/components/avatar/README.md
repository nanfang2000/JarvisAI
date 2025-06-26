# JARVIS 3D Avatar System

这是一个完整的3D虚拟头像系统，集成了实时嘴型同步、情感表达和语音交互功能。

## 功能特性

### 🎭 3D头像渲染
- **Ready Player Me集成**: 支持高质量的3D人形头像
- **实时渲染**: 基于Three.js和React Three Fiber的高性能3D渲染
- **多种头像风格**: 支持写实、卡通、动漫等多种风格
- **个性化定制**: 支持肤色、发色、眼色等外观定制

### 🗣️ 实时嘴型同步
- **语音分析**: 实时分析音频信号，提取音量、音调等特征
- **音素识别**: 基于共振峰分析的音素识别
- **嘴型映射**: 智能将音素映射到对应的嘴型动画
- **平滑过渡**: 使用缓动算法确保嘴型动画的自然流畅

### 😊 情感表达系统
- **多种情绪**: 支持快乐、悲伤、愤怒、惊讶、恐惧、厌恶、思考、说话等情绪
- **自动检测**: 基于文本内容和语音特征的情感自动识别
- **混合形状**: 使用面部混合形状实现精确的表情控制
- **动画过渡**: 支持情感间的平滑过渡动画

### 🎤 语音集成
- **语音识别**: 集成Web Speech API实现实时语音转文字
- **语音合成**: 支持文本转语音播放
- **音频分析**: 实时分析麦克风输入的音频特征
- **双向同步**: 语音输入和输出的嘴型同步

### ⚡ 性能优化
- **自适应质量**: 根据设备性能自动调整渲染质量
- **LOD管理**: 基于距离的细节层次控制
- **内存管理**: 智能的资源释放和垃圾回收
- **帧率控制**: 维持稳定的渲染帧率

## 组件结构

```
src/components/avatar/
├── Avatar3D.tsx              # 主要的3D头像组件
├── LipSyncManager.tsx        # 嘴型同步管理器
├── EmotionControl.tsx        # 情感控制组件
├── AvatarConfigPanel.tsx     # 头像配置面板
├── AvatarManager.tsx         # 集成管理器
├── AvatarTest.tsx           # 测试组件
└── index.ts                 # 导出文件

src/services/
└── avatarService.ts         # 头像服务和工具类

src/types/
└── avatar.ts               # 类型定义

src/utils/
└── avatarPerformance.ts    # 性能优化工具

src/components/voice/
└── VoiceAvatarIntegration.tsx # 语音头像集成组件
```

## 使用方法

### 基础使用

```tsx
import { AvatarManager } from './components/avatar';

function App() {
  return (
    <AvatarManager
      onEmotionChange={(emotion) => console.log('Emotion changed:', emotion)}
      onAvatarLoad={() => console.log('Avatar loaded')}
      onError={(error) => console.error('Avatar error:', error)}
    />
  );
}
```

### 自定义头像配置

```tsx
import { AvatarManager, AvatarConfig, EmotionType } from './components/avatar';

const customConfig: AvatarConfig = {
  id: 'my-avatar',
  name: 'Custom Avatar',
  url: 'https://models.readyplayer.me/your-avatar-id.glb',
  gender: 'female',
  style: 'realistic',
  customization: {
    skinColor: '#f4c2a1',
    hairColor: '#8b4513',
    eyeColor: '#4169e1',
    outfit: 'business'
  }
};

<AvatarManager
  initialConfig={customConfig}
  // ... other props
/>
```

### 语音集成

```tsx
import { VoiceAvatarIntegration } from './components/voice';

<VoiceAvatarIntegration
  onVoiceInput={(text) => console.log('Recognized:', text)}
  onVoiceOutput={(text) => console.log('Speaking:', text)}
  currentText="Hello, I'm JARVIS!"
  onListeningChange={(listening) => console.log('Listening:', listening)}
  onSpeakingChange={(speaking) => console.log('Speaking:', speaking)}
/>
```

### 情感控制

```tsx
import { EmotionControl, EmotionType } from './components/avatar';

<EmotionControl
  currentEmotion={EmotionType.HAPPY}
  onEmotionChange={(emotion, intensity) => {
    console.log('New emotion:', emotion, 'intensity:', intensity);
  }}
  isAutoMode={true}
  textInput="I'm feeling great today!"
/>
```

## API 参考

### AvatarManager Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `initialConfig` | `AvatarConfig` | - | 初始头像配置 |
| `audioSource` | `MediaStreamAudioSourceNode` | - | 音频源节点 |
| `textInput` | `string` | - | 用于情感分析的文本 |
| `voiceAnalysis` | `VoiceAnalysis` | - | 语音分析数据 |
| `onEmotionChange` | `(emotion: EmotionType) => void` | - | 情感变化回调 |
| `onAvatarLoad` | `() => void` | - | 头像加载完成回调 |
| `onError` | `(error: Error) => void` | - | 错误处理回调 |

### EmotionType 枚举

- `NEUTRAL` - 中性
- `HAPPY` - 快乐
- `SAD` - 悲伤
- `ANGRY` - 愤怒
- `SURPRISED` - 惊讶
- `FEAR` - 恐惧
- `DISGUSTED` - 厌恶
- `THINKING` - 思考
- `SPEAKING` - 说话

### AvatarConfig 接口

```typescript
interface AvatarConfig {
  id: string;                    // 头像ID
  name: string;                  // 头像名称
  url: string;                   // GLB文件URL
  gender: 'male' | 'female';     // 性别
  style: 'realistic' | 'cartoon' | 'anime'; // 风格
  customization: {               // 个性化设置
    skinColor?: string;          // 肤色
    hairColor?: string;          // 发色
    eyeColor?: string;           // 眼色
    outfit?: string;             // 服装
  };
}
```

## 性能优化建议

### 1. 质量设置
```typescript
// 根据设备性能调整质量
const renderOptions: RenderOptions = {
  quality: navigator.hardwareConcurrency > 4 ? 'high' : 'medium',
  enableShadows: true,
  enablePostProcessing: false, // 低端设备关闭后处理
  maxFPS: 60,
  autoResize: true
};
```

### 2. 内存管理
```typescript
// 定期清理不用的资源
useEffect(() => {
  const cleanup = () => {
    // 清理逻辑
  };
  
  const interval = setInterval(cleanup, 30000); // 30秒清理一次
  return () => clearInterval(interval);
}, []);
```

### 3. 网络优化
- 使用CDN托管头像模型文件
- 压缩GLB文件大小
- 实现模型预加载和缓存

## 故障排除

### 常见问题

1. **头像加载失败**
   - 检查网络连接
   - 验证GLB文件URL
   - 确认文件格式正确

2. **性能问题**
   - 降低渲染质量设置
   - 关闭阴影和后处理效果
   - 检查内存使用情况

3. **语音功能不工作**
   - 检查麦克风权限
   - 确认浏览器支持Web Speech API
   - 验证音频设备连接

4. **嘴型同步不准确**
   - 调整灵敏度设置
   - 检查音频输入质量
   - 确认混合形状映射

### 调试工具

使用内置的测试组件进行功能验证：

```tsx
import { AvatarTest } from './components/avatar/AvatarTest';

// 渲染测试组件
<AvatarTest />
```

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

## 依赖项

- React 18+
- Three.js
- @react-three/fiber
- @react-three/drei
- Material-UI
- TypeScript

## 许可证

本项目基于 MIT 许可证开源。