// Android模拟器类型定义
export interface AndroidEmulator {
  id: string;
  name: string;
  type: EmulatorType;
  status: EmulatorStatus;
  deviceInfo: DeviceInfo;
  adbPort: number;
  screenResolution: Resolution;
  androidVersion: string;
  createdAt: Date;
  lastUsed: Date;
}

export enum EmulatorType {
  BLUESTACKS = 'bluestacks',
  GENYMOTION = 'genymotion',
  ANDROID_STUDIO = 'android_studio',
  NOX = 'nox',
  LDPLAYER = 'ldplayer'
}

export enum EmulatorStatus {
  OFFLINE = 'offline',
  BOOTING = 'booting',
  ONLINE = 'online',
  ERROR = 'error',
  UNKNOWN = 'unknown'
}

export interface DeviceInfo {
  manufacturer: string;
  model: string;
  brand: string;
  product: string;
  device: string;
  board: string;
  hardware: string;
  cpuAbi: string;
  serialNumber: string;
}

export interface Resolution {
  width: number;
  height: number;
  density: number;
}

// ADB相关类型
export interface ADBDevice {
  serial: string;
  state: 'device' | 'offline' | 'unauthorized';
  transport: string;
  usb?: string;
  product?: string;
  model?: string;
  device?: string;
}

export interface ADBCommand {
  command: string;
  args: string[];
  timeout?: number;
}

export interface ADBResponse {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
}

// 屏幕操作类型
export interface TouchEvent {
  type: 'tap' | 'swipe' | 'long_press' | 'drag';
  x: number;
  y: number;
  endX?: number;
  endY?: number;
  duration?: number;
  pressure?: number;
}

export interface KeyEvent {
  type: 'key_press' | 'key_down' | 'key_up';
  keyCode: number;
  metaState?: number;
}

export interface ScreenInfo {
  width: number;
  height: number;
  density: number;
  orientation: 0 | 1 | 2 | 3; // 0=portrait, 1=landscape, 2=reverse_portrait, 3=reverse_landscape
}

// 应用相关类型
export interface AndroidApp {
  packageName: string;
  versionName: string;
  versionCode: number;
  label: string;
  icon?: string;
  isSystemApp: boolean;
  isEnabled: boolean;
  firstInstallTime: Date;
  lastUpdateTime: Date;
  dataDir: string;
  publicSourceDir: string;
}

export interface AppOperation {
  type: 'install' | 'uninstall' | 'start' | 'stop' | 'clear_data' | 'grant_permission';
  packageName: string;
  apkPath?: string;
  permission?: string;
}

// 自动化相关类型
export interface AutomationScript {
  id: string;
  name: string;
  description: string;
  targetApp: string;
  steps: AutomationStep[];
  conditions: AutomationCondition[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationStep {
  id: string;
  type: 'tap' | 'swipe' | 'input' | 'wait' | 'check' | 'screenshot' | 'scroll';
  selector?: ElementSelector;
  action?: TouchEvent | KeyEvent;
  text?: string;
  duration?: number;
  condition?: string;
  retry?: number;
  description: string;
}

export interface ElementSelector {
  type: 'id' | 'text' | 'class' | 'xpath' | 'coordinate';
  value: string;
  index?: number;
  timeout?: number;
}

export interface AutomationCondition {
  id: string;
  type: 'element_exists' | 'element_not_exists' | 'text_contains' | 'screen_match';
  selector?: ElementSelector;
  text?: string;
  imagePath?: string;
  threshold?: number;
}

// 价格比对相关类型
export interface PriceComparisonTask {
  id: string;
  productName: string;
  platforms: ShoppingPlatform[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: PriceResult[];
  createdAt: Date;
  completedAt?: Date;
}

export interface ShoppingPlatform {
  name: string;
  packageName: string;
  searchSelector: ElementSelector;
  priceSelector: ElementSelector;
  titleSelector: ElementSelector;
  imageSelector?: ElementSelector;
}

export interface PriceResult {
  platform: string;
  productTitle: string;
  price: number;
  currency: string;
  originalPrice?: number;
  discount?: string;
  rating?: number;
  reviews?: number;
  imageUrl?: string;
  productUrl?: string;
  timestamp: Date;
}

// 安全和隐私类型
export interface SecurityProfile {
  id: string;
  name: string;
  permissions: Permission[];
  restrictions: SecurityRestriction[];
  virtualIdentity?: VirtualIdentity;
  dataIsolation: boolean;
  networkIsolation: boolean;
}

export interface Permission {
  name: string;
  granted: boolean;
  requestTime?: Date;
  source: string;
}

export interface SecurityRestriction {
  type: 'network_access' | 'file_access' | 'contact_access' | 'location_access';
  allowed: boolean;
  whitelist?: string[];
  blacklist?: string[];
}

export interface VirtualIdentity {
  name: string;
  email: string;
  phone: string;
  address: string;
  deviceId: string;
  imei: string;
}

// 智能交互类型
export interface AIDecision {
  id: string;
  context: string;
  instruction: string;
  interpretation: string;
  actions: AutomationStep[];
  confidence: number;
  reasoning: string;
  timestamp: Date;
}

export interface InteractionContext {
  currentApp: string;
  screenState: string;
  userIntent: string;
  conversationHistory: string[];
  deviceStatus: EmulatorStatus;
  availableActions: string[];
}

// 集成相关类型
export interface JarvisIntegration {
  emulatorId: string;
  voiceControlEnabled: boolean;
  aiAssistantEnabled: boolean;
  taskSyncEnabled: boolean;
  reportingEnabled: boolean;
}

export interface TaskReport {
  id: string;
  taskType: string;
  emulatorId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  results?: any;
  errors?: string[];
  screenshots?: string[];
}

// 错误处理类型
export interface EmulatorError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
}

export interface RecoveryAction {
  type: 'restart_emulator' | 'reconnect_adb' | 'clear_cache' | 'restart_app' | 'manual_intervention';
  description: string;
  automated: boolean;
  executionTime?: number;
}