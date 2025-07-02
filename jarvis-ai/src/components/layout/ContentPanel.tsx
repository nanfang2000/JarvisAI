import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Tooltip,
  Badge,
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
  VolumeUp,
  VolumeOff,
  Stop,
} from '@mui/icons-material';
import { voiceService, voiceCommandProcessor, VoiceRecognitionResult } from '../../services/voiceService';
import { pythonSpeechService, PythonSpeechService } from '../../services/pythonSpeechService';

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
  isSpeaking: boolean;
  voiceEnabled: boolean;
  isListening: boolean;
  recognitionText: string;
  voiceSupported: boolean;
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
    isSpeaking: false,
    voiceEnabled: true,
    isListening: false,
    recognitionText: '',
    voiceSupported: false,
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

  // 语音服务初始化状态
  const [voiceInitialized, setVoiceInitialized] = useState(false);
  const [voiceProvider, setVoiceProvider] = useState<'browser' | 'python_backend'>('browser');
  const [pythonService, setPythonService] = useState<PythonSpeechService | null>(null);

  // 检查语音配置和支持
  useEffect(() => {
    const checkVoiceSupport = async () => {
      console.log('🔍 检查语音支持...');
      
      try {
        // 首先尝试检查Python后端语音服务
        const backendResponse = await fetch('http://127.0.0.1:8000/status');
        if (backendResponse.ok) {
          console.log('🎯 使用Python后端语音识别服务');
          setVoiceProvider('python_backend');
          
          // 初始化Python语音服务
          setPythonService(pythonSpeechService);
          
          setState(prev => ({
            ...prev,
            voiceSupported: true
          }));
          
          setTimeout(() => {
            onShowNotification('JARVIS已升级为Python后端语音识别！点击🎤按钮体验专业级语音功能', 'success');
          }, 2000);
          
          return;
        }
      } catch (error) {
        console.log('⚠️ Python后端连接失败，降级到浏览器语音API:', error);
      }
      
      // 最后降级到浏览器语音API
      console.log('🔄 使用浏览器语音API');
      setVoiceProvider('browser');
      
      const status = voiceService.getStatus();
      console.log('📊 浏览器语音服务状态:', status);
      
      setState(prev => ({
        ...prev,
        voiceSupported: status.isSupported
      }));

      if (!status.isSupported) {
        console.log('❌ 浏览器不支持语音识别');
        
        // 检测是否在Tauri环境中
        const isTauri = !!(window as any).__TAURI__;
        
        if (isTauri) {
          onShowNotification('桌面版语音功能受限，请在浏览器中访问 http://localhost:1420 使用完整语音功能', 'warning');
        } else {
          onShowNotification('您的浏览器不支持语音识别，建议升级到Chrome、Edge或Safari浏览器', 'error');
        }
      } else {
        console.log('✅ 浏览器支持语音识别');
        setTimeout(() => {
          onShowNotification('JARVIS已就绪！点击🎤按钮使用语音功能', 'info');
        }, 2000);
      }
    };

    checkVoiceSupport();

    // 清理函数
    return () => {
      voiceService.destroy();
    };
  }, []);

  // 完整初始化语音服务（需要用户交互）
  const initVoiceServiceFull = async () => {
    if (voiceInitialized || !state.voiceSupported) {
      return true;
    }

    console.log('🚀 完整初始化语音服务...', { provider: voiceProvider });
    
    try {
      const currentService = voiceProvider === 'python_backend' ? pythonService : voiceService;
      
      if (!currentService) {
        throw new Error('语音服务未初始化');
      }
      
      // 检查麦克风权限
      const hasPermission = await currentService.checkPermissions();
      console.log('🎤 麦克风权限状态:', hasPermission);
      
      if (!hasPermission) {
        // 尝试请求权限
        console.log('🔐 请求麦克风权限...');
        const granted = await currentService.requestPermissions();
        console.log('📋 权限请求结果:', granted);
        
        if (!granted) {
          onShowNotification('需要麦克风权限才能使用语音功能', 'warning');
          return false;
        }
      }

      // 设置语音事件监听器
      currentService.setEventListeners({
        onResult: handleVoiceResult,
        onError: handleVoiceError,
        onStart: () => {
          setState(prev => ({ ...prev, isListening: true }));
          onShowNotification('正在监听...', 'info');
        },
        onEnd: () => {
          setState(prev => ({ ...prev, isListening: false, recognitionText: '' }));
        },
        onSpeechStart: () => {
          setState(prev => ({ ...prev, isSpeaking: true }));
        },
        onSpeechEnd: () => {
          setState(prev => ({ ...prev, isSpeaking: false }));
        }
      });

      setVoiceInitialized(true);
      console.log('✅ 语音服务完整初始化成功');
      const providerName = voiceProvider === 'python_backend' ? 'Python后端' : '浏览器';
      onShowNotification(`${providerName}语音功能已就绪！`, 'success');
      return true;
    } catch (error) {
      console.error('❌ 语音服务初始化失败:', error);
      onShowNotification('语音服务初始化失败', 'error');
      return false;
    }
  };

  // 在用户首次交互时自动初始化
  useEffect(() => {
    const handleFirstInteraction = async () => {
      if (!voiceInitialized && state.voiceSupported) {
        console.log('👆 检测到用户交互，自动初始化语音服务');
        try {
          await initVoiceServiceFull();
        } catch (error) {
          console.error('❌ 自动初始化失败:', error);
        }
      }
    };

    // 监听多种用户交互事件
    const events = ['click', 'keydown', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleFirstInteraction, { once: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleFirstInteraction);
      });
    };
  }, [state.voiceSupported, voiceInitialized]);

  // 语音识别结果处理
  const handleVoiceResult = useCallback((result: VoiceRecognitionResult) => {
    console.log('🎙️ handleVoiceResult 收到结果:', result);
    
    setState(prev => ({
      ...prev,
      recognitionText: result.transcript
    }));

    if (result.isFinal && result.transcript.trim()) {
      console.log('✅ 完整语音识别结果，准备处理:', result.transcript);
      
      // 检查是否是语音命令
      const isCommand = voiceCommandProcessor.processCommand(result.transcript);
      console.log('🔍 是否为语音命令:', isCommand);
      
      if (!isCommand) {
        // 发送普通消息
        console.log('📤 准备发送语音消息到Chat:', result.transcript.trim());
        sendVoiceMessage(result.transcript.trim());
      } else {
        console.log('🎛️ 处理语音命令:', result.transcript);
      }
    } else if (result.transcript.trim()) {
      console.log('⏳ 部分语音识别结果:', result.transcript);
    }
  }, []);

  // 语音错误处理
  const handleVoiceError = useCallback((error: string) => {
    setState(prev => ({
      ...prev,
      isListening: false,
      recognitionText: ''
    }));
    onShowNotification(`语音识别错误: ${error}`, 'error');
  }, [onShowNotification]);

  const isConnectedRef = useRef(isConnected);
  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);

  // 发送语音消息
  const sendVoiceMessage = async (content: string) => {
    console.log('📤 sendVoiceMessage 被调用，内容:', content);
    
    if (!content.trim() || !isConnectedRef.current || state.isLoading) {
      console.log('❌ sendVoiceMessage 被阻止:', {
        hasContent: !!content.trim(),
        isConnected:isConnectedRef.current,
        isLoading: state.isLoading
      });
      return;
    }

    console.log('✅ 创建用户消息到聊天历史');
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content,
      timestamp: new Date(),
      type: 'text',
    };

    console.log('📝 添加用户消息到聊天界面:', userMessage);
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      recognitionText: ''
    }));

    try {
      console.log('🚀 发送语音消息到Chat API:', {
        url: 'http://127.0.0.1:8000/chat',
        message: content,
        mode: state.selectedMode
      });
      
      // 发送到JARVIS后端
      const response = await fetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          mode: state.selectedMode,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ 收到Chat API响应:', data);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || '抱歉，我遇到了一些问题。',
        timestamp: new Date(),
        type: 'text',
        model: data.model_used || state.selectedMode,
      };

      console.log('🤖 创建AI助手消息:', assistantMessage);
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isLoading: false,
      }));
      
      console.log('✅ 语音消息对话完成，AI响应已添加到聊天历史');
      onShowNotification('✅ 语音识别完成，已发送给AI并收到回复', 'success');

      // 语音播放响应
      if (state.voiceEnabled && assistantMessage.content) {
        try {
          await voiceService.speak(assistantMessage.content);
        } catch (speechError) {
          console.error('语音合成失败:', speechError);
          onShowNotification('语音播放失败', 'warning');
        }
      }

    } catch (error) {
      console.error('发送语音消息失败:', error);
      
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

      onShowNotification('语音消息发送失败', 'error');
    }
  };

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

  // 切换语音识别
  const toggleVoiceRecognition = async () => {
    console.log('🎤 toggleVoiceRecognition 函数被调用!');
    console.log('🔍 当前状态检查:', {
      voiceSupported: state.voiceSupported,
      voiceInitialized,
      isListening: state.isListening,
      voiceEnabled: state.voiceEnabled,
      isConnected,
      voiceProvider,
      pythonService,
      currentService: voiceProvider === 'python_backend' ? pythonService : voiceService
    });
    
    if (!state.voiceSupported) {
      console.log('❌ 语音识别不可用 - voiceSupported:', state.voiceSupported);
      onShowNotification('语音识别不可用', 'error');
      return;
    }
    
    if (!state.voiceEnabled) {
      console.log('❌ 语音功能已禁用 - voiceEnabled:', state.voiceEnabled);
      onShowNotification('语音功能已禁用，请先开启', 'warning');
      return;
    }
    
    if (!isConnected) {
      console.log('❌ 后端未连接 - isConnected:', isConnected);
      onShowNotification('后端服务未连接', 'error');
      return;
    }

    // 首次使用时自动初始化
    if (!voiceInitialized) {
      console.log('🔧 首次使用，自动初始化语音服务...');
      const initSuccess = await initVoiceServiceFull();
      if (!initSuccess) {
        return;
      }
    }

    const currentService = voiceProvider === 'python_backend' ? pythonService : voiceService;
    
    console.log(`🎯 使用语音服务: ${voiceProvider}, 服务对象:`, currentService);
    
    if (!currentService) {
      onShowNotification('语音服务未初始化', 'error');
      return;
    }

    if (state.isListening) {
      console.log('🛑 停止语音识别');
      currentService.stopListening();
    } else {
      console.log('🚀 启动语音识别');
      
      // 再次确认麦克风权限
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        console.log('✅ 麦克风权限确认正常');
      } catch (error) {
        console.error('❌ 麦克风权限检查失败:', error);
        onShowNotification('麦克风权限异常，请重新授权', 'error');
        return;
      }
      
      // 检查语音识别对象状态
      const serviceStatus = currentService.getStatus();
      console.log('📊 服务状态详情:', serviceStatus);
      
      const success = await currentService.startListening();
      console.log('🎯 启动结果:', success);
      
      if (!success) {
        console.log('❌ 启动失败，尝试重新创建语音识别对象...');
        
        // 强制重新创建语音识别
        currentService.destroy();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 重新初始化
        setVoiceInitialized(false);
        const reinitSuccess = await initVoiceServiceFull();
        
        if (reinitSuccess) {
          console.log('🔄 重新初始化成功，再次尝试启动...');
          const retrySuccess = await currentService.startListening();
          if (!retrySuccess) {
            const providerName = voiceProvider === 'python_backend' ? 'Python后端' : '浏览器';
            onShowNotification(`${providerName}语音识别启动失败，请刷新页面重试`, 'error');
          }
        } else {
          onShowNotification('语音服务重新初始化失败', 'error');
        }
      }
    }
  };

  // 打断语音播放
  const interruptSpeech = () => {
    const interrupted = voiceService.interrupt();
    if (interrupted) {
      onShowNotification('已打断语音播放', 'info');
    }
  };

  // 切换语音功能开关
  const toggleVoiceEnabled = () => {
    setState(prev => ({ ...prev, voiceEnabled: !prev.voiceEnabled }));
    onShowNotification(
      state.voiceEnabled ? '语音功能已关闭' : '语音功能已开启',
      'info'
    );
  };

  // 调试：显示语音状态
  const showVoiceDebugInfo = () => {
    const status = voiceService.getStatus();
    const debugInfo = {
      isConnected,
      voiceSupported: state.voiceSupported,
      voiceEnabled: state.voiceEnabled,
      voiceInitialized,
      isListening: state.isListening,
      isSpeaking: state.isSpeaking,
      serviceStatus: status,
      userAgent: navigator.userAgent,
      isSecureContext: window.isSecureContext,
      protocol: window.location.protocol,
      host: window.location.host
    };
    console.log('🐛 语音服务调试信息:', debugInfo);
    onShowNotification(`调试信息已输出到控制台 - 连接:${isConnected} 支持:${state.voiceSupported} 启用:${state.voiceEnabled} 初始化:${voiceInitialized}`, 'info');
  };

  // 强制重新初始化语音服务
  const forceReinitVoice = async () => {
    console.log('🔄 强制重新初始化语音服务...');
    onShowNotification('正在重新初始化语音服务...', 'info');
    
    try {
      // 重置初始化状态
      setVoiceInitialized(false);
      
      // 销毁现有服务
      voiceService.destroy();
      
      // 等待一段时间确保完全清理
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 重新检查语音支持
      const status = voiceService.getStatus();
      console.log('📊 重新初始化后状态:', status);
      
      setState(prev => ({
        ...prev,
        voiceSupported: status.isSupported
      }));

      if (status.isSupported) {
        // 执行完整初始化
        const initSuccess = await initVoiceServiceFull();
        
        if (initSuccess) {
          onShowNotification('语音服务重新初始化成功！', 'success');
        } else {
          onShowNotification('语音服务初始化失败', 'error');
        }
      } else {
        onShowNotification('浏览器不支持语音识别', 'error');
      }
    } catch (error) {
      console.error('❌ 重新初始化失败:', error);
      onShowNotification('语音服务初始化失败', 'error');
    }
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
      {/* 调试按钮 */}
      <Box sx={{ mb: 1, display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button 
            size="small" 
            variant="outlined" 
            onClick={showVoiceDebugInfo}
            sx={{ fontSize: '10px', minWidth: '60px' }}
          >
            调试语音
          </Button>
          
          {/* 重新初始化语音服务按钮 */}
          <Button 
            size="small" 
            variant="outlined" 
            color="secondary"
            onClick={forceReinitVoice}
            sx={{ fontSize: '10px', minWidth: '60px' }}
          >
            重新初始化
          </Button>
          
          {/* 麦克风测试按钮 */}
          <Button 
            size="small" 
            variant="outlined" 
            color="warning"
            onClick={async () => {
              console.log('🧪 开始麦克风测试...');
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                console.log('✅ 麦克风测试成功:', stream);
                onShowNotification('麦克风测试成功！', 'success');
                stream.getTracks().forEach(track => track.stop());
              } catch (error) {
                console.error('❌ 麦克风测试失败:', error);
                onShowNotification(`麦克风测试失败: ${error.message}`, 'error');
              }
            }}
            sx={{ fontSize: '10px', minWidth: '60px' }}
          >
            测试麦克风
          </Button>
          
          {/* 立即初始化按钮 */}
          <Button 
            size="small" 
            variant="contained" 
            color="success"
            onClick={async () => {
              console.log('⚡ 立即强制初始化...');
              try {
                const result = await initVoiceServiceFull();
                if (result) {
                  onShowNotification('立即初始化成功！', 'success');
                } else {
                  onShowNotification('立即初始化失败', 'error');
                }
              } catch (error) {
                console.error('❌ 立即初始化失败:', error);
                onShowNotification('立即初始化失败', 'error');
              }
            }}
            sx={{ fontSize: '10px', minWidth: '60px' }}
          >
            立即初始化
          </Button>
          
          {/* 测试语音处理按钮 */}
          <Button 
            size="small" 
            variant="contained" 
            color="warning"
            onClick={() => {
              console.log('🧪 测试语音处理流程');
              const testResult = {
                transcript: '测试语音识别结果',
                isFinal: true,
                confidence: 0.95
              };
              console.log('🎯 模拟语音识别结果:', testResult);
              handleVoiceResult(testResult);
            }}
            sx={{ fontSize: '10px', minWidth: '60px' }}
          >
            测试语音处理
          </Button>
          
          {/* 测试WebSocket连接按钮 */}
          <Button 
            size="small" 
            variant="contained" 
            color="error"
            onClick={() => {
              console.log('🔍 检查WebSocket连接状态');
              const currentService = voiceProvider === 'python_backend' ? pythonService : voiceService;
              if (currentService) {
                const status = currentService.getStatus();
                console.log('📊 当前语音服务状态:', status);
                
                // 检查是否是Python后端服务（有WebSocket连接）
                if ('hasWebSocket' in status) {
                  onShowNotification(`WebSocket状态: ${status.hasWebSocket ? '已连接' : '未连接'}`, 
                    status.hasWebSocket ? 'success' : 'error');
                } else {
                  // 浏览器原生语音识别服务
                  onShowNotification(`语音识别状态: ${status.isSupported ? '支持' : '不支持'}`, 
                    status.isSupported ? 'success' : 'error');
                }
              } else {
                console.log('❌ 语音服务未初始化');
                onShowNotification('语音服务未初始化', 'error');
              }
            }}
            sx={{ fontSize: '10px', minWidth: '60px' }}
          >
            检查连接
          </Button>
          
          {/* 如果在Tauri中且语音不支持，显示浏览器版本按钮 */}
          {!state.voiceSupported && !!(window as any).__TAURI__ && (
            <Button 
              size="small" 
              variant="contained" 
              color="primary"
              onClick={() => {
                if ((window as any).__TAURI__?.shell?.open) {
                  (window as any).__TAURI__.shell.open('http://localhost:1420');
                } else {
                  window.open('http://localhost:1420', '_blank');
                }
              }}
              sx={{ fontSize: '10px', minWidth: '80px' }}
            >
              浏览器版本
            </Button>
          )}
        </Box>
        
        <Typography variant="caption" color="text.secondary">
          连接:{isConnected?'✅':'❌'} 语音:{state.voiceSupported?'✅':'❌'} 启用:{state.voiceEnabled?'✅':'❌'} 初始化:{voiceInitialized?'✅':'❌'} 提供商:{voiceProvider === 'python_backend' ? 'Python后端' : '浏览器'}
        </Typography>
      </Box>

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

      {/* 语音状态显示 */}
      {(state.isListening || state.isSpeaking || state.recognitionText) && (
        <Box sx={{ mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {state.isListening && (
              <>
                <CircularProgress size={16} />
                <Typography variant="body2" color="primary">
                  正在监听...
                </Typography>
              </>
            )}
            {state.isSpeaking && (
              <>
                <VolumeUp color="secondary" />
                <Typography variant="body2" color="secondary">
                  JARVIS正在说话...
                </Typography>
                <Button size="small" onClick={interruptSpeech} startIcon={<Stop />}>
                  打断
                </Button>
              </>
            )}
          </Box>
          {state.recognitionText && (
            <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
              识别中: {state.recognitionText}
            </Typography>
          )}
        </Box>
      )}

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
                {/* 语音功能切换 */}
                <Tooltip title={state.voiceEnabled ? "关闭语音" : "开启语音"}>
                  <IconButton
                    onClick={toggleVoiceEnabled}
                    disabled={!state.voiceSupported}
                    color={state.voiceEnabled ? 'primary' : 'default'}
                  >
                    {state.voiceEnabled ? <VolumeUp /> : <VolumeOff />}
                  </IconButton>
                </Tooltip>

                {/* 语音识别按钮 */}
                <Tooltip title={state.isListening ? "停止识别" : "开始语音识别"}>
                  <Badge
                    variant="dot"
                    color="primary"
                    invisible={!state.isListening}
                  >
                    <IconButton
                      onClick={(e) => {
                        console.log('🎤 麦克风按钮被点击!');
                        console.log('📊 按钮状态检查:', {
                          isConnected,
                          voiceSupported: state.voiceSupported,
                          voiceEnabled: state.voiceEnabled,
                          voiceInitialized,
                          voiceProvider,
                          buttonDisabled: !isConnected || !state.voiceSupported || !state.voiceEnabled
                        });
                        toggleVoiceRecognition();
                      }}
                      disabled={!isConnected || !state.voiceSupported || !state.voiceEnabled}
                      color={state.isListening ? 'error' : (voiceInitialized ? 'primary' : 'default')}
                      sx={{
                        animation: state.isListening ? 'pulse 2s infinite' : 'none',
                        '@keyframes pulse': {
                          '0%': { transform: 'scale(1)' },
                          '50%': { transform: 'scale(1.1)' },
                          '100%': { transform: 'scale(1)' },
                        },
                      }}
                    >
                      {state.isListening ? <MicOff /> : <Mic />}
                    </IconButton>
                  </Badge>
                </Tooltip>
                
                {/* 图片上传按钮 */}
                <Tooltip title="上传图片">
                  <IconButton disabled={!isConnected}>
                    <Image />
                  </IconButton>
                </Tooltip>
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