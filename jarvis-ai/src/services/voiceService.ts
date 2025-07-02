// 语音服务：语音识别、语音合成、支持打断
export interface VoiceConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
}

export interface VoiceRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface VoiceSynthesisConfig {
  voice?: string;
  rate: number;
  pitch: number;
  volume: number;
}

export class VoiceService {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isListening: boolean = false;
  private isSpeaking: boolean = false;
  private onResult?: (result: VoiceRecognitionResult) => void;
  private onError?: (error: string) => void;
  private onStart?: () => void;
  private onEnd?: () => void;
  private onSpeechStart?: () => void;
  private onSpeechEnd?: () => void;

  constructor() {
    this.synthesis = window.speechSynthesis;
    // 延迟初始化，避免立即失效
    setTimeout(() => {
      this.initializeRecognition();
    }, 100);
  }

  private initializeRecognition() {
    // 检查浏览器支持
    const SpeechRecognition = 
      window.SpeechRecognition || 
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition ||
      (window as any).msSpeechRecognition;

    console.log('🔍 检查语音识别支持:', {
      'window.SpeechRecognition': !!window.SpeechRecognition,
      'window.webkitSpeechRecognition': !!(window as any).webkitSpeechRecognition,
      'userAgent': navigator.userAgent,
      'isSecureContext': window.isSecureContext,
      'protocol': window.location.protocol
    });

    if (!SpeechRecognition) {
      console.warn('❌ 浏览器不支持语音识别');
      console.log('💡 建议使用Chrome、Edge、Safari或支持语音识别的浏览器');
      return;
    }

    console.log('✅ 找到语音识别API:', SpeechRecognition.name || 'SpeechRecognition');
    this.recognition = new SpeechRecognition();
    this.setupRecognition();
  }

  private setupRecognition() {
    if (!this.recognition) return;

    // 配置语音识别
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'zh-CN';
    this.recognition.maxAlternatives = 3;

    // 识别结果处理
    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript && this.onResult) {
        this.onResult({
          transcript: finalTranscript.trim(),
          confidence: event.results[event.results.length - 1][0].confidence || 0.9,
          isFinal: true
        });
      } else if (interimTranscript && this.onResult) {
        this.onResult({
          transcript: interimTranscript.trim(),
          confidence: 0.5,
          isFinal: false
        });
      }
    };

    // 错误处理
    this.recognition.onerror = (event) => {
      console.error('语音识别错误:', event.error);
      this.isListening = false;
      
      // 对于某些错误，自动重新初始化
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        console.log('🔄 权限错误，尝试重新初始化...');
        setTimeout(() => {
          this.initializeRecognition();
        }, 1000);
      } else if (event.error === 'aborted' || event.error === 'audio-capture') {
        console.log('🔄 音频错误，尝试重新初始化...');
        setTimeout(() => {
          this.initializeRecognition();
        }, 500);
      }
      
      if (this.onError) {
        let errorMessage = '语音识别出错';
        switch (event.error) {
          case 'no-speech':
            errorMessage = '没有检测到语音';
            break;
          case 'audio-capture':
            errorMessage = '无法访问麦克风';
            break;
          case 'not-allowed':
          case 'service-not-allowed':
            errorMessage = '麦克风权限被拒绝';
            break;
          case 'network':
            errorMessage = '网络连接错误';
            break;
          case 'aborted':
            errorMessage = '语音识别被中断';
            break;
          default:
            errorMessage = `语音识别错误: ${event.error}`;
        }
        this.onError(errorMessage);
      }
    };

    // 开始和结束事件
    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('🎤 语音识别开始');
      this.onStart?.();
    };

    this.recognition.onend = () => {
      console.log('🎤 语音识别结束');
      
      // 确保状态重置
      this.isListening = false;
      
      // 如果是意外结束（比如超时），准备重新启动
      if (this.recognition) {
        console.log('📝 语音识别服务仍然可用');
      } else {
        console.log('⚠️ 语音识别服务已失效，需要重新初始化');
      }
      
      this.onEnd?.();
    };

    // 语音检测事件
    this.recognition.onspeechstart = () => {
      console.log('🎤 检测到语音');
      this.onSpeechStart?.();
    };

    this.recognition.onspeechend = () => {
      console.log('🎤 语音结束');
      this.onSpeechEnd?.();
    };
  }

  // 开始语音识别
  startListening(config?: Partial<VoiceConfig>) {
    console.log('🎤 尝试开始语音识别...');
    console.log('🔍 当前状态:', {
      hasRecognition: !!this.recognition,
      isListening: this.isListening,
      isSpeaking: this.isSpeaking
    });
    
    if (!this.recognition) {
      console.log('❌ 语音识别对象不存在，尝试重新初始化...');
      this.initializeRecognition();
      
      if (!this.recognition) {
        console.error('❌ 重新初始化后仍然没有语音识别对象');
        this.onError?.('浏览器不支持语音识别');
        return false;
      } else {
        console.log('✅ 重新初始化语音识别对象成功');
      }
    }

    if (this.isListening) {
      console.log('⚠️ 语音识别已在进行中，先停止当前识别');
      this.stopListening();
      // 稍等一下再开始新的识别
      setTimeout(() => this.startListening(config), 200);
      return false;
    }

    // 如果正在播放语音，先停止
    if (this.isSpeaking) {
      console.log('🔇 停止语音播放...');
      this.stopSpeaking();
      // 等待语音停止
      setTimeout(() => this.startListening(config), 300);
      return false;
    }

    // 重新设置配置以确保正确
    console.log('⚙️ 配置语音识别参数...');
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'zh-CN';
    this.recognition.maxAlternatives = 3;
    
    // 应用自定义配置
    if (config) {
      if (config.language) this.recognition.lang = config.language;
      if (config.continuous !== undefined) this.recognition.continuous = config.continuous;
      if (config.interimResults !== undefined) this.recognition.interimResults = config.interimResults;
      if (config.maxAlternatives) this.recognition.maxAlternatives = config.maxAlternatives;
    }

    console.log('📋 最终配置:', {
      lang: this.recognition.lang,
      continuous: this.recognition.continuous,
      interimResults: this.recognition.interimResults,
      maxAlternatives: this.recognition.maxAlternatives
    });

    try {
      console.log('🚀 启动语音识别...');
      this.recognition.start();
      console.log('✅ 语音识别启动命令已发送');
      return true;
    } catch (error: any) {
      console.error('❌ 启动语音识别失败:', error);
      console.error('错误详情:', {
        name: error.name,
        message: error.message,
        code: error.code
      });
      
      // 特殊错误处理
      if (error.name === 'InvalidStateError') {
        console.log('🔄 InvalidStateError，尝试重置状态...');
        this.isListening = false;
        this.stopListening();
        
        setTimeout(() => {
          console.log('🔄 延迟重试启动...');
          try {
            this.recognition?.start();
          } catch (retryError) {
            console.error('❌ 延迟重试也失败:', retryError);
            this.onError?.('语音识别状态错误，请重新初始化');
          }
        }, 500);
        
        return false;
      }
      
      // 如果启动失败，尝试重新创建识别对象
      console.log('🔄 尝试重新创建语音识别对象...');
      this.recognition = null;
      this.initializeRecognition();
      
      if (this.recognition) {
        try {
          console.log('🔄 使用新对象重试启动...');
          this.recognition.start();
          console.log('✅ 重新创建后启动成功');
          return true;
        } catch (retryError) {
          console.error('❌ 重试启动也失败:', retryError);
        }
      }
      
      this.onError?.('启动语音识别失败');
      return false;
    }
  }

  // 停止语音识别
  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  // 语音合成
  speak(text: string, config?: Partial<VoiceSynthesisConfig>): Promise<void> {
    return new Promise((resolve, reject) => {
      // 停止当前播放
      this.stopSpeaking();

      if (!text.trim()) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      // 配置语音合成
      const defaultConfig: VoiceSynthesisConfig = {
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      const finalConfig = { ...defaultConfig, ...config };

      utterance.rate = finalConfig.rate;
      utterance.pitch = finalConfig.pitch;
      utterance.volume = finalConfig.volume;

      // 尝试设置中文语音
      const voices = this.synthesis.getVoices();
      const chineseVoice = voices.find(voice => 
        voice.lang.includes('zh') || 
        voice.name.includes('Chinese') ||
        voice.name.includes('中文')
      );

      if (chineseVoice) {
        utterance.voice = chineseVoice;
      } else if (finalConfig.voice) {
        const selectedVoice = voices.find(voice => voice.name === finalConfig.voice);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      // 事件处理
      utterance.onstart = () => {
        this.isSpeaking = true;
        console.log('🔊 开始语音播放');
        this.onSpeechStart?.();
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        console.log('🔊 语音播放结束');
        this.onSpeechEnd?.();
        resolve();
      };

      utterance.onerror = (event) => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        console.error('语音合成错误:', event);
        reject(new Error(`语音合成失败: ${event.error}`));
      };

      // 开始播放
      this.synthesis.speak(utterance);
    });
  }

  // 停止语音播放
  stopSpeaking() {
    if (this.synthesis.speaking) {
      this.synthesis.cancel();
    }
    this.isSpeaking = false;
    this.currentUtterance = null;
  }

  // 打断语音播放并开始监听
  interrupt(): boolean {
    if (this.isSpeaking) {
      console.log('🛑 打断语音播放');
      this.stopSpeaking();
      
      // 短暂延迟后开始监听，确保语音播放完全停止
      setTimeout(() => {
        this.startListening();
      }, 100);
      
      return true;
    }
    return false;
  }

  // 设置事件监听器
  setEventListeners(listeners: {
    onResult?: (result: VoiceRecognitionResult) => void;
    onError?: (error: string) => void;
    onStart?: () => void;
    onEnd?: () => void;
    onSpeechStart?: () => void;
    onSpeechEnd?: () => void;
  }) {
    this.onResult = listeners.onResult;
    this.onError = listeners.onError;
    this.onStart = listeners.onStart;
    this.onEnd = listeners.onEnd;
    this.onSpeechStart = listeners.onSpeechStart;
    this.onSpeechEnd = listeners.onSpeechEnd;
  }

  // 获取可用的语音
  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.synthesis.getVoices();
  }

  // 获取状态
  getStatus() {
    return {
      isListening: this.isListening,
      isSpeaking: this.isSpeaking,
      isSupported: !!this.recognition,
      availableVoices: this.getAvailableVoices().length
    };
  }

  // 检查权限
  async checkPermissions(): Promise<boolean> {
    try {
      console.log('🔐 检查麦克风权限...');
      
      // 方法1: 使用Permissions API
      if ('permissions' in navigator) {
        try {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          console.log('📋 权限API结果:', result.state);
          if (result.state === 'granted') {
            return true;
          } else if (result.state === 'denied') {
            return false;
          }
          // 如果是'prompt'状态，继续尝试其他方法
        } catch (permError) {
          console.log('⚠️ Permissions API失败:', permError);
        }
      }
      
      // 方法2: 尝试获取媒体流来测试权限
      if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true,
            video: false 
          });
          // 立即关闭流
          stream.getTracks().forEach(track => track.stop());
          console.log('✅ 麦克风访问测试成功');
          return true;
        } catch (mediaError) {
          console.log('❌ 麦克风访问测试失败:', mediaError);
          return false;
        }
      }
      
      console.log('⚠️ 无法检查麦克风权限 - 浏览器API不支持');
      return false;
    } catch (error) {
      console.warn('❌ 检查麦克风权限时出错:', error);
      return false;
    }
  }

  // 请求权限
  async requestPermissions(): Promise<boolean> {
    try {
      console.log('🔐 开始请求麦克风权限...');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ 浏览器不支持getUserMedia');
        return false;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('✅ 成功获取麦克风流:', stream);
      console.log('🎤 音频轨道:', stream.getAudioTracks());
      
      // 立即关闭流
      stream.getTracks().forEach(track => {
        console.log('🔒 关闭音频轨道:', track.label);
        track.stop();
      });
      
      return true;
    } catch (error) {
      console.error('❌ 获取麦克风权限失败:', error);
      console.error('错误详情:', {
        name: error.name,
        message: error.message,
        constraint: (error as any).constraint
      });
      return false;
    }
  }

  // 清理资源
  destroy() {
    this.stopListening();
    this.stopSpeaking();
    this.recognition = null;
  }
}

// 全局语音服务实例
export const voiceService = new VoiceService();

// 语音指令处理器
export class VoiceCommandProcessor {
  private commandPatterns: Map<string, RegExp> = new Map();
  private commandHandlers: Map<string, (params: string[]) => void> = new Map();

  constructor() {
    this.setupDefaultCommands();
  }

  private setupDefaultCommands() {
    // 默认语音命令
    this.addCommand('stop', /^(停止|暂停|闭嘴)/, () => {
      voiceService.stopSpeaking();
    });

    this.addCommand('interrupt', /^(打断|我说话)/, () => {
      voiceService.interrupt();
    });

    // this.addCommand('hello', /^(你好|hi|hello)/, () => {
    //   console.log('收到问候指令');
    // });
  }

  addCommand(name: string, pattern: RegExp, handler: (params: string[]) => void) {
    this.commandPatterns.set(name, pattern);
    this.commandHandlers.set(name, handler);
  }

  processCommand(text: string): boolean {
    const normalizedText = text.toLowerCase().trim();
    
    for (const [name, pattern] of this.commandPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        const handler = this.commandHandlers.get(name);
        if (handler) {
          handler(match.slice(1));
          return true;
        }
      }
    }
    
    return false;
  }
}

export const voiceCommandProcessor = new VoiceCommandProcessor();