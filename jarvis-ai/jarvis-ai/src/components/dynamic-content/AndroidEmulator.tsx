import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  TextField,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  FormControlLabel,
  Slider,
  Paper
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Refresh,
  Screenshot,
  Touch,
  Keyboard,
  Apps,
  Settings,
  Security,
  Phone,
  Wifi,
  Battery,
  Memory,
  Storage,
  Speed,
  BugReport,
  RestartAlt,
  Visibility,
  VisibilityOff,
  FullscreenExit,
  Fullscreen,
  ZoomIn,
  ZoomOut,
  RotateLeft,
  RotateRight,
  Home,
  ArrowBack,
  Menu,
  VolumeUp,
  VolumeDown,
  PowerSettingsNew
} from '@mui/icons-material';
import { 
  AndroidEmulator as AndroidEmulatorType, 
  EmulatorStatus, 
  EmulatorType,
  ADBDevice,
  TouchEvent,
  ScreenInfo,
  AndroidApp,
  AutomationScript,
  PriceComparisonTask
} from '../../types/android-emulator';
import { AndroidEmulatorService } from '../../services/androidEmulatorService';
import { ADBController } from '../../services/adbController';

interface AndroidEmulatorProps {
  onClose?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`android-tabpanel-${index}`}
      aria-labelledby={`android-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const AndroidEmulator: React.FC<AndroidEmulatorProps> = ({ onClose }) => {
  // 状态管理
  const [tabValue, setTabValue] = useState(0);
  const [emulators, setEmulators] = useState<AndroidEmulatorType[]>([]);
  const [selectedEmulator, setSelectedEmulator] = useState<string>('');
  const [connectedDevices, setConnectedDevices] = useState<ADBDevice[]>([]);
  const [screenInfo, setScreenInfo] = useState<ScreenInfo | null>(null);
  const [installedApps, setInstalledApps] = useState<AndroidApp[]>([]);
  const [automationScripts, setAutomationScripts] = useState<AutomationScript[]>([]);
  const [priceComparisons, setPriceComparisons] = useState<PriceComparisonTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isScreenMirroring, setIsScreenMirroring] = useState(false);
  const [deviceStats, setDeviceStats] = useState<any>(null);
  
  // 控制状态
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [screenZoom, setScreenZoom] = useState(1.0);
  const [isVirtualKeyboard, setIsVirtualKeyboard] = useState(false);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [securityProfile, setSecurityProfile] = useState<string>('default');
  
  // 对话框状态
  const [showAppDialog, setShowAppDialog] = useState(false);
  const [showAutomationDialog, setShowAutomationDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  
  // 服务实例
  const emulatorService = AndroidEmulatorService.getInstance();
  const adbController = ADBController.getInstance();
  
  // 引用
  const screenRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化
  useEffect(() => {
    initializeEmulators();
    startDeviceMonitoring();
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // 选择模拟器时的处理
  useEffect(() => {
    if (selectedEmulator) {
      loadEmulatorDetails(selectedEmulator);
    }
  }, [selectedEmulator]);

  const initializeEmulators = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const detectedEmulators = await emulatorService.detectInstalledEmulators();
      setEmulators(detectedEmulators);
      
      const devices = await adbController.getDevices();
      setConnectedDevices(devices);
      
      // 如果没有选择的模拟器且有在线设备，自动选择第一个
      if (!selectedEmulator && devices.length > 0) {
        const onlineDevice = devices.find(d => d.state === 'device');
        if (onlineDevice) {
          const emulator = detectedEmulators.find(e => 
            e.adbPort.toString() === onlineDevice.serial || 
            e.deviceInfo.serialNumber === onlineDevice.serial
          );
          if (emulator) {
            setSelectedEmulator(emulator.id);
          }
        }
      }
    } catch (err) {
      setError('Failed to initialize emulators: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmulatorDetails = async (emulatorId: string) => {
    const emulator = emulators.find(e => e.id === emulatorId);
    if (!emulator) return;

    try {
      const deviceSerial = emulator.adbPort.toString();
      
      // 获取屏幕信息
      const screenInfo = await adbController.getScreenInfo(deviceSerial);
      setScreenInfo(screenInfo);
      
      // 获取已安装应用
      const apps = await emulatorService.getInstalledApps(deviceSerial);
      setInstalledApps(apps);
      
      // 获取设备统计信息
      const deviceInfo = await adbController.getDeviceInfo(deviceSerial);
      const batteryInfo = await adbController.getBatteryInfo(deviceSerial);
      const networkInfo = await adbController.getNetworkInfo(deviceSerial);
      
      setDeviceStats({
        device: deviceInfo,
        battery: batteryInfo,
        network: networkInfo
      });
      
      // 开始屏幕镜像
      if (isScreenMirroring) {
        startScreenMirroring(deviceSerial);
      }
    } catch (err) {
      console.error('Failed to load emulator details:', err);
    }
  };

  const startDeviceMonitoring = () => {
    refreshIntervalRef.current = setInterval(async () => {
      const devices = await adbController.getDevices();
      setConnectedDevices(devices);
      
      // 更新模拟器状态
      setEmulators(prev => prev.map(emulator => {
        const device = devices.find(d => 
          d.serial === emulator.adbPort.toString() || 
          d.serial === emulator.deviceInfo.serialNumber
        );
        
        if (device) {
          return {
            ...emulator,
            status: device.state === 'device' ? EmulatorStatus.ONLINE : EmulatorStatus.OFFLINE
          };
        }
        
        return { ...emulator, status: EmulatorStatus.OFFLINE };
      }));
    }, 5000);
  };

  const startScreenMirroring = async (deviceSerial: string) => {
    const updateScreen = async () => {
      const screenshotPath = await adbController.takeScreenshot(deviceSerial);
      if (screenshotPath) {
        setScreenshot(screenshotPath);
      }
    };
    
    // 初始截图
    await updateScreen();
    
    // 定期更新
    const mirrorInterval = setInterval(updateScreen, 1000);
    
    return () => clearInterval(mirrorInterval);
  };

  // 模拟器控制
  const handleStartEmulator = async (emulatorId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const success = await emulatorService.startEmulator(emulatorId);
      if (success) {
        await initializeEmulators();
        setSelectedEmulator(emulatorId);
      } else {
        setError('Failed to start emulator');
      }
    } catch (err) {
      setError('Error starting emulator: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopEmulator = async (emulatorId: string) => {
    setIsLoading(true);
    
    try {
      await emulatorService.stopEmulator(emulatorId);
      await initializeEmulators();
      if (selectedEmulator === emulatorId) {
        setSelectedEmulator('');
      }
    } catch (err) {
      setError('Error stopping emulator: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleScreenTouch = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedEmulator || !screenInfo) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * screenInfo.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * screenInfo.height);
    
    const emulator = emulators.find(e => e.id === selectedEmulator);
    if (emulator) {
      const touchEvent: TouchEvent = {
        type: 'tap',
        x,
        y
      };
      
      await adbController.performTouchEvent(emulator.adbPort.toString(), touchEvent);
    }
  };

  const handleKeyPress = async (keyCode: number) => {
    if (!selectedEmulator) return;
    
    const emulator = emulators.find(e => e.id === selectedEmulator);
    if (emulator) {
      await adbController.sendKeyEvent(emulator.adbPort.toString(), {
        type: 'key_press',
        keyCode
      });
    }
  };

  const handleTextInput = async (text: string) => {
    if (!selectedEmulator) return;
    
    const emulator = emulators.find(e => e.id === selectedEmulator);
    if (emulator) {
      await adbController.inputText(emulator.adbPort.toString(), text);
    }
  };

  const handleTakeScreenshot = async () => {
    if (!selectedEmulator) return;
    
    const emulator = emulators.find(e => e.id === selectedEmulator);
    if (emulator) {
      const screenshotPath = await adbController.takeScreenshot(emulator.adbPort.toString());
      if (screenshotPath) {
        setScreenshot(screenshotPath);
      }
    }
  };

  const handleAppLaunch = async (packageName: string) => {
    if (!selectedEmulator) return;
    
    const emulator = emulators.find(e => e.id === selectedEmulator);
    if (emulator) {
      await adbController.launchApp(emulator.adbPort.toString(), packageName);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getStatusColor = (status: EmulatorStatus) => {
    switch (status) {
      case EmulatorStatus.ONLINE:
        return 'success';
      case EmulatorStatus.BOOTING:
        return 'warning';
      case EmulatorStatus.ERROR:
        return 'error';
      default:
        return 'default';
    }
  };

  const getEmulatorTypeIcon = (type: EmulatorType) => {
    switch (type) {
      case EmulatorType.ANDROID_STUDIO:
        return '🤖';
      case EmulatorType.BLUESTACKS:
        return '🔵';
      case EmulatorType.GENYMOTION:
        return '⚡';
      case EmulatorType.NOX:
        return '🎮';
      case EmulatorType.LDPLAYER:
        return '🎯';
      default:
        return '📱';
    }
  };

  const selectedEmulatorData = emulators.find(e => e.id === selectedEmulator);

  return (
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 头部工具栏 */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>选择模拟器</InputLabel>
              <Select
                value={selectedEmulator}
                onChange={(e) => setSelectedEmulator(e.target.value)}
                label="选择模拟器"
              >
                {emulators.map((emulator) => (
                  <MenuItem key={emulator.id} value={emulator.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{getEmulatorTypeIcon(emulator.type)}</span>
                      <Typography>{emulator.name}</Typography>
                      <Chip
                        size="small"
                        label={emulator.status}
                        color={getStatusColor(emulator.status)}
                      />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {selectedEmulatorData?.status === EmulatorStatus.OFFLINE && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PlayArrow />}
                  onClick={() => handleStartEmulator(selectedEmulator)}
                  disabled={isLoading}
                  size="small"
                >
                  启动
                </Button>
              )}
              
              {selectedEmulatorData?.status === EmulatorStatus.ONLINE && (
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<Stop />}
                  onClick={() => handleStopEmulator(selectedEmulator)}
                  disabled={isLoading}
                  size="small"
                >
                  停止
                </Button>
              )}
              
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={initializeEmulators}
                disabled={isLoading}
                size="small"
              >
                刷新
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<Screenshot />}
                onClick={handleTakeScreenshot}
                disabled={!selectedEmulator || selectedEmulatorData?.status !== EmulatorStatus.ONLINE}
                size="small"
              >
                截图
              </Button>
              
              <Button
                variant="outlined"
                startIcon={isScreenMirroring ? <VisibilityOff /> : <Visibility />}
                onClick={() => setIsScreenMirroring(!isScreenMirroring)}
                disabled={!selectedEmulator || selectedEmulatorData?.status !== EmulatorStatus.ONLINE}
                size="small"
              >
                {isScreenMirroring ? '停止镜像' : '屏幕镜像'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 主要内容区域 */}
      <Box sx={{ flexGrow: 1, display: 'flex' }}>
        {/* 左侧设备屏幕 */}
        <Box sx={{ flex: 1, mr: 2 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {selectedEmulatorData?.status === EmulatorStatus.ONLINE ? (
                <>
                  {/* 设备屏幕 */}
                  <Box
                    ref={screenRef}
                    sx={{
                      flex: 1,
                      backgroundColor: '#000',
                      borderRadius: 2,
                      overflow: 'hidden',
                      position: 'relative',
                      cursor: 'pointer',
                      transform: `scale(${screenZoom})`,
                      transformOrigin: 'top left'
                    }}
                    onClick={handleScreenTouch}
                  >
                    {screenshot ? (
                      <img
                        src={screenshot}
                        alt="Device Screen"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          color: 'white'
                        }}
                      >
                        <Typography>
                          {isScreenMirroring ? '加载屏幕中...' : '点击"屏幕镜像"开始显示'}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* 设备控制按钮 */}
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 1 }}>
                    <IconButton onClick={() => handleKeyPress(4)} title="返回">
                      <ArrowBack />
                    </IconButton>
                    <IconButton onClick={() => handleKeyPress(3)} title="主页">
                      <Home />
                    </IconButton>
                    <IconButton onClick={() => handleKeyPress(187)} title="菜单">
                      <Menu />
                    </IconButton>
                    <IconButton onClick={() => handleKeyPress(24)} title="音量+">
                      <VolumeUp />
                    </IconButton>
                    <IconButton onClick={() => handleKeyPress(25)} title="音量-">
                      <VolumeDown />
                    </IconButton>
                    <IconButton onClick={() => handleKeyPress(26)} title="电源">
                      <PowerSettingsNew />
                    </IconButton>
                  </Box>

                  {/* 缩放控制 */}
                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton onClick={() => setScreenZoom(Math.max(0.5, screenZoom - 0.1))}>
                      <ZoomOut />
                    </IconButton>
                    <Slider
                      value={screenZoom}
                      onChange={(_, value) => setScreenZoom(value as number)}
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      sx={{ flex: 1 }}
                    />
                    <IconButton onClick={() => setScreenZoom(Math.min(2.0, screenZoom + 0.1))}>
                      <ZoomIn />
                    </IconButton>
                    <Typography variant="caption">
                      {Math.round(screenZoom * 100)}%
                    </Typography>
                  </Box>
                </>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    flexDirection: 'column',
                    gap: 2
                  }}
                >
                  {selectedEmulatorData?.status === EmulatorStatus.BOOTING ? (
                    <>
                      <CircularProgress />
                      <Typography>模拟器启动中...</Typography>
                    </>
                  ) : (
                    <>
                      <Phone sx={{ fontSize: 48, color: 'grey.400' }} />
                      <Typography color="textSecondary">
                        {selectedEmulator ? '模拟器未连接' : '请选择一个模拟器'}
                      </Typography>
                    </>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* 右侧控制面板 */}
        <Box sx={{ width: 400 }}>
          <Card sx={{ height: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable">
                <Tab label="设备信息" icon={<Phone />} />
                <Tab label="应用管理" icon={<Apps />} />
                <Tab label="自动化" icon={<Speed />} />
                <Tab label="价格比对" icon={<Typography>💰</Typography>} />
                <Tab label="设置" icon={<Settings />} />
              </Tabs>
            </Box>

            {/* 设备信息 */}
            <TabPanel value={tabValue} index={0}>
              {selectedEmulatorData && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="h6">设备状态</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      icon={<Phone />}
                      label={`${selectedEmulatorData.name}`}
                      color="primary"
                    />
                    <Chip
                      label={selectedEmulatorData.status}
                      color={getStatusColor(selectedEmulatorData.status)}
                    />
                  </Box>

                  {screenInfo && (
                    <>
                      <Divider />
                      <Typography variant="h6">屏幕信息</Typography>
                      <Box>
                        <Typography variant="body2">
                          分辨率: {screenInfo.width} × {screenInfo.height}
                        </Typography>
                        <Typography variant="body2">
                          密度: {screenInfo.density} DPI
                        </Typography>
                        <Typography variant="body2">
                          方向: {screenInfo.orientation === 0 ? '竖屏' : '横屏'}
                        </Typography>
                      </Box>
                    </>
                  )}

                  {deviceStats && (
                    <>
                      <Divider />
                      <Typography variant="h6">系统信息</Typography>
                      <Box>
                        {deviceStats.device && (
                          <>
                            <Typography variant="body2">
                              制造商: {deviceStats.device['ro.product.manufacturer']}
                            </Typography>
                            <Typography variant="body2">
                              型号: {deviceStats.device['ro.product.model']}
                            </Typography>
                            <Typography variant="body2">
                              Android版本: {deviceStats.device['ro.build.version.release']}
                            </Typography>
                          </>
                        )}
                      </Box>
                    </>
                  )}

                  {/* 虚拟键盘 */}
                  <Divider />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isVirtualKeyboard}
                        onChange={(e) => setIsVirtualKeyboard(e.target.checked)}
                      />
                    }
                    label="虚拟键盘"
                  />
                  
                  {isVirtualKeyboard && (
                    <TextField
                      fullWidth
                      placeholder="输入文本..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleTextInput((e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                  )}
                </Box>
              )}
            </TabPanel>

            {/* 应用管理 */}
            <TabPanel value={tabValue} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h6">已安装应用</Typography>
                <Button
                  variant="outlined"
                  onClick={() => setShowAppDialog(true)}
                  startIcon={<Apps />}
                >
                  管理应用
                </Button>
                
                <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {installedApps.slice(0, 10).map((app) => (
                    <ListItem
                      key={app.packageName}
                      secondaryAction={
                        <Button
                          size="small"
                          onClick={() => handleAppLaunch(app.packageName)}
                        >
                          启动
                        </Button>
                      }
                    >
                      <ListItemIcon>
                        <Apps />
                      </ListItemIcon>
                      <ListItemText
                        primary={app.label}
                        secondary={app.packageName}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </TabPanel>

            {/* 自动化 */}
            <TabPanel value={tabValue} index={2}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h6">自动化脚本</Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={automationEnabled}
                      onChange={(e) => setAutomationEnabled(e.target.checked)}
                    />
                  }
                  label="启用自动化"
                />
                
                <Button
                  variant="outlined"
                  onClick={() => setShowAutomationDialog(true)}
                  startIcon={<Speed />}
                  disabled={!automationEnabled}
                >
                  创建脚本
                </Button>
                
                <Typography variant="body2" color="textSecondary">
                  自动化脚本可以帮助您自动完成重复性操作，如应用测试、数据采集等。
                </Typography>
              </Box>
            </TabPanel>

            {/* 价格比对 */}
            <TabPanel value={tabValue} index={3}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h6">价格比对</Typography>
                <Button
                  variant="outlined"
                  onClick={() => setShowPriceDialog(true)}
                  startIcon={<Typography>💰</Typography>}
                >
                  开始比价
                </Button>
                
                <Typography variant="body2" color="textSecondary">
                  在多个购物应用中自动搜索和比较商品价格。
                </Typography>
              </Box>
            </TabPanel>

            {/* 设置 */}
            <TabPanel value={tabValue} index={4}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="h6">安全设置</Typography>
                <FormControl fullWidth>
                  <InputLabel>安全配置</InputLabel>
                  <Select
                    value={securityProfile}
                    onChange={(e) => setSecurityProfile(e.target.value)}
                    label="安全配置"
                  >
                    <MenuItem value="default">默认</MenuItem>
                    <MenuItem value="strict">严格</MenuItem>
                    <MenuItem value="custom">自定义</MenuItem>
                  </Select>
                </FormControl>
                
                <Button
                  variant="outlined"
                  onClick={() => setShowSettingsDialog(true)}
                  startIcon={<Settings />}
                >
                  高级设置
                </Button>
                
                <Divider />
                <Typography variant="h6">调试工具</Typography>
                <Button
                  variant="outlined"
                  startIcon={<BugReport />}
                  color="warning"
                >
                  查看日志
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<RestartAlt />}
                  color="error"
                >
                  重置设备
                </Button>
              </Box>
            </TabPanel>
          </Card>
        </Box>
      </Box>

      {/* 对话框 */}
      {/* 应用管理对话框 */}
      <Dialog
        open={showAppDialog}
        onClose={() => setShowAppDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>应用管理</DialogTitle>
        <DialogContent>
          <Typography>应用管理功能正在开发中...</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAppDialog(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 自动化对话框 */}
      <Dialog
        open={showAutomationDialog}
        onClose={() => setShowAutomationDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>创建自动化脚本</DialogTitle>
        <DialogContent>
          <Typography>自动化脚本功能正在开发中...</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAutomationDialog(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 价格比对对话框 */}
      <Dialog
        open={showPriceDialog}
        onClose={() => setShowPriceDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>价格比对</DialogTitle>
        <DialogContent>
          <Typography>价格比对功能正在开发中...</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPriceDialog(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 设置对话框 */}
      <Dialog
        open={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>高级设置</DialogTitle>
        <DialogContent>
          <Typography>高级设置功能正在开发中...</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettingsDialog(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AndroidEmulator;