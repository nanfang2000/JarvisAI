import React, { useState, useEffect } from 'react';
import { Box, Grid, Paper, Typography, useTheme } from '@mui/material';
import AvatarPanel from './AvatarPanel';
import ContentPanel from './ContentPanel';

interface MainLayoutProps {
  onShowNotification: (message: string, severity?: 'info' | 'success' | 'warning' | 'error') => void;
}

interface LayoutState {
  avatarPanelWidth: number;
  contentPanelWidth: number;
  isConnected: boolean;
  jarvisStatus: any;
}

const MainLayout: React.FC<MainLayoutProps> = ({ onShowNotification }) => {
  const theme = useTheme();
  const [state, setState] = useState<LayoutState>({
    avatarPanelWidth: 40, // 左侧40%
    contentPanelWidth: 60, // 右侧60%
    isConnected: false,
    jarvisStatus: null,
  });

  // 检查JARVIS服务状态
  useEffect(() => {
    const checkJarvisStatus = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/status');
        if (response.ok) {
          const status = await response.json();
          setState(prev => ({
            ...prev,
            isConnected: true,
            jarvisStatus: status,
          }));
        }
      } catch (error) {
        console.error('无法连接到JARVIS服务:', error);
        setState(prev => ({
          ...prev,
          isConnected: false,
          jarvisStatus: null,
        }));
      }
    };

    // 初始检查
    checkJarvisStatus();

    // 定期检查连接状态
    const interval = setInterval(checkJarvisStatus, 30000); // 30秒检查一次

    return () => clearInterval(interval);
  }, []);

  // 动态调整面板大小（根据内容需要）
  const adjustPanelSizes = (avatarWidth: number, contentWidth: number) => {
    if (avatarWidth + contentWidth === 100) {
      setState(prev => ({
        ...prev,
        avatarPanelWidth: avatarWidth,
        contentPanelWidth: contentWidth,
      }));
    }
  };

  // 处理连接状态变化
  useEffect(() => {
    if (state.isConnected && state.jarvisStatus) {
      console.log('JARVIS状态:', state.jarvisStatus);
    }
  }, [state.isConnected, state.jarvisStatus]);

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        bgcolor: 'background.default',
        overflow: 'hidden',
      }}
    >
      {/* 左侧Avatar面板 */}
      <Box
        sx={{
          width: `${state.avatarPanelWidth}%`,
          height: '100%',
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
        }}
      >
        <AvatarPanel
          isConnected={state.isConnected}
          jarvisStatus={state.jarvisStatus}
          onShowNotification={onShowNotification}
        />
      </Box>

      {/* 右侧内容面板 */}
      <Box
        sx={{
          width: `${state.contentPanelWidth}%`,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
        }}
      >
        <ContentPanel
          isConnected={state.isConnected}
          jarvisStatus={state.jarvisStatus}
          onShowNotification={onShowNotification}
          onAdjustPanelSizes={adjustPanelSizes}
        />
      </Box>

      {/* 连接状态指示器 */}
      <Box
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: state.isConnected ? 'success.dark' : 'error.dark',
            color: 'white',
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: state.isConnected ? 'success.light' : 'error.light',
              animation: state.isConnected ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%': {
                  opacity: 1,
                },
                '50%': {
                  opacity: 0.5,
                },
                '100%': {
                  opacity: 1,
                },
              },
            }}
          />
          <Typography variant="caption" sx={{ fontWeight: 500 }}>
            {state.isConnected ? 'JARVIS在线' : 'JARVIS离线'}
          </Typography>
        </Paper>
      </Box>

      {/* 版本信息 */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          zIndex: 1000,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            opacity: 0.6,
            fontSize: 10,
          }}
        >
          JARVIS AI v1.0.0 | Powered by Qwen & DeepSeek
        </Typography>
      </Box>
    </Box>
  );
};

export default MainLayout;