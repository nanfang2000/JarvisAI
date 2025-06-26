import { Command } from '@tauri-apps/plugin-shell';
import { 
  ADBDevice, 
  ADBCommand, 
  ADBResponse, 
  TouchEvent, 
  KeyEvent, 
  ScreenInfo,
  ElementSelector,
  AndroidApp
} from '../types/android-emulator';

export class ADBController {
  private static instance: ADBController;
  private isADBServerRunning: boolean = false;
  private connectionPool: Map<string, Date> = new Map();

  private constructor() {
    this.initializeADB();
  }

  public static getInstance(): ADBController {
    if (!ADBController.instance) {
      ADBController.instance = new ADBController();
    }
    return ADBController.instance;
  }

  private async initializeADB(): Promise<void> {
    try {
      await this.ensureADBServer();
    } catch (error) {
      console.error('Failed to initialize ADB:', error);
    }
  }

  // ADB服务器管理
  public async ensureADBServer(): Promise<boolean> {
    try {
      if (!this.isADBServerRunning) {
        const startResult = await this.executeCommand({
          command: 'start-server',
          args: []
        });
        
        this.isADBServerRunning = startResult.success;
      }
      
      return this.isADBServerRunning;
    } catch (error) {
      console.error('Failed to start ADB server:', error);
      return false;
    }
  }

  public async restartADBServer(): Promise<boolean> {
    try {
      // 停止ADB服务器
      await this.executeCommand({
        command: 'kill-server',
        args: []
      });
      
      this.isADBServerRunning = false;
      
      // 重新启动
      return await this.ensureADBServer();
    } catch (error) {
      console.error('Failed to restart ADB server:', error);
      return false;
    }
  }

  // 基础ADB命令执行
  public async executeCommand(command: ADBCommand): Promise<ADBResponse> {
    try {
      await this.ensureADBServer();
      
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

  // 设备管理
  public async getDevices(): Promise<ADBDevice[]> {
    const response = await this.executeCommand({
      command: 'devices',
      args: ['-l']
    });
    
    if (!response.success) {
      return [];
    }
    
    return this.parseDeviceList(response.output);
  }

  private parseDeviceList(output: string): ADBDevice[] {
    const devices: ADBDevice[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('\t') && !line.includes('List of devices')) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const serial = parts[0].trim();
          const state = parts[1].trim() as 'device' | 'offline' | 'unauthorized';
          
          const device: ADBDevice = {
            serial,
            state,
            transport: serial.includes(':') ? 'tcp' : 'usb'
          };
          
          // 解析设备属性
          if (parts.length > 2) {
            const attributes = parts[2].trim().split(' ');
            for (const attr of attributes) {
              const [key, value] = attr.split(':');
              if (key && value) {
                switch (key) {
                  case 'product':
                    device.product = value;
                    break;
                  case 'model':
                    device.model = value;
                    break;
                  case 'device':
                    device.device = value;
                    break;
                  case 'transport_id':
                    device.transport = value;
                    break;
                }
              }
            }
          }
          
          devices.push(device);
        }
      }
    }
    
    return devices;
  }

  public async isDeviceConnected(serial: string): Promise<boolean> {
    const devices = await this.getDevices();
    return devices.some(device => device.serial === serial && device.state === 'device');
  }

  public async waitForDevice(serial: string, timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await this.isDeviceConnected(serial)) {
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return false;
  }

  // 屏幕操作增强版
  public async performTouchEvent(serial: string, event: TouchEvent): Promise<boolean> {
    const commands: string[][] = [];
    
    switch (event.type) {
      case 'tap':
        commands.push(['-s', serial, 'shell', 'input', 'tap', event.x.toString(), event.y.toString()]);
        break;
        
      case 'swipe':
        if (event.endX !== undefined && event.endY !== undefined) {
          const duration = event.duration || 300;
          commands.push(['-s', serial, 'shell', 'input', 'swipe', 
                        event.x.toString(), event.y.toString(),
                        event.endX.toString(), event.endY.toString(),
                        duration.toString()]);
        }
        break;
        
      case 'long_press':
        // 使用sendevent实现更精确的长按
        const duration = event.duration || 1000;
        commands.push(['-s', serial, 'shell', 'input', 'touchscreen', 'swipe', 
                      event.x.toString(), event.y.toString(),
                      event.x.toString(), event.y.toString(),
                      duration.toString()]);
        break;
        
      case 'drag':
        if (event.endX !== undefined && event.endY !== undefined) {
          const dragDuration = event.duration || 500;
          commands.push(['-s', serial, 'shell', 'input', 'swipe',
                        event.x.toString(), event.y.toString(),
                        event.endX.toString(), event.endY.toString(),
                        dragDuration.toString()]);
        }
        break;
    }
    
    for (const cmd of commands) {
      const response = await this.executeCommand({
        command: cmd[0],
        args: cmd.slice(1)
      });
      
      if (!response.success) {
        return false;
      }
    }
    
    return true;
  }

  // 增强的文本输入
  public async inputText(serial: string, text: string, clearFirst: boolean = false): Promise<boolean> {
    if (clearFirst) {
      // 清空当前输入
      await this.sendKeyEvent(serial, { type: 'key_press', keyCode: 123 }); // CTRL+A
      await this.sendKeyEvent(serial, { type: 'key_press', keyCode: 67 });  // DEL
    }
    
    // 处理特殊字符
    const escapedText = this.escapeTextForADB(text);
    
    const response = await this.executeCommand({
      command: '-s',
      args: [serial, 'shell', 'input', 'text', escapedText]
    });
    
    return response.success;
  }

  private escapeTextForADB(text: string): string {
    return text
      .replace(/\\/g, '\\\\')  // 转义反斜杠
      .replace(/'/g, '\\'')    // 转义单引号
      .replace(/\"/g, '\\\"')  // 转义双引号
      .replace(/\s/g, '%s')    // 空格转换为%s
      .replace(/&/g, '\\&')    // 转义&符号
      .replace(/\|/g, '\\|')   // 转义管道符
      .replace(/;/g, '\\;')    // 转义分号
      .replace(/</g, '\\<')    // 转义小于号
      .replace(/>/g, '\\>')    // 转义大于号
      .replace(/\(/g, '\\(')   // 转义左括号
      .replace(/\)/g, '\\)');  // 转义右括号
  }

  public async sendKeyEvent(serial: string, keyEvent: KeyEvent): Promise<boolean> {
    const response = await this.executeCommand({
      command: '-s',
      args: [serial, 'shell', 'input', 'keyevent', keyEvent.keyCode.toString()]
    });
    
    return response.success;
  }

  // 屏幕信息获取
  public async getScreenSize(serial: string): Promise<{ width: number; height: number } | null> {
    const response = await this.executeCommand({
      command: '-s',
      args: [serial, 'shell', 'wm', 'size']
    });
    
    if (response.success) {
      const match = response.output.match(/(\d+)x(\d+)/);
      if (match) {
        return {
          width: parseInt(match[1]),
          height: parseInt(match[2])
        };
      }
    }
    
    return null;
  }

  public async getScreenDensity(serial: string): Promise<number | null> {
    const response = await this.executeCommand({
      command: '-s',
      args: [serial, 'shell', 'wm', 'density']
    });
    
    if (response.success) {
      const match = response.output.match(/Physical density: (\d+)/);
      if (match) {
        return parseInt(match[1]);
      }
    }
    
    return null;
  }

  public async getScreenInfo(serial: string): Promise<ScreenInfo | null> {
    const size = await this.getScreenSize(serial);
    const density = await this.getScreenDensity(serial);
    
    if (size && density) {
      return {
        width: size.width,
        height: size.height,
        density,
        orientation: size.width > size.height ? 1 : 0
      };
    }
    
    return null;
  }

  // 截图功能
  public async takeScreenshot(serial: string, localPath?: string): Promise<string | null> {
    const timestamp = Date.now();
    const devicePath = `/sdcard/screenshot_${timestamp}.png`;
    const finalLocalPath = localPath || `./screenshots/screenshot_${timestamp}.png`;
    
    try {
      // 在设备上截图
      const screenshotResponse = await this.executeCommand({
        command: '-s',
        args: [serial, 'shell', 'screencap', '-p', devicePath]
      });
      
      if (!screenshotResponse.success) {
        return null;
      }
      
      // 将截图拉取到本地
      const pullResponse = await this.executeCommand({
        command: '-s',
        args: [serial, 'pull', devicePath, finalLocalPath]
      });
      
      if (pullResponse.success) {
        // 删除设备上的临时文件
        await this.executeCommand({
          command: '-s',
          args: [serial, 'shell', 'rm', devicePath]
        });
        
        return finalLocalPath;
      }
      
      return null;
    } catch (error) {
      console.error('Screenshot operation failed:', error);
      return null;
    }
  }

  // UI元素查找和操作
  public async findElement(serial: string, selector: ElementSelector): Promise<{ x: number; y: number } | null> {
    let command: string[];
    
    switch (selector.type) {
      case 'id':
        command = ['-s', serial, 'shell', 'uiautomator', 'dump', '/sdcard/ui_dump.xml'];
        break;
      case 'text':
        command = ['-s', serial, 'shell', 'uiautomator', 'dump', '/sdcard/ui_dump.xml'];
        break;
      case 'xpath':
      case 'class':
        command = ['-s', serial, 'shell', 'uiautomator', 'dump', '/sdcard/ui_dump.xml'];
        break;
      case 'coordinate':
        // 直接返回坐标
        const coords = selector.value.split(',');
        if (coords.length === 2) {
          return {
            x: parseInt(coords[0]),
            y: parseInt(coords[1])
          };
        }
        return null;
      default:
        return null;
    }
    
    const dumpResponse = await this.executeCommand({
      command: command[0],
      args: command.slice(1)
    });
    
    if (!dumpResponse.success) {
      return null;
    }
    
    // 获取UI dump文件
    const catResponse = await this.executeCommand({
      command: '-s',
      args: [serial, 'shell', 'cat', '/sdcard/ui_dump.xml']
    });
    
    if (catResponse.success) {
      return this.parseUIElement(catResponse.output, selector);
    }
    
    return null;
  }

  private parseUIElement(xmlContent: string, selector: ElementSelector): { x: number; y: number } | null {
    try {
      // 简化的XML解析 - 在实际项目中应使用专业的XML解析器
      let pattern: RegExp;
      
      switch (selector.type) {
        case 'id':
          pattern = new RegExp(`resource-id="${selector.value}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`);
          break;
        case 'text':
          pattern = new RegExp(`text="${selector.value}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`);
          break;
        case 'class':
          pattern = new RegExp(`class="${selector.value}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`);
          break;
        default:
          return null;
      }
      
      const match = xmlContent.match(pattern);
      if (match) {
        const x1 = parseInt(match[1]);
        const y1 = parseInt(match[2]);
        const x2 = parseInt(match[3]);
        const y2 = parseInt(match[4]);
        
        // 返回中心点坐标
        return {
          x: Math.floor((x1 + x2) / 2),
          y: Math.floor((y1 + y2) / 2)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing UI element:', error);
      return null;
    }
  }

  public async clickElement(serial: string, selector: ElementSelector): Promise<boolean> {
    const element = await this.findElement(serial, selector);
    if (element) {
      return await this.performTouchEvent(serial, {
        type: 'tap',
        x: element.x,
        y: element.y
      });
    }
    return false;
  }

  public async waitForElement(serial: string, selector: ElementSelector, timeout: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const element = await this.findElement(serial, selector);
      if (element) {
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return false;
  }

  // 应用管理
  public async getCurrentApp(serial: string): Promise<string | null> {
    const response = await this.executeCommand({
      command: '-s',
      args: [serial, 'shell', 'dumpsys', 'window', 'windows', '|', 'grep', '-E', 'mCurrentFocus|mFocusedApp']
    });
    
    if (response.success) {
      const match = response.output.match(/([a-zA-Z0-9.]+)\/([a-zA-Z0-9.]+)/);
      if (match) {
        return match[1]; // 返回包名
      }
    }
    
    return null;
  }

  public async launchApp(serial: string, packageName: string, activityName?: string): Promise<boolean> {
    let command: string[];
    
    if (activityName) {
      command = ['-s', serial, 'shell', 'am', 'start', '-n', `${packageName}/${activityName}`];
    } else {
      command = ['-s', serial, 'shell', 'monkey', '-p', packageName, '-c', 'android.intent.category.LAUNCHER', '1'];
    }
    
    const response = await this.executeCommand({
      command: command[0],
      args: command.slice(1)
    });
    
    return response.success;
  }

  public async stopApp(serial: string, packageName: string): Promise<boolean> {
    const response = await this.executeCommand({
      command: '-s',
      args: [serial, 'shell', 'am', 'force-stop', packageName]
    });
    
    return response.success;
  }

  // 文件操作
  public async pushFile(serial: string, localPath: string, remotePath: string): Promise<boolean> {
    const response = await this.executeCommand({
      command: '-s',
      args: [serial, 'push', localPath, remotePath]
    });
    
    return response.success;
  }

  public async pullFile(serial: string, remotePath: string, localPath: string): Promise<boolean> {
    const response = await this.executeCommand({
      command: '-s',
      args: [serial, 'pull', remotePath, localPath]
    });
    
    return response.success;
  }

  public async fileExists(serial: string, path: string): Promise<boolean> {
    const response = await this.executeCommand({
      command: '-s',
      args: [serial, 'shell', 'test', '-f', path, '&&', 'echo', 'exists']
    });
    
    return response.success && response.output.includes('exists');
  }

  // 系统信息
  public async getDeviceInfo(serial: string): Promise<Record<string, string>> {
    const info: Record<string, string> = {};
    
    const properties = [
      'ro.product.manufacturer',
      'ro.product.model',
      'ro.product.brand',
      'ro.product.name',
      'ro.product.device',
      'ro.build.version.release',
      'ro.build.version.sdk',
      'ro.product.cpu.abi'
    ];
    
    for (const prop of properties) {
      const response = await this.executeCommand({
        command: '-s',
        args: [serial, 'shell', 'getprop', prop]
      });
      
      if (response.success) {
        info[prop] = response.output.trim();
      }
    }
    
    return info;
  }

  public async getBatteryInfo(serial: string): Promise<Record<string, string>> {
    const response = await this.executeCommand({
      command: '-s',
      args: [serial, 'shell', 'dumpsys', 'battery']
    });
    
    const batteryInfo: Record<string, string> = {};
    
    if (response.success) {
      const lines = response.output.split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*([^:]+):\s*(.+)/);
        if (match) {
          batteryInfo[match[1].trim()] = match[2].trim();
        }
      }
    }
    
    return batteryInfo;
  }

  // 网络操作
  public async setWifiEnabled(serial: string, enabled: boolean): Promise<boolean> {
    const command = enabled ? 'enable' : 'disable';
    const response = await this.executeCommand({
      command: '-s',
      args: [serial, 'shell', 'svc', 'wifi', command]
    });
    
    return response.success;
  }

  public async getNetworkInfo(serial: string): Promise<Record<string, any>> {
    const response = await this.executeCommand({
      command: '-s',
      args: [serial, 'shell', 'dumpsys', 'connectivity']
    });
    
    const networkInfo: Record<string, any> = {};
    
    if (response.success) {
      // 解析网络连接信息
      const lines = response.output.split('\n');
      for (const line of lines) {
        if (line.includes('NetworkInfo:')) {
          networkInfo.networkInfo = line.trim();
        } else if (line.includes('WifiInfo:')) {
          networkInfo.wifiInfo = line.trim();
        }
      }
    }
    
    return networkInfo;
  }

  // 连接管理
  public updateConnectionPool(serial: string): void {
    this.connectionPool.set(serial, new Date());
  }

  public getLastConnectionTime(serial: string): Date | null {
    return this.connectionPool.get(serial) || null;
  }

  public clearConnectionPool(): void {
    this.connectionPool.clear();
  }

  // 清理资源
  public async cleanup(): Promise<void> {
    this.clearConnectionPool();
    // 执行其他清理操作
  }
}

export default ADBController;