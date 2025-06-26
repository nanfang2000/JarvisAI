import { v4 as uuidv4 } from 'uuid';
import {
  AutomationScript,
  AutomationStep,
  AutomationCondition,
  ElementSelector,
  TouchEvent,
  KeyEvent
} from '../types/android-emulator';
import { ADBController } from './adbController';

export class AutomationEngine {
  private static instance: AutomationEngine;
  private adbController: ADBController;
  private runningScripts: Map<string, boolean> = new Map();
  private scriptResults: Map<string, any> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();

  private constructor() {
    this.adbController = ADBController.getInstance();
  }

  public static getInstance(): AutomationEngine {
    if (!AutomationEngine.instance) {
      AutomationEngine.instance = new AutomationEngine();
    }
    return AutomationEngine.instance;
  }

  // 脚本管理
  public createScript(
    name: string,
    description: string,
    targetApp: string,
    steps: Omit<AutomationStep, 'id'>[]
  ): AutomationScript {
    const script: AutomationScript = {
      id: uuidv4(),
      name,
      description,
      targetApp,
      steps: steps.map(step => ({ ...step, id: uuidv4() })),
      conditions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return script;
  }

  public updateScript(scriptId: string, updates: Partial<AutomationScript>): boolean {
    // 实现脚本更新逻辑
    return true;
  }

  public deleteScript(scriptId: string): boolean {
    if (this.runningScripts.has(scriptId)) {
      this.stopScript(scriptId);
    }
    this.scriptResults.delete(scriptId);
    return true;
  }

  // 脚本执行
  public async executeScript(
    script: AutomationScript,
    deviceSerial: string,
    options: {
      timeout?: number;
      retryCount?: number;
      screenshot?: boolean;
    } = {}
  ): Promise<boolean> {
    const {
      timeout = 60000,
      retryCount = 3,
      screenshot = true
    } = options;

    this.runningScripts.set(script.id, true);
    this.emitEvent('script-started', { scriptId: script.id, deviceSerial });

    try {
      // 启动目标应用
      if (script.targetApp) {
        await this.adbController.launchApp(deviceSerial, script.targetApp);
        await this.wait(2000); // 等待应用启动
      }

      // 执行脚本步骤
      for (const step of script.steps) {
        if (!this.runningScripts.get(script.id)) {
          this.emitEvent('script-cancelled', { scriptId: script.id });
          return false;
        }

        const success = await this.executeStep(step, deviceSerial, retryCount);
        
        if (!success) {
          this.emitEvent('script-failed', { 
            scriptId: script.id, 
            stepId: step.id, 
            description: step.description 
          });
          return false;
        }

        // 截图记录
        if (screenshot) {
          const screenshotPath = await this.adbController.takeScreenshot(deviceSerial);
          if (screenshotPath) {
            this.emitEvent('step-screenshot', { 
              scriptId: script.id, 
              stepId: step.id, 
              screenshot: screenshotPath 
            });
          }
        }

        this.emitEvent('step-completed', { 
          scriptId: script.id, 
          stepId: step.id, 
          description: step.description 
        });
      }

      this.emitEvent('script-completed', { scriptId: script.id });
      return true;

    } catch (error) {
      this.emitEvent('script-error', { 
        scriptId: script.id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    } finally {
      this.runningScripts.delete(script.id);
    }
  }

  private async executeStep(
    step: AutomationStep,
    deviceSerial: string,
    retryCount: number
  ): Promise<boolean> {
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        const success = await this.performStepAction(step, deviceSerial);
        if (success) {
          return true;
        }
      } catch (error) {
        console.error(`Step execution attempt ${attempt + 1} failed:`, error);
      }

      if (attempt < retryCount - 1) {
        await this.wait(1000); // 重试前等待
      }
    }

    return false;
  }

  private async performStepAction(step: AutomationStep, deviceSerial: string): Promise<boolean> {
    switch (step.type) {
      case 'tap':
        return await this.performTap(step, deviceSerial);
      case 'swipe':
        return await this.performSwipe(step, deviceSerial);
      case 'input':
        return await this.performInput(step, deviceSerial);
      case 'wait':
        return await this.performWait(step);
      case 'check':
        return await this.performCheck(step, deviceSerial);
      case 'screenshot':
        return await this.performScreenshot(step, deviceSerial);
      case 'scroll':
        return await this.performScroll(step, deviceSerial);
      default:
        console.error(`Unknown step type: ${step.type}`);
        return false;
    }
  }

  private async performTap(step: AutomationStep, deviceSerial: string): Promise<boolean> {
    if (step.selector) {
      const element = await this.adbController.findElement(deviceSerial, step.selector);
      if (element) {
        const touchEvent: TouchEvent = {
          type: 'tap',
          x: element.x,
          y: element.y
        };
        return await this.adbController.performTouchEvent(deviceSerial, touchEvent);
      }
      return false;
    } else if (step.action && 'x' in step.action && 'y' in step.action) {
      return await this.adbController.performTouchEvent(deviceSerial, step.action as TouchEvent);
    }
    return false;
  }

  private async performSwipe(step: AutomationStep, deviceSerial: string): Promise<boolean> {
    if (step.action && 'x' in step.action && 'endX' in step.action) {
      return await this.adbController.performTouchEvent(deviceSerial, step.action as TouchEvent);
    }
    return false;
  }

  private async performInput(step: AutomationStep, deviceSerial: string): Promise<boolean> {
    if (step.text) {
      // 如果有选择器，先点击输入框
      if (step.selector) {
        const element = await this.adbController.findElement(deviceSerial, step.selector);
        if (element) {
          const touchEvent: TouchEvent = {
            type: 'tap',
            x: element.x,
            y: element.y
          };
          await this.adbController.performTouchEvent(deviceSerial, touchEvent);
          await this.wait(500);
        }
      }
      
      return await this.adbController.inputText(deviceSerial, step.text, true);
    }
    return false;
  }

  private async performWait(step: AutomationStep): Promise<boolean> {
    const duration = step.duration || 1000;
    await this.wait(duration);
    return true;
  }

  private async performCheck(step: AutomationStep, deviceSerial: string): Promise<boolean> {
    if (step.condition) {
      return await this.evaluateCondition(step.condition, deviceSerial);
    }
    return true;
  }

  private async performScreenshot(step: AutomationStep, deviceSerial: string): Promise<boolean> {
    const screenshotPath = await this.adbController.takeScreenshot(deviceSerial);
    return screenshotPath !== null;
  }

  private async performScroll(step: AutomationStep, deviceSerial: string): Promise<boolean> {
    // 默认向下滚动
    const screenInfo = await this.adbController.getScreenInfo(deviceSerial);
    if (screenInfo) {
      const swipeEvent: TouchEvent = {
        type: 'swipe',
        x: screenInfo.width / 2,
        y: screenInfo.height * 0.7,
        endX: screenInfo.width / 2,
        endY: screenInfo.height * 0.3,
        duration: 500
      };
      return await this.adbController.performTouchEvent(deviceSerial, swipeEvent);
    }
    return false;
  }

  // 条件评估
  private async evaluateCondition(condition: string, deviceSerial: string): Promise<boolean> {
    // 简化的条件评估 - 在实际项目中需要更复杂的解析器
    if (condition.includes('element_exists:')) {
      const selectorValue = condition.split('element_exists:')[1].trim();
      const selector: ElementSelector = {
        type: 'text',
        value: selectorValue
      };
      const element = await this.adbController.findElement(deviceSerial, selector);
      return element !== null;
    }
    
    if (condition.includes('app_running:')) {
      const packageName = condition.split('app_running:')[1].trim();
      const currentApp = await this.adbController.getCurrentApp(deviceSerial);
      return currentApp === packageName;
    }
    
    return true;
  }

  public stopScript(scriptId: string): boolean {
    this.runningScripts.set(scriptId, false);
    this.emitEvent('script-stopped', { scriptId });
    return true;
  }

  public isScriptRunning(scriptId: string): boolean {
    return this.runningScripts.get(scriptId) || false;
  }

  // 预定义脚本模板
  public createSocialMediaScript(platform: 'wechat' | 'qq' | 'weibo'): AutomationScript {
    const platformConfigs = {
      wechat: {
        packageName: 'com.tencent.mm',
        name: '微信自动化',
        steps: [
          {
            type: 'tap' as const,
            selector: { type: 'text' as const, value: '通讯录' },
            description: '点击通讯录'
          },
          {
            type: 'wait' as const,
            duration: 1000,
            description: '等待页面加载'
          }
        ]
      },
      qq: {
        packageName: 'com.tencent.mobileqq',
        name: 'QQ自动化',
        steps: [
          {
            type: 'tap' as const,
            selector: { type: 'text' as const, value: '联系人' },
            description: '点击联系人'
          }
        ]
      },
      weibo: {
        packageName: 'com.sina.weibo',
        name: '微博自动化',
        steps: [
          {
            type: 'tap' as const,
            selector: { type: 'text' as const, value: '首页' },
            description: '点击首页'
          }
        ]
      }
    };

    const config = platformConfigs[platform];
    
    return this.createScript(
      config.name,
      `${config.name}操作脚本`,
      config.packageName,
      config.steps
    );
  }

  public createShoppingScript(platform: 'taobao' | 'jd' | 'pdd'): AutomationScript {
    const platformConfigs = {
      taobao: {
        packageName: 'com.taobao.taobao',
        name: '淘宝购物自动化',
        steps: [
          {
            type: 'tap' as const,
            selector: { type: 'id' as const, value: 'com.taobao.taobao:id/searchbar' },
            description: '点击搜索框'
          },
          {
            type: 'input' as const,
            text: '商品关键词',
            description: '输入搜索关键词'
          },
          {
            type: 'tap' as const,
            selector: { type: 'text' as const, value: '搜索' },
            description: '点击搜索按钮'
          }
        ]
      },
      jd: {
        packageName: 'com.jingdong.app.mall',
        name: '京东购物自动化',
        steps: [
          {
            type: 'tap' as const,
            selector: { type: 'id' as const, value: 'com.jingdong.app.mall:id/search_box' },
            description: '点击搜索框'
          }
        ]
      },
      pdd: {
        packageName: 'com.xunmeng.pinduoduo',
        name: '拼多多购物自动化',
        steps: [
          {
            type: 'tap' as const,
            selector: { type: 'text' as const, value: '搜索' },
            description: '点击搜索'
          }
        ]
      }
    };

    const config = platformConfigs[platform];
    
    return this.createScript(
      config.name,
      `${config.name}操作脚本`,
      config.packageName,
      config.steps
    );
  }

  public createPriceComparisonScript(productName: string): AutomationScript {
    const steps: Omit<AutomationStep, 'id'>[] = [
      // 淘宝搜索
      {
        type: 'tap',
        selector: { type: 'text', value: '淘宝' },
        description: '打开淘宝应用'
      },
      {
        type: 'wait',
        duration: 3000,
        description: '等待应用启动'
      },
      {
        type: 'tap',
        selector: { type: 'id', value: 'com.taobao.taobao:id/searchbar' },
        description: '点击搜索框'
      },
      {
        type: 'input',
        text: productName,
        description: '输入商品名称'
      },
      {
        type: 'tap',
        selector: { type: 'text', value: '搜索' },
        description: '执行搜索'
      },
      {
        type: 'screenshot',
        description: '截图保存搜索结果'
      }
    ];

    return this.createScript(
      `价格比对-${productName}`,
      `自动搜索并比较${productName}的价格`,
      'multi-app',
      steps
    );
  }

  // 脚本录制功能
  public startRecording(deviceSerial: string): string {
    const recordingId = uuidv4();
    // 实现录制逻辑
    return recordingId;
  }

  public stopRecording(recordingId: string): AutomationScript | null {
    // 实现录制停止逻辑
    return null;
  }

  // 批量操作
  public async executeBatch(
    scripts: AutomationScript[],
    deviceSerial: string,
    options: { parallel?: boolean; delay?: number } = {}
  ): Promise<boolean[]> {
    const { parallel = false, delay = 0 } = options;
    const results: boolean[] = [];

    if (parallel) {
      const promises = scripts.map(script => this.executeScript(script, deviceSerial));
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    } else {
      for (const script of scripts) {
        const result = await this.executeScript(script, deviceSerial);
        results.push(result);
        
        if (delay > 0 && script !== scripts[scripts.length - 1]) {
          await this.wait(delay);
        }
      }
    }

    return results;
  }

  // 智能重试机制
  public async executeWithSmartRetry(
    script: AutomationScript,
    deviceSerial: string,
    maxRetries: number = 3
  ): Promise<boolean> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const success = await this.executeScript(script, deviceSerial);
      
      if (success) {
        return true;
      }

      // 分析失败原因并进行恢复操作
      await this.performRecoveryActions(deviceSerial);
      
      if (attempt < maxRetries - 1) {
        await this.wait(2000 * (attempt + 1)); // 指数退避
      }
    }

    return false;
  }

  private async performRecoveryActions(deviceSerial: string): Promise<void> {
    // 尝试返回主页
    await this.adbController.sendKeyEvent(deviceSerial, { type: 'key_press', keyCode: 3 });
    await this.wait(1000);
    
    // 清理内存
    await this.adbController.sendKeyEvent(deviceSerial, { type: 'key_press', keyCode: 187 });
    await this.wait(500);
  }

  // 性能监控
  public getScriptPerformance(scriptId: string): any {
    return this.scriptResults.get(scriptId);
  }

  public getAllRunningScripts(): string[] {
    return Array.from(this.runningScripts.entries())
      .filter(([_, isRunning]) => isRunning)
      .map(([scriptId, _]) => scriptId);
  }

  // 工具方法
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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

  // 清理资源
  public cleanup(): void {
    // 停止所有运行中的脚本
    for (const scriptId of this.runningScripts.keys()) {
      this.stopScript(scriptId);
    }
    
    this.runningScripts.clear();
    this.scriptResults.clear();
    this.eventListeners.clear();
  }
}

export default AutomationEngine;