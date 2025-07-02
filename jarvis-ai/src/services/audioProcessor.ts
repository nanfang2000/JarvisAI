/**
 * 音频处理服务 - 处理PCM格式转换
 * 用于将浏览器音频转换为后端Paraformer需要的PCM格式
 */

export interface AudioProcessorConfig {
  sampleRate: number;
  channelCount: number;
  bitDepth: number;
}

export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private processor: AudioWorkletNode | ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isProcessing = false;
  
  private config: AudioProcessorConfig = {
    sampleRate: 16000,
    channelCount: 1,
    bitDepth: 16
  };

  private onAudioData?: (pcmData: ArrayBuffer) => void;

  constructor(config?: Partial<AudioProcessorConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * 初始化音频处理器
   */
  async initialize(): Promise<boolean> {
    try {
      // 创建AudioContext
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate
      });

      // 检查AudioContext状态
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      console.log(`🎵 AudioContext初始化完成 - 采样率: ${this.audioContext.sampleRate}Hz`);
      return true;
    } catch (error) {
      console.error('❌ AudioContext初始化失败:', error);
      return false;
    }
  }

  /**
   * 开始处理音频流
   */
  async startProcessing(stream: MediaStream, onAudioData: (pcmData: ArrayBuffer) => void): Promise<boolean> {
    console.log('🚀 AudioProcessor.startProcessing() 被调用');
    console.log('📊 音频流信息:', {
      tracks: stream.getTracks().length,
      audioTracks: stream.getAudioTracks().length,
      active: stream.active
    });

    if (!this.audioContext) {
      console.error('❌ AudioContext未初始化');
      return false;
    }

    if (this.isProcessing) {
      console.log('⚠️ 音频处理器已在运行');
      return false;
    }

    try {
      this.onAudioData = onAudioData;
      
      // 创建音频源
      this.source = this.audioContext.createMediaStreamSource(stream);
      console.log('✅ 音频源已创建');
      
      // 创建分析器
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
      console.log('✅ 音频分析器已创建');

      // 尝试使用AudioWorklet (现代浏览器)
      if (this.audioContext.audioWorklet) {
        console.log('🎯 使用AudioWorklet进行PCM处理');
        await this.setupAudioWorklet();
      } else {
        console.log('🎯 使用ScriptProcessor进行PCM处理');
        // 降级到ScriptProcessorNode (旧浏览器)
        this.setupScriptProcessor();
      }

      this.isProcessing = true;
      console.log('✅ 音频处理器启动成功 - PCM转换已开始');
      return true;

    } catch (error) {
      console.error('❌ 启动音频处理器失败:', error);
      return false;
    }
  }

  /**
   * 设置AudioWorklet处理器 (推荐方式)
   */
  private async setupAudioWorklet() {
    try {
      // 注册AudioWorklet模块
      const workletCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.bufferSize = 1024;
            this.buffer = new Float32Array(this.bufferSize);
            this.bufferIndex = 0;
          }

          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input && input[0]) {
              const inputData = input[0];
              
              for (let i = 0; i < inputData.length; i++) {
                this.buffer[this.bufferIndex++] = inputData[i];
                
                if (this.bufferIndex >= this.bufferSize) {
                  // 将Float32Array转换为Int16Array (PCM 16bit)
                  const pcmBuffer = new Int16Array(this.bufferSize);
                  for (let j = 0; j < this.bufferSize; j++) {
                    // 限制在-1到1之间，然后转换为16位整数
                    const sample = Math.max(-1, Math.min(1, this.buffer[j]));
                    pcmBuffer[j] = sample * 0x7FFF;
                  }
                  
                  // 发送PCM数据
                  this.port.postMessage({
                    type: 'audioData',
                    data: pcmBuffer.buffer
                  });
                  
                  this.bufferIndex = 0;
                }
              }
            }
            
            return true;
          }
        }

        registerProcessor('pcm-processor', PCMProcessor);
      `;

      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      
      await this.audioContext!.audioWorklet.addModule(workletUrl);
      
      // 创建AudioWorkletNode
      this.processor = new AudioWorkletNode(this.audioContext!, 'pcm-processor');
      
      // 监听PCM数据
      this.processor.port.onmessage = (event) => {
        if (event.data.type === 'audioData') {
          console.log(`🎵 AudioWorklet生成PCM数据: ${event.data.data.byteLength} bytes`);
          this.onAudioData?.(event.data.data);
        }
      };

      // 连接音频节点
      this.source!.connect(this.analyser!);
      this.analyser!.connect(this.processor);
      
      console.log('✅ AudioWorklet处理器设置完成');
      
    } catch (error) {
      console.error('❌ AudioWorklet设置失败，降级到ScriptProcessor:', error);
      this.setupScriptProcessor();
    }
  }

  /**
   * 设置ScriptProcessorNode (兼容性方式)
   */
  private setupScriptProcessor() {
    const bufferSize = 1024;
    this.processor = this.audioContext!.createScriptProcessor(bufferSize, 1, 1);
    
    this.processor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer;
      const inputData = inputBuffer.getChannelData(0);
      
      // 将Float32Array转换为Int16Array (PCM 16bit)
      const pcmBuffer = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        // 限制在-1到1之间，然后转换为16位整数
        const sample = Math.max(-1, Math.min(1, inputData[i]));
        pcmBuffer[i] = sample * 0x7FFF;
      }
      
      this.onAudioData?.(pcmBuffer.buffer);
    };

    // 连接音频节点
    this.source!.connect(this.analyser!);
    this.analyser!.connect(this.processor);
    this.processor.connect(this.audioContext!.destination);
    
    console.log('✅ ScriptProcessor处理器设置完成');
  }

  /**
   * 停止音频处理
   */
  stopProcessing() {
    if (!this.isProcessing) return;

    try {
      // 断开连接
      if (this.source) {
        this.source.disconnect();
        this.source = null;
      }

      if (this.analyser) {
        this.analyser.disconnect();
        this.analyser = null;
      }

      if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
      }

      this.isProcessing = false;
      this.onAudioData = undefined;
      
      console.log('✅ 音频处理器已停止');
    } catch (error) {
      console.error('❌ 停止音频处理器失败:', error);
    }
  }

  /**
   * 获取音频分析数据
   */
  getAnalyserData(): { frequencyData: Uint8Array; timeData: Uint8Array } | null {
    if (!this.analyser) return null;

    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    const timeData = new Uint8Array(this.analyser.frequencyBinCount);
    
    this.analyser.getByteFrequencyData(frequencyData);
    this.analyser.getByteTimeDomainData(timeData);

    return { frequencyData, timeData };
  }

  /**
   * 清理资源
   */
  destroy() {
    this.stopProcessing();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      isInitialized: !!this.audioContext,
      isProcessing: this.isProcessing,
      sampleRate: this.audioContext?.sampleRate || 0,
      state: this.audioContext?.state || 'closed',
      config: this.config
    };
  }
}

/**
 * 音频格式转换工具函数
 */
export class AudioConverter {
  /**
   * 将WebM音频转换为PCM
   */
  static async webmToPcm(webmBlob: Blob, sampleRate: number = 16000): Promise<ArrayBuffer> {
    try {
      const arrayBuffer = await webmBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // 解码音频数据
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // 重采样到目标采样率
      const resampledBuffer = await this.resampleAudioBuffer(audioBuffer, sampleRate);
      
      // 转换为PCM 16位
      const pcmData = this.audioBufferToPcm16(resampledBuffer);
      
      audioContext.close();
      return pcmData;
      
    } catch (error) {
      console.error('❌ WebM转PCM失败:', error);
      throw error;
    }
  }

  /**
   * 重采样AudioBuffer
   */
  private static async resampleAudioBuffer(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
    if (audioBuffer.sampleRate === targetSampleRate) {
      return audioBuffer;
    }

    const offlineContext = new OfflineAudioContext(
      1, // 单声道
      Math.ceil(audioBuffer.duration * targetSampleRate),
      targetSampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();

    return await offlineContext.startRendering();
  }

  /**
   * 将AudioBuffer转换为PCM 16位数据
   */
  private static audioBufferToPcm16(audioBuffer: AudioBuffer): ArrayBuffer {
    const length = audioBuffer.length;
    const pcmData = new Int16Array(length);
    const channelData = audioBuffer.getChannelData(0); // 只取第一个声道

    for (let i = 0; i < length; i++) {
      // 限制在-1到1之间，然后转换为16位整数
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      pcmData[i] = sample * 0x7FFF;
    }

    return pcmData.buffer;
  }
}