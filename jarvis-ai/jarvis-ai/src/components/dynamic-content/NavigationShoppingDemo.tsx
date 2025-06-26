import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Button,
  TextField,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
  Divider,
  Alert,
  IconButton,
  Fab,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  Map,
  ShoppingCart,
  Assistant,
  Navigation,
  TrendingUp,
  Notifications,
  Settings,
  PlayArrow,
  Stop,
  Refresh,
  Code,
  Description,
} from '@mui/icons-material';

import MapView from './MapView';
import PriceComparison from './PriceComparison';
import { jarvisIntegrationService, JarvisResponse } from '../../services/jarvisIntegrationService';

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
      id={`demo-tabpanel-${index}`}
      aria-labelledby={`demo-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const NavigationShoppingDemo: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [demoStep, setDemoStep] = useState(0);
  const [isRunningDemo, setIsRunningDemo] = useState(false);
  const [demoOutput, setDemoOutput] = useState<string[]>([]);
  const [jarvisInput, setJarvisInput] = useState('');
  const [jarvisResponse, setJarvisResponse] = useState<JarvisResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 演示步骤
  const demoSteps = [
    {
      label: '初始化系统',
      description: '加载地图服务和价格比对系统',
      action: async () => {
        setDemoOutput(prev => [...prev, '🚀 正在初始化JARVIS导航和购物系统...']);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setDemoOutput(prev => [...prev, '✅ Google Maps API已加载']);
        await new Promise(resolve => setTimeout(resolve, 500));
        setDemoOutput(prev => [...prev, '✅ 价格比对API已连接']);
        await new Promise(resolve => setTimeout(resolve, 500));
        setDemoOutput(prev => [...prev, '✅ 实时数据服务已启动']);
      },
    },
    {
      label: '地点搜索演示',
      description: '搜索附近的咖啡店',
      action: async () => {
        setDemoOutput(prev => [...prev, '🔍 搜索附近的咖啡店...']);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setDemoOutput(prev => [...prev, '📍 找到5家附近的咖啡店']);
        setDemoOutput(prev => [...prev, '• 星巴克 (距离200m, 评分4.5⭐)']);
        setDemoOutput(prev => [...prev, '• 瑞幸咖啡 (距离350m, 评分4.3⭐)']);
        setDemoOutput(prev => [...prev, '• 蓝山咖啡 (距离500m, 评分4.7⭐)']);
      },
    },
    {
      label: '路线规划演示',
      description: '规划到最近咖啡店的路线',
      action: async () => {
        setDemoOutput(prev => [...prev, '🗺️ 规划前往星巴克的路线...']);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setDemoOutput(prev => [...prev, '✅ 路线已规划：距离200m，步行3分钟']);
        setDemoOutput(prev => [...prev, '🚶‍♂️ 推荐步行路线：沿着主街直行']);
        setDemoOutput(prev => [...prev, '🚗 当前交通状况：畅通']);
      },
    },
    {
      label: '商品价格比对',
      description: '比较iPhone 15 Pro的价格',
      action: async () => {
        setDemoOutput(prev => [...prev, '💰 搜索iPhone 15 Pro价格...']);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setDemoOutput(prev => [...prev, '📊 找到3个平台的价格信息：']);
        setDemoOutput(prev => [...prev, '• 京东：¥7,999 (有优惠券-1000)']);
        setDemoOutput(prev => [...prev, '• 天猫：¥8,199 (官方正品)']);
        setDemoOutput(prev => [...prev, '• 拼多多：¥7,699 (限时特价)']);
        setDemoOutput(prev => [...prev, '🏆 推荐：拼多多价格最优']);
      },
    },
    {
      label: '智能购物建议',
      description: '生成购买建议和价格预测',
      action: async () => {
        setDemoOutput(prev => [...prev, '🤖 分析价格趋势和购买时机...']);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setDemoOutput(prev => [...prev, '📈 价格趋势分析完成']);
        setDemoOutput(prev => [...prev, '💡 建议：等待双11大促，预计可节省¥800']);
        setDemoOutput(prev => [...prev, '⏰ 最佳购买时间：11月11日']);
        setDemoOutput(prev => [...prev, '🔔 已设置价格提醒：目标价格¥7,200']);
      },
    },
    {
      label: '实时监控',
      description: '启动价格和交通监控',
      action: async () => {
        setDemoOutput(prev => [...prev, '📡 启动实时数据监控...']);
        await new Promise(resolve => setTimeout(resolve, 800));
        setDemoOutput(prev => [...prev, '✅ 价格监控已启动']);
        setDemoOutput(prev => [...prev, '✅ 交通状况监控已启动']);
        setDemoOutput(prev => [...prev, '🔄 自动刷新间隔：5分钟']);
        setDemoOutput(prev => [...prev, '🎉 演示完成！所有功能正常运行']);
      },
    },
  ];

  // 运行演示
  const runDemo = async () => {
    setIsRunningDemo(true);
    setDemoOutput([]);
    setDemoStep(0);

    for (let i = 0; i < demoSteps.length; i++) {
      setDemoStep(i);
      await demoSteps[i].action();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsRunningDemo(false);
  };

  // 停止演示
  const stopDemo = () => {
    setIsRunningDemo(false);
  };

  // 处理JARVIS输入
  const handleJarvisInput = async () => {
    if (!jarvisInput.trim() || isProcessing) return;

    setIsProcessing(true);
    setJarvisResponse(null);

    try {
      const response = await jarvisIntegrationService.processInput(
        jarvisInput,
        'demo_user',
        'demo_session'
      );
      setJarvisResponse(response);
    } catch (error) {
      console.error('Error processing JARVIS input:', error);
      setJarvisResponse({
        type: 'text',
        content: '抱歉，处理您的请求时出现错误。',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 示例JARVIS命令
  const exampleCommands = [
    '导航到北京西站',
    '附近的餐厅',
    '搜索iPhone 15价格',
    '比较iPad价格',
    '设置MacBook价格提醒',
    '查询交通状况',
    '推荐购买时机',
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* 标题 */}
      <Box textAlign="center" mb={4}>
        <Typography variant="h3" component="h1" gutterBottom>
          JARVIS 导航与购物系统演示
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          集成Google Maps地图导航和智能价格比对系统
        </Typography>
        <Box mt={2}>
          <Chip label="Google Maps API" color="primary" sx={{ mr: 1 }} />
          <Chip label="价格比对" color="secondary" sx={{ mr: 1 }} />
          <Chip label="实时监控" color="success" sx={{ mr: 1 }} />
          <Chip label="AI推荐" color="warning" />
        </Box>
      </Box>

      {/* 主要内容 */}
      <Grid container spacing={3}>
        {/* 左侧：功能演示区域 */}
        <Grid item xs={12} lg={8}>
          <Paper elevation={3}>
            <Tabs
              value={currentTab}
              onChange={(_, newValue) => setCurrentTab(newValue)}
              variant="fullWidth"
            >
              <Tab icon={<Map />} label="地图导航" />
              <Tab icon={<ShoppingCart />} label="价格比对" />
              <Tab icon={<Assistant />} label="JARVIS AI" />
              <Tab icon={<Code />} label="系统演示" />
            </Tabs>

            {/* 地图导航标签页 */}
            <TabPanel value={currentTab} index={0}>
              <Box height="600px">
                <MapView
                  onLocationSelect={(location) => {
                    console.log('Location selected:', location);
                  }}
                  onRouteCalculated={(route) => {
                    console.log('Route calculated:', route);
                  }}
                />
              </Box>
            </TabPanel>

            {/* 价格比对标签页 */}
            <TabPanel value={currentTab} index={1}>
              <PriceComparison
                onProductSelect={(product) => {
                  console.log('Product selected:', product);
                }}
                onPriceAlert={(productId, targetPrice) => {
                  console.log('Price alert set:', productId, targetPrice);
                }}
              />
            </TabPanel>

            {/* JARVIS AI标签页 */}
            <TabPanel value={currentTab} index={2}>
              <Box>
                <Typography variant="h5" gutterBottom>
                  与JARVIS对话
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  尝试以下命令，体验AI助手的智能导航和购物功能：
                </Typography>

                {/* 输入区域 */}
                <Box display="flex" gap={2} mb={3}>
                  <TextField
                    fullWidth
                    label="输入您的指令"
                    placeholder="例如：导航到北京西站"
                    value={jarvisInput}
                    onChange={(e) => setJarvisInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleJarvisInput()}
                  />
                  <Button
                    variant="contained"
                    onClick={handleJarvisInput}
                    disabled={isProcessing || !jarvisInput.trim()}
                    sx={{ minWidth: 100 }}
                  >
                    {isProcessing ? '处理中...' : '发送'}
                  </Button>
                </Box>

                {/* 示例命令 */}
                <Box mb={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    示例命令：
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {exampleCommands.map((command, index) => (
                      <Chip
                        key={index}
                        label={command}
                        variant="outlined"
                        clickable
                        onClick={() => setJarvisInput(command)}
                      />
                    ))}
                  </Box>
                </Box>

                {/* JARVIS响应 */}
                {jarvisResponse && (
                  <Paper elevation={1} sx={{ p: 3, backgroundColor: 'background.default' }}>
                    <Typography variant="h6" gutterBottom>
                      JARVIS 回复：
                    </Typography>
                    <Typography variant="body1" paragraph>
                      {jarvisResponse.content}
                    </Typography>

                    {jarvisResponse.actions && jarvisResponse.actions.length > 0 && (
                      <Box mt={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          建议操作：
                        </Typography>
                        {jarvisResponse.actions.map((action, index) => (
                          <Button
                            key={index}
                            variant="outlined"
                            size="small"
                            sx={{ mr: 1, mb: 1 }}
                            onClick={() => console.log('Action:', action)}
                          >
                            {action.description}
                          </Button>
                        ))}
                      </Box>
                    )}

                    {jarvisResponse.metadata?.suggestions && (
                      <Box mt={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          相关建议：
                        </Typography>
                        <Box display="flex" flexWrap="wrap" gap={1}>
                          {jarvisResponse.metadata.suggestions.map((suggestion: string, index: number) => (
                            <Chip
                              key={index}
                              label={suggestion}
                              size="small"
                              variant="outlined"
                              clickable
                              onClick={() => setJarvisInput(suggestion)}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Paper>
                )}
              </Box>
            </TabPanel>

            {/* 系统演示标签页 */}
            <TabPanel value={currentTab} index={3}>
              <Box>
                <Typography variant="h5" gutterBottom>
                  系统功能演示
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  观看完整的系统功能演示，了解所有特性如何协同工作。
                </Typography>

                {/* 演示控制 */}
                <Box display="flex" gap={2} mb={3}>
                  <Button
                    variant="contained"
                    startIcon={<PlayArrow />}
                    onClick={runDemo}
                    disabled={isRunningDemo}
                  >
                    开始演示
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Stop />}
                    onClick={stopDemo}
                    disabled={!isRunningDemo}
                  >
                    停止演示
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={() => setDemoOutput([])}
                  >
                    清除输出
                  </Button>
                </Box>

                <Grid container spacing={3}>
                  {/* 演示步骤 */}
                  <Grid item xs={12} md={6}>
                    <Paper elevation={1} sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        演示步骤
                      </Typography>
                      <Stepper activeStep={demoStep} orientation="vertical">
                        {demoSteps.map((step, index) => (
                          <Step key={index}>
                            <StepLabel>{step.label}</StepLabel>
                            <StepContent>
                              <Typography variant="body2">
                                {step.description}
                              </Typography>
                            </StepContent>
                          </Step>
                        ))}
                      </Stepper>
                    </Paper>
                  </Grid>

                  {/* 演示输出 */}
                  <Grid item xs={12} md={6}>
                    <Paper elevation={1} sx={{ p: 2, height: 400, overflow: 'auto' }}>
                      <Typography variant="h6" gutterBottom>
                        演示输出
                      </Typography>
                      <Box
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          backgroundColor: 'background.paper',
                          p: 1,
                          borderRadius: 1,
                          border: 1,
                          borderColor: 'divider',
                        }}
                      >
                        {demoOutput.length === 0 ? (
                          <Typography color="text.secondary">
                            点击"开始演示"查看系统运行过程...
                          </Typography>
                        ) : (
                          demoOutput.map((line, index) => (
                            <div key={index}>{line}</div>
                          ))
                        )}
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            </TabPanel>
          </Paper>
        </Grid>

        {/* 右侧：功能特性和说明 */}
        <Grid item xs={12} lg={4}>
          <Box display="flex" flexDirection="column" gap={3}>
            {/* 主要功能 */}
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  主要功能
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <Map color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="智能地图导航"
                      secondary="Google Maps集成，路线规划，实时交通"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <ShoppingCart color="secondary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="价格比对系统"
                      secondary="多平台价格对比，优惠券查找"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <TrendingUp color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="智能购物建议"
                      secondary="AI分析，价格预测，购买时机"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Notifications color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary="实时监控提醒"
                      secondary="价格变动，交通状况，促销活动"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>

            {/* 技术特性 */}
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  技术特性
                </Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  <Chip label="React + TypeScript" variant="outlined" />
                  <Chip label="Google Maps API" variant="outlined" />
                  <Chip label="Material-UI设计" variant="outlined" />
                  <Chip label="实时WebSocket" variant="outlined" />
                  <Chip label="智能缓存系统" variant="outlined" />
                  <Chip label="离线模式支持" variant="outlined" />
                  <Chip label="响应式设计" variant="outlined" />
                  <Chip label="自然语言处理" variant="outlined" />
                </Box>
              </CardContent>
            </Card>

            {/* 使用说明 */}
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  使用说明
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>1. 地图导航：</strong>
                  搜索地点、规划路线、查看实时交通状况
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>2. 价格比对：</strong>
                  搜索商品、比较价格、设置价格提醒
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>3. AI助手：</strong>
                  使用自然语言与JARVIS对话，获取智能建议
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>4. 系统演示：</strong>
                  观看完整的功能演示，了解系统能力
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" startIcon={<Description />}>
                  查看文档
                </Button>
                <Button size="small" startIcon={<Code />}>
                  查看源码
                </Button>
              </CardActions>
            </Card>
          </Box>
        </Grid>
      </Grid>

      {/* 浮动操作按钮 */}
      <Fab
        color="primary"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
        onClick={() => setCurrentTab(2)}
      >
        <Assistant />
      </Fab>
    </Container>
  );
};

export default NavigationShoppingDemo;