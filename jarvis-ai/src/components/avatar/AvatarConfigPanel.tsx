import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Slider,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Save,
  Refresh,
  Download,
  Upload,
  Person,
  Palette,
  Settings,
  Visibility,
  VisibilityOff,
  CloudDownload,
  Delete,
  Edit
} from '@mui/icons-material';
import { 
  AvatarConfig, 
  SceneConfig, 
  RenderOptions,
  AvatarManagerConfig 
} from '../../types/avatar';
import { ReadyPlayerMeService } from '../../services/avatarService';

interface AvatarConfigPanelProps {
  currentConfig: AvatarConfig;
  onConfigChange: (config: AvatarConfig) => void;
  onSceneConfigChange?: (config: SceneConfig) => void;
  onRenderOptionsChange?: (options: RenderOptions) => void;
  presetConfigs?: AvatarConfig[];
  onSavePreset?: (config: AvatarConfig) => void;
  onLoadPreset?: (config: AvatarConfig) => void;
}

// 默认配置
const DEFAULT_SCENE_CONFIG: SceneConfig = {
  backgroundColor: '#1a1a1a',
  lighting: {
    ambient: 0.6,
    directional: {
      intensity: 0.8,
      position: [2, 4, 2],
      color: '#ffffff'
    }
  },
  camera: {
    position: [0, 1.6, 3],
    fov: 75,
    near: 0.1,
    far: 1000
  },
  performance: {
    pixelRatio: 2,
    antialias: true,
    shadows: true
  }
};

const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  quality: 'high',
  enableShadows: true,
  enablePostProcessing: true,
  maxFPS: 60,
  autoResize: true
};

// 预设头像配置
const PRESET_AVATARS: AvatarConfig[] = [
  {
    id: 'male-professional',
    name: 'Professional Male',
    url: 'https://models.readyplayer.me/66c4a73cbc4b2e7c9ff6a0b0.glb',
    gender: 'male',
    style: 'realistic',
    customization: {
      skinColor: '#f4c2a1',
      hairColor: '#4a3728',
      eyeColor: '#4a5729',
      outfit: 'business'
    }
  },
  {
    id: 'female-casual',
    name: 'Casual Female',
    url: 'https://models.readyplayer.me/66c4a73cbc4b2e7c9ff6a0b1.glb',
    gender: 'female',
    style: 'realistic',
    customization: {
      skinColor: '#f4c2a1',
      hairColor: '#8b4513',
      eyeColor: '#4169e1',
      outfit: 'casual'
    }
  },
  {
    id: 'anime-style',
    name: 'Anime Character',
    url: 'https://models.readyplayer.me/66c4a73cbc4b2e7c9ff6a0b2.glb',
    gender: 'female',
    style: 'anime',
    customization: {
      skinColor: '#ffe4e1',
      hairColor: '#ff69b4',
      eyeColor: '#00bfff',
      outfit: 'anime'
    }
  }
];

// Tab面板组件
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

// 颜色选择器组件
const ColorSelector: React.FC<{
  label: string;
  value: string;
  onChange: (color: string) => void;
}> = ({ label, value, onChange }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
    <Typography variant="body2" sx={{ minWidth: 100 }}>
      {label}:
    </Typography>
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ 
        width: 40, 
        height: 30, 
        border: 'none', 
        borderRadius: 4,
        cursor: 'pointer'
      }}
    />
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      size="small"
      sx={{ width: 100 }}
    />
  </Box>
);

// 主要的AvatarConfigPanel组件
const AvatarConfigPanel: React.FC<AvatarConfigPanelProps> = ({
  currentConfig,
  onConfigChange,
  onSceneConfigChange,
  onRenderOptionsChange,
  presetConfigs = PRESET_AVATARS,
  onSavePreset,
  onLoadPreset
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [sceneConfig, setSceneConfig] = useState<SceneConfig>(DEFAULT_SCENE_CONFIG);
  const [renderOptions, setRenderOptions] = useState<RenderOptions>(DEFAULT_RENDER_OPTIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [customUrl, setCustomUrl] = useState('');

  // 处理头像基本配置更改
  const handleBasicConfigChange = useCallback(<K extends keyof AvatarConfig>(
    key: K,
    value: AvatarConfig[K]
  ) => {
    const newConfig = { ...currentConfig, [key]: value };
    onConfigChange(newConfig);
  }, [currentConfig, onConfigChange]);

  // 处理自定义配置更改
  const handleCustomizationChange = useCallback((
    key: keyof AvatarConfig['customization'],
    value: string
  ) => {
    const newConfig = {
      ...currentConfig,
      customization: {
        ...currentConfig.customization,
        [key]: value
      }
    };
    onConfigChange(newConfig);
  }, [currentConfig, onConfigChange]);

  // 处理场景配置更改
  const handleSceneConfigChange = useCallback(<K extends keyof SceneConfig>(
    key: K,
    value: SceneConfig[K]
  ) => {
    const newConfig = { ...sceneConfig, [key]: value };
    setSceneConfig(newConfig);
    if (onSceneConfigChange) {
      onSceneConfigChange(newConfig);
    }
  }, [sceneConfig, onSceneConfigChange]);

  // 处理渲染选项更改
  const handleRenderOptionsChange = useCallback(<K extends keyof RenderOptions>(
    key: K,
    value: RenderOptions[K]
  ) => {
    const newOptions = { ...renderOptions, [key]: value };
    setRenderOptions(newOptions);
    if (onRenderOptionsChange) {
      onRenderOptionsChange(newOptions);
    }
  }, [renderOptions, onRenderOptionsChange]);

  // 生成Ready Player Me URL
  const generateRPMUrl = useCallback(() => {
    if (!currentConfig.id) return;
    
    const url = ReadyPlayerMeService.generateAvatarUrl(currentConfig.id, {
      quality: renderOptions.quality === 'high' ? 'high' : 'medium',
      pose: 'A',
      background: 'transparent'
    });
    
    setPreviewUrl(url);
    handleBasicConfigChange('url', url);
  }, [currentConfig.id, renderOptions.quality, handleBasicConfigChange]);

  // 验证头像URL
  const validateAvatarUrl = useCallback(async (url: string) => {
    if (!url) return false;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const isValid = await ReadyPlayerMeService.validateAvatarUrl(url);
      if (!isValid) {
        setError('Invalid avatar URL or avatar not accessible');
      }
      return isValid;
    } catch (err) {
      setError('Error validating avatar URL');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 处理预设选择
  const handlePresetSelect = useCallback((preset: AvatarConfig) => {
    onConfigChange(preset);
    if (onLoadPreset) {
      onLoadPreset(preset);
    }
  }, [onConfigChange, onLoadPreset]);

  // 保存当前配置为预设
  const handleSavePreset = useCallback(() => {
    if (onSavePreset) {
      onSavePreset(currentConfig);
    }
  }, [currentConfig, onSavePreset]);

  // 处理自定义URL设置
  const handleCustomUrlSubmit = useCallback(async () => {
    if (await validateAvatarUrl(customUrl)) {
      handleBasicConfigChange('url', customUrl);
      setShowUrlDialog(false);
      setCustomUrl('');
    }
  }, [customUrl, validateAvatarUrl, handleBasicConfigChange]);

  return (
    <Card sx={{ maxWidth: '100%', m: 1 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Avatar Configuration
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Save Preset">
              <IconButton onClick={handleSavePreset} size="small">
                <Save />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Generate Ready Player Me URL">
              <IconButton onClick={generateRPMUrl} size="small">
                <Refresh />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Custom URL">
              <IconButton onClick={() => setShowUrlDialog(true)} size="small">
                <CloudDownload />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 加载状态 */}
        {isLoading && <LinearProgress sx={{ mb: 2 }} />}

        {/* 标签页 */}
        <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)} sx={{ mb: 2 }}>
          <Tab icon={<Person />} label="Avatar" />
          <Tab icon={<Palette />} label="Appearance" />
          <Tab icon={<Settings />} label="Scene" />
          <Tab icon={<Visibility />} label="Rendering" />
        </Tabs>

        {/* 头像基础配置 */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Avatar Name"
                value={currentConfig.name}
                onChange={(e) => handleBasicConfigChange('name', e.target.value)}
                margin="normal"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Avatar ID"
                value={currentConfig.id}
                onChange={(e) => handleBasicConfigChange('id', e.target.value)}
                margin="normal"
                helperText="Ready Player Me Avatar ID"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Gender</InputLabel>
                <Select
                  value={currentConfig.gender}
                  onChange={(e) => handleBasicConfigChange('gender', e.target.value as 'male' | 'female')}
                >
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Style</InputLabel>
                <Select
                  value={currentConfig.style}
                  onChange={(e) => handleBasicConfigChange('style', e.target.value as any)}
                >
                  <MenuItem value="realistic">Realistic</MenuItem>
                  <MenuItem value="cartoon">Cartoon</MenuItem>
                  <MenuItem value="anime">Anime</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Avatar URL"
                value={currentConfig.url}
                onChange={(e) => handleBasicConfigChange('url', e.target.value)}
                margin="normal"
                multiline
                rows={2}
                helperText="Direct URL to avatar GLB file"
              />
            </Grid>
          </Grid>

          {/* 预设头像 */}
          <Typography variant="subtitle1" sx={{ mt: 3, mb: 2 }}>
            Preset Avatars
          </Typography>
          <Grid container spacing={2}>
            {presetConfigs.map((preset) => (
              <Grid item xs={6} sm={4} md={3} key={preset.id}>
                <Card 
                  sx={{ 
                    cursor: 'pointer',
                    bgcolor: currentConfig.id === preset.id ? 'primary.light' : 'background.paper'
                  }}
                  onClick={() => handlePresetSelect(preset)}
                >
                  <CardContent sx={{ textAlign: 'center', p: 2 }}>
                    <Avatar sx={{ mx: 'auto', mb: 1, bgcolor: 'primary.main' }}>
                      <Person />
                    </Avatar>
                    <Typography variant="body2" noWrap>
                      {preset.name}
                    </Typography>
                    <Chip 
                      label={preset.style} 
                      size="small" 
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* 外观自定义 */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="subtitle1" gutterBottom>
            Customization
          </Typography>
          
          <ColorSelector
            label="Skin Color"
            value={currentConfig.customization.skinColor || '#f4c2a1'}
            onChange={(color) => handleCustomizationChange('skinColor', color)}
          />
          
          <ColorSelector
            label="Hair Color"
            value={currentConfig.customization.hairColor || '#4a3728'}
            onChange={(color) => handleCustomizationChange('hairColor', color)}
          />
          
          <ColorSelector
            label="Eye Color"
            value={currentConfig.customization.eyeColor || '#4a5729'}
            onChange={(color) => handleCustomizationChange('eyeColor', color)}
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>Outfit</InputLabel>
            <Select
              value={currentConfig.customization.outfit || 'casual'}
              onChange={(e) => handleCustomizationChange('outfit', e.target.value)}
            >
              <MenuItem value="casual">Casual</MenuItem>
              <MenuItem value="business">Business</MenuItem>
              <MenuItem value="formal">Formal</MenuItem>
              <MenuItem value="anime">Anime Style</MenuItem>
            </Select>
          </FormControl>
        </TabPanel>

        {/* 场景配置 */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="subtitle1" gutterBottom>
            Scene Settings
          </Typography>
          
          <ColorSelector
            label="Background"
            value={sceneConfig.backgroundColor}
            onChange={(color) => handleSceneConfigChange('backgroundColor', color)}
          />

          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            Lighting
          </Typography>
          
          <Typography variant="body2" gutterBottom>
            Ambient Intensity
          </Typography>
          <Slider
            value={sceneConfig.lighting.ambient}
            onChange={(_, value) => handleSceneConfigChange('lighting', {
              ...sceneConfig.lighting,
              ambient: value as number
            })}
            min={0}
            max={2}
            step={0.1}
            valueLabelDisplay="auto"
            sx={{ mb: 2 }}
          />

          <Typography variant="body2" gutterBottom>
            Directional Light Intensity
          </Typography>
          <Slider
            value={sceneConfig.lighting.directional.intensity}
            onChange={(_, value) => handleSceneConfigChange('lighting', {
              ...sceneConfig.lighting,
              directional: {
                ...sceneConfig.lighting.directional,
                intensity: value as number
              }
            })}
            min={0}
            max={3}
            step={0.1}
            valueLabelDisplay="auto"
            sx={{ mb: 2 }}
          />

          <ColorSelector
            label="Light Color"
            value={sceneConfig.lighting.directional.color}
            onChange={(color) => handleSceneConfigChange('lighting', {
              ...sceneConfig.lighting,
              directional: {
                ...sceneConfig.lighting.directional,
                color
              }
            })}
          />

          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            Camera
          </Typography>
          
          <Typography variant="body2" gutterBottom>
            Field of View
          </Typography>
          <Slider
            value={sceneConfig.camera.fov}
            onChange={(_, value) => handleSceneConfigChange('camera', {
              ...sceneConfig.camera,
              fov: value as number
            })}
            min={30}
            max={120}
            step={5}
            valueLabelDisplay="auto"
            sx={{ mb: 2 }}
          />
        </TabPanel>

        {/* 渲染配置 */}
        <TabPanel value={tabValue} index={3}>
          <Typography variant="subtitle1" gutterBottom>
            Render Options
          </Typography>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Quality</InputLabel>
            <Select
              value={renderOptions.quality}
              onChange={(e) => handleRenderOptionsChange('quality', e.target.value as any)}
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={renderOptions.enableShadows}
                onChange={(e) => handleRenderOptionsChange('enableShadows', e.target.checked)}
              />
            }
            label="Enable Shadows"
          />

          <FormControlLabel
            control={
              <Switch
                checked={renderOptions.enablePostProcessing}
                onChange={(e) => handleRenderOptionsChange('enablePostProcessing', e.target.checked)}
              />
            }
            label="Enable Post Processing"
          />

          <FormControlLabel
            control={
              <Switch
                checked={renderOptions.autoResize}
                onChange={(e) => handleRenderOptionsChange('autoResize', e.target.checked)}
              />
            }
            label="Auto Resize"
          />

          <Typography variant="body2" gutterBottom sx={{ mt: 2 }}>
            Max FPS: {renderOptions.maxFPS}
          </Typography>
          <Slider
            value={renderOptions.maxFPS}
            onChange={(_, value) => handleRenderOptionsChange('maxFPS', value as number)}
            min={30}
            max={120}
            step={10}
            valueLabelDisplay="auto"
            sx={{ mb: 2 }}
          />

          <Typography variant="body2" gutterBottom>
            Pixel Ratio
          </Typography>
          <Slider
            value={sceneConfig.performance.pixelRatio}
            onChange={(_, value) => handleSceneConfigChange('performance', {
              ...sceneConfig.performance,
              pixelRatio: value as number
            })}
            min={0.5}
            max={3}
            step={0.5}
            valueLabelDisplay="auto"
            sx={{ mb: 2 }}
          />
        </TabPanel>
      </CardContent>

      {/* 自定义URL对话框 */}
      <Dialog open={showUrlDialog} onClose={() => setShowUrlDialog(false)}>
        <DialogTitle>Custom Avatar URL</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Avatar URL"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            margin="normal"
            placeholder="https://models.readyplayer.me/..."
            helperText="Enter the direct URL to a GLB avatar file"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUrlDialog(false)}>Cancel</Button>
          <Button onClick={handleCustomUrlSubmit} variant="contained">
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default AvatarConfigPanel;