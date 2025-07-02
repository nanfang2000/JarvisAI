/**
 * Python后端语音识别服务客户端
 * 通过WebSocket与Python后端通信进行语音识别
 * 支持PCM格式音频处理
 */

import { AudioProcessor } from './audioProcessor';

export interface VoiceRecognitionResult {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
}

export interface ChatResponse {
  userMessage: string;
  assistantResponse: string;
  timestamp: string;
}

export interface VoiceEventListeners {
  onResult?: (result: VoiceRecognitionResult) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onChatResponse?: (response: ChatResponse) => void;
}

export class PythonSpeechService {
  private ws: WebSocket | null = null;
  private audioProcessor: AudioProcessor | null = null;
  private audioStream: MediaStream | null = null;
  private isListening = false;
  private isSpeaking = false;
  private synthesis: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  // 事件监听器
  private onResult?: (result: VoiceRecognitionResult) => void;
  private onError?: (error: string) => void;
  private onStart?: () => void;
  private onEnd?: () => void;
  private onSpeechStart?: () => void;
  private onSpeechEnd?: () => void;
  private onChatResponse?: (response: ChatResponse) => void;

  // Python后端地址
  private readonly backendUrl = 'ws://127.0.0.1:8000/ws/speech';

  constructor() {
    this.synthesis = window.speechSynthesis;
    this.audioProcessor = new AudioProcessor({
      sampleRate: 16000,
      channelCount: 1,
      bitDepth: 16
    });
  }

  // 设置事件监听器
  setEventListeners(listeners: VoiceEventListeners) {
    this.onResult = listeners.onResult;
    this.onError = listeners.onError;
    this.onStart = listeners.onStart;
    this.onEnd = listeners.onEnd;
    this.onSpeechStart = listeners.onSpeechStart;
    this.onSpeechEnd = listeners.onSpeechEnd;
    this.onChatResponse = listeners.onChatResponse;
  }

  // 检查浏览器支持
  private isSupported(): boolean {
    return !!(
      window.WebSocket &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      (window.AudioContext || (window as any).webkitAudioContext)
    );
  }

  // 创建WebSocket连接
  private async createWebSocketConnection(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔗 正在连接到Python语音识别服务...');
        console.log('📍 URL:', this.backendUrl);
        
        this.ws = new WebSocket(this.backendUrl);
        
        this.ws.onopen = () => {
          console.log('✅ WebSocket连接已建立');
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            console.log('📨 收到WebSocket原始消息:', event.data);
            const response = JSON.parse(event.data);
            console.log('📝 解析后的WebSocket消息:', response);
            this.handleWebSocketMessage(response);
          } catch (error) {
            console.error('❌ 解析WebSocket消息失败:', error, '原始数据:', event.data);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket连接错误:', error);
          this.onError?.('WebSocket连接失败');
          reject(new Error('WebSocket连接失败'));
        };

        this.ws.onclose = (event) => {
          console.log(`🔌 WebSocket连接已关闭: 代码=${event.code}, 原因=${event.reason || '无'}`);
          this.isListening = false;
          this.onEnd?.();
        };
        
      } catch (error) {
        console.error('创建WebSocket连接失败:', error);
        reject(error);
      }
    });
  }

  // 处理WebSocket消息
  private handleWebSocketMessage(response: any) {
    const { type } = response;
    
    switch (type) {
      case 'status':
        if (response.message?.includes('已开始')) {
          console.log('✅ 语音识别任务已启动');
          this.onStart?.();
        } else if (response.message?.includes('已结束')) {
          console.log('✅ 语音识别任务完成');
          this.stopListening();
        }
        break;
        
      case 'result':
        // 语音识别结果
        console.log('🎯 收到语音识别结果:', response);
        const result = {
          transcript: response.transcript || '',
          isFinal: response.is_final || false,
          confidence: response.confidence || 0.9
        };
        
        console.log('📝 处理后的识别结果:', result);
        this.onResult?.(result);
        
        if (result.isFinal) {
          console.log('✅ 完整句子识别完成，准备发送给Chat:', result.transcript);
          this.onSpeechEnd?.();
        } else {
          console.log('⏳ 部分识别结果:', result.transcript);
        }
        break;
        
      case 'chat_response':
        // 处理聊天响应
        console.log('💬 收到聊天响应:', response);
        if (this.onChatResponse) {
          this.onChatResponse({
            userMessage: response.user_message,
            assistantResponse: response.assistant_response,
            timestamp: response.timestamp
          });
        }
        break;
        
      case 'chat_error':
        console.error('❌ 聊天处理错误:', response.message);
        this.onError?.(response.message || '聊天处理失败');
        break;
        
      case 'error':
        console.error('❌ 语音识别错误:', response.message);
        this.onError?.(response.message || '语音识别失败');
        break;
        
      default:
        console.log('收到WebSocket消息:', response);
    }
  }

  // 初始化音频处理器
  private async initializeAudioProcessor(): Promise<boolean> {
    if (!this.audioProcessor) {
      console.error('❌ AudioProcessor未创建');
      return false;
    }

    const success = await this.audioProcessor.initialize();
    if (success) {
      console.log('✅ AudioProcessor初始化成功');
    } else {
      console.error('❌ AudioProcessor初始化失败');
    }
    
    return success;
  }

  // 开始语音识别
  async startListening(): Promise<boolean> {
    if (!this.isSupported()) {
      this.onError?.('浏览器不支持WebSocket或AudioContext');
      return false;
    }

    if (this.isListening) {
      console.log('语音识别已在进行中');
      return false;
    }

    try {
      // 停止语音播放
      if (this.isSpeaking) {
        this.stopSpeaking();
      }

      console.log('🎙️ 开始启动PCM语音识别...');

      // 初始化音频处理器
      const audioProcessorReady = await this.initializeAudioProcessor();
      if (!audioProcessorReady) {
        throw new Error('音频处理器初始化失败');
      }

      // 创建WebSocket连接
      await this.createWebSocketConnection();
      
      // 获取音频流
      console.log('🎤 请求麦克风权限...');
      this.audioStream = await (navigator as any).mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('✅ 音频流获取成功');

      // 设置PCM数据处理回调
      const handlePCMData = (pcmData: ArrayBuffer) => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.sendPCMAudioData(pcmData);
        }
      };

      // 开始处理音频流
      const processingStarted = await this.audioProcessor!.startProcessing(this.audioStream, handlePCMData);
      if (!processingStarted) {
        throw new Error('音频处理器启动失败');
      }

      // 通知后端开始识别
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'start' }));
        console.log('📤 发送开始识别命令');
      }

      this.isListening = true;
      console.log('✅ PCM语音识别启动成功');
      this.onStart?.();
      
      return true;
    } catch (error) {
      console.error('❌ 启动PCM语音识别失败:', error);
      this.onError?.(`启动语音识别失败: ${error}`);
      return false;
    }
  }

  // 发送PCM音频数据
  private sendPCMAudioData(pcmData: ArrayBuffer) {
    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // 验证PCM数据格式
        const int16View = new Int16Array(pcmData);
        const sampleCount = int16View.length;
        console.log(`📤 发送PCM音频数据: ${pcmData.byteLength} bytes (${sampleCount} samples)`);
        
        // 调试：显示前几个采样值
        if (sampleCount > 0) {
          const firstSamples = Array.from(int16View.slice(0, Math.min(8, sampleCount)));
          console.log(`🔍 PCM采样值示例: [${firstSamples.join(', ')}]`);
        }
        
        this.ws.send(pcmData);
      }
    } catch (error) {
      console.error('❌ 发送PCM音频数据失败:', error);
    }
  }

  // 停止语音识别
  stopListening() {
    if (!this.isListening) return;

    try {
      console.log('🛑 停止PCM语音识别...');

      // 停止音频处理器
      if (this.audioProcessor) {
        this.audioProcessor.stopProcessing();
      }

      // 关闭音频流
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
        console.log('✅ 音频流已关闭');
      }

      // 通知后端停止识别
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'stop' }));
        console.log('📤 发送停止识别命令');
        
        // 延迟关闭WebSocket
        setTimeout(() => {
          this.ws?.close(1000, 'Normal closure');
          this.ws = null;
        }, 100);
      }

      this.isListening = false;
      this.onEnd?.();
      console.log('✅ PCM语音识别已停止');
    } catch (error) {
      console.error('❌ 停止PCM语音识别失败:', error);
    }
  }

  // 语音合成
  speak(text: string, config?: { rate?: number; pitch?: number; volume?: number; voice?: string }) {
    if (!text.trim()) return;

    // 停止当前播放
    this.stopSpeaking();

    this.currentUtterance = new SpeechSynthesisUtterance(text);
    
    // 配置语音参数
    this.currentUtterance.rate = config?.rate || 1;
    this.currentUtterance.pitch = config?.pitch || 1;
    this.currentUtterance.volume = config?.volume || 1;
    this.currentUtterance.lang = 'zh-CN';

    // 选择语音
    const voices = this.getAvailableVoices();
    if (config?.voice) {
      const selectedVoice = voices.find(v => v.name === config.voice);
      if (selectedVoice) {
        this.currentUtterance.voice = selectedVoice;
      }
    } else {
      // 默认选择中文语音
      const chineseVoice = voices.find(v => v.lang.includes('zh'));
      if (chineseVoice) {
        this.currentUtterance.voice = chineseVoice;
      }
    }

    // 事件处理
    this.currentUtterance.onstart = () => {
      this.isSpeaking = true;
      this.onSpeechStart?.();
    };

    this.currentUtterance.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.onSpeechEnd?.();
    };

    this.currentUtterance.onerror = (event) => {
      console.error('语音合成错误:', event.error);
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.onError?.(`语音合成失败: ${event.error}`);
    };

    // 开始播放
    this.synthesis.speak(this.currentUtterance);
  }

  // 停止语音播放
  stopSpeaking() {
    if (this.isSpeaking) {
      this.synthesis.cancel();
      this.isSpeaking = false;
      this.currentUtterance = null;
    }
  }

  // 打断语音播放并开始监听
  interrupt(): boolean {
    if (this.isSpeaking) {
      this.stopSpeaking();
      setTimeout(() => {
        this.startListening();
      }, 100);
      return true;
    }
    return false;
  }

  // 获取可用语音
  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.synthesis.getVoices();
  }

  // 获取状态
  getStatus() {
    return {
      isSupported: this.isSupported(),
      isListening: this.isListening,
      isSpeaking: this.isSpeaking,
      hasWebSocket: !!this.ws,
      wsReadyState: this.ws?.readyState,
      audioProcessor: this.audioProcessor?.getStatus(),
      availableVoices: this.getAvailableVoices().length
    };
  }

  // 检查权限
  async checkPermissions(): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return false;
      }

      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return result.state === 'granted';
      }
      
      // 尝试获取媒体流来测试权限
      if (navigator && 'mediaDevices' in navigator && (navigator as any).mediaDevices && (navigator as any).mediaDevices.getUserMedia) {
        const stream = await (navigator as any).mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('检查麦克风权限失败:', error);
      return false;
    }
  }

  // 请求权限
  async requestPermissions(): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return false;
      }

      if (!(navigator as any).mediaDevices || !(navigator as any).mediaDevices.getUserMedia) {
        console.error('浏览器不支持媒体设备API');
        return false;
      }

      const stream = await (navigator as any).mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // 立即关闭流，只是为了获取权限
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('获取麦克风权限失败:', error);
      return false;
    }
  }

  // 清理资源
  destroy() {
    console.log('🧹 清理PCM语音识别服务资源...');
    
    this.stopListening();
    this.stopSpeaking();
    
    if (this.audioProcessor) {
      this.audioProcessor.destroy();
      this.audioProcessor = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    console.log('✅ PCM语音识别服务资源清理完成');
  }
}

// 导出全局实例
export const pythonSpeechService = new PythonSpeechService();