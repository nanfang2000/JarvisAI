import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Grid, Paper, Tabs, Tab, IconButton, Tooltip } from '@mui/material';
import { 
  Face, 
  RecordVoiceOver, 
  Settings, 
  Tune,
  Fullscreen,
  FullscreenExit
} from '@mui/icons-material';
import Avatar3D from './Avatar3D';
import LipSyncManager from './LipSyncManager';
import EmotionControl from './EmotionControl';
import AvatarConfigPanel from './AvatarConfigPanel';
import { 
  AvatarConfig, 
  EmotionType, 
  AudioAnalysisResult,
  SceneConfig,
  RenderOptions,
  BlendShape
} from '../../types/avatar';

interface AvatarManagerProps {
  initialConfig?: AvatarConfig;
  audioSource?: MediaStreamAudioSourceNode | AudioBufferSourceNode;
  textInput?: string;
  voiceAnalysis?: {
    pitch: number;
    energy: number;
    sentiment?: number;
  };
  onEmotionChange?: (emotion: EmotionType) => void;
  onAvatarLoad?: () => void;
  onError?: (error: Error) => void;
  className?: string;
}

// 默认头像配置
const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  id: 'jarvis-default',
  name: 'JARVIS Assistant',
  url: 'https://models.readyplayer.me/66c4a73cbc4b2e7c9ff6a0b0.glb',
  gender: 'male',
  style: 'realistic',
  customization: {
    skinColor: '#f4c2a1',
    hairColor: '#4a3728',
    eyeColor: '#4a5729',
    outfit: 'business'
  }
};

// Tab面板组件
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box>{children}</Box>}
  </div>
);

const AvatarManager: React.FC<AvatarManagerProps> = ({
  initialConfig = DEFAULT_AVATAR_CONFIG,
  audioSource,
  textInput = '',
  voiceAnalysis,
  onEmotionChange,
  onAvatarLoad,
  onError,
  className
}) => {
  // 状态管理
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(initialConfig);
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>(EmotionType.NEUTRAL);
  const [isLipSyncEnabled, setIsLipSyncEnabled] = useState(false);
  const [isAutoEmotionEnabled, setIsAutoEmotionEnabled] = useState(false);
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysisResult | undefined>();
  const [controlPanelTab, setControlPanelTab] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sceneConfig, setSceneConfig] = useState<SceneConfig>();
  const [renderOptions, setRenderOptions] = useState<RenderOptions>();
  
  // 引用
  const containerRef = useRef<HTMLDivElement>(null);
  const presetConfigsRef = useRef<AvatarConfig[]>([]);

  // 处理头像配置变化
  const handleAvatarConfigChange = useCallback((config: AvatarConfig) => {
    setAvatarConfig(config);
  }, []);

  // 处理情感变化
  const handleEmotionChange = useCallback((emotion: EmotionType, intensity?: number) => {
    setCurrentEmotion(emotion);
    if (onEmotionChange) {
      onEmotionChange(emotion);
    }
  }, [onEmotionChange]);

  // 处理嘴型同步数据
  const handleLipSyncData = useCallback((data: AudioAnalysisResult) => {
    setAudioAnalysis(data);
  }, []);

  // 处理嘴型同步开关
  const handleLipSyncToggle = useCallback((enabled: boolean) => {
    setIsLipSyncEnabled(enabled);
  }, []);

  // 处理自动情感开关
  const handleAutoEmotionToggle = useCallback((enabled: boolean) => {
    setIsAutoEmotionEnabled(enabled);
  }, []);

  // 处理混合形状变化
  const handleBlendShapeChange = useCallback((shapes: BlendShape[]) => {
    // 这里可以添加额外的混合形状处理逻辑
    console.log('Blend shapes updated:', shapes);
  }, []);

  // 处理全屏切换
  const handleFullscreenToggle = useCallback(() => {
    if (!isFullscreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  }, [isFullscreen]);

  // 处理预设保存
  const handleSavePreset = useCallback((config: AvatarConfig) => {
    presetConfigsRef.current = [...presetConfigsRef.current, config];
    // 这里可以添加持久化存储逻辑
    localStorage.setItem('avatar-presets', JSON.stringify(presetConfigsRef.current));
  }, []);

  // 处理预设加载
  const handleLoadPreset = useCallback((config: AvatarConfig) => {
    setAvatarConfig(config);
  }, []);

  // 处理场景配置变化
  const handleSceneConfigChange = useCallback((config: SceneConfig) => {
    setSceneConfig(config);
  }, []);

  // 处理渲染选项变化
  const handleRenderOptionsChange = useCallback((options: RenderOptions) => {
    setRenderOptions(options);
  }, []);

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 加载保存的预设
  useEffect(() => {
    try {
      const saved = localStorage.getItem('avatar-presets');
      if (saved) {
        presetConfigsRef.current = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load avatar presets:', error);
    }
  }, []);

  return (
    <Box 
      ref={containerRef}
      className={className}
      sx={{ 
        width: '100%', 
        height: '100%',
        display: 'flex',
        flexDirection: isFullscreen ? 'row' : 'column',
        gap: 2,
        p: isFullscreen ? 0 : 2,
        bgcolor: isFullscreen ? 'black' : 'transparent'
      }}
    >
      {/* 3D头像显示区域 */}
      <Box 
        sx={{ 
          flex: isFullscreen ? '1 1 70%' : '1 1 60%',
          minHeight: isFullscreen ? '100vh' : '400px',
          position: 'relative',
          borderRadius: isFullscreen ? 0 : 2,
          overflow: 'hidden'
        }}
      >
        <Avatar3D
          avatarConfig={avatarConfig}
          emotion={currentEmotion}
          audioAnalysis={audioAnalysis}
          onLoad={onAvatarLoad}
          onError={onError}
          showControls={!isFullscreen}
        />
        
        {/* 全屏控制按钮 */}
        <Box sx={{ 
          position: 'absolute', 
          top: 10, 
          left: 10,
          zIndex: 1000
        }}>
          <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}>
            <IconButton 
              onClick={handleFullscreenToggle}
              sx={{ 
                bgcolor: 'rgba(0,0,0,0.7)', 
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.9)' }
              }}
            >
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* 控制面板 */}
      <Box 
        sx={{ 
          flex: isFullscreen ? '1 1 30%' : '1 1 40%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: isFullscreen ? '100vh' : 'auto',
          maxHeight: isFullscreen ? '100vh' : '600px',
          overflow: 'hidden'
        }}
      >
        <Paper 
          elevation={3} 
          sx={{ 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* 控制面板标签 */}
          <Tabs 
            value={controlPanelTab} 
            onChange={(_, value) => setControlPanelTab(value)}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab icon={<Face />} label="Emotion" />
            <Tab icon={<RecordVoiceOver />} label="Voice" />
            <Tab icon={<Settings />} label="Avatar" />
            <Tab icon={<Tune />} label="Scene" />
          </Tabs>

          {/* 控制面板内容 */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {/* 情感控制面板 */}
            <TabPanel value={controlPanelTab} index={0}>
              <EmotionControl
                currentEmotion={currentEmotion}
                onEmotionChange={handleEmotionChange}
                onBlendShapeChange={handleBlendShapeChange}
                isAutoMode={isAutoEmotionEnabled}
                onAutoModeChange={handleAutoEmotionToggle}
                textInput={textInput}
                voiceAnalysis={voiceAnalysis}
              />
            </TabPanel>

            {/* 语音和嘴型同步面板 */}
            <TabPanel value={controlPanelTab} index={1}>
              <LipSyncManager
                audioSource={audioSource}
                onLipSyncData={handleLipSyncData}
                isActive={isLipSyncEnabled}
                onActiveChange={handleLipSyncToggle}
              />
            </TabPanel>

            {/* 头像配置面板 */}
            <TabPanel value={controlPanelTab} index={2}>
              <AvatarConfigPanel
                currentConfig={avatarConfig}
                onConfigChange={handleAvatarConfigChange}
                presetConfigs={presetConfigsRef.current}
                onSavePreset={handleSavePreset}
                onLoadPreset={handleLoadPreset}
              />
            </TabPanel>

            {/* 场景和渲染配置面板 */}
            <TabPanel value={controlPanelTab} index={3}>
              <AvatarConfigPanel
                currentConfig={avatarConfig}
                onConfigChange={handleAvatarConfigChange}
                onSceneConfigChange={handleSceneConfigChange}
                onRenderOptionsChange={handleRenderOptionsChange}
              />
            </TabPanel>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default AvatarManager;