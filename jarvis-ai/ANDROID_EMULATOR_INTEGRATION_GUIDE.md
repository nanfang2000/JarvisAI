# JARVIS Android模拟器控制系统集成指南

## 概述

JARVIS Android模拟器控制系统是一个完整的虚拟Android设备管理和自动化解决方案，支持多种模拟器类型，提供智能操作、价格比对、安全管理等功能。

## 核心功能

### 1. Android模拟器集成
- **多模拟器支持**: BlueStacks、Genymotion、Android Studio AVD、NOX、LDPlayer
- **设备管理**: 启动、停止、状态监控
- **ADB连接**: 自动建立和维护ADB连接

### 2. 设备控制系统
- **屏幕镜像**: 实时显示设备屏幕
- **触摸控制**: 点击、滑动、长按、拖拽操作
- **键盘输入**: 虚拟键盘和物理按键模拟
- **应用管理**: 安装、卸载、启动、停止应用

### 3. 应用自动化
- **脚本系统**: 可视化脚本编辑器
- **预定义模板**: 社交媒体、购物应用自动化
- **智能录制**: 自动记录用户操作生成脚本
- **批量执行**: 支持多脚本并行或顺序执行

### 4. 价格比对集成
- **多平台搜索**: 淘宝、京东、拼多多、天猫、苏宁易购
- **智能解析**: AI驱动的价格和商品信息提取
- **实时监控**: 定时价格变化监控
- **数据整合**: 与JARVIS价格API集成

### 5. 智能交互系统
- **自然语言处理**: 理解用户语音和文本指令
- **AI决策引擎**: 智能分析并生成操作步骤
- **上下文理解**: 基于当前应用和屏幕状态的智能响应
- **学习优化**: 从执行结果中学习和改进

### 6. 安全和隐私
- **安全配置**: 多级安全策略配置
- **权限管理**: 细粒度应用权限控制
- **虚拟身份**: 虚拟设备信息和用户数据
- **数据隔离**: 应用数据和网络隔离
- **风险评估**: 实时安全风险分析

### 7. JARVIS主系统集成
- **语音控制**: 通过JARVIS语音助手控制Android设备
- **任务协调**: 跨平台任务协调和执行
- **实时反馈**: 操作结果实时反馈给AI系统
- **智能建议**: 基于用户行为的智能操作建议

## 技术架构

### 核心服务

1. **AndroidEmulatorService**: 模拟器管理服务
2. **ADBController**: ADB连接和设备控制
3. **AutomationEngine**: 自动化脚本引擎
4. **AndroidPriceComparison**: 价格比对服务
5. **AndroidAIDecisionEngine**: AI决策引擎
6. **AndroidSecurityManager**: 安全管理器
7. **JarvisAndroidIntegration**: JARVIS集成服务

### 用户界面

- **AndroidEmulator.tsx**: 主控制界面
- **多标签页设计**: 设备信息、应用管理、自动化、价格比对、设置
- **实时状态显示**: 设备状态、任务进度、安全状态

## 安装和配置

### 1. 依赖安装

```bash
# 安装Node.js依赖
npm install

# 确保ADB工具可用
# Windows: 下载Android SDK Platform Tools
# macOS: brew install android-platform-tools
# Linux: sudo apt-get install android-tools-adb
```

### 2. 模拟器配置

#### BlueStacks配置
```bash
# 启用ADB连接
# BlueStacks设置 > 高级 > Android调试桥 > 启用
```

#### Android Studio AVD配置
```bash
# 创建AVD
emulator -list-avds
emulator -avd <avd_name>
```

#### Genymotion配置
```bash
# 安装Genymotion
# 创建虚拟设备
# 启用ADB连接
```

### 3. 启动系统

```bash
# 开发模式
npm run dev

# 生产构建
npm run build
```

## 使用指南

### 1. 设备连接

1. 启动模拟器或连接实体设备
2. 在JARVIS界面中选择"Android模拟器"
3. 系统将自动检测并连接可用设备
4. 选择要控制的设备

### 2. 基本操作

#### 屏幕控制
- 点击屏幕任意位置进行触摸操作
- 使用缩放滑块调整显示大小
- 点击"屏幕镜像"开始实时显示

#### 应用管理
- 在"应用管理"标签查看已安装应用
- 点击"启动"按钮启动应用
- 支持应用安装、卸载等操作

### 3. 自动化脚本

#### 创建脚本
```typescript
import { AutomationEngine } from './services/automationEngine';

const engine = AutomationEngine.getInstance();

// 创建购物自动化脚本
const script = engine.createShoppingScript('taobao');

// 执行脚本
await engine.executeScript(script, deviceSerial);
```

#### 语音控制
```typescript
// 启用语音控制
await jarvisIntegration.enableVoiceControl(deviceSerial);

// 语音指令示例：
// "在淘宝搜索iPhone"
// "打开微信"
// "发送消息给张三"
```

### 4. 价格比对

#### 基本比价
```typescript
import { AndroidPriceComparison } from './services/androidPriceComparison';

const priceComparison = AndroidPriceComparison.getInstance();

// 创建价格比对任务
const task = priceComparison.createPriceComparisonTask(
  'iPhone 15 Pro',
  ['淘宝', '京东', '拼多多']
);

// 执行比价
await priceComparison.executePriceComparison(task.id, deviceSerial);
```

#### 智能比价
```typescript
// 智能价格比对
const result = await priceComparison.intelligentPriceComparison(
  'MacBook Pro',
  deviceSerial,
  {
    maxResultsPerPlatform: 10,
    includeRecommendations: true
  }
);

console.log('最低价格:', result.analysis.lowestPrice);
console.log('推荐:', result.analysis.recommendations);
```

### 5. 安全管理

#### 应用安全配置
```typescript
import { AndroidSecurityManager } from './services/androidSecurityManager';

const securityManager = AndroidSecurityManager.getInstance();

// 创建严格安全配置
const profile = securityManager.createSecurityProfile(
  '测试环境',
  [
    {
      type: 'network_access',
      allowed: true,
      whitelist: ['example.com'],
      blacklist: []
    }
  ],
  {
    name: '测试用户',
    email: 'test@example.com',
    phone: '13800138000'
  },
  true, // 数据隔离
  false // 网络隔离
);

// 应用安全配置
await securityManager.applySecurityProfile(deviceSerial, profile.id);
```

#### 风险评估
```typescript
// 执行安全风险评估
const riskAssessment = await securityManager.assessSecurityRisk(deviceSerial);

console.log('风险等级:', riskAssessment.riskLevel);
console.log('风险因素:', riskAssessment.factors);
console.log('建议:', riskAssessment.recommendations);
```

## API参考

### AndroidEmulatorService

```typescript
class AndroidEmulatorService {
  // 检测模拟器
  async detectInstalledEmulators(): Promise<AndroidEmulator[]>
  
  // 启动模拟器
  async startEmulator(emulatorId: string): Promise<boolean>
  
  // 停止模拟器
  async stopEmulator(emulatorId: string): Promise<boolean>
  
  // 获取已安装应用
  async getInstalledApps(deviceSerial: string): Promise<AndroidApp[]>
}
```

### ADBController

```typescript
class ADBController {
  // 执行触摸事件
  async performTouchEvent(serial: string, event: TouchEvent): Promise<boolean>
  
  // 发送按键事件
  async sendKeyEvent(serial: string, event: KeyEvent): Promise<boolean>
  
  // 输入文本
  async inputText(serial: string, text: string): Promise<boolean>
  
  // 截图
  async takeScreenshot(serial: string): Promise<string | null>
  
  // 启动应用
  async launchApp(serial: string, packageName: string): Promise<boolean>
}
```

### AutomationEngine

```typescript
class AutomationEngine {
  // 创建脚本
  createScript(name: string, description: string, targetApp: string, steps: AutomationStep[]): AutomationScript
  
  // 执行脚本
  async executeScript(script: AutomationScript, deviceSerial: string): Promise<boolean>
  
  // 批量执行
  async executeBatch(scripts: AutomationScript[], deviceSerial: string): Promise<boolean[]>
}
```

## 配置选项

### 1. 模拟器配置

```json
{
  "emulators": {
    "bluestacks": {
      "enabled": true,
      "path": "/path/to/bluestacks",
      "adbPort": 5555
    },
    "androidStudio": {
      "enabled": true,
      "sdkPath": "/path/to/android-sdk"
    }
  }
}
```

### 2. 安全配置

```json
{
  "security": {
    "defaultProfile": "strict",
    "permissionWhitelist": [
      "android.permission.INTERNET"
    ],
    "permissionBlacklist": [
      "android.permission.READ_CONTACTS",
      "android.permission.ACCESS_FINE_LOCATION"
    ]
  }
}
```

### 3. AI配置

```json
{
  "ai": {
    "defaultModel": "DeepSeek",
    "models": {
      "deepseek": {
        "endpoint": "/api/deepseek/chat",
        "maxTokens": 4000
      },
      "qwen": {
        "endpoint": "/api/qwen/chat",
        "maxTokens": 8000
      }
    }
  }
}
```

## 故障排除

### 1. 常见问题

#### ADB连接失败
```bash
# 重启ADB服务
adb kill-server
adb start-server

# 检查设备连接
adb devices
```

#### 模拟器检测失败
- 确保模拟器已启动
- 检查ADB端口配置
- 验证模拟器ADB调试已启用

#### 权限问题
- 确保应用具有必要的系统权限
- 检查模拟器的root权限
- 验证安全策略配置

### 2. 性能优化

#### 减少资源占用
```typescript
// 降低屏幕镜像刷新率
const refreshRate = 2000; // 2秒刷新一次

// 限制并发操作
const maxConcurrentTasks = 3;

// 启用硬件加速
const hardwareAcceleration = true;
```

#### 提高响应速度
```typescript
// 使用缓存
const cacheTimeout = 5000;

// 预加载常用数据
await preloadAppList();
await preloadScreenInfo();
```

### 3. 调试技巧

#### 启用详细日志
```typescript
// 设置日志级别
const logLevel = 'debug';

// 启用ADB日志
adb logcat -s "JARVIS:*"
```

#### 监控性能
```typescript
// 监控内存使用
const memoryUsage = process.memoryUsage();

// 监控CPU使用
const cpuUsage = process.cpuUsage();
```

## 扩展开发

### 1. 添加新模拟器支持

```typescript
// 实现模拟器检测
private async detectCustomEmulator(): Promise<AndroidEmulator[]> {
  // 检测逻辑
  return emulators;
}

// 注册到主服务
emulatorService.registerEmulatorType('custom', detectCustomEmulator);
```

### 2. 自定义自动化操作

```typescript
// 创建自定义操作类型
interface CustomAction extends AutomationStep {
  type: 'custom_action';
  customData: any;
}

// 实现操作处理器
automationEngine.registerActionHandler('custom_action', async (step, deviceSerial) => {
  // 自定义操作逻辑
  return true;
});
```

### 3. 集成第三方服务

```typescript
// 创建第三方服务集成
class ThirdPartyIntegration {
  async integrateWithService(data: any): Promise<any> {
    // 集成逻辑
  }
}

// 注册到JARVIS集成服务
jarvisIntegration.registerThirdPartyService('custom', new ThirdPartyIntegration());
```

## 安全注意事项

### 1. 数据保护
- 敏感数据加密存储
- 网络传输使用HTTPS
- 定期清理临时文件

### 2. 权限管理
- 最小权限原则
- 定期审计权限使用
- 监控异常权限请求

### 3. 网络安全
- 防火墙配置
- 流量监控
- 恶意软件检测

## 许可证

本项目采用MIT许可证。详见LICENSE文件。

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 技术支持

- 文档: [项目Wiki](link-to-wiki)
- 问题反馈: [GitHub Issues](link-to-issues)
- 讨论: [GitHub Discussions](link-to-discussions)

---

**注意**: 使用本系统时请遵守相关法律法规，不得用于非法用途。请确保在使用自动化功能时不违反应用服务条款。