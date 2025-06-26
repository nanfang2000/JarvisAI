import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  LinearProgress,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Videocam,
  VideocamOff,
  Mic,
  MicOff,
  Settings,
  Psychology,
  Visibility,
  VisibilityOff,
  ThreeDRotation,
  Face,
} from '@mui/icons-material';
import { VoiceAvatarIntegration } from '../voice';
import { EmotionType } from '../../types/avatar';

interface AvatarPanelProps {
  isConnected: boolean;
  jarvisStatus: any;
  onShowNotification: (message: string, severity?: 'info' | 'success' | 'warning' | 'error') => void;
}

interface AvatarState {
  cameraEnabled: boolean;
  micEnabled: boolean;
  isThinking: boolean;
  thinkingProgress: number;
  emotionalState: 'neutral' | 'happy' | 'thinking' | 'listening' | 'speaking';
  lipSyncActive: boolean;
  faceDetected: boolean;
  currentExpression: string;
  show3DAvatar: boolean;
  currentEmotion: EmotionType;
  isListening: boolean;
  isSpeaking: boolean;
  recognizedText: string;
}

const AvatarPanel: React.FC<AvatarPanelProps> = ({
  isConnected,
  jarvisStatus,
  onShowNotification,
}) => {
  const [state, setState] = useState<AvatarState>({
    cameraEnabled: false,
    micEnabled: false,
    isThinking: false,
    thinkingProgress: 0,
    emotionalState: 'neutral',
    lipSyncActive: false,
    faceDetected: false,
    currentExpression: '😊',
    show3DAvatar: true,
    currentEmotion: EmotionType.NEUTRAL,
    isListening: false,
    isSpeaking: false,
    recognizedText: '',
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 处理语音输入
  const handleVoiceInput = (text: string) => {
    setState(prev => ({ 
      ...prev, 
      recognizedText: text,
      emotionalState: 'listening',
      currentEmotion: EmotionType.THINKING
    }));
    console.log('Voice input:', text);
  };

  // 处理语音输出
  const handleVoiceOutput = (text: string) => {
    setState(prev => ({ 
      ...prev, 
      emotionalState: 'speaking',
      currentEmotion: EmotionType.SPEAKING
    }));
    console.log('Voice output:', text);
  };

  // 处理情感变化
  const handleEmotionChange = (emotion: EmotionType) => {
    setState(prev => ({ ...prev, currentEmotion: emotion }));
    
    // 同步到表情状态
    switch (emotion) {
      case EmotionType.HAPPY:
        setState(prev => ({ ...prev, emotionalState: 'happy', currentExpression: '😊' }));
        break;
      case EmotionType.THINKING:
        setState(prev => ({ ...prev, emotionalState: 'thinking', currentExpression: '🤔' }));
        break;
      case EmotionType.SPEAKING:
        setState(prev => ({ ...prev, emotionalState: 'speaking', currentExpression: '💬' }));
        break;
      default:
        setState(prev => ({ ...prev, emotionalState: 'neutral', currentExpression: '😊' }));
    }
  };

  // 处理监听状态变化
  const handleListeningChange = (listening: boolean) => {
    setState(prev => ({ 
      ...prev, 
      isListening: listening,
      emotionalState: listening ? 'listening' : 'neutral',
      currentEmotion: listening ? EmotionType.NEUTRAL : EmotionType.NEUTRAL
    }));
  };

  // 处理说话状态变化
  const handleSpeakingChange = (speaking: boolean) => {
    setState(prev => ({ 
      ...prev, 
      isSpeaking: speaking,
      emotionalState: speaking ? 'speaking' : 'neutral',
      currentEmotion: speaking ? EmotionType.SPEAKING : EmotionType.NEUTRAL,
      lipSyncActive: speaking
    }));
  };

  // 切换3D头像显示
  const toggle3DAvatar = () => {
    setState(prev => ({ ...prev, show3DAvatar: !prev.show3DAvatar }));
    onShowNotification(
      state.show3DAvatar ? '已切换到2D模式' : '已切换到3D头像模式', 
      'info'
    );
  };

  // 摄像头控制
  const toggleCamera = async () => {
    try {
      if (!state.cameraEnabled) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setState(prev => ({ ...prev, cameraEnabled: true }));
        onShowNotification('摄像头已启用', 'success');
      } else {
        if (videoRef.current && videoRef.current.srcObject) {
          const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }
        setState(prev => ({ ...prev, cameraEnabled: false, faceDetected: false }));
        onShowNotification('摄像头已关闭', 'info');
      }
    } catch (error) {
      console.error('摄像头操作失败:', error);
      onShowNotification('摄像头操作失败，请检查权限', 'error');
    }
  };

  // 麦克风控制
  const toggleMic = async () => {
    try {
      if (!state.micEnabled) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setState(prev => ({ ...prev, micEnabled: true }));
        onShowNotification('麦克风已启用', 'success');
      } else {
        setState(prev => ({ ...prev, micEnabled: false }));
        onShowNotification('麦克风已关闭', 'info');
      }
    } catch (error) {
      console.error('麦克风操作失败:', error);
      onShowNotification('麦克风操作失败，请检查权限', 'error');
    }
  };

  // 模拟思考状态
  const simulateThinking = () => {
    setState(prev => ({ ...prev, isThinking: true, emotionalState: 'thinking' }));
    
    const interval = setInterval(() => {
      setState(prev => {
        const newProgress = prev.thinkingProgress + 10;
        if (newProgress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setState(current => ({
              ...current,
              isThinking: false,
              thinkingProgress: 0,
              emotionalState: 'neutral',
            }));
          }, 500);
          return { ...prev, thinkingProgress: 100 };
        }
        return { ...prev, thinkingProgress: newProgress };
      });
    }, 200);
  };

  // 简单的人脸检测模拟
  useEffect(() => {
    if (state.cameraEnabled && videoRef.current) {
      const detectFace = () => {
        // 这里应该集成实际的人脸检测逻辑
        // 目前使用模拟
        const detected = Math.random() > 0.3; // 70%概率检测到人脸
        setState(prev => ({ ...prev, faceDetected: detected }));
      };

      const interval = setInterval(detectFace, 2000);
      return () => clearInterval(interval);
    }
  }, [state.cameraEnabled]);

  // 表情变化动画
  useEffect(() => {
    const expressions = ['😊', '🤔', '👀', '😄', '🙂'];
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (state.emotionalState === 'thinking') {
        setState(prev => ({ ...prev, currentExpression: '🤔' }));
      } else if (state.emotionalState === 'listening') {
        setState(prev => ({ ...prev, currentExpression: '👂' }));
      } else if (state.emotionalState === 'speaking') {
        setState(prev => ({ ...prev, currentExpression: '💬' }));
      } else {
        currentIndex = (currentIndex + 1) % expressions.length;
        setState(prev => ({ ...prev, currentExpression: expressions[currentIndex] }));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [state.emotionalState]);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: 2,
        gap: 2,
      }}
    >
      {/* 标题区域 */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          textAlign: 'center',
          bgcolor: 'rgba(100, 181, 246, 0.1)',
          border: '1px solid rgba(100, 181, 246, 0.3)',
        }}
      >
        <Typography variant="h6" color="primary" gutterBottom>
          JARVIS AI
        </Typography>
        <Typography variant="caption" color="text.secondary">
          您的智能管家小爱
        </Typography>
      </Paper>

      {/* 3D Avatar区域 */}
      <Paper
        elevation={3}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          bgcolor: state.show3DAvatar ? 'black' : 'background.paper',
        }}
      >
        {state.show3DAvatar ? (
          /* 3D头像集成组件 */
          <VoiceAvatarIntegration
            onVoiceInput={handleVoiceInput}
            onVoiceOutput={handleVoiceOutput}
            currentText={state.recognizedText}
            isListening={state.isListening}
            isSpeaking={state.isSpeaking}
            onListeningChange={handleListeningChange}
            onSpeakingChange={handleSpeakingChange}
          />
        ) : (
          /* 传统2D显示 */
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 2,
              height: '100%',
            }}
          >
            <Box
              sx={{
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #64B5F6, #81C784)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 80,
                mb: 2,
                animation: state.isThinking ? 'pulse 1.5s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': {
                    transform: 'scale(1)',
                    opacity: 1,
                  },
                  '50%': {
                    transform: 'scale(1.05)',
                    opacity: 0.8,
                  },
                  '100%': {
                    transform: 'scale(1)',
                    opacity: 1,
                  },
                },
              }}
            >
              {state.currentExpression}
            </Box>
          </Box>
        )}

        {/* 状态指示器 */}
        <Box sx={{ width: '100%', textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {state.isThinking
              ? '深度思考中...'
              : state.emotionalState === 'listening'
              ? '正在聆听...'
              : state.emotionalState === 'speaking'
              ? '正在回复...'
              : '等待指令'}
          </Typography>

          {/* 思考进度条 */}
          {state.isThinking && (
            <LinearProgress
              variant="determinate"
              value={state.thinkingProgress}
              sx={{ mt: 1, borderRadius: 1 }}
            />
          )}

          {/* 嘴型同步指示器 */}
          {state.lipSyncActive && (
            <Box
              sx={{
                mt: 1,
                display: 'flex',
                justifyContent: 'center',
                gap: 0.5,
              }}
            >
              {[1, 2, 3, 4, 5].map((bar) => (
                <Box
                  key={bar}
                  sx={{
                    width: 4,
                    height: Math.random() * 20 + 10,
                    bgcolor: 'primary.main',
                    borderRadius: 1,
                    animation: 'lipSync 0.5s infinite alternate',
                    animationDelay: `${bar * 0.1}s`,
                    '@keyframes lipSync': {
                      '0%': {
                        transform: 'scaleY(0.3)',
                      },
                      '100%': {
                        transform: 'scaleY(1)',
                      },
                    },
                  }}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* 连接状态覆盖层 */}
        {!isConnected && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
            }}
          >
            <Typography variant="h6" color="error" gutterBottom>
              连接中断
            </Typography>
            <Typography variant="body2" color="text.secondary">
              正在尝试重新连接...
            </Typography>
          </Box>
        )}
      </Paper>

      {/* 摄像头预览区域 */}
      {state.cameraEnabled && (
        <Paper
          elevation={2}
          sx={{
            height: 120,
            overflow: 'hidden',
            position: 'relative',
            bgcolor: 'black',
          }}
        >
          <video
            ref={videoRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            muted
          />
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          />
          
          {/* 人脸检测指示器 */}
          {state.faceDetected && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'success.main',
                color: 'white',
                px: 1,
                py: 0.5,
                borderRadius: 1,
                fontSize: 12,
              }}
            >
              人脸已识别
            </Box>
          )}
        </Paper>
      )}

      {/* 控制按钮区域 */}
      <Paper elevation={1} sx={{ p: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 1,
          }}
        >
          {/* 摄像头控制 */}
          <Tooltip title={state.cameraEnabled ? '关闭摄像头' : '开启摄像头'}>
            <IconButton
              onClick={toggleCamera}
              color={state.cameraEnabled ? 'primary' : 'default'}
              sx={{
                bgcolor: state.cameraEnabled ? 'primary.dark' : 'action.hover',
              }}
            >
              {state.cameraEnabled ? <Videocam /> : <VideocamOff />}
            </IconButton>
          </Tooltip>

          {/* 麦克风控制 */}
          <Tooltip title={state.micEnabled ? '关闭麦克风' : '开启麦克风'}>
            <IconButton
              onClick={toggleMic}
              color={state.micEnabled ? 'primary' : 'default'}
              sx={{
                bgcolor: state.micEnabled ? 'primary.dark' : 'action.hover',
              }}
            >
              {state.micEnabled ? <Mic /> : <MicOff />}
            </IconButton>
          </Tooltip>

          {/* 3D头像切换 */}
          <Tooltip title={state.show3DAvatar ? '切换到2D模式' : '切换到3D头像'}>
            <IconButton
              onClick={toggle3DAvatar}
              color={state.show3DAvatar ? 'primary' : 'default'}
              sx={{
                bgcolor: state.show3DAvatar ? 'primary.dark' : 'action.hover',
              }}
            >
              {state.show3DAvatar ? <ThreeDRotation /> : <Face />}
            </IconButton>
          </Tooltip>

          {/* 思考测试按钮 */}
          <Tooltip title="触发深度思考">
            <IconButton
              onClick={simulateThinking}
              disabled={state.isThinking}
              sx={{ gridColumn: 'span 3' }}
            >
              <Psychology />
            </IconButton>
          </Tooltip>
        </Box>

        {/* 状态信息 */}
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            状态: {isConnected ? '在线' : '离线'} | 
            模式: {state.show3DAvatar ? '3D' : '2D'} | 
            摄像头: {state.cameraEnabled ? '开' : '关'} | 
            麦克风: {state.micEnabled ? '开' : '关'}
          </Typography>
          
          <Typography variant="caption" color="text.secondary" display="block">
            语音: {state.isListening ? '监听中' : '待机'} | 
            合成: {state.isSpeaking ? '播放中' : '空闲'} | 
            情感: {state.currentEmotion}
          </Typography>
          
          {state.recognizedText && (
            <Typography variant="caption" color="primary" display="block" sx={{ mt: 0.5 }}>
              识别: {state.recognizedText}
            </Typography>
          )}
          
          {jarvisStatus && (
            <Typography variant="caption" color="text.secondary" display="block">
              对话轮次: {jarvisStatus.conversation_turns || 0} | 
              活跃任务: {jarvisStatus.active_tasks || 0}
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default AvatarPanel;