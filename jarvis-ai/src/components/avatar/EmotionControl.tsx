import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Slider,
  Button,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  SentimentVeryDissatisfied,
  SentimentDissatisfied,
  SentimentNeutral,
  SentimentSatisfied,
  SentimentVerySatisfied,
  Psychology,
  RecordVoiceOver,
  Face,
  Shuffle,
  PlayArrow,
  Stop
} from '@mui/icons-material';
import { EmotionType, EmotionConfig, BlendShape } from '../../types/avatar';

interface EmotionControlProps {
  currentEmotion: EmotionType;
  onEmotionChange: (emotion: EmotionType, intensity?: number) => void;
  onBlendShapeChange?: (shapes: BlendShape[]) => void;
  isAutoMode?: boolean;
  onAutoModeChange?: (enabled: boolean) => void;
  textInput?: string; // 用于情感分析的文本
  voiceAnalysis?: {
    pitch: number;
    energy: number;
    sentiment?: number;
  };
}

// 情感配置映射
const EMOTION_CONFIGS: Record<EmotionType, {
  icon: React.ReactNode;
  color: string;
  description: string;
  intensity: number;
  blendShapes: Record<string, number>;
}> = {
  [EmotionType.NEUTRAL]: {
    icon: <SentimentNeutral />,
    color: '#9e9e9e',
    description: 'Calm and composed',
    intensity: 0.0,
    blendShapes: {}
  },
  [EmotionType.HAPPY]: {
    icon: <SentimentVerySatisfied />,
    color: '#4caf50',
    description: 'Joyful and cheerful',
    intensity: 0.8,
    blendShapes: {
      'mouthSmile': 0.8,
      'eyeSquintLeft': 0.3,
      'eyeSquintRight': 0.3,
      'cheekPuff': 0.2,
      'browUpLeft': 0.1,
      'browUpRight': 0.1
    }
  },
  [EmotionType.SAD]: {
    icon: <SentimentVeryDissatisfied />,
    color: '#2196f3',
    description: 'Melancholy and downcast',
    intensity: 0.6,
    blendShapes: {
      'mouthFrown': 0.6,
      'eyeBlinkLeft': 0.4,
      'eyeBlinkRight': 0.4,
      'browDownLeft': 0.5,
      'browDownRight': 0.5,
      'mouthLowerDownLeft': 0.3,
      'mouthLowerDownRight': 0.3
    }
  },
  [EmotionType.ANGRY]: {
    icon: <SentimentDissatisfied />,
    color: '#f44336',
    description: 'Intense and fierce',
    intensity: 0.7,
    blendShapes: {
      'mouthFrown': 0.4,
      'browDownLeft': 0.8,
      'browDownRight': 0.8,
      'eyeSquintLeft': 0.6,
      'eyeSquintRight': 0.6,
      'noseSneerLeft': 0.3,
      'noseSneerRight': 0.3
    }
  },
  [EmotionType.SURPRISED]: {
    icon: <Face />,
    color: '#ff9800',
    description: 'Amazed and astonished',
    intensity: 0.8,
    blendShapes: {
      'mouthOpen': 0.6,
      'eyeWideLeft': 0.8,
      'eyeWideRight': 0.8,
      'browUpLeft': 0.7,
      'browUpRight': 0.7,
      'jawOpen': 0.4
    }
  },
  [EmotionType.EXCITED]: {
    icon: <SentimentSatisfied />,
    color: '#ff5722',
    description: 'Energetic and enthusiastic',
    intensity: 0.9,
    blendShapes: {
      'mouthSmile': 0.9,
      'eyeWideLeft': 0.6,
      'eyeWideRight': 0.6,
      'browUpLeft': 0.5,
      'browUpRight': 0.5,
      'cheekPuff': 0.4,
      'mouthOpen': 0.2
    }
  },
  [EmotionType.FEAR]: {
    icon: <Face />,
    color: '#9c27b0',
    description: 'Anxious and worried',
    intensity: 0.6,
    blendShapes: {
      'eyeWideLeft': 0.6,
      'eyeWideRight': 0.6,
      'browUpLeft': 0.5,
      'browUpRight': 0.5,
      'browInnerUp': 0.4,
      'mouthOpen': 0.3
    }
  },
  [EmotionType.DISGUSTED]: {
    icon: <Face />,
    color: '#795548',
    description: 'Repulsed and disgusted',
    intensity: 0.5,
    blendShapes: {
      'noseSneerLeft': 0.6,
      'noseSneerRight': 0.6,
      'mouthFrown': 0.4,
      'eyeSquintLeft': 0.3,
      'eyeSquintRight': 0.3,
      'browDownLeft': 0.2,
      'browDownRight': 0.2
    }
  },
  [EmotionType.THINKING]: {
    icon: <Psychology />,
    color: '#673ab7',
    description: 'Contemplative and focused',
    intensity: 0.4,
    blendShapes: {
      'mouthPucker': 0.3,
      'eyeSquintLeft': 0.2,
      'browDownLeft': 0.3,
      'browUpRight': 0.2,
      'eyeLookUpLeft': 0.1,
      'eyeLookUpRight': 0.1
    }
  },
  [EmotionType.SPEAKING]: {
    icon: <RecordVoiceOver />,
    color: '#00bcd4',
    description: 'Engaged in conversation',
    intensity: 0.3,
    blendShapes: {
      'mouthOpen': 0.3,
      'eyeWideLeft': 0.1,
      'eyeWideRight': 0.1,
      'browUpLeft': 0.05,
      'browUpRight': 0.05
    }
  }
};

// 情感转换动画器
class EmotionAnimator {
  private currentBlendShapes: Map<string, number> = new Map();
  private targetBlendShapes: Map<string, number> = new Map();
  private animationSpeed: number = 0.1;
  private isAnimating: boolean = false;

  setTarget(emotion: EmotionType, intensity: number = 1) {
    const config = EMOTION_CONFIGS[emotion];
    this.targetBlendShapes.clear();
    
    Object.entries(config.blendShapes).forEach(([shape, value]) => {
      this.targetBlendShapes.set(shape, value * intensity);
    });
  }

  update(): BlendShape[] {
    const blendShapes: BlendShape[] = [];
    let hasChanges = false;

    // 插值到目标值
    this.targetBlendShapes.forEach((target, shape) => {
      const current = this.currentBlendShapes.get(shape) || 0;
      const diff = target - current;
      
      if (Math.abs(diff) > 0.001) {
        const newValue = current + diff * this.animationSpeed;
        this.currentBlendShapes.set(shape, newValue);
        blendShapes.push({ name: shape, value: newValue });
        hasChanges = true;
      } else {
        this.currentBlendShapes.set(shape, target);
        blendShapes.push({ name: shape, value: target });
      }
    });

    // 衰减未在目标中的形状
    this.currentBlendShapes.forEach((current, shape) => {
      if (!this.targetBlendShapes.has(shape) && current > 0) {
        const newValue = Math.max(0, current - this.animationSpeed);
        this.currentBlendShapes.set(shape, newValue);
        
        if (newValue > 0) {
          blendShapes.push({ name: shape, value: newValue });
          hasChanges = true;
        }
      }
    });

    this.isAnimating = hasChanges;
    return blendShapes;
  }

  getIsAnimating(): boolean {
    return this.isAnimating;
  }

  setAnimationSpeed(speed: number) {
    this.animationSpeed = Math.max(0.01, Math.min(1, speed));
  }
}

// 文本情感分析器
class TextEmotionAnalyzer {
  private emotionKeywords: Record<EmotionType, string[]> = {
    [EmotionType.HAPPY]: ['happy', 'joy', 'excited', 'great', 'wonderful', 'amazing', 'love', 'smile', 'laugh'],
    [EmotionType.SAD]: ['sad', 'depressed', 'down', 'unhappy', 'disappointed', 'upset', 'cry', 'tear'],
    [EmotionType.ANGRY]: ['angry', 'mad', 'furious', 'annoyed', 'frustrated', 'hate', 'rage', 'irritated'],
    [EmotionType.SURPRISED]: ['surprised', 'shocked', 'amazed', 'wow', 'incredible', 'unbelievable', 'astonished'],
    [EmotionType.EXCITED]: ['excited', 'thrilled', 'enthusiastic', 'energetic', 'pumped', 'exhilarated', 'elated'],
    [EmotionType.FEAR]: ['afraid', 'scared', 'fear', 'worried', 'anxious', 'nervous', 'terrified', 'panic'],
    [EmotionType.DISGUSTED]: ['disgusted', 'gross', 'yuck', 'eww', 'repulsive', 'horrible'],
    [EmotionType.THINKING]: ['think', 'consider', 'ponder', 'wonder', 'hmm', 'maybe', 'perhaps', 'analyze'],
    [EmotionType.SPEAKING]: ['say', 'tell', 'speak', 'talk', 'explain', 'discuss', 'mention'],
    [EmotionType.NEUTRAL]: []
  };

  analyzeText(text: string): { emotion: EmotionType; confidence: number } {
    if (!text.trim()) {
      return { emotion: EmotionType.NEUTRAL, confidence: 1.0 };
    }

    const words = text.toLowerCase().split(/\s+/);
    const scores: Record<EmotionType, number> = {
      [EmotionType.NEUTRAL]: 0,
      [EmotionType.HAPPY]: 0,
      [EmotionType.SAD]: 0,
      [EmotionType.ANGRY]: 0,
      [EmotionType.SURPRISED]: 0,
      [EmotionType.EXCITED]: 0,
      [EmotionType.FEAR]: 0,
      [EmotionType.DISGUSTED]: 0,
      [EmotionType.THINKING]: 0,
      [EmotionType.SPEAKING]: 0
    };

    // 计算每种情感的得分
    Object.entries(this.emotionKeywords).forEach(([emotion, keywords]) => {
      keywords.forEach(keyword => {
        const count = words.filter(word => word.includes(keyword)).length;
        scores[emotion as EmotionType] += count;
      });
    });

    // 找到得分最高的情感
    let maxEmotion = EmotionType.NEUTRAL;
    let maxScore = 0;

    Object.entries(scores).forEach(([emotion, score]) => {
      if (score > maxScore) {
        maxScore = score;
        maxEmotion = emotion as EmotionType;
      }
    });

    const confidence = Math.min(maxScore / Math.max(words.length / 4, 1), 1.0);
    return { emotion: maxEmotion, confidence };
  }
}

// 主要的EmotionControl组件
const EmotionControl: React.FC<EmotionControlProps> = ({
  currentEmotion,
  onEmotionChange,
  onBlendShapeChange,
  isAutoMode = false,
  onAutoModeChange,
  textInput = '',
  voiceAnalysis
}) => {
  const [intensity, setIntensity] = useState(1.0);
  const [animationSpeed, setAnimationSpeed] = useState(0.1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoDetectedEmotion, setAutoDetectedEmotion] = useState<EmotionType>(EmotionType.NEUTRAL);
  const [confidence, setConfidence] = useState(0);

  const animatorRef = useRef(new EmotionAnimator());
  const textAnalyzerRef = useRef(new TextEmotionAnalyzer());
  const animationFrameRef = useRef<number | null>(null);

  // 动画循环
  const animate = useCallback(() => {
    if (isPlaying) {
      const blendShapes = animatorRef.current.update();
      
      if (onBlendShapeChange) {
        onBlendShapeChange(blendShapes);
      }

      if (animatorRef.current.getIsAnimating()) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
      }
    }
  }, [isPlaying, onBlendShapeChange]);

  // 开始动画
  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, animate]);

  // 设置动画目标
  useEffect(() => {
    animatorRef.current.setTarget(currentEmotion, intensity);
    animatorRef.current.setAnimationSpeed(animationSpeed);
    
    if (!isPlaying) {
      setIsPlaying(true);
    }
  }, [currentEmotion, intensity, animationSpeed]);

  // 文本情感分析
  useEffect(() => {
    if (isAutoMode && textInput) {
      const result = textAnalyzerRef.current.analyzeText(textInput);
      setAutoDetectedEmotion(result.emotion);
      setConfidence(result.confidence);
      
      if (result.confidence > 0.3) {
        onEmotionChange(result.emotion, result.confidence);
      }
    }
  }, [textInput, isAutoMode, onEmotionChange]);

  // 语音情感分析
  useEffect(() => {
    if (isAutoMode && voiceAnalysis) {
      const { pitch, energy, sentiment } = voiceAnalysis;
      
      let detectedEmotion = EmotionType.NEUTRAL;
      
      if (energy > 0.7 && pitch > 200) {
        detectedEmotion = EmotionType.EXCITED;
      } else if (energy > 0.5) {
        detectedEmotion = EmotionType.HAPPY;
      } else if (energy < 0.2) {
        detectedEmotion = EmotionType.SAD;
      } else if (pitch < 100) {
        detectedEmotion = EmotionType.ANGRY;
      }
      
      if (sentiment !== undefined) {
        if (sentiment > 0.6) detectedEmotion = EmotionType.HAPPY;
        else if (sentiment < -0.6) detectedEmotion = EmotionType.SAD;
        else if (sentiment < -0.3) detectedEmotion = EmotionType.ANGRY;
      }

      setAutoDetectedEmotion(detectedEmotion);
      onEmotionChange(detectedEmotion, energy);
    }
  }, [voiceAnalysis, isAutoMode, onEmotionChange]);

  // 处理情感变化
  const handleEmotionClick = useCallback((emotion: EmotionType) => {
    onEmotionChange(emotion, intensity);
  }, [onEmotionChange, intensity]);

  // 随机情感
  const handleRandomEmotion = useCallback(() => {
    const emotions = Object.values(EmotionType).filter(e => e !== EmotionType.NEUTRAL);
    const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
    const randomIntensity = 0.5 + Math.random() * 0.5;
    
    setIntensity(randomIntensity);
    onEmotionChange(randomEmotion, randomIntensity);
  }, [onEmotionChange]);

  return (
    <Card sx={{ maxWidth: '100%', m: 1 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Emotion Control
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Random Emotion">
              <IconButton onClick={handleRandomEmotion} size="small">
                <Shuffle />
              </IconButton>
            </Tooltip>
            
            <Tooltip title={isPlaying ? "Stop Animation" : "Start Animation"}>
              <IconButton 
                onClick={() => setIsPlaying(!isPlaying)} 
                size="small"
                color={isPlaying ? "secondary" : "primary"}
              >
                {isPlaying ? <Stop /> : <PlayArrow />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* 自动模式开关 */}
        <FormControlLabel
          control={
            <Switch
              checked={isAutoMode}
              onChange={(e) => onAutoModeChange?.(e.target.checked)}
              color="primary"
            />
          }
          label="Auto Emotion Detection"
          sx={{ mb: 2 }}
        />

        {/* 自动检测状态 */}
        {isAutoMode && (
          <Box sx={{ mb: 2, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Typography variant="body2" gutterBottom>
              Auto-detected: 
              <Chip 
                icon={EMOTION_CONFIGS[autoDetectedEmotion].icon}
                label={autoDetectedEmotion}
                size="small"
                sx={{ ml: 1, bgcolor: EMOTION_CONFIGS[autoDetectedEmotion].color }}
              />
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={confidence * 100} 
              sx={{ mt: 1 }}
            />
            <Typography variant="caption" color="text.secondary">
              Confidence: {(confidence * 100).toFixed(1)}%
            </Typography>
          </Box>
        )}

        {/* 情感选择网格 */}
        <Grid container spacing={1} sx={{ mb: 3 }}>
          {Object.entries(EMOTION_CONFIGS).map(([emotion, config]) => (
            <Grid item xs={4} sm={3} key={emotion}>
              <Button
                variant={currentEmotion === emotion ? 'contained' : 'outlined'}
                fullWidth
                onClick={() => handleEmotionClick(emotion as EmotionType)}
                startIcon={config.icon}
                sx={{ 
                  minHeight: 60,
                  bgcolor: currentEmotion === emotion ? config.color : 'transparent',
                  borderColor: config.color,
                  color: currentEmotion === emotion ? 'white' : config.color,
                  '&:hover': {
                    bgcolor: config.color,
                    color: 'white'
                  }
                }}
              >
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" display="block">
                    {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                  </Typography>
                </Box>
              </Button>
            </Grid>
          ))}
        </Grid>

        {/* 当前情感信息 */}
        <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Current Emotion: {currentEmotion.charAt(0).toUpperCase() + currentEmotion.slice(1)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {EMOTION_CONFIGS[currentEmotion].description}
          </Typography>
        </Box>

        {/* 强度控制 */}
        <Typography variant="subtitle2" gutterBottom>
          Intensity
        </Typography>
        <Slider
          value={intensity}
          onChange={(_, value) => setIntensity(value as number)}
          min={0}
          max={1}
          step={0.1}
          valueLabelDisplay="auto"
          sx={{ mb: 2 }}
        />

        {/* 动画速度控制 */}
        <Typography variant="subtitle2" gutterBottom>
          Animation Speed
        </Typography>
        <Slider
          value={animationSpeed}
          onChange={(_, value) => setAnimationSpeed(value as number)}
          min={0.01}
          max={0.5}
          step={0.01}
          valueLabelDisplay="auto"
          sx={{ mb: 2 }}
        />

        {/* 状态指示器 */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          p: 1, 
          bgcolor: 'action.hover', 
          borderRadius: 1 
        }}>
          <Typography variant="caption">
            Animation: {isPlaying ? 'Running' : 'Stopped'}
          </Typography>
          <Typography variant="caption">
            Intensity: {(intensity * 100).toFixed(0)}%
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default EmotionControl;