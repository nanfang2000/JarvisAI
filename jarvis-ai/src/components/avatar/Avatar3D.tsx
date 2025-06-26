import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { Box, CircularProgress, Alert, Slider, Typography } from '@mui/material';
import * as THREE from 'three';
import { 
  Avatar3DProps, 
  AvatarConfig, 
  EmotionType, 
  AvatarState,
  AudioAnalysisResult 
} from '../../types/avatar';
import { AvatarService, ReadyPlayerMeService } from '../../services/avatarService';
import { AdaptiveQualityController } from '../../utils/avatarPerformance';

// 默认头像配置
const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  id: 'default',
  name: 'JARVIS Assistant',
  url: 'https://models.readyplayer.me/66c4a73cbc4b2e7c9ff6a0b0.glb',
  gender: 'male',
  style: 'realistic',
  customization: {}
};

// 3D头像渲染组件
const Avatar3DRenderer: React.FC<{
  avatarService: AvatarService;
  config: AvatarConfig;
  emotion: EmotionType;
  audioAnalysis?: AudioAnalysisResult;
  onLoad: () => void;
  onError: (error: Error) => void;
}> = ({ avatarService, config, emotion, audioAnalysis, onLoad, onError }) => {
  const { scene, camera, gl } = useThree();
  const [isLoaded, setIsLoaded] = useState(false);
  const qualityControllerRef = useRef<AdaptiveQualityController | null>(null);

  // 初始化性能控制器
  useEffect(() => {
    if (!qualityControllerRef.current) {
      qualityControllerRef.current = new AdaptiveQualityController(gl);
    }
  }, [gl]);

  useEffect(() => {
    const loadAvatar = async () => {
      try {
        await avatarService.loadAvatar(config);
        setIsLoaded(true);
        onLoad();
        
        // 跟踪头像对象用于性能管理
        if (qualityControllerRef.current && avatarService.getScene().children.length > 0) {
          avatarService.getScene().children.forEach(child => {
            qualityControllerRef.current!.trackObject(child);
          });
        }
      } catch (error) {
        console.error('Failed to load avatar:', error);
        onError(error as Error);
      }
    };

    loadAvatar();
  }, [avatarService, config, onLoad, onError]);

  useEffect(() => {
    if (isLoaded) {
      avatarService.setEmotion(emotion);
    }
  }, [avatarService, emotion, isLoaded]);

  useEffect(() => {
    if (isLoaded && audioAnalysis) {
      avatarService.updateLipSync(audioAnalysis);
    }
  }, [avatarService, audioAnalysis, isLoaded]);

  useFrame(() => {
    if (isLoaded) {
      // 更新性能优化
      if (qualityControllerRef.current) {
        qualityControllerRef.current.update(scene, camera);
      }
      
      avatarService.render();
    }
  });

  useEffect(() => {
    const handleResize = () => {
      avatarService.resize(gl.domElement.width, gl.domElement.height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [avatarService, gl]);

  return null;
};

// 头像控制面板
const AvatarControls: React.FC<{
  emotion: EmotionType;
  onEmotionChange: (emotion: EmotionType) => void;
  isAnimating: boolean;
  onPlayAnimation: (animation: string) => void;
  onStopAnimation: () => void;
}> = ({ emotion, onEmotionChange, isAnimating, onPlayAnimation, onStopAnimation }) => {
  const emotions = Object.values(EmotionType);
  const animations = ['idle', 'talking', 'greeting', 'thinking', 'nodding'];

  return (
    <Box sx={{ 
      position: 'absolute', 
      top: 10, 
      right: 10, 
      background: 'rgba(0,0,0,0.8)', 
      p: 2, 
      borderRadius: 2,
      minWidth: 200
    }}>
      <Typography variant="h6" color="white" gutterBottom>
        Avatar Controls
      </Typography>
      
      {/* 情感控制 */}
      <Typography variant="subtitle2" color="white" sx={{ mt: 2 }}>
        Emotion:
      </Typography>
      <select 
        value={emotion} 
        onChange={(e) => onEmotionChange(e.target.value as EmotionType)}
        style={{ 
          width: '100%', 
          padding: '8px', 
          marginTop: '4px',
          backgroundColor: '#333',
          color: 'white',
          border: '1px solid #555',
          borderRadius: '4px'
        }}
      >
        {emotions.map(em => (
          <option key={em} value={em}>
            {em.charAt(0).toUpperCase() + em.slice(1)}
          </option>
        ))}
      </select>

      {/* 动画控制 */}
      <Typography variant="subtitle2" color="white" sx={{ mt: 2 }}>
        Animation:
      </Typography>
      <Box sx={{ mt: 1 }}>
        {animations.map(anim => (
          <button
            key={anim}
            onClick={() => onPlayAnimation(anim)}
            style={{
              margin: '2px',
              padding: '4px 8px',
              backgroundColor: isAnimating ? '#555' : '#333',
              color: 'white',
              border: '1px solid #666',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {anim}
          </button>
        ))}
        <button
          onClick={onStopAnimation}
          style={{
            margin: '2px',
            padding: '4px 8px',
            backgroundColor: '#d32f2f',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Stop
        </button>
      </Box>
    </Box>
  );
};

// 主要的Avatar3D组件
const Avatar3D: React.FC<Avatar3DProps & {
  avatarConfig?: AvatarConfig;
  audioAnalysis?: AudioAnalysisResult;
  showControls?: boolean;
}> = ({
  avatarUrl,
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  animation = 'idle',
  emotion = EmotionType.NEUTRAL,
  isVisible = true,
  onLoad = () => {},
  onError = () => {},
  avatarConfig = DEFAULT_AVATAR_CONFIG,
  audioAnalysis,
  showControls = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const avatarServiceRef = useRef<AvatarService | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>({
    isLoaded: false,
    isAnimating: false,
    currentEmotion: emotion,
    currentAnimation: animation,
    lipSyncActive: false
  });

  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>(emotion);
  const [isAnimating, setIsAnimating] = useState(false);

  // 初始化Avatar服务
  useEffect(() => {
    if (canvasRef.current && !avatarServiceRef.current) {
      avatarServiceRef.current = new AvatarService(canvasRef.current);
    }

    return () => {
      if (avatarServiceRef.current) {
        avatarServiceRef.current.dispose();
        avatarServiceRef.current = null;
      }
    };
  }, []);

  // 处理头像加载成功
  const handleAvatarLoad = useCallback(() => {
    setAvatarState(prev => ({ ...prev, isLoaded: true }));
    onLoad();
  }, [onLoad]);

  // 处理头像加载错误
  const handleAvatarError = useCallback((error: Error) => {
    setAvatarState(prev => ({ ...prev, error: error.message }));
    onError(error);
  }, [onError]);

  // 处理情感变化
  const handleEmotionChange = useCallback((newEmotion: EmotionType) => {
    setCurrentEmotion(newEmotion);
    setAvatarState(prev => ({ ...prev, currentEmotion: newEmotion }));
  }, []);

  // 处理动画播放
  const handlePlayAnimation = useCallback((animationName: string) => {
    if (avatarServiceRef.current) {
      avatarServiceRef.current.playAnimation(animationName);
      setIsAnimating(true);
      setAvatarState(prev => ({ 
        ...prev, 
        isAnimating: true, 
        currentAnimation: animationName 
      }));
    }
  }, []);

  // 处理动画停止
  const handleStopAnimation = useCallback(() => {
    if (avatarServiceRef.current) {
      avatarServiceRef.current.stopAnimation();
      setIsAnimating(false);
      setAvatarState(prev => ({ ...prev, isAnimating: false }));
    }
  }, []);

  // 使用传入的avatarUrl或配置中的url
  const finalConfig = avatarUrl 
    ? { ...avatarConfig, url: avatarUrl }
    : avatarConfig;

  if (!isVisible) {
    return null;
  }

  return (
    <Box sx={{ 
      position: 'relative', 
      width: '100%', 
      height: '100%',
      minHeight: '400px',
      background: 'linear-gradient(45deg, #1a1a1a 30%, #2d2d2d 90%)'
    }}>
      {/* 3D Canvas */}
      <Canvas
        ref={canvasRef}
        camera={{ 
          position: [0, 1.6, 3], 
          fov: 75,
          near: 0.1,
          far: 1000 
        }}
        shadows
        style={{ width: '100%', height: '100%' }}
      >
        {/* 环境光照设置 */}
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[10, 10, 5]} 
          intensity={1.5}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-10, -10, -10]} intensity={0.3} />
        <ContactShadows 
          position={[0, -1, 0]} 
          opacity={0.4} 
          scale={10} 
          blur={2} 
          far={4} 
        />
        
        {/* 相机控制 */}
        <OrbitControls 
          enablePan={false}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={8}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI - Math.PI / 6}
        />

        {/* 头像渲染器 */}
        {avatarServiceRef.current && (
          <Avatar3DRenderer
            avatarService={avatarServiceRef.current}
            config={finalConfig}
            emotion={currentEmotion}
            audioAnalysis={audioAnalysis}
            onLoad={handleAvatarLoad}
            onError={handleAvatarError}
          />
        )}
      </Canvas>

      {/* 加载状态 */}
      {!avatarState.isLoaded && !avatarState.error && (
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2, color: 'white' }}>
            Loading Avatar...
          </Typography>
        </Box>
      )}

      {/* 错误状态 */}
      {avatarState.error && (
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '80%'
        }}>
          <Alert severity="error">
            Failed to load avatar: {avatarState.error}
          </Alert>
        </Box>
      )}

      {/* 控制面板 */}
      {showControls && avatarState.isLoaded && (
        <AvatarControls
          emotion={currentEmotion}
          onEmotionChange={handleEmotionChange}
          isAnimating={isAnimating}
          onPlayAnimation={handlePlayAnimation}
          onStopAnimation={handleStopAnimation}
        />
      )}

      {/* 状态指示器 */}
      <Box sx={{
        position: 'absolute',
        bottom: 10,
        left: 10,
        background: 'rgba(0,0,0,0.8)',
        p: 1,
        borderRadius: 1
      }}>
        <Typography variant="caption" color="white">
          Status: {avatarState.isLoaded ? 'Loaded' : 'Loading'}
          {avatarState.isAnimating && ' | Animating'}
          {avatarState.lipSyncActive && ' | Lip Sync Active'}
        </Typography>
        <br />
        <Typography variant="caption" color="white">
          Emotion: {avatarState.currentEmotion}
        </Typography>
      </Box>
    </Box>
  );
};

export default Avatar3D;