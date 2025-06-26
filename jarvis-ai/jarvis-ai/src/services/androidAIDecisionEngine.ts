import { v4 as uuidv4 } from 'uuid';
import {
  AIDecision,
  InteractionContext,
  AutomationStep,
  ElementSelector,
  TouchEvent,
  AndroidApp,
  EmulatorStatus
} from '../types/android-emulator';
import { ADBController } from './adbController';
import { AutomationEngine } from './automationEngine';
import { AndroidEmulatorService } from './androidEmulatorService';

interface AIModel {
  name: string;
  endpoint: string;
  apiKey?: string;
  maxTokens: number;
}

interface NLPResult {
  intent: string;
  entities: { [key: string]: any };
  confidence: number;
  actions: string[];
}

interface ScreenAnalysis {
  currentApp: string;
  screenType: string;
  interactableElements: Array<{
    type: string;
    text: string;
    bounds: { x: number; y: number; width: number; height: number };
    clickable: boolean;
    selector: ElementSelector;
  }>;
  suggestedActions: string[];
  context: string;
}

export class AndroidAIDecisionEngine {
  private static instance: AndroidAIDecisionEngine;
  private adbController: ADBController;
  private automationEngine: AutomationEngine;
  private emulatorService: AndroidEmulatorService;
  private conversationHistory: Map<string, string[]> = new Map();
  private contextCache: Map<string, InteractionContext> = new Map();
  private decisionHistory: Map<string, AIDecision[]> = new Map();

  // AI模型配置
  private aiModels: AIModel[] = [
    {
      name: 'DeepSeek',
      endpoint: '/api/deepseek/chat',
      maxTokens: 4000
    },
    {
      name: 'Qwen',
      endpoint: '/api/qwen/chat',
      maxTokens: 8000
    }
  ];

  private currentModel: AIModel;

  // 预定义的意图模式
  private intentPatterns = {
    navigation: [
      /打开(.+)/,
      /进入(.+)/,
      /访问(.+)/,
      /切换到(.+)/,
      /启动(.+)/
    ],
    search: [
      /搜索(.+)/,
      /查找(.+)/,
      /寻找(.+)/,
      /找(.+)/
    ],
    input: [
      /输入(.+)/,
      /填写(.+)/,
      /写(.+)/,
      /键入(.+)/
    ],
    action: [
      /点击(.+)/,
      /按(.+)/,
      /选择(.+)/,
      /滑动(.+)/,
      /长按(.+)/
    ],
    shopping: [
      /购买(.+)/,
      /下单(.+)/,
      /加购物车(.+)/,
      /比价(.+)/,
      /查看价格(.+)/
    ],
    social: [
      /发消息(.+)/,
      /发送(.+)/,
      /回复(.+)/,
      /分享(.+)/,
      /转发(.+)/
    ]
  };

  // 应用特定的知识库
  private appKnowledge = {
    'com.taobao.taobao': {
      name: '淘宝',
      commonActions: ['搜索商品', '加购物车', '下单', '查看订单'],
      selectors: {
        searchBox: { type: 'id', value: 'com.taobao.taobao:id/searchbar' },
        cart: { type: 'text', value: '购物车' },
        home: { type: 'text', value: '首页' }
      }
    },
    'com.tencent.mm': {
      name: '微信',
      commonActions: ['发消息', '添加好友', '朋友圈', '扫一扫'],
      selectors: {
        messageInput: { type: 'id', value: 'com.tencent.mm:id/input' },
        contacts: { type: 'text', value: '通讯录' },
        discover: { type: 'text', value: '发现' }
      }
    },
    'com.jingdong.app.mall': {
      name: '京东',
      commonActions: ['搜索商品', '查看订单', '京东超市', '京东物流'],
      selectors: {
        searchBox: { type: 'id', value: 'com.jingdong.app.mall:id/search_box' }
      }
    }
  };

  private constructor() {
    this.adbController = ADBController.getInstance();
    this.automationEngine = AutomationEngine.getInstance();
    this.emulatorService = AndroidEmulatorService.getInstance();
    this.currentModel = this.aiModels[0]; // 默认使用第一个模型
  }

  public static getInstance(): AndroidAIDecisionEngine {
    if (!AndroidAIDecisionEngine.instance) {
      AndroidAIDecisionEngine.instance = new AndroidAIDecisionEngine();
    }
    return AndroidAIDecisionEngine.instance;
  }

  // 主要的AI决策入口
  public async processNaturalLanguageInstruction(
    instruction: string,
    deviceSerial: string,
    conversationId: string = 'default'
  ): Promise<AIDecision> {
    try {
      // 1. 更新对话历史
      this.updateConversationHistory(conversationId, instruction);

      // 2. 获取当前设备上下文
      const context = await this.getCurrentContext(deviceSerial);

      // 3. 分析自然语言指令
      const nlpResult = await this.analyzeInstruction(instruction, context);

      // 4. 生成AI决策
      const decision = await this.generateDecision(
        instruction,
        nlpResult,
        context,
        conversationId
      );

      // 5. 记录决策
      this.recordDecision(conversationId, decision);

      return decision;

    } catch (error) {
      console.error('Error processing instruction:', error);
      
      return {
        id: uuidv4(),
        context: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        instruction,
        interpretation: '无法理解指令',
        actions: [],
        confidence: 0,
        reasoning: '系统错误',
        timestamp: new Date()
      };
    }
  }

  // 获取当前设备和应用上下文
  private async getCurrentContext(deviceSerial: string): Promise<InteractionContext> {
    const cached = this.contextCache.get(deviceSerial);
    const now = Date.now();
    
    // 如果缓存在5秒内，直接使用
    if (cached && now - cached.timestamp < 5000) {
      return cached;
    }

    try {
      // 获取当前应用
      const currentApp = await this.adbController.getCurrentApp(deviceSerial) || 'unknown';
      
      // 获取屏幕信息
      const screenAnalysis = await this.analyzeCurrentScreen(deviceSerial);
      
      // 获取设备状态
      const emulators = this.emulatorService.getEmulators();
      const currentEmulator = emulators.find(e => 
        e.adbPort.toString() === deviceSerial || 
        e.deviceInfo.serialNumber === deviceSerial
      );
      
      const context: InteractionContext = {
        currentApp,
        screenState: screenAnalysis.screenType,
        userIntent: '',
        conversationHistory: this.conversationHistory.get('default') || [],
        deviceStatus: currentEmulator?.status || EmulatorStatus.UNKNOWN,
        availableActions: screenAnalysis.suggestedActions,
        timestamp: now
      };

      this.contextCache.set(deviceSerial, context);
      return context;

    } catch (error) {
      console.error('Error getting current context:', error);
      
      return {
        currentApp: 'unknown',
        screenState: 'unknown',
        userIntent: '',
        conversationHistory: [],
        deviceStatus: EmulatorStatus.UNKNOWN,
        availableActions: [],
        timestamp: now
      };
    }
  }

  // 分析当前屏幕内容
  private async analyzeCurrentScreen(deviceSerial: string): Promise<ScreenAnalysis> {
    try {
      // 获取UI层次结构
      const uiHierarchy = await this.getUIHierarchy(deviceSerial);
      
      // 解析可交互元素
      const elements = this.parseInteractableElements(uiHierarchy);
      
      // 获取当前应用
      const currentApp = await this.adbController.getCurrentApp(deviceSerial) || 'unknown';
      
      // 确定屏幕类型
      const screenType = this.determineScreenType(elements, currentApp);
      
      // 生成建议操作
      const suggestedActions = this.generateSuggestedActions(elements, currentApp, screenType);
      
      return {
        currentApp,
        screenType,
        interactableElements: elements,
        suggestedActions,
        context: this.generateScreenContext(elements, screenType)
      };

    } catch (error) {
      console.error('Error analyzing screen:', error);
      
      return {
        currentApp: 'unknown',
        screenType: 'unknown',
        interactableElements: [],
        suggestedActions: [],
        context: 'Unable to analyze screen'
      };
    }
  }

  // 获取UI层次结构
  private async getUIHierarchy(deviceSerial: string): Promise<string> {
    const dumpResponse = await this.adbController.executeCommand({
      command: '-s',
      args: [deviceSerial, 'shell', 'uiautomator', 'dump', '/sdcard/ui_dump.xml']
    });

    if (!dumpResponse.success) {
      throw new Error('Failed to dump UI hierarchy');
    }

    const catResponse = await this.adbController.executeCommand({
      command: '-s',
      args: [deviceSerial, 'shell', 'cat', '/sdcard/ui_dump.xml']
    });

    if (!catResponse.success) {
      throw new Error('Failed to read UI hierarchy');
    }

    return catResponse.output;
  }

  // 解析可交互元素
  private parseInteractableElements(uiXml: string): Array<{
    type: string;
    text: string;
    bounds: { x: number; y: number; width: number; height: number };
    clickable: boolean;
    selector: ElementSelector;
  }> {
    const elements: any[] = [];
    
    try {
      // 简化的XML解析 - 查找clickable元素
      const clickablePattern = /clickable="true"[^>]*text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
      let match;

      while ((match = clickablePattern.exec(uiXml)) !== null) {
        const text = match[1];
        const x1 = parseInt(match[2]);
        const y1 = parseInt(match[3]);
        const x2 = parseInt(match[4]);
        const y2 = parseInt(match[5]);

        if (text && text.trim().length > 0) {
          elements.push({
            type: 'button',
            text: text.trim(),
            bounds: {
              x: x1,
              y: y1,
              width: x2 - x1,
              height: y2 - y1
            },
            clickable: true,
            selector: {
              type: 'text',
              value: text.trim()
            }
          });
        }
      }

      // 查找输入框
      const inputPattern = /class="[^"]*EditText"[^>]*text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
      
      while ((match = inputPattern.exec(uiXml)) !== null) {
        const text = match[1] || '输入框';
        const x1 = parseInt(match[2]);
        const y1 = parseInt(match[3]);
        const x2 = parseInt(match[4]);
        const y2 = parseInt(match[5]);

        elements.push({
          type: 'input',
          text,
          bounds: {
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1
          },
          clickable: true,
          selector: {
            type: 'class',
            value: 'android.widget.EditText'
          }
        });
      }

    } catch (error) {
      console.error('Error parsing UI elements:', error);
    }

    return elements;
  }

  // 确定屏幕类型
  private determineScreenType(elements: any[], currentApp: string): string {
    const texts = elements.map(e => e.text.toLowerCase()).join(' ');
    
    if (texts.includes('搜索') || texts.includes('search')) {
      return 'search_page';
    } else if (texts.includes('登录') || texts.includes('login')) {
      return 'login_page';
    } else if (texts.includes('首页') || texts.includes('home')) {
      return 'home_page';
    } else if (texts.includes('购物车') || texts.includes('cart')) {
      return 'shopping_cart';
    } else if (texts.includes('设置') || texts.includes('setting')) {
      return 'settings_page';
    } else if (elements.some(e => e.type === 'input')) {
      return 'form_page';
    } else {
      return 'content_page';
    }
  }

  // 生成建议操作
  private generateSuggestedActions(elements: any[], currentApp: string, screenType: string): string[] {
    const actions: string[] = [];
    
    // 基于应用知识生成建议
    const appInfo = this.appKnowledge[currentApp];
    if (appInfo) {
      actions.push(...appInfo.commonActions);
    }
    
    // 基于屏幕类型生成建议
    switch (screenType) {
      case 'search_page':
        actions.push('输入搜索关键词', '点击搜索按钮');
        break;
      case 'home_page':
        actions.push('浏览内容', '点击菜单项');
        break;
      case 'shopping_cart':
        actions.push('修改数量', '结算', '删除商品');
        break;
      case 'form_page':
        actions.push('填写表单', '提交信息');
        break;
    }
    
    // 基于可见元素生成建议
    for (const element of elements) {
      if (element.clickable && element.text) {
        actions.push(`点击"${element.text}"`);
      }
    }
    
    return [...new Set(actions)]; // 去重
  }

  // 生成屏幕上下文描述
  private generateScreenContext(elements: any[], screenType: string): string {
    const elementDescriptions = elements
      .filter(e => e.text && e.text.trim().length > 0)
      .slice(0, 10) // 限制数量
      .map(e => `${e.type}:"${e.text}"`)
      .join(', ');
    
    return `屏幕类型: ${screenType}, 可交互元素: ${elementDescriptions}`;
  }

  // 分析自然语言指令
  private async analyzeInstruction(
    instruction: string,
    context: InteractionContext
  ): Promise<NLPResult> {
    try {
      // 本地NLP处理
      const localResult = this.processInstructionLocally(instruction, context);
      
      // 如果置信度较低，使用AI模型增强
      if (localResult.confidence < 0.7) {
        const aiResult = await this.enhanceWithAI(instruction, context, localResult);
        return aiResult;
      }
      
      return localResult;

    } catch (error) {
      console.error('Error analyzing instruction:', error);
      
      return {
        intent: 'unknown',
        entities: {},
        confidence: 0,
        actions: []
      };
    }
  }

  // 本地NLP处理
  private processInstructionLocally(
    instruction: string,
    context: InteractionContext
  ): NLPResult {
    const lowerInstruction = instruction.toLowerCase();
    let intent = 'unknown';
    let confidence = 0;
    const entities: { [key: string]: any } = {};
    const actions: string[] = [];

    // 意图识别
    for (const [intentName, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        const match = lowerInstruction.match(pattern);
        if (match) {
          intent = intentName;
          confidence = 0.8;
          
          if (match[1]) {
            entities.target = match[1].trim();
          }
          
          break;
        }
      }
      
      if (intent !== 'unknown') break;
    }

    // 基于意图生成动作
    switch (intent) {
      case 'navigation':
        actions.push('launch_app', 'navigate_to');
        break;
      case 'search':
        actions.push('find_search_box', 'input_text', 'execute_search');
        break;
      case 'input':
        actions.push('find_input_field', 'input_text');
        break;
      case 'action':
        actions.push('find_element', 'click_element');
        break;
      case 'shopping':
        actions.push('search_product', 'compare_prices', 'add_to_cart');
        break;
      case 'social':
        actions.push('find_chat', 'send_message');
        break;
    }

    // 提取其他实体
    const numbers = instruction.match(/\d+/g);
    if (numbers) {
      entities.numbers = numbers.map(n => parseInt(n));
    }

    return {
      intent,
      entities,
      confidence,
      actions
    };
  }

  // 使用AI模型增强分析
  private async enhanceWithAI(
    instruction: string,
    context: InteractionContext,
    localResult: NLPResult
  ): Promise<NLPResult> {
    try {
      const prompt = this.buildAIPrompt(instruction, context, localResult);
      const aiResponse = await this.callAIModel(prompt);
      
      // 解析AI响应
      const enhancedResult = this.parseAIResponse(aiResponse, localResult);
      
      return enhancedResult;

    } catch (error) {
      console.error('Error enhancing with AI:', error);
      return localResult;
    }
  }

  // 构建AI提示
  private buildAIPrompt(
    instruction: string,
    context: InteractionContext,
    localResult: NLPResult
  ): string {
    return `
作为Android设备控制专家，请分析以下用户指令：

用户指令: "${instruction}"

当前上下文:
- 当前应用: ${context.currentApp}
- 屏幕状态: ${context.screenState}
- 可用操作: ${context.availableActions.join(', ')}
- 对话历史: ${context.conversationHistory.slice(-3).join(' -> ')}

本地分析结果:
- 意图: ${localResult.intent}
- 实体: ${JSON.stringify(localResult.entities)}
- 置信度: ${localResult.confidence}

请提供:
1. 修正后的意图识别
2. 提取的关键实体
3. 建议的操作步骤
4. 置信度评估 (0-1)

请以JSON格式回复，包含: intent, entities, actions, confidence, reasoning
`;
  }

  // 调用AI模型
  private async callAIModel(prompt: string): Promise<string> {
    try {
      const response = await fetch(this.currentModel.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: '你是一个专业的Android设备控制助手，擅长理解用户的自然语言指令并转换为具体的设备操作。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: this.currentModel.maxTokens,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`AI model request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';

    } catch (error) {
      console.error('Error calling AI model:', error);
      throw error;
    }
  }

  // 解析AI响应
  private parseAIResponse(aiResponse: string, fallback: NLPResult): NLPResult {
    try {
      // 尝试解析JSON响应
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          intent: parsed.intent || fallback.intent,
          entities: parsed.entities || fallback.entities,
          confidence: Math.min(parsed.confidence || fallback.confidence, 1),
          actions: parsed.actions || fallback.actions
        };
      }
      
      return fallback;

    } catch (error) {
      console.error('Error parsing AI response:', error);
      return fallback;
    }
  }

  // 生成AI决策
  private async generateDecision(
    instruction: string,
    nlpResult: NLPResult,
    context: InteractionContext,
    conversationId: string
  ): Promise<AIDecision> {
    const decisionId = uuidv4();
    
    // 基于分析结果生成具体操作步骤
    const actions = await this.generateActionSteps(nlpResult, context);
    
    // 生成推理说明
    const reasoning = this.generateReasoning(instruction, nlpResult, context, actions);
    
    return {
      id: decisionId,
      context: this.formatContext(context),
      instruction,
      interpretation: this.generateInterpretation(nlpResult),
      actions,
      confidence: nlpResult.confidence,
      reasoning,
      timestamp: new Date()
    };
  }

  // 生成操作步骤
  private async generateActionSteps(
    nlpResult: NLPResult,
    context: InteractionContext
  ): Promise<AutomationStep[]> {
    const steps: AutomationStep[] = [];
    
    switch (nlpResult.intent) {
      case 'search':
        steps.push(...await this.generateSearchSteps(nlpResult, context));
        break;
      case 'navigation':
        steps.push(...await this.generateNavigationSteps(nlpResult, context));
        break;
      case 'input':
        steps.push(...await this.generateInputSteps(nlpResult, context));
        break;
      case 'action':
        steps.push(...await this.generateActionSteps_Click(nlpResult, context));
        break;
      case 'shopping':
        steps.push(...await this.generateShoppingSteps(nlpResult, context));
        break;
      case 'social':
        steps.push(...await this.generateSocialSteps(nlpResult, context));
        break;
      default:
        // 通用操作
        steps.push({
          id: uuidv4(),
          type: 'wait',
          duration: 1000,
          description: '等待用户进一步指令'
        });
    }
    
    return steps;
  }

  // 生成搜索操作步骤
  private async generateSearchSteps(
    nlpResult: NLPResult,
    context: InteractionContext
  ): Promise<AutomationStep[]> {
    const steps: AutomationStep[] = [];
    const searchTerm = nlpResult.entities.target;
    
    if (!searchTerm) {
      return steps;
    }

    // 根据当前应用确定搜索框选择器
    const appInfo = this.appKnowledge[context.currentApp];
    let searchSelector: ElementSelector = {
      type: 'text',
      value: '搜索'
    };
    
    if (appInfo?.selectors?.searchBox) {
      searchSelector = appInfo.selectors.searchBox;
    }

    steps.push(
      {
        id: uuidv4(),
        type: 'tap',
        selector: searchSelector,
        description: '点击搜索框'
      },
      {
        id: uuidv4(),
        type: 'input',
        text: searchTerm,
        description: `输入搜索关键词: ${searchTerm}`
      },
      {
        id: uuidv4(),
        type: 'tap',
        selector: { type: 'text', value: '搜索' },
        description: '执行搜索'
      }
    );
    
    return steps;
  }

  // 生成导航操作步骤
  private async generateNavigationSteps(
    nlpResult: NLPResult,
    context: InteractionContext
  ): Promise<AutomationStep[]> {
    const steps: AutomationStep[] = [];
    const target = nlpResult.entities.target;
    
    if (!target) {
      return steps;
    }

    // 如果是应用名称，启动应用
    const appPackage = this.findAppPackageByName(target);
    if (appPackage) {
      steps.push({
        id: uuidv4(),
        type: 'tap',
        selector: { type: 'text', value: target },
        description: `启动应用: ${target}`
      });
    } else {
      // 在当前应用内导航
      steps.push({
        id: uuidv4(),
        type: 'tap',
        selector: { type: 'text', value: target },
        description: `导航到: ${target}`
      });
    }
    
    return steps;
  }

  // 生成输入操作步骤
  private async generateInputSteps(
    nlpResult: NLPResult,
    context: InteractionContext
  ): Promise<AutomationStep[]> {
    const steps: AutomationStep[] = [];
    const inputText = nlpResult.entities.target;
    
    if (!inputText) {
      return steps;
    }

    steps.push(
      {
        id: uuidv4(),
        type: 'tap',
        selector: { type: 'class', value: 'android.widget.EditText' },
        description: '点击输入框'
      },
      {
        id: uuidv4(),
        type: 'input',
        text: inputText,
        description: `输入文本: ${inputText}`
      }
    );
    
    return steps;
  }

  // 生成点击操作步骤
  private async generateActionSteps_Click(
    nlpResult: NLPResult,
    context: InteractionContext
  ): Promise<AutomationStep[]> {
    const steps: AutomationStep[] = [];
    const target = nlpResult.entities.target;
    
    if (!target) {
      return steps;
    }

    steps.push({
      id: uuidv4(),
      type: 'tap',
      selector: { type: 'text', value: target },
      description: `点击: ${target}`
    });
    
    return steps;
  }

  // 生成购物操作步骤
  private async generateShoppingSteps(
    nlpResult: NLPResult,
    context: InteractionContext
  ): Promise<AutomationStep[]> {
    const steps: AutomationStep[] = [];
    const product = nlpResult.entities.target;
    
    if (!product) {
      return steps;
    }

    // 根据指令类型生成不同的购物步骤
    if (nlpResult.instruction.includes('比价') || nlpResult.instruction.includes('价格')) {
      // 价格比对流程
      steps.push({
        id: uuidv4(),
        type: 'screenshot',
        description: '开始价格比对'
      });
    } else {
      // 常规购物流程
      steps.push(...await this.generateSearchSteps(nlpResult, context));
    }
    
    return steps;
  }

  // 生成社交操作步骤
  private async generateSocialSteps(
    nlpResult: NLPResult,
    context: InteractionContext
  ): Promise<AutomationStep[]> {
    const steps: AutomationStep[] = [];
    const message = nlpResult.entities.target;
    
    if (!message) {
      return steps;
    }

    const appInfo = this.appKnowledge[context.currentApp];
    if (appInfo?.selectors?.messageInput) {
      steps.push(
        {
          id: uuidv4(),
          type: 'tap',
          selector: appInfo.selectors.messageInput,
          description: '点击消息输入框'
        },
        {
          id: uuidv4(),
          type: 'input',
          text: message,
          description: `输入消息: ${message}`
        },
        {
          id: uuidv4(),
          type: 'tap',
          selector: { type: 'text', value: '发送' },
          description: '发送消息'
        }
      );
    }
    
    return steps;
  }

  // 工具方法
  private findAppPackageByName(appName: string): string | null {
    for (const [packageName, info] of Object.entries(this.appKnowledge)) {
      if (info.name.includes(appName) || appName.includes(info.name)) {
        return packageName;
      }
    }
    return null;
  }

  private formatContext(context: InteractionContext): string {
    return `应用: ${context.currentApp}, 屏幕: ${context.screenState}, 状态: ${context.deviceStatus}`;
  }

  private generateInterpretation(nlpResult: NLPResult): string {
    const intent = nlpResult.intent;
    const target = nlpResult.entities.target;
    
    switch (intent) {
      case 'search':
        return `搜索: ${target}`;
      case 'navigation':
        return `导航到: ${target}`;
      case 'input':
        return `输入: ${target}`;
      case 'action':
        return `执行操作: ${target}`;
      case 'shopping':
        return `购物操作: ${target}`;
      case 'social':
        return `社交操作: ${target}`;
      default:
        return '通用操作';
    }
  }

  private generateReasoning(
    instruction: string,
    nlpResult: NLPResult,
    context: InteractionContext,
    actions: AutomationStep[]
  ): string {
    return `
基于指令"${instruction}"的分析:
1. 识别意图: ${nlpResult.intent} (置信度: ${nlpResult.confidence})
2. 当前环境: ${context.currentApp} - ${context.screenState}
3. 生成${actions.length}个操作步骤
4. 预期结果: ${this.generateInterpretation(nlpResult)}
`;
  }

  // 执行AI决策
  public async executeDecision(
    decision: AIDecision,
    deviceSerial: string
  ): Promise<boolean> {
    try {
      // 创建自动化脚本
      const script = this.automationEngine.createScript(
        `AI决策-${decision.id}`,
        decision.interpretation,
        'ai-generated',
        decision.actions.map(action => ({
          ...action,
          id: action.id || uuidv4()
        }))
      );

      // 执行脚本
      const success = await this.automationEngine.executeScript(script, deviceSerial);
      
      return success;

    } catch (error) {
      console.error('Error executing AI decision:', error);
      return false;
    }
  }

  // 学习和优化
  public async learnFromExecution(
    decision: AIDecision,
    executionResult: boolean,
    userFeedback?: string
  ): Promise<void> {
    // 实现学习逻辑，优化后续决策
    // 可以记录成功/失败模式，调整置信度等
  }

  // 对话管理
  private updateConversationHistory(conversationId: string, message: string): void {
    if (!this.conversationHistory.has(conversationId)) {
      this.conversationHistory.set(conversationId, []);
    }
    
    const history = this.conversationHistory.get(conversationId)!;
    history.push(message);
    
    // 保持历史记录在合理范围内
    if (history.length > 10) {
      history.shift();
    }
  }

  private recordDecision(conversationId: string, decision: AIDecision): void {
    if (!this.decisionHistory.has(conversationId)) {
      this.decisionHistory.set(conversationId, []);
    }
    
    const history = this.decisionHistory.get(conversationId)!;
    history.push(decision);
    
    // 保持决策历史在合理范围内
    if (history.length > 20) {
      history.shift();
    }
  }

  // 公共方法
  public getDecisionHistory(conversationId: string): AIDecision[] {
    return this.decisionHistory.get(conversationId) || [];
  }

  public getConversationHistory(conversationId: string): string[] {
    return this.conversationHistory.get(conversationId) || [];
  }

  public clearConversation(conversationId: string): void {
    this.conversationHistory.delete(conversationId);
    this.decisionHistory.delete(conversationId);
    this.contextCache.clear();
  }

  public setAIModel(modelName: string): boolean {
    const model = this.aiModels.find(m => m.name === modelName);
    if (model) {
      this.currentModel = model;
      return true;
    }
    return false;
  }

  // 清理资源
  public cleanup(): void {
    this.conversationHistory.clear();
    this.decisionHistory.clear();
    this.contextCache.clear();
  }
}

export default AndroidAIDecisionEngine;