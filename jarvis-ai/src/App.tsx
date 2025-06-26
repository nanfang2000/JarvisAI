import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, Alert, Snackbar } from '@mui/material';
import MainLayout from './components/layout/MainLayout';

// 创建暗色主题
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#64B5F6', // 浅蓝色
    },
    secondary: {
      main: '#81C784', // 浅绿色
    },
    background: {
      default: '#0A0A0A', // 深黑色背景
      paper: '#1A1A1A', // 稍浅的黑色
    },
    text: {
      primary: '#E0E0E0', // 浅灰色文字
      secondary: '#B0B0B0',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", "Microsoft YaHei", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

// 错误边界组件
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('JARVIS应用错误:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
          p={3}
          bgcolor="background.default"
          color="text.primary"
        >
          <h1>🤖 JARVIS遇到了问题</h1>
          <p>应用发生了错误，请重启应用或联系支持。</p>
          <pre style={{ fontSize: 12, opacity: 0.7 }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              backgroundColor: '#64B5F6',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            重新加载
          </button>
        </Box>
      );
    }

    return this.props.children;
  }
}

interface AppState {
  isInitialized: boolean;
  error: string | null;
  notifications: { id: string; message: string; severity: 'info' | 'success' | 'warning' | 'error' }[];
}

function App() {
  const [state, setState] = useState<AppState>({
    isInitialized: false,
    error: null,
    notifications: [],
  });

  // 初始化应用
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 正在初始化JARVIS智能管家...');
        
        // 检查后端服务连接
        const response = await fetch('http://127.0.0.1:8000/status');
        if (!response.ok) {
          throw new Error('无法连接到JARVIS核心服务');
        }
        
        const status = await response.json();
        console.log('✅ JARVIS核心服务状态:', status);
        
        // 显示欢迎通知
        showNotification('JARVIS智能管家已启动', 'success');
        
        setState(prev => ({
          ...prev,
          isInitialized: true,
          error: null,
        }));
        
      } catch (error) {
        console.error('❌ JARVIS初始化失败:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : '未知错误',
          isInitialized: false,
        }));
      }
    };

    initializeApp();
  }, []);

  // 显示通知
  const showNotification = (message: string, severity: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = Date.now().toString();
    setState(prev => ({
      ...prev,
      notifications: [...prev.notifications, { id, message, severity }],
    }));

    // 3秒后自动移除通知
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        notifications: prev.notifications.filter(n => n.id !== id),
      }));
    }, 3000);
  };

  // 移除通知
  const removeNotification = (id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== id),
    }));
  };

  if (state.error) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
          p={3}
          bgcolor="background.default"
        >
          <h1 style={{ color: '#ff6b6b', marginBottom: 16 }}>
            🚫 JARVIS启动失败
          </h1>
          <p style={{ color: '#B0B0B0', textAlign: 'center', maxWidth: 600 }}>
            {state.error}
          </p>
          <Box mt={2}>
            <p style={{ color: '#888', fontSize: 14 }}>
              请确保：
            </p>
            <ul style={{ color: '#888', fontSize: 14, textAlign: 'left' }}>
              <li>JARVIS核心服务已启动 (端口8000)</li>
              <li>网络连接正常</li>
              <li>防火墙允许本地连接</li>
            </ul>
          </Box>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 24,
              padding: '12px 24px',
              backgroundColor: '#64B5F6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            重试连接
          </button>
        </Box>
      </ThemeProvider>
    );
  }

  if (!state.isInitialized) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
          bgcolor="background.default"
        >
          <Box
            component="div"
            sx={{
              width: 60,
              height: 60,
              border: 3,
              borderColor: 'primary.main',
              borderTop: 3,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              mb: 2,
              '@keyframes spin': {
                '0%': {
                  transform: 'rotate(0deg)',
                },
                '100%': {
                  transform: 'rotate(360deg)',
                },
              },
            }}
          />
          <h2 style={{ color: '#64B5F6', margin: 0 }}>
            正在启动JARVIS...
          </h2>
          <p style={{ color: '#B0B0B0', margin: '8px 0 0 0' }}>
            智能管家系统初始化中
          </p>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <MainLayout onShowNotification={showNotification} />
        
        {/* 通知系统 */}
        {state.notifications.map((notification) => (
          <Snackbar
            key={notification.id}
            open={true}
            autoHideDuration={3000}
            onClose={() => removeNotification(notification.id)}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            style={{ marginTop: notification.id === state.notifications[0]?.id ? 70 : undefined }}
          >
            <Alert
              onClose={() => removeNotification(notification.id)}
              severity={notification.severity}
              variant="filled"
              sx={{ width: '100%' }}
            >
              {notification.message}
            </Alert>
          </Snackbar>
        ))}
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
