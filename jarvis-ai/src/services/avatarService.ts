import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { 
  AvatarConfig, 
  EmotionType, 
  EmotionConfig, 
  BlendShape, 
  VoiceAnalysis,
  PhonemeToViseme,
  AudioAnalysisResult
} from '../types/avatar';

export class AvatarService {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private loader: GLTFLoader;
  private currentAvatar: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private currentAnimations: Map<string, THREE.AnimationAction> = new Map();
  private morphTargets: THREE.Mesh | null = null;
  private clock: THREE.Clock;
  
  // 情感表情配置
  private emotionConfigs: Map<EmotionType, EmotionConfig> = new Map([
    [EmotionType.NEUTRAL, {
      name: EmotionType.NEUTRAL,
      blendShapes: {},
      duration: 1000
    }],
    [EmotionType.HAPPY, {
      name: EmotionType.HAPPY,
      blendShapes: {
        'mouthSmile': 0.8,
        'eyeSquintLeft': 0.3,
        'eyeSquintRight': 0.3,
        'cheekPuff': 0.2
      },
      duration: 1000
    }],
    [EmotionType.SAD, {
      name: EmotionType.SAD,
      blendShapes: {
        'mouthFrown': 0.6,
        'eyeBlinkLeft': 0.4,
        'eyeBlinkRight': 0.4,
        'browDownLeft': 0.5,
        'browDownRight': 0.5
      },
      duration: 1000
    }],
    [EmotionType.ANGRY, {
      name: EmotionType.ANGRY,
      blendShapes: {
        'mouthFrown': 0.4,
        'browDownLeft': 0.8,
        'browDownRight': 0.8,
        'eyeSquintLeft': 0.6,
        'eyeSquintRight': 0.6
      },
      duration: 1000
    }],
    [EmotionType.SURPRISED, {
      name: EmotionType.SURPRISED,
      blendShapes: {
        'mouthOpen': 0.6,
        'eyeWideLeft': 0.8,
        'eyeWideRight': 0.8,
        'browUpLeft': 0.7,
        'browUpRight': 0.7
      },
      duration: 800
    }],
    [EmotionType.THINKING, {
      name: EmotionType.THINKING,
      blendShapes: {
        'mouthPucker': 0.3,
        'eyeSquintLeft': 0.2,
        'browDownLeft': 0.3,
        'browUpRight': 0.2
      },
      duration: 1200
    }],
    [EmotionType.SPEAKING, {
      name: EmotionType.SPEAKING,
      blendShapes: {
        'mouthOpen': 0.3,
        'eyeWideLeft': 0.1,
        'eyeWideRight': 0.1
      },
      duration: 500
    }]
  ]);

  // 音素到口型映射
  private phonemeToViseme: PhonemeToViseme = {
    'p': { viseme: 'mouthClose', intensity: 0.8 },
    'b': { viseme: 'mouthClose', intensity: 0.8 },
    'm': { viseme: 'mouthClose', intensity: 0.8 },
    'f': { viseme: 'mouthFunnel', intensity: 0.6 },
    'v': { viseme: 'mouthFunnel', intensity: 0.6 },
    'th': { viseme: 'mouthOpen', intensity: 0.4 },
    't': { viseme: 'mouthOpen', intensity: 0.5 },
    'd': { viseme: 'mouthOpen', intensity: 0.5 },
    's': { viseme: 'mouthSmile', intensity: 0.4 },
    'z': { viseme: 'mouthSmile', intensity: 0.4 },
    'sh': { viseme: 'mouthPucker', intensity: 0.7 },
    'ch': { viseme: 'mouthPucker', intensity: 0.7 },
    'j': { viseme: 'mouthPucker', intensity: 0.7 },
    'k': { viseme: 'mouthOpen', intensity: 0.6 },
    'g': { viseme: 'mouthOpen', intensity: 0.6 },
    'n': { viseme: 'mouthOpen', intensity: 0.3 },
    'l': { viseme: 'mouthOpen', intensity: 0.4 },
    'r': { viseme: 'mouthPucker', intensity: 0.5 },
    'w': { viseme: 'mouthPucker', intensity: 0.8 },
    'y': { viseme: 'mouthSmile', intensity: 0.3 },
    'h': { viseme: 'mouthOpen', intensity: 0.2 },
    'a': { viseme: 'mouthOpen', intensity: 0.8 },
    'e': { viseme: 'mouthSmile', intensity: 0.6 },
    'i': { viseme: 'mouthSmile', intensity: 0.7 },
    'o': { viseme: 'mouthPucker', intensity: 0.8 },
    'u': { viseme: 'mouthPucker', intensity: 0.9 }
  };

  constructor(canvas: HTMLCanvasElement) {
    this.clock = new THREE.Clock();
    this.initScene(canvas);
    this.initLighting();
    this.loader = new GLTFLoader();
  }

  private initScene(canvas: HTMLCanvasElement) {
    // 初始化场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // 初始化相机
    this.camera = new THREE.PerspectiveCamera(
      75,
      canvas.width / canvas.height,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.6, 3);
    this.camera.lookAt(0, 1.6, 0);

    // 初始化渲染器
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
  }

  private initLighting() {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // 主光源
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(2, 4, 2);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 20;
    directionalLight.shadow.camera.left = -5;
    directionalLight.shadow.camera.right = 5;
    directionalLight.shadow.camera.top = 5;
    directionalLight.shadow.camera.bottom = -5;
    this.scene.add(directionalLight);

    // 补充光源
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-2, 2, 2);
    this.scene.add(fillLight);

    // 背景光
    const backLight = new THREE.DirectionalLight(0xffffff, 0.2);
    backLight.position.set(0, 2, -2);
    this.scene.add(backLight);
  }

  async loadAvatar(config: AvatarConfig): Promise<void> {
    try {
      // 使用备选URL机制
      const validUrl = await ReadyPlayerMeService.loadAvatarWithFallback(config.url);
      const gltf = await this.loadGLTF(validUrl);
      
      // 移除旧头像
      if (this.currentAvatar) {
        this.scene.remove(this.currentAvatar);
        this.currentAvatar = null;
      }

      // 设置新头像
      this.currentAvatar = gltf.scene;
      this.scene.add(this.currentAvatar);

      // 设置动画混合器
      if (gltf.animations && gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.currentAvatar);
        
        // 加载所有动画
        gltf.animations.forEach(clip => {
          const action = this.mixer!.clipAction(clip);
          this.currentAnimations.set(clip.name, action);
        });
      }

      // 查找并设置形变目标
      this.findMorphTargets(this.currentAvatar);

      // 设置阴影
      this.currentAvatar.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      console.log('Avatar loaded successfully:', config.name, 'using URL:', validUrl);
    } catch (error) {
      console.error('Failed to load avatar:', error);
      throw error;
    }
  }

  private loadGLTF(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => resolve(gltf),
        undefined,
        (error) => reject(error)
      );
    });
  }

  private findMorphTargets(avatar: THREE.Group) {
    avatar.traverse((child) => {
      if (child instanceof THREE.Mesh && child.morphTargetInfluences) {
        this.morphTargets = child;
        console.log('Found morph targets:', child.morphTargetDictionary);
      }
    });
  }

  setEmotion(emotion: EmotionType, intensity: number = 1): void {
    const config = this.emotionConfigs.get(emotion);
    if (!config || !this.morphTargets) return;

    // 重置所有形变目标
    if (this.morphTargets.morphTargetInfluences) {
      this.morphTargets.morphTargetInfluences.fill(0);
    }

    // 应用情感表情
    Object.entries(config.blendShapes).forEach(([shapeName, value]) => {
      this.setBlendShape(shapeName, value * intensity);
    });
  }

  private setBlendShape(shapeName: string, value: number): void {
    if (!this.morphTargets || !this.morphTargets.morphTargetDictionary) return;

    const index = this.morphTargets.morphTargetDictionary[shapeName];
    if (index !== undefined && this.morphTargets.morphTargetInfluences) {
      this.morphTargets.morphTargetInfluences[index] = Math.max(0, Math.min(1, value));
    }
  }

  updateLipSync(audioAnalysis: AudioAnalysisResult): void {
    if (!this.morphTargets) return;

    const { volume, phonemes } = audioAnalysis;
    
    // 基于音量的基础口型
    const baseOpenness = Math.min(volume * 2, 1);
    this.setBlendShape('mouthOpen', baseOpenness);
    
    // 基于音素的精确口型
    if (phonemes && phonemes.length > 0) {
      const currentPhoneme = phonemes[0];
      const visemeConfig = this.phonemeToViseme[currentPhoneme];
      
      if (visemeConfig) {
        this.setBlendShape(visemeConfig.viseme, visemeConfig.intensity * volume);
      }
    }
  }

  playAnimation(animationName: string, loop: boolean = false): void {
    if (!this.mixer) return;

    const action = this.currentAnimations.get(animationName);
    if (!action) {
      console.warn(`Animation '${animationName}' not found`);
      return;
    }

    // 停止其他动画
    this.currentAnimations.forEach((otherAction, name) => {
      if (name !== animationName) {
        otherAction.stop();
      }
    });

    // 播放动画
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = true;
    action.play();
  }

  stopAnimation(): void {
    if (!this.mixer) return;

    this.currentAnimations.forEach(action => {
      action.stop();
    });
  }

  updateBlendShapes(shapes: BlendShape[]): void {
    shapes.forEach(shape => {
      this.setBlendShape(shape.name, shape.value);
    });
  }

  render(): void {
    const deltaTime = this.clock.getDelta();
    
    // 更新动画
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }

    // 渲染场景
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose(): void {
    // 清理资源
    if (this.currentAvatar) {
      this.scene.remove(this.currentAvatar);
    }
    
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
    
    this.currentAnimations.clear();
    this.renderer.dispose();
  }

  // 获取当前场景引用
  getScene(): THREE.Scene {
    return this.scene;
  }

  // 获取当前相机引用
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  // 获取当前渲染器引用
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }
}

// 音频分析工具类
export class AudioAnalyzer {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;
  private bufferLength: number;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
  }

  connectSource(source: AudioNode): void {
    source.connect(this.analyser);
  }

  analyze(): AudioAnalysisResult {
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // 计算音量
    let sum = 0;
    for (let i = 0; i < this.bufferLength; i++) {
      sum += this.dataArray[i];
    }
    const volume = sum / this.bufferLength / 255;

    // 计算基频
    const pitch = this.calculatePitch();

    // 计算MFCC特征
    const mfcc = this.calculateMFCC();

    // 计算频谱质心
    const spectralCentroid = this.calculateSpectralCentroid();

    // 计算过零率
    const zeroCrossingRate = this.calculateZeroCrossingRate();

    return {
      volume,
      pitch,
      mfcc,
      spectralCentroid,
      zeroCrossingRate
    };
  }

  private calculatePitch(): number {
    // 简化的基频检测
    let maxAmplitude = 0;
    let maxIndex = 0;
    
    for (let i = 0; i < this.bufferLength; i++) {
      if (this.dataArray[i] > maxAmplitude) {
        maxAmplitude = this.dataArray[i];
        maxIndex = i;
      }
    }
    
    return (maxIndex * this.audioContext.sampleRate) / (2 * this.bufferLength);
  }

  private calculateMFCC(): number[] {
    // 简化的MFCC计算
    const mfcc: number[] = [];
    const numCoeffs = 13;
    
    for (let i = 0; i < numCoeffs; i++) {
      let sum = 0;
      for (let j = 0; j < this.bufferLength; j++) {
        sum += this.dataArray[j] * Math.cos((Math.PI * i * (j + 0.5)) / this.bufferLength);
      }
      mfcc.push(sum / this.bufferLength);
    }
    
    return mfcc;
  }

  private calculateSpectralCentroid(): number {
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < this.bufferLength; i++) {
      const frequency = (i * this.audioContext.sampleRate) / (2 * this.bufferLength);
      const magnitude = this.dataArray[i];
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  private calculateZeroCrossingRate(): number {
    // 简化实现
    let crossings = 0;
    for (let i = 1; i < this.bufferLength; i++) {
      if ((this.dataArray[i] >= 128) !== (this.dataArray[i - 1] >= 128)) {
        crossings++;
      }
    }
    return crossings / this.bufferLength;
  }
}

// Ready Player Me 集成工具
export class ReadyPlayerMeService {
  private static readonly BASE_URL = 'https://models.readyplayer.me/';
  
  // 备选头像URL列表
  static readonly FALLBACK_AVATAR_URLS = [
    'https://models.readyplayer.me/64bc14e7c6ccbefd11b0b8cd.glb',
    'https://models.readyplayer.me/65f1c5c83bb58e45ec48e91b.glb', 
    'https://models.readyplayer.me/64bc14e7c6ccbefd11b0b8ce.glb'
  ];
  
  static generateAvatarUrl(
    avatarId: string,
    options: {
      quality?: 'low' | 'medium' | 'high';
      pose?: string;
      background?: string;
      textures?: string;
    } = {}
  ): string {
    const { quality = 'medium', pose = 'A', background = 'transparent' } = options;
    
    const params = new URLSearchParams({
      quality,
      pose,
      background,
      morphTargets: 'ARKit',
      format: 'glb'
    });
    
    return `${this.BASE_URL}${avatarId}.glb?${params.toString()}`;
  }

  static async validateAvatarUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  static async loadAvatarWithFallback(primaryUrl?: string): Promise<string> {
    const urlsToTry = primaryUrl 
      ? [primaryUrl, ...this.FALLBACK_AVATAR_URLS]
      : this.FALLBACK_AVATAR_URLS;

    for (const url of urlsToTry) {
      try {
        console.log(`尝试验证头像URL: ${url}`);
        const isValid = await this.validateAvatarUrl(url);
        if (isValid) {
          console.log(`头像URL验证成功: ${url}`);
          return url;
        }
      } catch (error) {
        console.warn(`头像URL验证失败: ${url}`, error);
      }
    }
    
    // 如果所有URL都失败，返回第一个作为默认值
    console.warn('所有头像URL验证都失败，使用第一个备选URL');
    return this.FALLBACK_AVATAR_URLS[0];
  }
}