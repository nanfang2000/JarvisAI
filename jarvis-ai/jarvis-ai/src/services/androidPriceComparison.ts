import { v4 as uuidv4 } from 'uuid';
import {
  PriceComparisonTask,
  ShoppingPlatform,
  PriceResult,
  ElementSelector,
  AutomationScript
} from '../types/android-emulator';
import { AutomationEngine } from './automationEngine';
import { ADBController } from './adbController';
import { priceApiService } from '../../services/priceApiService';

export class AndroidPriceComparison {
  private static instance: AndroidPriceComparison;
  private automationEngine: AutomationEngine;
  private adbController: ADBController;
  private activeTasks: Map<string, PriceComparisonTask> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();

  // 预定义的购物平台配置
  private platforms: ShoppingPlatform[] = [
    {
      name: '淘宝',
      packageName: 'com.taobao.taobao',
      searchSelector: {
        type: 'id',
        value: 'com.taobao.taobao:id/searchbar'
      },
      priceSelector: {
        type: 'id',
        value: 'com.taobao.taobao:id/price'
      },
      titleSelector: {
        type: 'id',
        value: 'com.taobao.taobao:id/title'
      }
    },
    {
      name: '京东',
      packageName: 'com.jingdong.app.mall',
      searchSelector: {
        type: 'id',
        value: 'com.jingdong.app.mall:id/search_box'
      },
      priceSelector: {
        type: 'id',
        value: 'com.jingdong.app.mall:id/price_current'
      },
      titleSelector: {
        type: 'id',
        value: 'com.jingdong.app.mall:id/product_title'
      }
    },
    {
      name: '拼多多',
      packageName: 'com.xunmeng.pinduoduo',
      searchSelector: {
        type: 'text',
        value: '搜索'
      },
      priceSelector: {
        type: 'class',
        value: 'android.widget.TextView'
      },
      titleSelector: {
        type: 'class',
        value: 'android.widget.TextView'
      }
    },
    {
      name: '天猫',
      packageName: 'com.tmall.wireless',
      searchSelector: {
        type: 'id',
        value: 'com.tmall.wireless:id/search_input'
      },
      priceSelector: {
        type: 'id',
        value: 'com.tmall.wireless:id/price'
      },
      titleSelector: {
        type: 'id',
        value: 'com.tmall.wireless:id/title'
      }
    },
    {
      name: '苏宁易购',
      packageName: 'com.suning.mobile.ebuy',
      searchSelector: {
        type: 'id',
        value: 'com.suning.mobile.ebuy:id/search_bar'
      },
      priceSelector: {
        type: 'id',
        value: 'com.suning.mobile.ebuy:id/price'
      },
      titleSelector: {
        type: 'id',
        value: 'com.suning.mobile.ebuy:id/title'
      }
    }
  ];

  private constructor() {
    this.automationEngine = AutomationEngine.getInstance();
    this.adbController = ADBController.getInstance();
  }

  public static getInstance(): AndroidPriceComparison {
    if (!AndroidPriceComparison.instance) {
      AndroidPriceComparison.instance = new AndroidPriceComparison();
    }
    return AndroidPriceComparison.instance;
  }

  // 创建价格比对任务
  public createPriceComparisonTask(
    productName: string,
    selectedPlatforms?: string[]
  ): PriceComparisonTask {
    const taskId = uuidv4();
    const platforms = selectedPlatforms 
      ? this.platforms.filter(p => selectedPlatforms.includes(p.name))
      : this.platforms;

    const task: PriceComparisonTask = {
      id: taskId,
      productName,
      platforms,
      status: 'pending',
      results: [],
      createdAt: new Date()
    };

    this.activeTasks.set(taskId, task);
    return task;
  }

  // 执行价格比对任务
  public async executePriceComparison(
    taskId: string,
    deviceSerial: string,
    options: {
      maxResultsPerPlatform?: number;
      timeout?: number;
      includeScreenshots?: boolean;
    } = {}
  ): Promise<boolean> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const {
      maxResultsPerPlatform = 5,
      timeout = 300000, // 5分钟
      includeScreenshots = true
    } = options;

    try {
      task.status = 'running';
      this.emitEvent('task-started', { taskId, productName: task.productName });

      const startTime = Date.now();
      const results: PriceResult[] = [];

      for (const platform of task.platforms) {
        if (Date.now() - startTime > timeout) {
          console.warn(`Timeout reached, skipping remaining platforms`);
          break;
        }

        this.emitEvent('platform-started', { taskId, platform: platform.name });

        try {
          const platformResults = await this.searchPlatform(
            platform,
            task.productName,
            deviceSerial,
            maxResultsPerPlatform,
            includeScreenshots
          );

          results.push(...platformResults);
          this.emitEvent('platform-completed', { 
            taskId, 
            platform: platform.name, 
            resultCount: platformResults.length 
          });

        } catch (error) {
          console.error(`Error searching ${platform.name}:`, error);
          this.emitEvent('platform-error', { 
            taskId, 
            platform: platform.name, 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }

        // 平台间等待，避免过于频繁的切换
        await this.wait(2000);
      }

      task.results = results;
      task.status = 'completed';
      task.completedAt = new Date();

      this.emitEvent('task-completed', { 
        taskId, 
        productName: task.productName, 
        totalResults: results.length 
      });

      return true;

    } catch (error) {
      task.status = 'failed';
      this.emitEvent('task-failed', { 
        taskId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  // 在指定平台搜索商品
  private async searchPlatform(
    platform: ShoppingPlatform,
    productName: string,
    deviceSerial: string,
    maxResults: number,
    includeScreenshots: boolean
  ): Promise<PriceResult[]> {
    const results: PriceResult[] = [];

    // 启动应用
    const launchSuccess = await this.adbController.launchApp(
      deviceSerial, 
      platform.packageName
    );

    if (!launchSuccess) {
      throw new Error(`Failed to launch ${platform.name}`);
    }

    // 等待应用启动
    await this.wait(3000);

    // 查找搜索框并输入商品名称
    const searchElement = await this.adbController.findElement(
      deviceSerial, 
      platform.searchSelector
    );

    if (!searchElement) {
      throw new Error(`Search box not found in ${platform.name}`);
    }

    // 点击搜索框
    await this.adbController.performTouchEvent(deviceSerial, {
      type: 'tap',
      x: searchElement.x,
      y: searchElement.y
    });

    await this.wait(1000);

    // 输入搜索关键词
    await this.adbController.inputText(deviceSerial, productName, true);
    await this.wait(1000);

    // 执行搜索（通常是回车键或搜索按钮）
    await this.adbController.sendKeyEvent(deviceSerial, {
      type: 'key_press',
      keyCode: 66 // Enter key
    });

    // 等待搜索结果加载
    await this.wait(3000);

    // 截图保存搜索结果页面
    if (includeScreenshots) {
      await this.adbController.takeScreenshot(deviceSerial);
    }

    // 解析搜索结果
    const platformResults = await this.parseSearchResults(
      platform,
      deviceSerial,
      maxResults
    );

    results.push(...platformResults);

    return results;
  }

  // 解析搜索结果
  private async parseSearchResults(
    platform: ShoppingPlatform,
    deviceSerial: string,
    maxResults: number
  ): Promise<PriceResult[]> {
    const results: PriceResult[] = [];

    try {
      // 获取页面的UI信息
      const uiDump = await this.getUIHierarchy(deviceSerial);
      
      // 解析价格、标题等信息
      const parsedData = this.parseUIForPriceInfo(uiDump, platform);

      for (let i = 0; i < Math.min(parsedData.length, maxResults); i++) {
        const item = parsedData[i];
        
        const result: PriceResult = {
          platform: platform.name,
          productTitle: item.title || `${platform.name}商品${i + 1}`,
          price: item.price || 0,
          currency: 'CNY',
          originalPrice: item.originalPrice,
          discount: item.discount,
          rating: item.rating,
          reviews: item.reviews,
          imageUrl: item.imageUrl,
          productUrl: item.productUrl,
          timestamp: new Date()
        };

        results.push(result);
      }

    } catch (error) {
      console.error(`Error parsing results for ${platform.name}:`, error);
    }

    return results;
  }

  // 获取UI层次结构
  private async getUIHierarchy(deviceSerial: string): Promise<string> {
    const dumpResponse = await this.adbController.executeCommand({
      command: '-s',
      args: [deviceSerial, 'shell', 'uiautomator', 'dump', '/sdcard/ui_hierarchy.xml']
    });

    if (!dumpResponse.success) {
      throw new Error('Failed to dump UI hierarchy');
    }

    const catResponse = await this.adbController.executeCommand({
      command: '-s',
      args: [deviceSerial, 'shell', 'cat', '/sdcard/ui_hierarchy.xml']
    });

    if (!catResponse.success) {
      throw new Error('Failed to read UI hierarchy');
    }

    return catResponse.output;
  }

  // 解析UI信息提取价格数据
  private parseUIForPriceInfo(uiXml: string, platform: ShoppingPlatform): any[] {
    const results: any[] = [];

    try {
      // 简化的XML解析 - 在实际项目中应使用专业的XML解析器
      const pricePattern = /¥?(\d+(?:\.\d{2})?)/g;
      const prices: number[] = [];
      let match;

      while ((match = pricePattern.exec(uiXml)) !== null) {
        const price = parseFloat(match[1]);
        if (price > 0 && price < 100000) { // 合理的价格范围
          prices.push(price);
        }
      }

      // 提取标题（简化处理）
      const titlePattern = /text="([^"]{10,100})"/g;
      const titles: string[] = [];
      
      while ((match = titlePattern.exec(uiXml)) !== null) {
        const title = match[1];
        if (this.isProductTitle(title)) {
          titles.push(title);
        }
      }

      // 组合价格和标题
      const itemCount = Math.min(prices.length, titles.length, 10);
      for (let i = 0; i < itemCount; i++) {
        results.push({
          title: titles[i] || `商品${i + 1}`,
          price: prices[i] || 0,
          originalPrice: undefined,
          discount: undefined,
          rating: undefined,
          reviews: undefined,
          imageUrl: undefined,
          productUrl: undefined
        });
      }

    } catch (error) {
      console.error('Error parsing UI for price info:', error);
    }

    return results;
  }

  // 判断文本是否可能是商品标题
  private isProductTitle(text: string): boolean {
    // 简单的启发式判断
    return text.length >= 10 && 
           text.length <= 100 && 
           !text.includes('¥') && 
           !text.includes('元') &&
           !/^\d+$/.test(text) &&
           !text.includes('搜索') &&
           !text.includes('筛选') &&
           !text.includes('排序');
  }

  // 智能价格比对
  public async intelligentPriceComparison(
    productName: string,
    deviceSerial: string,
    options: {
      platforms?: string[];
      maxResultsPerPlatform?: number;
      priceThreshold?: number;
      includeRecommendations?: boolean;
    } = {}
  ): Promise<{
    task: PriceComparisonTask;
    analysis: {
      lowestPrice: PriceResult | null;
      highestPrice: PriceResult | null;
      averagePrice: number;
      priceRange: number;
      bestDeals: PriceResult[];
      recommendations: string[];
    };
  }> {
    const {
      platforms,
      maxResultsPerPlatform = 5,
      priceThreshold = 0,
      includeRecommendations = true
    } = options;

    // 创建并执行价格比对任务
    const task = this.createPriceComparisonTask(productName, platforms);
    
    const success = await this.executePriceComparison(task.id, deviceSerial, {
      maxResultsPerPlatform,
      includeScreenshots: true
    });

    if (!success) {
      throw new Error('Price comparison failed');
    }

    // 分析结果
    const results = task.results;
    
    let lowestPrice: PriceResult | null = null;
    let highestPrice: PriceResult | null = null;
    let totalPrice = 0;
    let validResults = 0;

    for (const result of results) {
      if (result.price > 0) {
        totalPrice += result.price;
        validResults++;

        if (!lowestPrice || result.price < lowestPrice.price) {
          lowestPrice = result;
        }

        if (!highestPrice || result.price > highestPrice.price) {
          highestPrice = result;
        }
      }
    }

    const averagePrice = validResults > 0 ? totalPrice / validResults : 0;
    const priceRange = (highestPrice?.price || 0) - (lowestPrice?.price || 0);

    // 找出最优惠的商品（价格低于平均价格的10%）
    const bestDeals = results.filter(result => 
      result.price > 0 && result.price < averagePrice * 0.9
    ).sort((a, b) => a.price - b.price);

    // 生成推荐
    const recommendations: string[] = [];
    if (includeRecommendations) {
      if (lowestPrice) {
        recommendations.push(`最低价格在${lowestPrice.platform}：¥${lowestPrice.price}`);
      }
      
      if (bestDeals.length > 0) {
        recommendations.push(`发现${bestDeals.length}个优惠商品`);
      }
      
      if (priceRange > averagePrice * 0.5) {
        recommendations.push('价格差异较大，建议仔细比较商品详情');
      }
      
      recommendations.push(`平均价格：¥${averagePrice.toFixed(2)}`);
    }

    return {
      task,
      analysis: {
        lowestPrice,
        highestPrice,
        averagePrice,
        priceRange,
        bestDeals,
        recommendations
      }
    };
  }

  // 定时价格监控
  public async startPriceMonitoring(
    productName: string,
    deviceSerial: string,
    options: {
      interval: number; // 监控间隔（分钟）
      priceThreshold?: number; // 价格阈值
      platforms?: string[];
      onPriceChange?: (oldPrice: number, newPrice: number, platform: string) => void;
    }
  ): Promise<string> {
    const monitorId = uuidv4();
    const { interval, priceThreshold, platforms, onPriceChange } = options;

    const monitorFunction = async () => {
      try {
        const task = this.createPriceComparisonTask(productName, platforms);
        await this.executePriceComparison(task.id, deviceSerial);
        
        // 检查价格变化
        if (onPriceChange) {
          // 实现价格变化检测逻辑
        }
        
        this.emitEvent('price-monitor-update', { 
          monitorId, 
          productName, 
          results: task.results 
        });

      } catch (error) {
        console.error('Price monitoring error:', error);
        this.emitEvent('price-monitor-error', { 
          monitorId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    };

    // 立即执行一次
    await monitorFunction();

    // 设置定时执行
    const intervalId = setInterval(monitorFunction, interval * 60 * 1000);

    // 存储监控信息（在实际项目中应该持久化）
    // this.activeMonitors.set(monitorId, { intervalId, options });

    return monitorId;
  }

  public stopPriceMonitoring(monitorId: string): boolean {
    // 实现停止监控逻辑
    return true;
  }

  // 集成JARVIS价格API
  public async enhanceWithExternalData(
    task: PriceComparisonTask
  ): Promise<PriceComparisonTask> {
    try {
      // 使用JARVIS的价格API获取额外数据
      const externalResults = await priceApiService.compareProducts(task.productName);
      
      // 将外部数据与Android搜索结果合并
      const enhancedResults = [...task.results];
      
      for (const extResult of externalResults) {
        const androidResult: PriceResult = {
          platform: extResult.source,
          productTitle: extResult.title,
          price: extResult.price,
          currency: extResult.currency || 'CNY',
          originalPrice: extResult.originalPrice,
          discount: extResult.discount,
          rating: extResult.rating,
          reviews: extResult.reviewCount,
          imageUrl: extResult.imageUrl,
          productUrl: extResult.url,
          timestamp: new Date()
        };
        
        enhancedResults.push(androidResult);
      }
      
      return {
        ...task,
        results: enhancedResults
      };
      
    } catch (error) {
      console.error('Failed to enhance with external data:', error);
      return task;
    }
  }

  // 获取任务信息
  public getTask(taskId: string): PriceComparisonTask | null {
    return this.activeTasks.get(taskId) || null;
  }

  public getAllTasks(): PriceComparisonTask[] {
    return Array.from(this.activeTasks.values());
  }

  public getActiveTasks(): PriceComparisonTask[] {
    return Array.from(this.activeTasks.values())
      .filter(task => task.status === 'running');
  }

  // 导出结果
  public exportResults(taskId: string, format: 'json' | 'csv' = 'json'): string {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (format === 'json') {
      return JSON.stringify(task, null, 2);
    } else {
      // 简化的CSV导出
      const headers = ['Platform', 'Title', 'Price', 'Currency', 'Timestamp'];
      const rows = task.results.map(result => [
        result.platform,
        result.productTitle,
        result.price.toString(),
        result.currency,
        result.timestamp.toISOString()
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
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
    this.activeTasks.clear();
    this.eventListeners.clear();
  }
}

export default AndroidPriceComparison;