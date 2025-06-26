import * as THREE from 'three';

// 基础头像类型定义
export interface Avatar3DProps {
  avatarUrl?: string;
  scale?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  animation?: string;
  emotion?: EmotionType;
  isVisible?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

// 情感类型枚举
export enum EmotionType {
  NEUTRAL = 'neutral',
  HAPPY = 'happy',
  SAD = 'sad',
  ANGRY = 'angry',
  SURPRISED = 'surprised',
  EXCITED = 'excited',
  FEAR = 'fear',
  DISGUSTED = 'disgusted',
  THINKING = 'thinking',
  SPEAKING = 'speaking'
}

// 情感表情配置
export interface EmotionConfig {
  name: EmotionType;
  blendShapes: Record<string, number>;
  duration: number;
  easing?: string;
}

// 嘴型同步相关类型
export interface LipSyncData {
  time: number;
  visemes: Viseme[];
}

export interface Viseme {
  id: string;
  weight: number;
  duration: number;
}

export interface LipSyncConfig {
  sensitivity: number;
  smoothing: number;
  amplitude: number;
  enabled: boolean;
}

// 头像配置
export interface AvatarConfig {
  id: string;
  name: string;
  url: string;
  gender: 'male' | 'female';
  style: 'realistic' | 'cartoon' | 'anime';
  customization: {
    skinColor?: string;
    hairColor?: string;
    eyeColor?: string;
    outfit?: string;
  };
}

// 动画控制
export interface AnimationState {
  current: string;
  queue: string[];
  isPlaying: boolean;
  loop: boolean;
  speed: number;
}

// 3D场景配置
export interface SceneConfig {
  backgroundColor: string;
  lighting: {
    ambient: number;
    directional: {
      intensity: number;
      position: [number, number, number];
      color: string;
    };
  };
  camera: {
    position: [number, number, number];
    fov: number;
    near: number;
    far: number;
  };
  performance: {
    pixelRatio: number;
    antialias: boolean;
    shadows: boolean;
  };
}

// 语音分析数据
export interface VoiceAnalysis {
  amplitude: number;
  frequency: number;
  formants: number[];
  pitch: number;
  energy: number;
}

// 头像状态管理
export interface AvatarState {
  isLoaded: boolean;
  isAnimating: boolean;
  currentEmotion: EmotionType;
  currentAnimation: string;
  lipSyncActive: boolean;
  error?: string;
}

// Ready Player Me 相关类型
export interface RPMConfig {
  subdomain: string;
  quickStart?: boolean;
  clearCache?: boolean;
  bodyType?: 'halfbody' | 'fullbody';
  gender?: 'male' | 'female';
  language?: string;
}

// 面部表情混合形状
export interface BlendShape {
  name: string;
  value: number;
  target?: number;
  speed?: number;
}

// 头像控制器接口
export interface AvatarController {
  loadAvatar: (config: AvatarConfig) => Promise<void>;
  setEmotion: (emotion: EmotionType, intensity?: number) => void;
  playAnimation: (animation: string, loop?: boolean) => void;
  stopAnimation: () => void;
  startLipSync: (audioSource: AudioNode) => void;
  stopLipSync: () => void;
  updateBlendShapes: (shapes: BlendShape[]) => void;
  dispose: () => void;
}

// 语音到嘴型映射
export interface PhonemeToViseme {
  [phoneme: string]: {
    viseme: string;
    intensity: number;
  };
}

// 实时音频分析结果
export interface AudioAnalysisResult {
  volume: number;
  pitch: number;
  mfcc: number[];
  spectralCentroid: number;
  zeroCrossingRate: number;
  phonemes?: string[];
}

// 头像渲染选项
export interface RenderOptions {
  quality: 'low' | 'medium' | 'high';
  enableShadows: boolean;
  enablePostProcessing: boolean;
  maxFPS: number;
  autoResize: boolean;
}

// 事件类型
export interface AvatarEvents {
  onAvatarLoad: (avatar: THREE.Object3D) => void;
  onAnimationStart: (animation: string) => void;
  onAnimationEnd: (animation: string) => void;
  onEmotionChange: (emotion: EmotionType) => void;
  onLipSyncStart: () => void;
  onLipSyncEnd: () => void;
  onError: (error: Error) => void;
}

// 头像管理器配置
export interface AvatarManagerConfig {
  scene: SceneConfig;
  lipSync: LipSyncConfig;
  render: RenderOptions;
  events?: Partial<AvatarEvents>;
}