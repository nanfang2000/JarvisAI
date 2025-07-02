/**
 * API配置管理器
 */

export interface APIConfig {
  qwen: {
    apiKey: string;
    baseUrl: string;
  };
  deepseek: {
    apiKey: string;
    baseUrl: string;
  };
  speech: {
    provider: string;
    apiKey: string;
  };
  readyPlayerMe: {
    defaultAvatarUrl: string;
    partnerSubdomain: string;
  };
}

class ConfigManager {
  private config: APIConfig = {
    qwen: {
      apiKey: import.meta.env.VITE_QWEN_API_KEY || '',
      baseUrl: import.meta.env.VITE_QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1'
    },
    deepseek: {
      apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY || '',
      baseUrl: import.meta.env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
    },
    speech: {
      provider: import.meta.env.VITE_SPEECH_PROVIDER || 'python_backend',
      apiKey: import.meta.env.VITE_SPEECH_API_KEY || ''
    },
    readyPlayerMe: {
      defaultAvatarUrl: import.meta.env.VITE_READY_PLAYER_ME_DEFAULT_AVATAR || 'https://models.readyplayer.me/65f1c5c83bb58e45ec48e91b.glb',
      partnerSubdomain: import.meta.env.VITE_READY_PLAYER_ME_SUBDOMAIN || 'jarvis'
    }
  };

  getConfig(): APIConfig {
    return this.config;
  }

  updateConfig(newConfig: Partial<APIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getQwenConfig() {
    return this.config.qwen;
  }

  getDeepSeekConfig() {
    return this.config.deepseek;
  }

  getSpeechConfig() {
    return this.config.speech;
  }

  getReadyPlayerMeConfig() {
    return this.config.readyPlayerMe;
  }
}

export const configManager = new ConfigManager();