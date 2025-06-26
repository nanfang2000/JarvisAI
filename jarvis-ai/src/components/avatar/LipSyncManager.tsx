import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, Switch, FormControlLabel, Slider, Typography, Paper } from '@mui/material';
import { 
  LipSyncConfig, 
  LipSyncData, 
  Viseme, 
  AudioAnalysisResult, 
  VoiceAnalysis,
  BlendShape 
} from '../../types/avatar';
import { AudioAnalyzer } from '../../services/avatarService';

interface LipSyncManagerProps {
  audioSource?: MediaStreamAudioSourceNode | AudioBufferSourceNode;
  onLipSyncData?: (data: AudioAnalysisResult) => void;
  config?: Partial<LipSyncConfig>;
  isActive?: boolean;
  onActiveChange?: (active: boolean) => void;
}

// 音素识别器类
class PhonemeRecognizer {
  private formantAnalyzer: FormantAnalyzer;
  
  constructor() {
    this.formantAnalyzer = new FormantAnalyzer();
  }

  recognizePhonemes(audioData: Float32Array, sampleRate: number): string[] {
    const formants = this.formantAnalyzer.extractFormants(audioData, sampleRate);
    return this.mapFormantsToPhonemes(formants);
  }

  private mapFormantsToPhonemes(formants: number[]): string[] {
    const [f1, f2, f3] = formants;
    const phonemes: string[] = [];

    // 基于前两个共振峰的音素分类
    if (f1 < 400 && f2 < 1200) {
      phonemes.push('u', 'o'); // 后元音
    } else if (f1 < 400 && f2 > 2000) {
      phonemes.push('i', 'e'); // 前元音
    } else if (f1 > 600 && f2 < 1400) {
      phonemes.push('a'); // 开元音
    } else if (f2 - f1 < 500) {
      phonemes.push('m', 'n', 'ng'); // 鼻音
    } else if (f3 > 2500) {
      phonemes.push('s', 'sh', 'f'); // 擦音
    } else {
      phonemes.push('t', 'd', 'k', 'g'); // 塞音
    }

    return phonemes;
  }
}

// 共振峰分析器
class FormantAnalyzer {
  extractFormants(audioData: Float32Array, sampleRate: number): number[] {
    const lpcCoeffs = this.lpcAnalysis(audioData, 12);
    const roots = this.findRoots(lpcCoeffs);
    const formants = this.rootsToFormants(roots, sampleRate);
    
    return formants.slice(0, 3); // 返回前三个共振峰
  }

  private lpcAnalysis(signal: Float32Array, order: number): Float32Array {
    // 简化的线性预测编码分析
    const autocorr = new Float32Array(order + 1);
    
    // 计算自相关
    for (let i = 0; i <= order; i++) {
      let sum = 0;
      for (let j = 0; j < signal.length - i; j++) {
        sum += signal[j] * signal[j + i];
      }
      autocorr[i] = sum;
    }

    // Levinson-Durbin算法
    const lpc = new Float32Array(order + 1);
    const reflection = new Float32Array(order);
    
    if (autocorr[0] === 0) return lpc;
    
    lpc[0] = 1;
    let error = autocorr[0];

    for (let i = 1; i <= order; i++) {
      let sum = 0;
      for (let j = 1; j < i; j++) {
        sum += lpc[j] * autocorr[i - j];
      }
      
      reflection[i - 1] = -(autocorr[i] + sum) / error;
      lpc[i] = reflection[i - 1];
      
      for (let j = 1; j < i; j++) {
        lpc[j] += reflection[i - 1] * lpc[i - j];
      }
      
      error *= (1 - reflection[i - 1] * reflection[i - 1]);
    }

    return lpc;
  }

  private findRoots(coeffs: Float32Array): Complex[] {
    // 简化的根查找算法
    const roots: Complex[] = [];
    const n = coeffs.length - 1;
    
    // 使用简化方法查找复数根
    for (let i = 1; i <= n; i++) {
      const angle = (2 * Math.PI * i) / (2 * n);
      const real = Math.cos(angle);
      const imag = Math.sin(angle);
      
      if (imag > 0) { // 只考虑上半平面的根
        roots.push({ real, imag });
      }
    }
    
    return roots;
  }

  private rootsToFormants(roots: Complex[], sampleRate: number): number[] {
    return roots
      .filter(root => root.imag > 0) // 只考虑上半平面
      .map(root => {
        const freq = Math.atan2(root.imag, root.real) * sampleRate / (2 * Math.PI);
        return Math.abs(freq);
      })
      .sort((a, b) => a - b)
      .filter(freq => freq > 90 && freq < sampleRate / 2); // 过滤合理的频率范围
  }
}

interface Complex {
  real: number;
  imag: number;
}

// 口型同步引擎
class LipSyncEngine {
  private phonemeRecognizer: PhonemeRecognizer;
  private visemeMapping: Map<string, string>;
  private smoothingBuffer: number[] = [];
  private readonly SMOOTHING_WINDOW = 5;
  
  constructor() {
    this.phonemeRecognizer = new PhonemeRecognizer();
    this.initVisemeMapping();
  }

  private initVisemeMapping() {
    this.visemeMapping = new Map([
      // 元音
      ['a', 'mouthOpen'],
      ['e', 'mouthSmile'],
      ['i', 'mouthSmile'],
      ['o', 'mouthPucker'],
      ['u', 'mouthPucker'],
      
      // 辅音
      ['p', 'mouthClose'],
      ['b', 'mouthClose'],
      ['m', 'mouthClose'],
      ['f', 'mouthFunnel'],
      ['v', 'mouthFunnel'],
      ['t', 'mouthOpen'],
      ['d', 'mouthOpen'],
      ['s', 'mouthSmile'],
      ['z', 'mouthSmile'],
      ['sh', 'mouthPucker'],
      ['ch', 'mouthPucker'],
      ['j', 'mouthPucker'],
      ['k', 'mouthOpen'],
      ['g', 'mouthOpen'],
      ['n', 'mouthOpen'],
      ['l', 'mouthOpen'],
      ['r', 'mouthPucker'],
      ['w', 'mouthPucker'],
      ['y', 'mouthSmile'],
      ['h', 'mouthOpen']
    ]);
  }

  processAudio(audioData: Float32Array, sampleRate: number): BlendShape[] {
    // 识别音素
    const phonemes = this.phonemeRecognizer.recognizePhonemes(audioData, sampleRate);
    
    // 计算音量
    const volume = this.calculateVolume(audioData);
    
    // 应用平滑
    const smoothedVolume = this.applySmoothng(volume);
    
    // 生成口型混合形状
    return this.generateBlendShapes(phonemes, smoothedVolume);
  }

  private calculateVolume(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  private applySmoothng(value: number): number {
    this.smoothingBuffer.push(value);
    
    if (this.smoothingBuffer.length > this.SMOOTHING_WINDOW) {
      this.smoothingBuffer.shift();
    }
    
    return this.smoothingBuffer.reduce((sum, v) => sum + v, 0) / this.smoothingBuffer.length;
  }

  private generateBlendShapes(phonemes: string[], volume: number): BlendShape[] {
    const blendShapes: BlendShape[] = [];
    
    // 基础口型开合
    blendShapes.push({
      name: 'mouthOpen',
      value: Math.min(volume * 2, 1)
    });

    // 基于音素的精确口型
    if (phonemes.length > 0) {
      const primaryPhoneme = phonemes[0];
      const viseme = this.visemeMapping.get(primaryPhoneme);
      
      if (viseme && viseme !== 'mouthOpen') {
        blendShapes.push({
          name: viseme,
          value: Math.min(volume * 1.5, 1)
        });
      }
    }

    return blendShapes;
  }
}

// 主要的LipSyncManager组件
const LipSyncManager: React.FC<LipSyncManagerProps> = ({
  audioSource,
  onLipSyncData,
  config = {},
  isActive = false,
  onActiveChange
}) => {
  const [lipSyncConfig, setLipSyncConfig] = useState<LipSyncConfig>({
    sensitivity: 1.0,
    smoothing: 0.3,
    amplitude: 1.2,
    enabled: isActive,
    ...config
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [currentPhonemes, setCurrentPhonemes] = useState<string[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const lipSyncEngineRef = useRef<LipSyncEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // 初始化音频处理
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (!analyzerRef.current) {
      analyzerRef.current = new AudioAnalyzer(audioContextRef.current);
    }

    if (!lipSyncEngineRef.current) {
      lipSyncEngineRef.current = new LipSyncEngine();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
    };
  }, []);

  // 音频源变化处理
  useEffect(() => {
    if (audioSource && analyzerRef.current && lipSyncConfig.enabled) {
      startLipSync();
    } else {
      stopLipSync();
    }
  }, [audioSource, lipSyncConfig.enabled]);

  // 开始嘴型同步
  const startLipSync = useCallback(() => {
    if (!audioContextRef.current || !analyzerRef.current || !lipSyncEngineRef.current || !audioSource) {
      return;
    }

    setIsProcessing(true);

    // 连接音频源
    analyzerRef.current.connectSource(audioSource);

    // 创建音频处理器
    processorRef.current = audioContextRef.current.createScriptProcessor(2048, 1, 1);
    
    processorRef.current.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const sampleRate = audioContextRef.current!.sampleRate;
      
      // 处理音频数据
      const blendShapes = lipSyncEngineRef.current!.processAudio(inputData, sampleRate);
      
      // 分析音频
      const analysisResult = analyzerRef.current!.analyze();
      setCurrentVolume(analysisResult.volume);
      
      // 应用配置参数
      const adjustedResult = {
        ...analysisResult,
        volume: analysisResult.volume * lipSyncConfig.amplitude,
        phonemes: currentPhonemes
      };

      // 发送数据到父组件
      if (onLipSyncData) {
        onLipSyncData(adjustedResult);
      }
    };

    // 连接处理器
    audioSource.connect(processorRef.current);
    processorRef.current.connect(audioContextRef.current.destination);

  }, [audioSource, lipSyncConfig, onLipSyncData, currentPhonemes]);

  // 停止嘴型同步
  const stopLipSync = useCallback(() => {
    setIsProcessing(false);
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // 处理配置变化
  const handleConfigChange = useCallback((key: keyof LipSyncConfig, value: any) => {
    setLipSyncConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  // 处理激活状态变化
  const handleActiveChange = useCallback((active: boolean) => {
    handleConfigChange('enabled', active);
    if (onActiveChange) {
      onActiveChange(active);
    }
  }, [handleConfigChange, onActiveChange]);

  return (
    <Paper elevation={3} sx={{ p: 2, m: 1 }}>
      <Typography variant="h6" gutterBottom>
        Lip Sync Manager
      </Typography>

      {/* 激活开关 */}
      <FormControlLabel
        control={
          <Switch
            checked={lipSyncConfig.enabled}
            onChange={(e) => handleActiveChange(e.target.checked)}
            color="primary"
          />
        }
        label="Enable Lip Sync"
      />

      {/* 配置控制 */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Sensitivity
        </Typography>
        <Slider
          value={lipSyncConfig.sensitivity}
          onChange={(_, value) => handleConfigChange('sensitivity', value)}
          min={0.1}
          max={2.0}
          step={0.1}
          valueLabelDisplay="auto"
          disabled={!lipSyncConfig.enabled}
        />

        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          Smoothing
        </Typography>
        <Slider
          value={lipSyncConfig.smoothing}
          onChange={(_, value) => handleConfigChange('smoothing', value)}
          min={0}
          max={1}
          step={0.1}
          valueLabelDisplay="auto"
          disabled={!lipSyncConfig.enabled}
        />

        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          Amplitude
        </Typography>
        <Slider
          value={lipSyncConfig.amplitude}
          onChange={(_, value) => handleConfigChange('amplitude', value)}
          min={0.5}
          max={3.0}
          step={0.1}
          valueLabelDisplay="auto"
          disabled={!lipSyncConfig.enabled}
        />
      </Box>

      {/* 状态显示 */}
      <Box sx={{ mt: 2, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="body2">
          Status: {isProcessing ? 'Processing' : 'Idle'}
        </Typography>
        <Typography variant="body2">
          Volume: {(currentVolume * 100).toFixed(1)}%
        </Typography>
        {currentPhonemes.length > 0 && (
          <Typography variant="body2">
            Phonemes: {currentPhonemes.join(', ')}
          </Typography>
        )}
      </Box>

      {/* 实时音量显示 */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2">
          Real-time Volume
        </Typography>
        <Box sx={{ 
          width: '100%', 
          height: 20, 
          bgcolor: 'grey.300', 
          borderRadius: 1,
          overflow: 'hidden'
        }}>
          <Box sx={{
            width: `${currentVolume * 100}%`,
            height: '100%',
            bgcolor: lipSyncConfig.enabled ? 'primary.main' : 'grey.500',
            transition: 'width 0.1s ease-out'
          }} />
        </Box>
      </Box>
    </Paper>
  );
};

export default LipSyncManager;