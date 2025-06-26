import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  TextField,
  IconButton,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Divider,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import {
  Send,
  Mic,
  MicOff,
  Image,
  Map,
  ShoppingCart,
  Phone,
  Schedule,
  Article,
  CloudOutlined,
  PersonOutlined,
  SmartToyOutlined,
  Psychology,
} from '@mui/icons-material';

interface ContentPanelProps {
  isConnected: boolean;
  jarvisStatus: any;
  onShowNotification: (message: string, severity?: 'info' | 'success' | 'warning' | 'error') => void;
  onAdjustPanelSizes: (avatarWidth: number, contentWidth: number) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'image' | 'system';
  model?: 'qwen' | 'deepseek';
  thinking?: boolean;
}

interface ContentState {
  activeTab: number;
  messages: Message[];
  inputText: string;
  isRecording: boolean;
  isLoading: boolean;
  selectedMode: 'auto' | 'qwen' | 'deepseek';
}

const ContentPanel: React.FC<ContentPanelProps> = ({
  isConnected,
  jarvisStatus,
  onShowNotification,
  onAdjustPanelSizes,
}) => {
  const [state, setState] = useState<ContentState>({
    activeTab: 0,
    messages: [],
    inputText: '',
    isRecording: false,
    isLoading: false,
    selectedMode: 'auto',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  // 初始化欢迎消息
  useEffect(() => {
    if (isConnected && state.messages.length === 0) {
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '你好主人！我是您的智能管家小爱，很高兴为您服务！有什么可以帮助您的吗？',
        timestamp: new Date(),
        type: 'text',
        model: 'qwen',
      };
      setState(prev => ({
        ...prev,
        messages: [welcomeMessage],
      }));
    }
  }, [isConnected]);

  // 发送消息
  const sendMessage = async () => {
    if (!state.inputText.trim() || !isConnected || state.isLoading) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: state.inputText.trim(),
      timestamp: new Date(),
      type: 'text',
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      inputText: '',
      isLoading: true,
    }));

    try {
      // 发送到JARVIS后端
      const response = await fetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          mode: state.selectedMode,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || '抱歉，我遇到了一些问题。',
        timestamp: new Date(),
        type: 'text',
        model: data.model_used || state.selectedMode,
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isLoading: false,
      }));

    } catch (error) {
      console.error('发送消息失败:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉主人，我遇到了技术问题，请稍后再试。',
        timestamp: new Date(),
        type: 'text',
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isLoading: false,
      }));

      onShowNotification('消息发送失败', 'error');
    }
  };

  // 处理输入框回车事件
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  // 切换录音状态
  const toggleRecording = () => {
    setState(prev => ({
      ...prev,
      isRecording: !prev.isRecording,
    }));
    onShowNotification(
      state.isRecording ? '录音已停止' : '开始录音...',
      'info'
    );
  };

  // 切换AI模型模式
  const switchMode = (mode: 'auto' | 'qwen' | 'deepseek') => {
    setState(prev => ({ ...prev, selectedMode: mode }));
    onShowNotification(`已切换到${mode === 'auto' ? '自动选择' : mode.toUpperCase()}模式`, 'info');
  };

  // 渲染消息列表
  const renderMessages = () => (
    <List sx={{ flex: 1, overflow: 'auto', py: 1 }}>
      {state.messages.map((message) => (
        <ListItem
          key={message.id}
          sx={{
            flexDirection: 'column',
            alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
            mb: 1,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              maxWidth: '80%',
              flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <ListItemAvatar>
              <Avatar
                sx={{
                  bgcolor: message.role === 'user' ? 'primary.main' : 'secondary.main',
                  width: 32,
                  height: 32,
                }}
              >
                {message.role === 'user' ? (
                  <PersonOutlined fontSize="small" />
                ) : (
                  <SmartToyOutlined fontSize="small" />
                )}
              </Avatar>
            </ListItemAvatar>

            <Paper
              elevation={1}
              sx={{
                p: 2,
                bgcolor: message.role === 'user' ? 'primary.dark' : 'background.paper',
                color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                borderRadius: 2,
                position: 'relative',
              }}
            >
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {message.content}
              </Typography>
              
              {/* 模型标识 */}
              {message.model && message.role === 'assistant' && (
                <Chip
                  size="small"
                  label={message.model === 'qwen' ? 'Q' : message.model === 'deepseek' ? 'D' : 'A'}
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    width: 20,
                    height: 20,
                    fontSize: 10,
                    bgcolor: message.model === 'qwen' ? 'info.main' : 'warning.main',
                  }}
                />
              )}

              {/* 时间戳 */}
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mt: 0.5,
                  opacity: 0.7,
                  fontSize: 10,
                }}
              >
                {message.timestamp.toLocaleTimeString()}
              </Typography>
            </Paper>
          </Box>
        </ListItem>
      ))}

      {/* 加载指示器 */}
      {state.isLoading && (
        <ListItem>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              ml: 6,
            }}
          >
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              JARVIS正在思考...
            </Typography>
          </Box>
        </ListItem>
      )}

      <div ref={messagesEndRef} />
    </List>
  );

  // 渲染输入区域
  const renderInputArea = () => (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      {/* 模型选择 */}
      <Box sx={{ mb: 1, display: 'flex', gap: 1, justifyContent: 'center' }}>
        {(['auto', 'qwen', 'deepseek'] as const).map((mode) => (
          <Button
            key={mode}
            size="small"
            variant={state.selectedMode === mode ? 'contained' : 'outlined'}
            onClick={() => switchMode(mode)}
            startIcon={
              mode === 'auto' ? <Psychology /> :
              mode === 'qwen' ? <CloudOutlined /> : 
              <Psychology />
            }
          >
            {mode === 'auto' ? '智能选择' :
             mode === 'qwen' ? 'Qwen快速' :
             'DeepSeek深度'}
          </Button>
        ))}
      </Box>

      {/* 输入框 */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <TextField
          ref={inputRef}
          fullWidth
          multiline
          maxRows={4}
          variant="outlined"
          placeholder={isConnected ? "跟JARVIS说些什么..." : "等待连接..."}
          value={state.inputText}
          disabled={!isConnected || state.isLoading}
          onChange={(e) => setState(prev => ({ ...prev, inputText: e.target.value }))}
          onKeyPress={handleKeyPress}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {/* 录音按钮 */}
                <IconButton
                  onClick={toggleRecording}
                  disabled={!isConnected}
                  color={state.isRecording ? 'error' : 'default'}
                >
                  {state.isRecording ? <MicOff /> : <Mic />}
                </IconButton>
                
                {/* 图片上传按钮 */}
                <IconButton disabled={!isConnected}>
                  <Image />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {/* 发送按钮 */}
        <IconButton
          onClick={sendMessage}
          disabled={!isConnected || !state.inputText.trim() || state.isLoading}
          color="primary"
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            '&:hover': {
              bgcolor: 'primary.dark',
            },
            '&:disabled': {
              bgcolor: 'action.disabledBackground',
              color: 'action.disabled',
            },
          }}
        >
          {state.isLoading ? <CircularProgress size={20} /> : <Send />}
        </IconButton>
      </Box>
    </Paper>
  );

  // 渲染动态内容标签页
  const renderDynamicContent = () => {
    switch (state.activeTab) {
      case 1: // 地图
        return (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Map sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              地图导航
            </Typography>
            <Typography variant="body2" color="text.secondary">
              地图功能开发中...
            </Typography>
          </Box>
        );
      case 2: // 购物
        return (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <ShoppingCart sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              购物助手
            </Typography>
            <Typography variant="body2" color="text.secondary">
              价格比对功能开发中...
            </Typography>
          </Box>
        );
      case 3: // 日程
        return (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Schedule sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              日程管理
            </Typography>
            <Typography variant="body2" color="text.secondary">
              日程功能开发中...
            </Typography>
          </Box>
        );
      case 4: // 新闻
        return (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Article sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              新闻资讯
            </Typography>
            <Typography variant="body2" color="text.secondary">
              新闻功能开发中...
            </Typography>
          </Box>
        );
      default: // 对话
        return (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {renderMessages()}
            {renderInputArea()}
          </Box>
        );
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标签栏 */}
      <Paper elevation={1} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={state.activeTab}
          onChange={(_, newValue) => setState(prev => ({ ...prev, activeTab: newValue }))}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<SmartToyOutlined />} label="对话" />
          <Tab icon={<Map />} label="地图" />
          <Tab icon={<ShoppingCart />} label="购物" />
          <Tab icon={<Schedule />} label="日程" />
          <Tab icon={<Article />} label="新闻" />
        </Tabs>
      </Paper>

      {/* 内容区域 */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {renderDynamicContent()}
      </Box>
    </Box>
  );
};

export default ContentPanel;