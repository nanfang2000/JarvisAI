import { invoke } from '@tauri-apps/api/core';
import { Command } from '@tauri-apps/plugin-shell';
import { 
  AndroidEmulator, 
  EmulatorType, 
  EmulatorStatus, 
  ADBDevice, 
  ADBCommand, 
  ADBResponse,
  TouchEvent,
  KeyEvent,
  ScreenInfo,
  AndroidApp,
  AppOperation,
  EmulatorError,
  RecoveryAction
} from '../types/android-emulator';

export class AndroidEmulatorService {
  private static instance: AndroidEmulatorService;
  private emulators: Map<string, AndroidEmulator> = new Map();
  private connectedDevices: Map<string, ADBDevice> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();

  private constructor() {
    this.initializeService();
  }

  public static getInstance(): AndroidEmulatorService {
    if (!AndroidEmulatorService.instance) {
      AndroidEmulatorService.instance = new AndroidEmulatorService();
    }
    return AndroidEmulatorService.instance;
  }

  private async initializeService(): Promise<void> {
    try {
      await this.detectInstalledEmulators();
      await this.refreshADBDevices();
      this.startDeviceMonitoring();
    } catch (error) {
      console.error('Failed to initialize Android emulator service:', error);
    }
  }

  // 模拟器检测和管理
  public async detectInstalledEmulators(): Promise<AndroidEmulator[]> {
    const detectedEmulators: AndroidEmulator[] = [];

    try {
      // 检测BlueStacks
      const bluestacksEmulators = await this.detectBlueStacks();
      detectedEmulators.push(...bluestacksEmulators);

      // 检测Genymotion
      const genymotionEmulators = await this.detectGenymotion();
      detectedEmulators.push(...genymotionEmulators);

      // 检测Android Studio AVD
      const avdEmulators = await this.detectAndroidStudioAVD();
      detectedEmulators.push(...avdEmulators);

      // 检测NOX
      const noxEmulators = await this.detectNox();
      detectedEmulators.push(...noxEmulators);

      // 检测LDPlayer
      const ldplayerEmulators = await this.detectLDPlayer();
      detectedEmulators.push(...ldplayerEmulators);

      // 更新内部状态
      detectedEmulators.forEach(emulator => {
        this.emulators.set(emulator.id, emulator);
      });

      return detectedEmulators;
    } catch (error) {
      console.error('Error detecting emulators:', error);
      return [];
    }
  }

  private async detectBlueStacks(): Promise<AndroidEmulator[]> {
    try {
      const command = new Command('bluestacks-detection', []);
      const output = await command.execute();
      
      // 解析BlueStacks输出
      const emulators: AndroidEmulator[] = [];
      // 实现BlueStacks检测逻辑
      
      return emulators;
    } catch (error) {
      console.error('BlueStacks detection failed:', error);
      return [];
    }
  }

  private async detectGenymotion(): Promise<AndroidEmulator[]> {
    try {
      const command = new Command('genymotion-detection', []);
      const output = await command.execute();
      
      // 实现Genymotion检测逻辑
      const emulators: AndroidEmulator[] = [];
      
      return emulators;
    } catch (error) {
      console.error('Genymotion detection failed:', error);
      return [];
    }
  }

  private async detectAndroidStudioAVD(): Promise<AndroidEmulator[]> {
    try {
      const command = new Command('avdmanager', ['list', 'avd']);
      const output = await command.execute();
      
      const emulators: AndroidEmulator[] = [];
      if (output.stdout) {
        const lines = output.stdout.split('\n');
        let currentEmulator: Partial<AndroidEmulator> = {};
        
        for (const line of lines) {
          if (line.includes('Name:')) {
            if (currentEmulator.name) {
              emulators.push(this.createEmulatorFromAVD(currentEmulator));
            }
            currentEmulator = {
              name: line.split('Name:')[1].trim(),
              type: EmulatorType.ANDROID_STUDIO,
              status: EmulatorStatus.OFFLINE
            };
          } else if (line.includes('Device:')) {
            // 解析设备信息
          } else if (line.includes('Target:')) {
            // 解析Android版本
          }
        }
        
        if (currentEmulator.name) {
          emulators.push(this.createEmulatorFromAVD(currentEmulator));
        }
      }
      
      return emulators;
    } catch (error) {
      console.error('Android Studio AVD detection failed:', error);
      return [];
    }
  }

  private async detectNox(): Promise<AndroidEmulator[]> {
    // 实现NOX检测逻辑
    return [];
  }

  private async detectLDPlayer(): Promise<AndroidEmulator[]> {
    // 实现LDPlayer检测逻辑
    return [];
  }

  private createEmulatorFromAVD(avdData: Partial<AndroidEmulator>): AndroidEmulator {
    return {
      id: `avd_${avdData.name}`,
      name: avdData.name || 'Unknown AVD',
      type: EmulatorType.ANDROID_STUDIO,
      status: EmulatorStatus.OFFLINE,
      deviceInfo: {
        manufacturer: 'Generic',
        model: 'Android Virtual Device',
        brand: 'Android',
        product: 'sdk_gphone_x86',
        device: 'generic_x86',
        board: 'goldfish_x86',
        hardware: 'goldfish',
        cpuAbi: 'x86',
        serialNumber: ''
      },
      adbPort: 5554,
      screenResolution: { width: 1080, height: 1920, density: 420 },
      androidVersion: '11.0',
      createdAt: new Date(),
      lastUsed: new Date()
    };
  }

  // ADB操作
  public async refreshADBDevices(): Promise<ADBDevice[]> {
    try {
      const response = await this.executeADBCommand({ command: 'devices', args: ['-l'] });
      
      if (response.success) {
        const devices = this.parseADBDevices(response.output);
        this.connectedDevices.clear();
        devices.forEach(device => {
          this.connectedDevices.set(device.serial, device);
        });
        
        // 更新模拟器状态
        this.updateEmulatorStatus();
        
        return devices;
      }
      
      return [];
    } catch (error) {
      console.error('Failed to refresh ADB devices:', error);
      return [];
    }
  }

  private parseADBDevices(output: string): ADBDevice[] {
    const devices: ADBDevice[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('\t')) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const serial = parts[0].trim();
          const state = parts[1].trim() as 'device' | 'offline' | 'unauthorized';
          
          const device: ADBDevice = {
            serial,
            state,
            transport: 'usb'
          };
          
          // 解析额外信息
          if (parts.length > 2) {
            const info = parts[2].trim();
            const properties = info.split(' ');
            
            for (const prop of properties) {
              if (prop.startsWith('product:')) {
                device.product = prop.split(':')[1];
              } else if (prop.startsWith('model:')) {
                device.model = prop.split(':')[1];
              } else if (prop.startsWith('device:')) {
                device.device = prop.split(':')[1];
              }
            }
          }
          
          devices.push(device);
        }
      }
    }
    
    return devices;
  }

  public async executeADBCommand(command: ADBCommand): Promise<ADBResponse> {
    try {
      const cmd = new Command('adb', [command.command, ...command.args]);
      const output = await cmd.execute();
      
      return {
        success: output.code === 0,
        output: output.stdout || '',
        error: output.stderr || undefined,
        exitCode: output.code
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        exitCode: -1
      };
    }
  }

  // 模拟器控制
  public async startEmulator(emulatorId: string): Promise<boolean> {
    const emulator = this.emulators.get(emulatorId);
    if (!emulator) {
      throw new Error(`Emulator ${emulatorId} not found`);
    }

    try {
      this.updateEmulatorStatus(emulatorId, EmulatorStatus.BOOTING);
      
      let startCommand: Command;
      
      switch (emulator.type) {
        case EmulatorType.ANDROID_STUDIO:
          startCommand = new Command('emulator', ['-avd', emulator.name]);
          break;
        case EmulatorType.BLUESTACKS:
          startCommand = new Command('bluestacks-start', [emulator.name]);
          break;
        case EmulatorType.GENYMOTION:
          startCommand = new Command('genymotion-start', [emulator.name]);
          break;
        default:
          throw new Error(`Unsupported emulator type: ${emulator.type}`);
      }
      
      const result = await startCommand.execute();
      
      if (result.code === 0) {
        // 等待设备连接
        await this.waitForDeviceConnection(emulator.adbPort.toString());
        this.updateEmulatorStatus(emulatorId, EmulatorStatus.ONLINE);
        return true;
      } else {
        this.updateEmulatorStatus(emulatorId, EmulatorStatus.ERROR);
        return false;
      }
    } catch (error) {
      console.error(`Failed to start emulator ${emulatorId}:`, error);
      this.updateEmulatorStatus(emulatorId, EmulatorStatus.ERROR);
      return false;
    }
  }

  public async stopEmulator(emulatorId: string): Promise<boolean> {
    const emulator = this.emulators.get(emulatorId);
    if (!emulator) {
      throw new Error(`Emulator ${emulatorId} not found`);
    }

    try {
      const response = await this.executeADBCommand({
        command: '-s',
        args: [emulator.adbPort.toString(), 'emu', 'kill']
      });
      
      if (response.success) {
        this.updateEmulatorStatus(emulatorId, EmulatorStatus.OFFLINE);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Failed to stop emulator ${emulatorId}:`, error);
      return false;
    }
  }

  private async waitForDeviceConnection(serial: string, timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const devices = await this.refreshADBDevices();
      const device = devices.find(d => d.serial === serial);
      
      if (device && device.state === 'device') {
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return false;
  }

  // 屏幕操作
  public async performTouch(deviceSerial: string, touchEvent: TouchEvent): Promise<boolean> {
    try {
      let command: string[];
      
      switch (touchEvent.type) {
        case 'tap':
          command = ['-s', deviceSerial, 'shell', 'input', 'tap', touchEvent.x.toString(), touchEvent.y.toString()];
          break;
        case 'swipe':
          if (touchEvent.endX !== undefined && touchEvent.endY !== undefined) {
            const duration = touchEvent.duration || 300;
            command = ['-s', deviceSerial, 'shell', 'input', 'swipe', 
                      touchEvent.x.toString(), touchEvent.y.toString(),
                      touchEvent.endX.toString(), touchEvent.endY.toString(),
                      duration.toString()];
          } else {
            throw new Error('Swipe requires endX and endY coordinates');
          }
          break;
        case 'long_press':
          const duration = touchEvent.duration || 1000;
          command = ['-s', deviceSerial, 'shell', 'input', 'tap', touchEvent.x.toString(), touchEvent.y.toString()];
          // 模拟长按 - 可能需要其他方法
          break;
        default:
          throw new Error(`Unsupported touch event type: ${touchEvent.type}`);
      }
      
      const response = await this.executeADBCommand({ command: command[0], args: command.slice(1) });
      return response.success;
    } catch (error) {
      console.error('Touch operation failed:', error);
      return false;
    }
  }

  public async sendKeyEvent(deviceSerial: string, keyEvent: KeyEvent): Promise<boolean> {
    try {
      const command = ['-s', deviceSerial, 'shell', 'input', 'keyevent', keyEvent.keyCode.toString()];
      const response = await this.executeADBCommand({ command: command[0], args: command.slice(1) });
      return response.success;
    } catch (error) {
      console.error('Key event failed:', error);
      return false;
    }
  }

  public async sendText(deviceSerial: string, text: string): Promise<boolean> {
    try {
      // 转义特殊字符
      const escapedText = text.replace(/['"\\]/g, '\\$&');
      const command = ['-s', deviceSerial, 'shell', 'input', 'text', `"${escapedText}"`];
      const response = await this.executeADBCommand({ command: command[0], args: command.slice(1) });
      return response.success;
    } catch (error) {
      console.error('Text input failed:', error);
      return false;
    }
  }

  public async getScreenInfo(deviceSerial: string): Promise<ScreenInfo | null> {
    try {
      const response = await this.executeADBCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'wm', 'size']
      });
      
      if (response.success) {
        const sizeMatch = response.output.match(/(\d+)x(\d+)/);
        if (sizeMatch) {
          const width = parseInt(sizeMatch[1]);
          const height = parseInt(sizeMatch[2]);
          
          // 获取密度
          const densityResponse = await this.executeADBCommand({
            command: '-s',
            args: [deviceSerial, 'shell', 'wm', 'density']
          });
          
          let density = 420; // 默认密度
          if (densityResponse.success) {
            const densityMatch = densityResponse.output.match(/(\d+)/);
            if (densityMatch) {
              density = parseInt(densityMatch[1]);
            }
          }
          
          return {
            width,
            height,
            density,
            orientation: width > height ? 1 : 0
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get screen info:', error);
      return null;
    }
  }

  public async takeScreenshot(deviceSerial: string): Promise<string | null> {
    try {
      const timestamp = Date.now();
      const filename = `/sdcard/screenshot_${timestamp}.png`;
      
      // 截图
      const screenshotResponse = await this.executeADBCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'screencap', '-p', filename]
      });
      
      if (screenshotResponse.success) {
        // 拉取截图文件
        const pullResponse = await this.executeADBCommand({
          command: '-s',
          args: [deviceSerial, 'pull', filename, `./screenshots/screenshot_${timestamp}.png`]
        });
        
        if (pullResponse.success) {
          // 删除设备上的截图文件
          await this.executeADBCommand({
            command: '-s',
            args: [deviceSerial, 'shell', 'rm', filename]
          });
          
          return `./screenshots/screenshot_${timestamp}.png`;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Screenshot failed:', error);
      return null;
    }
  }

  // 应用管理
  public async getInstalledApps(deviceSerial: string): Promise<AndroidApp[]> {
    try {
      const response = await this.executeADBCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'pm', 'list', 'packages', '-f']
      });
      
      if (response.success) {
        const apps: AndroidApp[] = [];
        const lines = response.output.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('package:')) {
            const packageInfo = line.substring(8);
            const parts = packageInfo.split('=');
            if (parts.length === 2) {
              const apkPath = parts[0];
              const packageName = parts[1];
              
              // 获取应用详细信息
              const appInfo = await this.getAppInfo(deviceSerial, packageName);
              if (appInfo) {
                apps.push(appInfo);
              }
            }
          }
        }
        
        return apps;
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get installed apps:', error);
      return [];
    }
  }

  private async getAppInfo(deviceSerial: string, packageName: string): Promise<AndroidApp | null> {
    try {
      const response = await this.executeADBCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'dumpsys', 'package', packageName]
      });
      
      if (response.success) {
        // 解析包信息
        const info = response.output;
        
        return {
          packageName,
          versionName: this.extractValue(info, 'versionName') || '1.0',
          versionCode: parseInt(this.extractValue(info, 'versionCode') || '1'),
          label: packageName, // 简化处理
          isSystemApp: info.includes('flags=[ SYSTEM '),
          isEnabled: !info.includes('enabled=false'),
          firstInstallTime: new Date(), // 简化处理
          lastUpdateTime: new Date(), // 简化处理
          dataDir: this.extractValue(info, 'dataDir') || '',
          publicSourceDir: this.extractValue(info, 'publicSourceDir') || ''
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to get app info for ${packageName}:`, error);
      return null;
    }
  }

  private extractValue(text: string, key: string): string | null {
    const regex = new RegExp(`${key}=([^\\s]+)`);
    const match = text.match(regex);
    return match ? match[1] : null;
  }

  public async performAppOperation(deviceSerial: string, operation: AppOperation): Promise<boolean> {
    try {
      let command: string[];
      
      switch (operation.type) {
        case 'install':
          if (!operation.apkPath) {
            throw new Error('APK path is required for install operation');
          }
          command = ['-s', deviceSerial, 'install', operation.apkPath];
          break;
        case 'uninstall':
          command = ['-s', deviceSerial, 'uninstall', operation.packageName];
          break;
        case 'start':
          command = ['-s', deviceSerial, 'shell', 'monkey', '-p', operation.packageName, '-c', 'android.intent.category.LAUNCHER', '1'];
          break;
        case 'stop':
          command = ['-s', deviceSerial, 'shell', 'am', 'force-stop', operation.packageName];
          break;
        case 'clear_data':
          command = ['-s', deviceSerial, 'shell', 'pm', 'clear', operation.packageName];
          break;
        case 'grant_permission':
          if (!operation.permission) {
            throw new Error('Permission is required for grant_permission operation');
          }
          command = ['-s', deviceSerial, 'shell', 'pm', 'grant', operation.packageName, operation.permission];
          break;
        default:
          throw new Error(`Unsupported operation type: ${operation.type}`);
      }
      
      const response = await this.executeADBCommand({ command: command[0], args: command.slice(1) });
      return response.success;
    } catch (error) {
      console.error('App operation failed:', error);
      return false;
    }
  }

  // 状态管理
  private updateEmulatorStatus(emulatorId?: string, status?: EmulatorStatus): void {
    if (emulatorId && status) {
      const emulator = this.emulators.get(emulatorId);
      if (emulator) {
        emulator.status = status;
        emulator.lastUsed = new Date();
        this.emitEvent('emulator-status-changed', { emulatorId, status });
      }
    } else {
      // 更新所有模拟器状态
      this.emulators.forEach((emulator, id) => {
        const device = this.connectedDevices.get(emulator.adbPort.toString());
        if (device) {
          const newStatus = device.state === 'device' ? EmulatorStatus.ONLINE : EmulatorStatus.OFFLINE;
          if (emulator.status !== newStatus) {
            emulator.status = newStatus;
            this.emitEvent('emulator-status-changed', { emulatorId: id, status: newStatus });
          }
        } else if (emulator.status !== EmulatorStatus.OFFLINE) {
          emulator.status = EmulatorStatus.OFFLINE;
          this.emitEvent('emulator-status-changed', { emulatorId: id, status: EmulatorStatus.OFFLINE });
        }
      });
    }
  }

  private startDeviceMonitoring(): void {
    setInterval(async () => {
      await this.refreshADBDevices();
    }, 5000); // 每5秒检查一次设备状态
  }

  // 事件系统
  public addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  public removeEventListener(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // 错误处理和恢复
  public async handleError(error: EmulatorError): Promise<boolean> {
    console.error('Emulator error:', error);
    
    const recoveryActions = this.getRecoveryActions(error);
    
    for (const action of recoveryActions) {
      if (action.automated) {
        const success = await this.executeRecoveryAction(action);
        if (success) {
          return true;
        }
      }
    }
    
    return false;
  }

  private getRecoveryActions(error: EmulatorError): RecoveryAction[] {
    const actions: RecoveryAction[] = [];
    
    switch (error.code) {
      case 'DEVICE_OFFLINE':
        actions.push({
          type: 'reconnect_adb',
          description: 'Reconnect to ADB device',
          automated: true
        });
        break;
      case 'EMULATOR_CRASH':
        actions.push({
          type: 'restart_emulator',
          description: 'Restart crashed emulator',
          automated: true
        });
        break;
      case 'APP_NOT_RESPONDING':
        actions.push({
          type: 'restart_app',
          description: 'Force stop and restart application',
          automated: true
        });
        break;
      default:
        actions.push({
          type: 'manual_intervention',
          description: 'Manual intervention required',
          automated: false
        });
    }
    
    return actions;
  }

  private async executeRecoveryAction(action: RecoveryAction): Promise<boolean> {
    try {
      switch (action.type) {
        case 'reconnect_adb':
          await this.executeADBCommand({ command: 'kill-server', args: [] });
          await this.executeADBCommand({ command: 'start-server', args: [] });
          return true;
        case 'restart_emulator':
          // 实现模拟器重启逻辑
          return true;
        case 'clear_cache':
          // 实现缓存清理逻辑
          return true;
        default:
          return false;
      }
    } catch (error) {
      console.error('Recovery action failed:', error);
      return false;
    }
  }

  // 公共获取方法
  public getEmulators(): AndroidEmulator[] {
    return Array.from(this.emulators.values());
  }

  public getEmulator(id: string): AndroidEmulator | undefined {
    return this.emulators.get(id);
  }

  public getConnectedDevices(): ADBDevice[] {
    return Array.from(this.connectedDevices.values());
  }

  public isEmulatorOnline(id: string): boolean {
    const emulator = this.emulators.get(id);
    return emulator?.status === EmulatorStatus.ONLINE;
  }
}

export default AndroidEmulatorService;