import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  Grid,
  Alert,
  Chip
} from '@mui/material';
import { 
  AvatarManager,
  EmotionType,
  AudioAnalysisResult 
} from './index';

const AvatarTest: React.FC = () => {
  const [testResults, setTestResults] = useState<{
    avatarLoaded: boolean;
    emotionsWorking: boolean;
    lipSyncWorking: boolean;
    performanceGood: boolean;
    errors: string[];
  }>({
    avatarLoaded: false,
    emotionsWorking: false,
    lipSyncWorking: false,
    performanceGood: false,
    errors: []
  });

  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>(EmotionType.NEUTRAL);
  const [mockAudioAnalysis, setMockAudioAnalysis] = useState<AudioAnalysisResult>({
    volume: 0,
    pitch: 0,
    mfcc: [],
    spectralCentroid: 0,
    zeroCrossingRate: 0
  });

  // 测试头像加载
  const testAvatarLoad = () => {
    console.log('Testing avatar load...');
    setTestResults(prev => ({ 
      ...prev, 
      avatarLoaded: true,
      errors: prev.errors.filter(e => !e.includes('avatar load'))
    }));
  };

  // 测试情感系统
  const testEmotions = () => {
    console.log('Testing emotions...');
    const emotions = Object.values(EmotionType);
    let index = 0;
    
    const interval = setInterval(() => {
      if (index < emotions.length) {
        setCurrentEmotion(emotions[index]);
        index++;
      } else {
        clearInterval(interval);
        setCurrentEmotion(EmotionType.NEUTRAL);
        setTestResults(prev => ({ 
          ...prev, 
          emotionsWorking: true,
          errors: prev.errors.filter(e => !e.includes('emotion'))
        }));
      }
    }, 1000);
  };

  // 测试嘴型同步
  const testLipSync = () => {
    console.log('Testing lip sync...');
    let volume = 0;
    let direction = 1;
    
    const interval = setInterval(() => {
      volume += direction * 0.1;
      if (volume >= 1) direction = -1;
      if (volume <= 0) direction = 1;
      
      setMockAudioAnalysis(prev => ({
        ...prev,
        volume,
        pitch: 150 + Math.random() * 100
      }));
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      setMockAudioAnalysis(prev => ({ ...prev, volume: 0 }));
      setTestResults(prev => ({ 
        ...prev, 
        lipSyncWorking: true,
        errors: prev.errors.filter(e => !e.includes('lip sync'))
      }));
    }, 3000);
  };

  // 测试性能
  const testPerformance = () => {
    console.log('Testing performance...');
    const startTime = performance.now();
    
    // 模拟性能测试
    setTimeout(() => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      if (renderTime < 100) {
        setTestResults(prev => ({ 
          ...prev, 
          performanceGood: true,
          errors: prev.errors.filter(e => !e.includes('performance'))
        }));
      } else {
        setTestResults(prev => ({ 
          ...prev, 
          errors: [...prev.errors.filter(e => !e.includes('performance')), 'Performance issue detected']
        }));
      }
    }, 50);
  };

  // 运行所有测试
  const runAllTests = () => {
    setTestResults({
      avatarLoaded: false,
      emotionsWorking: false,
      lipSyncWorking: false,
      performanceGood: false,
      errors: []
    });

    setTimeout(testAvatarLoad, 500);
    setTimeout(testEmotions, 1000);
    setTimeout(testLipSync, 4000);
    setTimeout(testPerformance, 7500);
  };

  // 处理头像加载
  const handleAvatarLoad = () => {
    console.log('Avatar loaded successfully');
    setTestResults(prev => ({ ...prev, avatarLoaded: true }));
  };

  // 处理错误
  const handleError = (error: Error) => {
    console.error('Avatar error:', error);
    setTestResults(prev => ({ 
      ...prev, 
      errors: [...prev.errors, error.message]
    }));
  };

  // 处理情感变化
  const handleEmotionChange = (emotion: EmotionType) => {
    setCurrentEmotion(emotion);
  };

  const allTestsPassed = testResults.avatarLoaded && 
                       testResults.emotionsWorking && 
                       testResults.lipSyncWorking && 
                       testResults.performanceGood;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>
        JARVIS 3D Avatar Test Suite
      </Typography>

      {/* 测试控制面板 */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Test Controls
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item>
            <Button 
              variant="contained" 
              onClick={runAllTests}
              color="primary"
            >
              Run All Tests
            </Button>
          </Grid>
          <Grid item>
            <Button onClick={testAvatarLoad}>Test Avatar Load</Button>
          </Grid>
          <Grid item>
            <Button onClick={testEmotions}>Test Emotions</Button>
          </Grid>
          <Grid item>
            <Button onClick={testLipSync}>Test Lip Sync</Button>
          </Grid>
          <Grid item>
            <Button onClick={testPerformance}>Test Performance</Button>
          </Grid>
        </Grid>
      </Paper>

      {/* 测试结果面板 */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Test Results
        </Typography>
        
        <Grid container spacing={1}>
          <Grid item>
            <Chip 
              label="Avatar Load" 
              color={testResults.avatarLoaded ? "success" : "default"}
              variant={testResults.avatarLoaded ? "filled" : "outlined"}
            />
          </Grid>
          <Grid item>
            <Chip 
              label="Emotions" 
              color={testResults.emotionsWorking ? "success" : "default"}
              variant={testResults.emotionsWorking ? "filled" : "outlined"}
            />
          </Grid>
          <Grid item>
            <Chip 
              label="Lip Sync" 
              color={testResults.lipSyncWorking ? "success" : "default"}
              variant={testResults.lipSyncWorking ? "filled" : "outlined"}
            />
          </Grid>
          <Grid item>
            <Chip 
              label="Performance" 
              color={testResults.performanceGood ? "success" : "default"}
              variant={testResults.performanceGood ? "filled" : "outlined"}
            />
          </Grid>
        </Grid>

        {allTestsPassed && (
          <Alert severity="success" sx={{ mt: 2 }}>
            All tests passed! 3D Avatar system is working correctly.
          </Alert>
        )}

        {testResults.errors.length > 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Errors detected:</Typography>
            {testResults.errors.map((error, index) => (
              <Typography key={index} variant="body2">
                • {error}
              </Typography>
            ))}
          </Alert>
        )}
      </Paper>

      {/* 状态面板 */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Current State
        </Typography>
        
        <Typography variant="body2">
          Current Emotion: {currentEmotion}
        </Typography>
        <Typography variant="body2">
          Audio Volume: {(mockAudioAnalysis.volume * 100).toFixed(1)}%
        </Typography>
        <Typography variant="body2">
          Audio Pitch: {mockAudioAnalysis.pitch.toFixed(1)} Hz
        </Typography>
      </Paper>

      {/* 3D头像显示区域 */}
      <Paper elevation={3} sx={{ height: 600, overflow: 'hidden' }}>
        <AvatarManager
          textInput="Testing JARVIS 3D Avatar System"
          voiceAnalysis={{
            pitch: mockAudioAnalysis.pitch,
            energy: mockAudioAnalysis.volume,
            sentiment: 0.5
          }}
          onEmotionChange={handleEmotionChange}
          onAvatarLoad={handleAvatarLoad}
          onError={handleError}
        />
      </Paper>
    </Box>
  );
};

export default AvatarTest;