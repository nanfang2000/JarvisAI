import { v4 as uuidv4 } from 'uuid';
import {
  JarvisIntegration,
  TaskReport,
  AndroidEmulator,
  EmulatorStatus,
  AIDecision,
  AutomationScript,
  PriceComparisonTask
} from '../types/android-emulator';
import { AndroidEmulatorService } from './androidEmulatorService';
import { AndroidAIDecisionEngine } from './androidAIDecisionEngine';
import { AutomationEngine } from './automationEngine';
import { AndroidPriceComparison } from './androidPriceComparison';
import { AndroidSecurityManager } from './androidSecurityManager';
import { jarvisIntegrationService } from '../../services/jarvisIntegrationService';

interface VoiceCommand {
  id: string;
  text: string;
  intent: string;
  confidence: number;
  timestamp: Date;
  deviceSerial?: string;
}

interface JarvisTask {
  id: string;
  type: 'automation' | 'price_comparison' | 'voice_control' | 'security_scan';
  description: string;
  parameters: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  createdAt: Date;
  completedAt?: Date;
}

export class JarvisAndroidIntegration {
  private static instance: JarvisAndroidIntegration;
  private emulatorService: AndroidEmulatorService;
  private aiDecisionEngine: AndroidAIDecisionEngine;
  private automationEngine: AutomationEngine;
  private priceComparison: AndroidPriceComparison;
  private securityManager: AndroidSecurityManager;
  
  private integrations: Map<string, JarvisIntegration> = new Map();
  private activeTasks: Map<string, JarvisTask> = new Map();
  private taskReports: Map<string, TaskReport[]> = new Map();
  private voiceCommands: VoiceCommand[] = [];
  private eventListeners: Map<string, Function[]> = new Map();

  // WebSocket连接到JARVIS主系统
  private jarvisConnection: WebSocket | null = null;
  private connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';

  private constructor() {
    this.emulatorService = AndroidEmulatorService.getInstance();
    this.aiDecisionEngine = AndroidAIDecisionEngine.getInstance();
    this.automationEngine = AutomationEngine.getInstance();
    this.priceComparison = AndroidPriceComparison.getInstance();
    this.securityManager = AndroidSecurityManager.getInstance();
    
    this.initializeJarvisConnection();
    this.setupEventHandlers();
  }

  public static getInstance(): JarvisAndroidIntegration {
    if (!JarvisAndroidIntegration.instance) {
      JarvisAndroidIntegration.instance = new JarvisAndroidIntegration();
    }
    return JarvisAndroidIntegration.instance;
  }

  // JARVIS连接初始化
  private async initializeJarvisConnection(): Promise<void> {
    try {
      this.connectionStatus = 'connecting';
      
      // 连接到JARVIS主系统WebSocket
      this.jarvisConnection = new WebSocket('ws://localhost:8080/jarvis-android');
      
      this.jarvisConnection.onopen = () => {
        this.connectionStatus = 'connected';
        this.emitEvent('jarvis-connected', {});
        console.log('Connected to JARVIS main system');
        
        // 发送Android子系统注册信息
        this.registerWithJarvis();
      };

      this.jarvisConnection.onmessage = (event) => {
        this.handleJarvisMessage(JSON.parse(event.data));
      };

      this.jarvisConnection.onclose = () => {
        this.connectionStatus = 'disconnected';
        this.emitEvent('jarvis-disconnected', {});
        console.log('Disconnected from JARVIS main system');
        
        // 尝试重连
        setTimeout(() => this.initializeJarvisConnection(), 5000);
      };

      this.jarvisConnection.onerror = (error) => {
        console.error('JARVIS connection error:', error);
        this.emitEvent('jarvis-error', { error });
      };

    } catch (error) {
      console.error('Failed to initialize JARVIS connection:', error);
      this.connectionStatus = 'disconnected';
    }
  }

  // 向JARVIS注册Android子系统
  private registerWithJarvis(): void {
    const registrationData = {
      type: 'subsystem_registration',
      subsystem: 'android_emulator',
      capabilities: [
        'device_control',
        'app_automation',
        'price_comparison',
        'security_monitoring',
        'voice_control',
        'ai_decision_making'
      ],
      status: 'ready',
      devices: this.emulatorService.getEmulators().map(e => ({
        id: e.id,
        name: e.name,
        type: e.type,
        status: e.status
      }))
    };

    this.sendToJarvis(registrationData);
  }

  // 处理来自JARVIS的消息
  private handleJarvisMessage(message: any): void {
    switch (message.type) {
      case 'voice_command':
        this.handleVoiceCommand(message);
        break;
      case 'task_request':
        this.handleTaskRequest(message);
        break;
      case 'device_query':
        this.handleDeviceQuery(message);
        break;
      case 'security_alert':
        this.handleSecurityAlert(message);
        break;
      case 'system_update':
        this.handleSystemUpdate(message);
        break;
      default:
        console.log('Unknown message type from JARVIS:', message.type);
    }
  }

  // 语音命令处理
  private async handleVoiceCommand(message: any): Promise<void> {
    const voiceCommand: VoiceCommand = {
      id: uuidv4(),
      text: message.text,
      intent: message.intent || 'unknown',
      confidence: message.confidence || 0,
      timestamp: new Date(),
      deviceSerial: message.deviceSerial
    };

    this.voiceCommands.push(voiceCommand);
    this.emitEvent('voice-command-received', voiceCommand);

    try {
      // 如果指定了设备，直接处理
      if (voiceCommand.deviceSerial) {
        await this.processVoiceCommandForDevice(voiceCommand, voiceCommand.deviceSerial);
      } else {
        // 选择最合适的在线设备
        const targetDevice = this.selectBestDevice();
        if (targetDevice) {
          await this.processVoiceCommandForDevice(voiceCommand, targetDevice);
        } else {
          this.sendToJarvis({
            type: 'command_response',
            commandId: voiceCommand.id,
            success: false,
            error: 'No available devices'
          });
        }
      }
    } catch (error) {
      console.error('Error processing voice command:', error);
      this.sendToJarvis({
        type: 'command_response',
        commandId: voiceCommand.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async processVoiceCommandForDevice(
    voiceCommand: VoiceCommand,
    deviceSerial: string
  ): Promise<void> {
    // 使用AI决策引擎处理语音命令
    const decision = await this.aiDecisionEngine.processNaturalLanguageInstruction(
      voiceCommand.text,
      deviceSerial,
      voiceCommand.id
    );

    // 执行AI决策
    const success = await this.aiDecisionEngine.executeDecision(decision, deviceSerial);

    // 报告结果给JARVIS
    this.sendToJarvis({
      type: 'command_response',
      commandId: voiceCommand.id,
      success,
      decision: {
        interpretation: decision.interpretation,
        confidence: decision.confidence,
        actions: decision.actions.length
      },
      deviceSerial
    });

    // 记录任务报告
    this.recordTaskReport({
      id: voiceCommand.id,
      taskType: 'voice_control',
      emulatorId: deviceSerial,
      startTime: voiceCommand.timestamp,
      endTime: new Date(),
      status: success ? 'completed' : 'failed',
      results: {
        command: voiceCommand.text,
        decision,
        success
      }
    });
  }

  // 任务请求处理
  private async handleTaskRequest(message: any): Promise<void> {
    const task: JarvisTask = {
      id: message.taskId || uuidv4(),
      type: message.taskType,
      description: message.description,
      parameters: message.parameters,
      status: 'pending',
      createdAt: new Date()
    };

    this.activeTasks.set(task.id, task);
    this.emitEvent('task-received', task);

    try {
      await this.executeJarvisTask(task);
    } catch (error) {
      console.error('Error executing JARVIS task:', error);
      task.status = 'failed';
      task.result = { error: error instanceof Error ? error.message : 'Unknown error' };
      task.completedAt = new Date();
    }

    this.sendToJarvis({
      type: 'task_response',
      taskId: task.id,
      status: task.status,
      result: task.result
    });
  }

  private async executeJarvisTask(task: JarvisTask): Promise<void> {
    task.status = 'running';
    
    switch (task.type) {
      case 'automation':
        await this.executeAutomationTask(task);
        break;
      case 'price_comparison':
        await this.executePriceComparisonTask(task);
        break;
      case 'voice_control':
        await this.executeVoiceControlTask(task);
        break;
      case 'security_scan':
        await this.executeSecurityScanTask(task);
        break;
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async executeAutomationTask(task: JarvisTask): Promise<void> {
    const { deviceSerial, scriptName, scriptSteps } = task.parameters;
    
    // 创建自动化脚本
    const script = this.automationEngine.createScript(
      scriptName || `JARVIS任务-${task.id}`,
      task.description,
      'jarvis-generated',
      scriptSteps || []
    );

    // 执行脚本
    const success = await this.automationEngine.executeScript(script, deviceSerial);
    
    task.status = success ? 'completed' : 'failed';
    task.result = { scriptId: script.id, success };
    task.completedAt = new Date();

    // 记录任务报告
    this.recordTaskReport({
      id: task.id,
      taskType: 'automation',
      emulatorId: deviceSerial,
      startTime: task.createdAt,
      endTime: task.completedAt,
      status: task.status,
      results: task.result
    });
  }

  private async executePriceComparisonTask(task: JarvisTask): Promise<void> {
    const { deviceSerial, productName, platforms } = task.parameters;
    
    // 创建价格比对任务
    const priceTask = this.priceComparison.createPriceComparisonTask(productName, platforms);
    
    // 执行价格比对
    const success = await this.priceComparison.executePriceComparison(
      priceTask.id,
      deviceSerial
    );
    
    task.status = success ? 'completed' : 'failed';
    task.result = {
      priceTaskId: priceTask.id,
      results: priceTask.results,
      success
    };
    task.completedAt = new Date();

    // 记录任务报告
    this.recordTaskReport({
      id: task.id,
      taskType: 'price_comparison',
      emulatorId: deviceSerial,
      startTime: task.createdAt,
      endTime: task.completedAt,
      status: task.status,
      results: task.result
    });
  }

  private async executeVoiceControlTask(task: JarvisTask): Promise<void> {
    const { deviceSerial, command } = task.parameters;
    
    // 创建虚拟语音命令
    const voiceCommand: VoiceCommand = {
      id: task.id,
      text: command,
      intent: 'jarvis_task',
      confidence: 1.0,
      timestamp: task.createdAt,
      deviceSerial
    };

    await this.processVoiceCommandForDevice(voiceCommand, deviceSerial);
    
    task.status = 'completed';
    task.result = { command, processed: true };
    task.completedAt = new Date();
  }

  private async executeSecurityScanTask(task: JarvisTask): Promise<void> {
    const { deviceSerial } = task.parameters;
    
    // 执行安全风险评估
    const riskAssessment = await this.securityManager.assessSecurityRisk(deviceSerial);
    
    task.status = 'completed';
    task.result = riskAssessment;
    task.completedAt = new Date();

    // 记录任务报告
    this.recordTaskReport({
      id: task.id,
      taskType: 'security_scan',
      emulatorId: deviceSerial,
      startTime: task.createdAt,
      endTime: task.completedAt,
      status: task.status,
      results: task.result
    });

    // 如果发现高风险，发送警报给JARVIS
    if (riskAssessment.riskLevel === 'high' || riskAssessment.riskLevel === 'critical') {
      this.sendToJarvis({
        type: 'security_alert',
        deviceSerial,
        riskLevel: riskAssessment.riskLevel,
        score: riskAssessment.score,
        factors: riskAssessment.factors,
        recommendations: riskAssessment.recommendations
      });
    }
  }

  // 设备查询处理
  private handleDeviceQuery(message: any): void {
    const emulators = this.emulatorService.getEmulators();
    const deviceInfo = emulators.map(e => ({
      id: e.id,
      name: e.name,
      type: e.type,
      status: e.status,
      androidVersion: e.androidVersion,
      screenResolution: e.screenResolution,
      lastUsed: e.lastUsed
    }));

    this.sendToJarvis({
      type: 'device_query_response',
      queryId: message.queryId,
      devices: deviceInfo
    });
  }

  // 安全警报处理
  private handleSecurityAlert(message: any): void {
    console.warn('Security alert from JARVIS:', message);
    this.emitEvent('security-alert', message);
    
    // 可以根据警报类型采取相应措施
    if (message.severity === 'critical') {
      // 暂停所有自动化任务
      this.pauseAllAutomation();
    }
  }

  // 系统更新处理
  private handleSystemUpdate(message: any): void {
    console.log('System update from JARVIS:', message);
    this.emitEvent('system-update', message);
    
    // 根据更新类型进行相应处理
    switch (message.updateType) {
      case 'config_update':
        this.updateConfiguration(message.config);
        break;
      case 'security_policy':
        this.updateSecurityPolicy(message.policy);
        break;
      case 'ai_model':
        this.updateAIModel(message.model);
        break;
    }
  }

  // 设备选择逻辑
  private selectBestDevice(): string | null {
    const emulators = this.emulatorService.getEmulators();
    const onlineEmulators = emulators.filter(e => e.status === EmulatorStatus.ONLINE);
    
    if (onlineEmulators.length === 0) {
      return null;
    }
    
    // 选择最近使用的设备
    onlineEmulators.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
    return onlineEmulators[0].adbPort.toString();
  }

  // 事件处理设置
  private setupEventHandlers(): void {
    // 监听模拟器状态变化
    this.emulatorService.addEventListener('emulator-status-changed', (data: any) => {
      this.sendToJarvis({
        type: 'device_status_update',
        deviceId: data.emulatorId,
        status: data.status
      });
    });

    // 监听自动化事件
    this.automationEngine.addEventListener('script-completed', (data: any) => {
      this.sendToJarvis({
        type: 'automation_completed',
        scriptId: data.scriptId,
        success: true
      });
    });

    this.automationEngine.addEventListener('script-failed', (data: any) => {
      this.sendToJarvis({
        type: 'automation_failed',
        scriptId: data.scriptId,
        error: data.error
      });
    });

    // 监听价格比对事件
    this.priceComparison.addEventListener('task-completed', (data: any) => {
      this.sendToJarvis({
        type: 'price_comparison_completed',
        taskId: data.taskId,
        productName: data.productName,
        resultCount: data.totalResults
      });
    });
  }

  // 发送消息到JARVIS
  private sendToJarvis(message: any): void {
    if (this.jarvisConnection && this.connectionStatus === 'connected') {
      this.jarvisConnection.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString(),
        source: 'android_emulator'
      }));
    } else {
      console.warn('Cannot send message to JARVIS: not connected');
    }
  }

  // 智能协调
  public async coordinateWithJarvis(
    userRequest: string,
    context: any = {}
  ): Promise<any> {
    // 发送用户请求到JARVIS进行协调处理
    const coordinationRequest = {
      type: 'coordination_request',
      requestId: uuidv4(),
      userRequest,
      context: {
        ...context,
        availableDevices: this.emulatorService.getEmulators()
          .filter(e => e.status === EmulatorStatus.ONLINE)
          .map(e => ({ id: e.id, name: e.name, type: e.type })),
        capabilities: [
          'app_automation',
          'price_comparison',
          'device_control',
          'security_monitoring'
        ]
      }
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Coordination request timeout'));
      }, 30000);

      const handleResponse = (event: any) => {
        if (event.type === 'coordination_response' && 
            event.requestId === coordinationRequest.requestId) {
          clearTimeout(timeout);
          this.removeEventListener('jarvis-message', handleResponse);
          resolve(event.response);
        }
      };

      this.addEventListener('jarvis-message', handleResponse);
      this.sendToJarvis(coordinationRequest);
    });
  }

  // 跨平台任务协调
  public async executeCrossPlatformTask(taskConfig: {
    androidActions: any[];
    webActions?: any[];
    systemActions?: any[];
    coordination: 'parallel' | 'sequential';
  }): Promise<boolean> {
    const taskId = uuidv4();
    
    try {
      // 发送跨平台任务请求到JARVIS
      const crossPlatformRequest = {
        type: 'cross_platform_task',
        taskId,
        config: taskConfig
      };

      this.sendToJarvis(crossPlatformRequest);

      // 执行Android部分
      const androidResults = await this.executeAndroidActions(taskConfig.androidActions);

      // 等待其他平台完成（通过JARVIS协调）
      return await this.waitForCrossPlatformCompletion(taskId);

    } catch (error) {
      console.error('Cross-platform task failed:', error);
      return false;
    }
  }

  private async executeAndroidActions(actions: any[]): Promise<any[]> {
    const results: any[] = [];
    
    for (const action of actions) {
      try {
        const result = await this.executeAction(action);
        results.push({ action, result, success: true });
      } catch (error) {
        results.push({ 
          action, 
          error: error instanceof Error ? error.message : 'Unknown error', 
          success: false 
        });
      }
    }
    
    return results;
  }

  private async executeAction(action: any): Promise<any> {
    switch (action.type) {
      case 'automation':
        return await this.automationEngine.executeScript(action.script, action.deviceSerial);
      case 'price_comparison':
        const task = this.priceComparison.createPriceComparisonTask(
          action.productName, 
          action.platforms
        );
        return await this.priceComparison.executePriceComparison(task.id, action.deviceSerial);
      case 'voice_command':
        const decision = await this.aiDecisionEngine.processNaturalLanguageInstruction(
          action.command,
          action.deviceSerial
        );
        return await this.aiDecisionEngine.executeDecision(decision, action.deviceSerial);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async waitForCrossPlatformCompletion(taskId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 60000); // 1分钟超时

      const handleCompletion = (event: any) => {
        if (event.type === 'cross_platform_task_completed' && event.taskId === taskId) {
          clearTimeout(timeout);
          this.removeEventListener('jarvis-message', handleCompletion);
          resolve(event.success);
        }
      };

      this.addEventListener('jarvis-message', handleCompletion);
    });
  }

  // 语音控制集成
  public async enableVoiceControl(deviceSerial: string): Promise<boolean> {
    const integration: JarvisIntegration = {
      emulatorId: deviceSerial,
      voiceControlEnabled: true,
      aiAssistantEnabled: true,
      taskSyncEnabled: true,
      reportingEnabled: true
    };

    this.integrations.set(deviceSerial, integration);

    // 通知JARVIS启用语音控制
    this.sendToJarvis({
      type: 'voice_control_enabled',
      deviceSerial,
      capabilities: ['natural_language_processing', 'app_control', 'automation']
    });

    return true;
  }

  public async disableVoiceControl(deviceSerial: string): Promise<boolean> {
    const integration = this.integrations.get(deviceSerial);
    if (integration) {
      integration.voiceControlEnabled = false;
    }

    this.sendToJarvis({
      type: 'voice_control_disabled',
      deviceSerial
    });

    return true;
  }

  // 任务报告
  private recordTaskReport(report: TaskReport): void {
    const emulatorId = report.emulatorId;
    
    if (!this.taskReports.has(emulatorId)) {
      this.taskReports.set(emulatorId, []);
    }
    
    const reports = this.taskReports.get(emulatorId)!;
    reports.push(report);
    
    // 保持报告数量在合理范围内
    if (reports.length > 100) {
      reports.shift();
    }

    // 发送报告到JARVIS
    this.sendToJarvis({
      type: 'task_report',
      report
    });
  }

  // 配置更新
  private updateConfiguration(config: any): void {
    // 更新AI模型配置
    if (config.aiModel) {
      this.aiDecisionEngine.setAIModel(config.aiModel);
    }

    // 更新自动化配置
    if (config.automation) {
      // 应用自动化配置
    }

    // 更新安全配置
    if (config.security) {
      // 应用安全配置
    }
  }

  private updateSecurityPolicy(policy: any): void {
    // 更新安全策略
    if (policy.profileId && policy.devices) {
      for (const deviceSerial of policy.devices) {
        this.securityManager.applySecurityProfile(deviceSerial, policy.profileId);
      }
    }
  }

  private updateAIModel(model: any): void {
    this.aiDecisionEngine.setAIModel(model.name);
  }

  // 暂停所有自动化
  private pauseAllAutomation(): void {
    const runningScripts = this.automationEngine.getAllRunningScripts();
    for (const scriptId of runningScripts) {
      this.automationEngine.stopScript(scriptId);
    }

    this.emitEvent('automation-paused', { scriptCount: runningScripts.length });
  }

  // 公共方法
  public getConnectionStatus(): string {
    return this.connectionStatus;
  }

  public getActiveIntegrations(): JarvisIntegration[] {
    return Array.from(this.integrations.values());
  }

  public getTaskReports(emulatorId?: string): TaskReport[] {
    if (emulatorId) {
      return this.taskReports.get(emulatorId) || [];
    }
    
    const allReports: TaskReport[] = [];
    for (const reports of this.taskReports.values()) {
      allReports.push(...reports);
    }
    
    return allReports.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  public getVoiceCommands(): VoiceCommand[] {
    return this.voiceCommands.slice(-50); // 返回最近50条命令
  }

  public async reconnectToJarvis(): Promise<void> {
    if (this.jarvisConnection) {
      this.jarvisConnection.close();
    }
    await this.initializeJarvisConnection();
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
    if (this.jarvisConnection) {
      this.jarvisConnection.close();
    }
    
    this.integrations.clear();
    this.activeTasks.clear();
    this.taskReports.clear();
    this.voiceCommands.length = 0;
    this.eventListeners.clear();
  }
}

export default JarvisAndroidIntegration;