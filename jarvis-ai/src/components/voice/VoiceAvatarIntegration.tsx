import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Card, CardContent, Typography, Button, IconButton, Tooltip } from '@mui/material';
import { Mic, MicOff, VolumeUp, VolumeOff, Settings } from '@mui/icons-material';
import { AvatarManager } from '../avatar';
import { EmotionType, AudioAnalysisResult } from '../../types/avatar';

interface VoiceAvatarIntegrationProps {
  onVoiceInput?: (text: string) => void;
  onVoiceOutput?: (text: string) => void;
  currentText?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  onListeningChange?: (listening: boolean) => void;
  onSpeakingChange?: (speaking: boolean) => void;
}

// 语音识别服务
class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;

  constructor() {
    this.initializeSpeechRecognition();
  }

  private initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }
  }

  async startListening(
    onResult: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void
  ): Promise<MediaStreamAudioSourceNode | null> {
    if (!this.recognition) {
      onError('Speech recognition not supported');
      return null;
    }

    try {
      // 获取麦克风权限
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 创建音频上下文
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.audioSource = this.audioContext.createMediaStreamSource(this.mediaStream);

      // 配置语音识别
      this.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        onResult(currentText, !!finalTranscript);
      };

      this.recognition.onerror = (event) => {
        onError(`Speech recognition error: ${event.error}`);
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };

      // 开始识别
      this.recognition.start();
      this.isListening = true;

      return this.audioSource;
    } catch (error) {
      onError(`Failed to start speech recognition: ${error}`);
      return null;
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.audioSource = null;
  }

  getIsListening(): boolean {
    return this.isListening;
  }
}

// 语音合成服务
class SpeechSynthesisService {
  private synthesis: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private audioContext: AudioContext | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;

  constructor() {
    this.synthesis = window.speechSynthesis;
  }

  async speak(
    text: string,
    voice?: SpeechSynthesisVoice,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (error: string) => void
  ): Promise<MediaStreamAudioSourceNode | null> {
    if (!text.trim()) return null;

    try {
      // 停止当前播放
      this.stop();

      // 创建新的语音
      this.currentUtterance = new SpeechSynthesisUtterance(text);
      
      if (voice) {
        this.currentUtterance.voice = voice;
      }

      this.currentUtterance.rate = 1.0;
      this.currentUtterance.pitch = 1.0;
      this.currentUtterance.volume = 1.0;

      // 设置回调
      this.currentUtterance.onstart = () => {
        if (onStart) onStart();
      };

      this.currentUtterance.onend = () => {
        if (onEnd) onEnd();
        this.currentUtterance = null;
      };

      this.currentUtterance.onerror = (event) => {
        if (onError) onError(`Speech synthesis error: ${event.error}`);
        this.currentUtterance = null;
      };

      // 播放语音
      this.synthesis.speak(this.currentUtterance);

      // 注意：Web Speech API的音频输出无法直接获取AudioNode
      // 这里返回null，实际的嘴型同步需要通过文本分析来实现
      return null;
    } catch (error) {
      if (onError) onError(`Failed to synthesize speech: ${error}`);
      return null;
    }
  }

  stop() {
    if (this.synthesis.speaking) {
      this.synthesis.cancel();
    }
    this.currentUtterance = null;
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.synthesis.getVoices();
  }

  isSpeaking(): boolean {
    return this.synthesis.speaking;
  }
}

// 情感分析服务
class EmotionAnalysisService {
  analyzeTextEmotion(text: string): { emotion: EmotionType; confidence: number } {
    if (!text.trim()) {
      return { emotion: EmotionType.NEUTRAL, confidence: 1.0 };
    }

    const words = text.toLowerCase().split(/\s+/);
    
    // 简单的关键词匹配
    const emotionKeywords = {
      [EmotionType.HAPPY]: ['happy', 'joy', 'excited', 'great', 'wonderful', 'amazing', 'love', 'fantastic', 'excellent'],
      [EmotionType.SAD]: ['sad', 'unhappy', 'disappointed', 'upset', 'depressed', 'sorry', 'unfortunate'],
      [EmotionType.ANGRY]: ['angry', 'mad', 'furious', 'annoyed', 'frustrated', 'hate', 'terrible', 'awful'],
      [EmotionType.SURPRISED]: ['surprised', 'shocked', 'amazed', 'wow', 'incredible', 'unbelievable'],
      [EmotionType.THINKING]: ['think', 'consider', 'maybe', 'perhaps', 'wonder', 'analyze', 'evaluate'],
      [EmotionType.SPEAKING]: ['say', 'tell', 'speak', 'explain', 'discuss', 'talk', 'mention']
    };

    let maxScore = 0;
    let detectedEmotion = EmotionType.NEUTRAL;

    Object.entries(emotionKeywords).forEach(([emotion, keywords]) => {
      const score = keywords.reduce((count, keyword) => {
        return count + words.filter(word => word.includes(keyword)).length;
      }, 0);

      if (score > maxScore) {
        maxScore = score;
        detectedEmotion = emotion as EmotionType;
      }
    });

    const confidence = Math.min(maxScore / Math.max(words.length / 4, 1), 1.0);
    return { emotion: detectedEmotion, confidence };
  }

  analyzeVoiceEmotion(audioAnalysis: AudioAnalysisResult): { emotion: EmotionType; confidence: number } {
    const { volume, pitch, spectralCentroid } = audioAnalysis;

    // 基于音频特征的简单情感分析
    if (volume > 0.7 && pitch > 250) {
      return { emotion: EmotionType.EXCITED, confidence: 0.8 };
    } else if (volume > 0.6 && spectralCentroid > 2000) {
      return { emotion: EmotionType.HAPPY, confidence: 0.7 };
    } else if (volume < 0.3 && pitch < 150) {
      return { emotion: EmotionType.SAD, confidence: 0.6 };
    } else if (volume > 0.8 && pitch < 100) {
      return { emotion: EmotionType.ANGRY, confidence: 0.7 };
    } else if (volume > 0.4) {
      return { emotion: EmotionType.SPEAKING, confidence: 0.5 };
    }

    return { emotion: EmotionType.NEUTRAL, confidence: 0.3 };
  }
}

// 主要的语音头像集成组件
const VoiceAvatarIntegration: React.FC<VoiceAvatarIntegrationProps> = ({
  onVoiceInput,
  onVoiceOutput,
  currentText = '',
  isListening = false,
  isSpeaking = false,
  onListeningChange,
  onSpeakingChange
}) => {
  const [recognizedText, setRecognizedText] = useState('');
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>(EmotionType.NEUTRAL);
  const [audioSource, setAudioSource] = useState<MediaStreamAudioSourceNode | null>(null);
  const [voiceAnalysis, setVoiceAnalysis] = useState<{
    pitch: number;
    energy: number;
    sentiment?: number;
  }>({ pitch: 0, energy: 0 });

  const speechRecognitionRef = useRef<SpeechRecognitionService | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisService | null>(null);
  const emotionAnalysisRef = useRef<EmotionAnalysisService | null>(null);

  // 初始化服务
  useEffect(() => {
    speechRecognitionRef.current = new SpeechRecognitionService();
    speechSynthesisRef.current = new SpeechSynthesisService();
    emotionAnalysisRef.current = new EmotionAnalysisService();

    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stopListening();
      }
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.stop();
      }
    };
  }, []);

  // 开始语音识别
  const startListening = useCallback(async () => {
    if (!speechRecognitionRef.current) return;

    try {
      const audioSrc = await speechRecognitionRef.current.startListening(
        (text, isFinal) => {
          setRecognizedText(text);
          if (isFinal && onVoiceInput) {
            onVoiceInput(text);
          }

          // 分析文本情感
          if (emotionAnalysisRef.current) {
            const { emotion } = emotionAnalysisRef.current.analyzeTextEmotion(text);
            setCurrentEmotion(emotion);
          }
        },
        (error) => {
          console.error('Speech recognition error:', error);
          if (onListeningChange) {
            onListeningChange(false);
          }
        }
      );

      setAudioSource(audioSrc);
      if (onListeningChange) {
        onListeningChange(true);
      }
    } catch (error) {
      console.error('Failed to start listening:', error);
    }
  }, [onVoiceInput, onListeningChange]);

  // 停止语音识别
  const stopListening = useCallback(() => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stopListening();
      setAudioSource(null);
      if (onListeningChange) {
        onListeningChange(false);
      }
    }
  }, [onListeningChange]);

  // 语音合成
  const speakText = useCallback(async (text: string) => {
    if (!speechSynthesisRef.current) return;

    try {
      await speechSynthesisRef.current.speak(
        text,
        undefined,
        () => {
          if (onSpeakingChange) {
            onSpeakingChange(true);
          }
          setCurrentEmotion(EmotionType.SPEAKING);
        },
        () => {
          if (onSpeakingChange) {
            onSpeakingChange(false);
          }
          setCurrentEmotion(EmotionType.NEUTRAL);
        },
        (error) => {
          console.error('Speech synthesis error:', error);
          if (onSpeakingChange) {
            onSpeakingChange(false);
          }
        }
      );

      if (onVoiceOutput) {
        onVoiceOutput(text);
      }

      // 分析文本情感
      if (emotionAnalysisRef.current) {
        const { emotion } = emotionAnalysisRef.current.analyzeTextEmotion(text);
        setCurrentEmotion(emotion);
      }
    } catch (error) {
      console.error('Failed to speak text:', error);
    }
  }, [onVoiceOutput, onSpeakingChange]);

  // 停止语音合成
  const stopSpeaking = useCallback(() => {
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.stop();
      if (onSpeakingChange) {
        onSpeakingChange(false);
      }
      setCurrentEmotion(EmotionType.NEUTRAL);
    }
  }, [onSpeakingChange]);

  // 处理情感变化
  const handleEmotionChange = useCallback((emotion: EmotionType) => {
    setCurrentEmotion(emotion);
  }, []);

  // 外部文本变化时自动朗读
  useEffect(() => {
    if (currentText && currentText !== recognizedText && !isSpeaking) {
      speakText(currentText);
    }
  }, [currentText, recognizedText, isSpeaking, speakText]);

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 语音控制面板 */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              Voice Control
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title={isListening ? "Stop Listening" : "Start Listening"}>
                <IconButton
                  onClick={isListening ? stopListening : startListening}
                  color={isListening ? "secondary" : "primary"}
                  size="large"
                >
                  {isListening ? <MicOff /> : <Mic />}
                </IconButton>
              </Tooltip>
              
              <Tooltip title={isSpeaking ? "Stop Speaking" : "Speak Current Text"}>
                <IconButton
                  onClick={isSpeaking ? stopSpeaking : () => currentText && speakText(currentText)}
                  color={isSpeaking ? "secondary" : "primary"}
                  size="large"
                  disabled={!currentText && !isSpeaking}
                >
                  {isSpeaking ? <VolumeOff /> : <VolumeUp />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* 状态显示 */}
          <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <Typography variant="body2" color={isListening ? 'primary' : 'text.secondary'}>
              Listening: {isListening ? 'ON' : 'OFF'}
            </Typography>
            <Typography variant="body2" color={isSpeaking ? 'secondary' : 'text.secondary'}>
              Speaking: {isSpeaking ? 'ON' : 'OFF'}
            </Typography>
            <Typography variant="body2">
              Emotion: {currentEmotion}
            </Typography>
          </Box>

          {/* 识别的文本显示 */}
          {recognizedText && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Recognized:
              </Typography>
              <Typography variant="body1">
                {recognizedText}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* 3D头像管理器 */}
      <Box sx={{ flex: 1 }}>
        <AvatarManager
          audioSource={audioSource}
          textInput={recognizedText || currentText}
          voiceAnalysis={voiceAnalysis}
          onEmotionChange={handleEmotionChange}
          onAvatarLoad={() => console.log('Avatar loaded')}
          onError={(error) => console.error('Avatar error:', error)}
        />
      </Box>
    </Box>
  );
};

export default VoiceAvatarIntegration;