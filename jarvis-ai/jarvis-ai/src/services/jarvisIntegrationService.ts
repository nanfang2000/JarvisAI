import { mapService, MapLocation, RouteResult, PlaceResult } from './mapService';
import { priceApiService, ProductPrice, ProductInfo } from './priceApiService';
import { shoppingRecommendationEngine, SmartRecommendation, ShoppingContext } from './shoppingRecommendationEngine';
import { realTimeDataService } from './realTimeDataService';

// JARVIS集成接口定义
export interface JarvisCommand {
  intent: string;
  entities: Record<string, any>;
  confidence: number;
  context?: Record<string, any>;
}

export interface JarvisResponse {
  type: 'text' | 'map' | 'price_comparison' | 'recommendation' | 'route' | 'mixed';
  content: string;
  data?: any;
  actions?: JarvisAction[];
  metadata?: Record<string, any>;
}

export interface JarvisAction {
  type: 'navigate' | 'search_product' | 'show_map' | 'set_alert' | 'open_url';
  parameters: Record<string, any>;
  description: string;
}

export interface LocationContext {
  current_location?: MapLocation;
  recent_searches?: string[];
  favorite_places?: PlaceResult[];
  travel_preferences?: {
    mode: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'BICYCLING';
    avoid_tolls: boolean;
    avoid_highways: boolean;
  };
}

export interface ShoppingProfile {
  budget_range?: {
    min: number;
    max: number;
  };
  preferred_platforms?: string[];
  brand_preferences?: string[];
  quality_preference: 'budget' | 'balanced' | 'premium';
  notification_preferences: {
    price_alerts: boolean;
    promotion_alerts: boolean;
    restock_alerts: boolean;
  };
  purchase_history?: Array<{
    product_id: string;
    price: number;
    platform: string;
    date: string;
  }>;
}

export interface ConversationContext {
  user_id: string;
  session_id: string;
  location_context: LocationContext;
  shopping_profile: ShoppingProfile;
  recent_interactions: Array<{
    timestamp: string;
    command: JarvisCommand;
    response: JarvisResponse;
  }>;
  active_tasks: Array<{
    id: string;
    type: 'navigation' | 'price_monitoring' | 'shopping_research';
    status: 'pending' | 'in_progress' | 'completed';
    data: any;
  }>;
}

// 自然语言处理器
class NaturalLanguageProcessor {
  private intents: Map<string, {
    patterns: RegExp[];
    handler: string;
    entities: string[];
  }> = new Map();

  constructor() {
    this.initializeIntents();
  }

  // 初始化意图识别模式
  private initializeIntents() {
    // 导航相关意图
    this.intents.set('navigation', {
      patterns: [
        /导航到|去|前往|路线到|怎么去|如何到达/,
        /navigate to|go to|directions to|route to|how to get to/i,
      ],
      handler: 'handleNavigation',
      entities: ['destination'],
    });

    // 地点搜索意图
    this.intents.set('place_search', {
      patterns: [
        /附近的|周围的|找|搜索|查找.*?(餐厅|商店|加油站|医院|银行)/,
        /find|search|look for.*?(restaurant|store|gas station|hospital|bank)/i,
      ],
      handler: 'handlePlaceSearch',
      entities: ['place_type', 'location'],
    });

    // 商品搜索意图
    this.intents.set('product_search', {
      patterns: [
        /搜索|查找|比价|价格.*?(商品|产品)/,
        /search|find|compare price.*?(product|item)/i,
      ],
      handler: 'handleProductSearch',
      entities: ['product_name', 'category'],
    });

    // 价格比较意图
    this.intents.set('price_comparison', {
      patterns: [
        /比较价格|价格对比|哪里更便宜|最低价/,
        /compare price|price comparison|where.*cheaper|lowest price/i,
      ],
      handler: 'handlePriceComparison',
      entities: ['product_name'],
    });

    // 购物建议意图
    this.intents.set('shopping_advice', {
      patterns: [
        /购买建议|推荐|应该买吗|值得买吗|什么时候买/,
        /shopping advice|recommend|should.*buy|worth buying|when to buy/i,
      ],
      handler: 'handleShoppingAdvice',
      entities: ['product_name'],
    });

    // 价格提醒意图
    this.intents.set('price_alert', {
      patterns: [
        /价格提醒|降价通知|价格低于.*时通知我/,
        /price alert|price notification|notify.*when price/i,
      ],
      handler: 'handlePriceAlert',
      entities: ['product_name', 'target_price'],
    });

    // 交通状况意图
    this.intents.set('traffic_status', {
      patterns: [
        /交通状况|路况|堵车吗|交通情况/,
        /traffic status|traffic condition|traffic jam/i,
      ],
      handler: 'handleTrafficStatus',
      entities: ['location', 'route'],
    });
  }

  // 解析用户输入
  parseInput(input: string, context: ConversationContext): JarvisCommand {
    let bestMatch: { intent: string; confidence: number; entities: Record<string, any> } = {
      intent: 'unknown',
      confidence: 0,
      entities: {},
    };

    // 遍历所有意图模式
    for (const [intent, config] of this.intents) {
      for (const pattern of config.patterns) {
        const match = input.match(pattern);
        if (match) {
          const confidence = this.calculateConfidence(match, input);
          if (confidence > bestMatch.confidence) {
            bestMatch = {
              intent,
              confidence,
              entities: this.extractEntities(input, config.entities, context),
            };
          }
        }
      }
    }

    return {
      intent: bestMatch.intent,
      entities: bestMatch.entities,
      confidence: bestMatch.confidence,
      context: context,
    };
  }

  // 计算匹配置信度
  private calculateConfidence(match: RegExpMatchArray, input: string): number {
    const matchLength = match[0].length;
    const inputLength = input.length;
    const coverage = matchLength / inputLength;
    
    // 基础置信度基于覆盖率
    let confidence = Math.min(coverage * 2, 1);
    
    // 根据匹配质量调整
    if (match.index === 0) confidence += 0.1; // 开头匹配加分
    if (matchLength === inputLength) confidence += 0.2; // 完全匹配加分
    
    return Math.min(confidence, 1);
  }

  // 提取实体
  private extractEntities(
    input: string,
    entityTypes: string[],
    context: ConversationContext
  ): Record<string, any> {
    const entities: Record<string, any> = {};

    for (const entityType of entityTypes) {
      switch (entityType) {
        case 'destination':
          entities.destination = this.extractDestination(input, context);
          break;
        case 'place_type':
          entities.place_type = this.extractPlaceType(input);
          break;
        case 'product_name':
          entities.product_name = this.extractProductName(input);
          break;
        case 'target_price':
          entities.target_price = this.extractPrice(input);
          break;
        case 'location':
          entities.location = this.extractLocation(input, context);
          break;
      }
    }

    return entities;
  }

  // 提取目的地
  private extractDestination(input: string, context: ConversationContext): string | null {
    // 移除导航关键词，提取目的地
    const cleanInput = input.replace(/(导航到|去|前往|路线到|怎么去|如何到达|navigate to|go to|directions to|route to|how to get to)/gi, '').trim();
    return cleanInput || null;
  }

  // 提取地点类型
  private extractPlaceType(input: string): string | null {
    const placeTypes = ['餐厅', '商店', '加油站', '医院', '银行', 'restaurant', 'store', 'gas station', 'hospital', 'bank'];
    
    for (const type of placeTypes) {
      if (input.toLowerCase().includes(type.toLowerCase())) {
        return type;
      }
    }
    
    return null;
  }

  // 提取商品名称
  private extractProductName(input: string): string | null {
    // 移除搜索关键词，提取商品名称
    const cleanInput = input.replace(/(搜索|查找|比价|价格|商品|产品|search|find|compare price|product|item)/gi, '').trim();
    return cleanInput || null;
  }

  // 提取价格
  private extractPrice(input: string): number | null {
    const priceMatch = input.match(/(\d+(?:\.\d+)?)\s*元?/);
    return priceMatch ? parseFloat(priceMatch[1]) : null;
  }

  // 提取位置
  private extractLocation(input: string, context: ConversationContext): MapLocation | null {
    // 如果没有明确的位置信息，使用当前位置
    return context.location_context.current_location || null;
  }
}

// JARVIS集成服务
class JarvisIntegrationService {
  private nlp: NaturalLanguageProcessor;
  private contexts: Map<string, ConversationContext> = new Map();

  constructor() {
    this.nlp = new NaturalLanguageProcessor();
    this.initializeEventListeners();
  }

  // 初始化事件监听器
  private initializeEventListeners() {
    // 监听实时数据更新
    realTimeDataService.on('price_change', (data) => {
      this.handlePriceChangeNotification(data);
    });

    realTimeDataService.on('traffic_change', (data) => {
      this.handleTrafficChangeNotification(data);
    });

    realTimeDataService.on('price_alert_triggered', (data) => {
      this.handlePriceAlertTriggered(data);
    });
  }

  // 处理用户输入
  async processInput(
    input: string,
    userId: string,
    sessionId: string
  ): Promise<JarvisResponse> {
    try {
      // 获取或创建对话上下文
      const context = this.getOrCreateContext(userId, sessionId);
      
      // 解析用户输入
      const command = this.nlp.parseInput(input, context);
      
      // 路由到相应的处理器
      const response = await this.routeCommand(command);
      
      // 更新对话历史
      this.updateConversationHistory(context, command, response);
      
      return response;
    } catch (error) {
      console.error('Error processing input:', error);
      return {
        type: 'text',
        content: '抱歉，我遇到了一些问题，请稍后再试。',
      };
    }
  }

  // 获取或创建对话上下文
  private getOrCreateContext(userId: string, sessionId: string): ConversationContext {
    const contextKey = `${userId}_${sessionId}`;
    
    if (!this.contexts.has(contextKey)) {
      this.contexts.set(contextKey, {
        user_id: userId,
        session_id: sessionId,
        location_context: {
          travel_preferences: {
            mode: 'DRIVING',
            avoid_tolls: false,
            avoid_highways: false,
          },
        },
        shopping_profile: {
          quality_preference: 'balanced',
          notification_preferences: {
            price_alerts: true,
            promotion_alerts: true,
            restock_alerts: false,
          },
        },
        recent_interactions: [],
        active_tasks: [],
      });
    }
    
    return this.contexts.get(contextKey)!;
  }

  // 路由命令到处理器
  private async routeCommand(command: JarvisCommand): Promise<JarvisResponse> {
    switch (command.intent) {
      case 'navigation':
        return this.handleNavigation(command);
      case 'place_search':
        return this.handlePlaceSearch(command);
      case 'product_search':
        return this.handleProductSearch(command);
      case 'price_comparison':
        return this.handlePriceComparison(command);
      case 'shopping_advice':
        return this.handleShoppingAdvice(command);
      case 'price_alert':
        return this.handlePriceAlert(command);
      case 'traffic_status':
        return this.handleTrafficStatus(command);
      default:
        return this.handleUnknownIntent(command);
    }
  }

  // 处理导航请求
  private async handleNavigation(command: JarvisCommand): Promise<JarvisResponse> {
    const destination = command.entities.destination;
    const context = command.context as ConversationContext;
    
    if (!destination) {
      return {
        type: 'text',
        content: '请告诉我您想去哪里？',
      };
    }
    
    try {
      // 获取当前位置
      const currentLocation = context.location_context.current_location || 
                            await mapService.getCurrentLocation();
      
      // 计算路线
      const route = await mapService.calculateRoute({
        origin: currentLocation,
        destination: destination,
        travelMode: context.location_context.travel_preferences?.mode || 'DRIVING',
        avoidTolls: context.location_context.travel_preferences?.avoid_tolls || false,
        avoidHighways: context.location_context.travel_preferences?.avoid_highways || false,
      });
      
      // 获取实时交通信息
      const trafficInfo = await realTimeDataService.getRealTimeTraffic(
        currentLocation,
        { lat: 0, lng: 0 } // 需要从destination解析出坐标
      );
      
      return {
        type: 'route',
        content: `为您规划了前往${destination}的路线，距离${route.distance}，预计用时${route.duration}。`,
        data: {
          route,
          traffic: trafficInfo,
          origin: currentLocation,
          destination,
        },
        actions: [
          {
            type: 'show_map',
            parameters: { route, traffic: trafficInfo },
            description: '在地图上显示路线',
          },
          {
            type: 'navigate',
            parameters: { destination },
            description: '开始导航',
          },
        ],
      };
    } catch (error) {
      return {
        type: 'text',
        content: `抱歉，无法规划到${destination}的路线。请检查目的地是否正确。`,
      };
    }
  }

  // 处理地点搜索
  private async handlePlaceSearch(command: JarvisCommand): Promise<JarvisResponse> {
    const placeType = command.entities.place_type;
    const location = command.entities.location || 
                    (command.context as ConversationContext).location_context.current_location;
    
    if (!placeType) {
      return {
        type: 'text',
        content: '请告诉我您要找什么类型的地点？',
      };
    }
    
    try {
      const places = await mapService.searchPlaces({
        query: placeType,
        location,
        radius: 5000, // 5公里范围
      });
      
      if (places.length === 0) {
        return {
          type: 'text',
          content: `抱歉，附近没有找到${placeType}。`,
        };
      }
      
      return {
        type: 'map',
        content: `为您找到了${places.length}个附近的${placeType}：`,
        data: {
          places,
          search_location: location,
          search_type: placeType,
        },
        actions: [
          {
            type: 'show_map',
            parameters: { places, center: location },
            description: '在地图上显示搜索结果',
          },
        ],
      };
    } catch (error) {
      return {
        type: 'text',
        content: `搜索${placeType}时出现错误，请稍后重试。`,
      };
    }
  }

  // 处理商品搜索
  private async handleProductSearch(command: JarvisCommand): Promise<JarvisResponse> {
    const productName = command.entities.product_name;
    
    if (!productName) {
      return {
        type: 'text',
        content: '请告诉我您要搜索什么商品？',
      };
    }
    
    try {
      const searchResult = await priceApiService.searchProducts({
        query: productName,
        sort_by: 'price_asc',
        limit: 10,
      });
      
      if (searchResult.products.length === 0) {
        return {
          type: 'text',
          content: `抱歉，没有找到"${productName}"相关的商品。`,
        };
      }
      
      return {
        type: 'price_comparison',
        content: `为您找到了${searchResult.products.length}个"${productName}"的价格信息：`,
        data: {
          products: searchResult.products,
          search_query: productName,
          total: searchResult.total,
        },
        actions: [
          {
            type: 'search_product',
            parameters: { query: productName, results: searchResult },
            description: '查看详细价格比较',
          },
        ],
      };
    } catch (error) {
      return {
        type: 'text',
        content: `搜索商品时出现错误，请稍后重试。`,
      };
    }
  }

  // 处理价格比较
  private async handlePriceComparison(command: JarvisCommand): Promise<JarvisResponse> {
    const productName = command.entities.product_name;
    
    if (!productName) {
      return {
        type: 'text',
        content: '请告诉我您要比较哪个商品的价格？',
      };
    }
    
    try {
      const searchResult = await priceApiService.searchProducts({
        query: productName,
        limit: 5,
      });
      
      if (searchResult.products.length === 0) {
        return {
          type: 'text',
          content: `抱歉，没有找到"${productName}"的价格信息。`,
        };
      }
      
      // 分析价格数据
      const prices = searchResult.products.map(p => p.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const cheapestProduct = searchResult.products.find(p => p.price === minPrice);
      
      return {
        type: 'price_comparison',
        content: `"${productName}"的价格比较：\n` +
                `最低价：¥${minPrice}（${cheapestProduct?.platform}）\n` +
                `最高价：¥${maxPrice}\n` +
                `平均价：¥${avgPrice.toFixed(0)}\n` +
                `价格差：¥${maxPrice - minPrice}`,
        data: {
          products: searchResult.products,
          analysis: {
            min_price: minPrice,
            max_price: maxPrice,
            avg_price: avgPrice,
            cheapest_product: cheapestProduct,
            price_spread: maxPrice - minPrice,
          },
        },
      };
    } catch (error) {
      return {
        type: 'text',
        content: `价格比较时出现错误，请稍后重试。`,
      };
    }
  }

  // 处理购物建议
  private async handleShoppingAdvice(command: JarvisCommand): Promise<JarvisResponse> {
    const productName = command.entities.product_name;
    const context = command.context as ConversationContext;
    
    if (!productName) {
      return {
        type: 'text',
        content: '请告诉我您想了解哪个商品的购买建议？',
      };
    }
    
    try {
      // 搜索商品信息
      const searchResult = await priceApiService.searchProducts({
        query: productName,
        limit: 5,
      });
      
      if (searchResult.products.length === 0) {
        return {
          type: 'text',
          content: `抱歉，没有找到"${productName}"的信息。`,
        };
      }
      
      // 获取商品详细信息
      const productInfo = await priceApiService.getProductInfo(searchResult.products[0].product_id);
      
      // 生成智能建议
      const shoppingContext: ShoppingContext = {
        user_budget: context.shopping_profile.budget_range?.max,
        urgency: 'medium',
        quality_preference: context.shopping_profile.quality_preference,
        preferred_platforms: context.shopping_profile.preferred_platforms,
      };
      
      const recommendation = await shoppingRecommendationEngine.generateSmartRecommendation(
        productInfo,
        searchResult.products,
        shoppingContext
      );
      
      let adviceContent = `关于"${productName}"的购买建议：\n\n`;
      
      switch (recommendation.action) {
        case 'buy_now':
          adviceContent += '💡 建议立即购买';
          break;
        case 'wait':
          adviceContent += '⏳ 建议等待更好的时机';
          break;
        case 'compare_more':
          adviceContent += '🔍 建议多比较几家';
          break;
        case 'set_alert':
          adviceContent += '🔔 建议设置价格提醒';
          break;
      }
      
      adviceContent += `\n\n📊 置信度：${(recommendation.confidence * 100).toFixed(0)}%\n\n`;
      adviceContent += '原因：\n' + recommendation.reasoning.join('\n• ');
      
      if (recommendation.estimated_savings) {
        adviceContent += `\n\n💰 预计可节省：¥${recommendation.estimated_savings.toFixed(0)}`;
      }
      
      if (recommendation.best_time_to_buy) {
        adviceContent += `\n\n⏰ 最佳购买时间：${recommendation.best_time_to_buy}`;
      }
      
      return {
        type: 'recommendation',
        content: adviceContent,
        data: {
          product_info: productInfo,
          recommendation,
          current_prices: searchResult.products,
        },
        actions: [
          {
            type: 'set_alert',
            parameters: { 
              product_id: productInfo.id,
              target_price: recommendation.price_prediction?.predicted_price 
            },
            description: '设置价格提醒',
          },
        ],
      };
    } catch (error) {
      return {
        type: 'text',
        content: `生成购买建议时出现错误，请稍后重试。`,
      };
    }
  }

  // 处理价格提醒
  private async handlePriceAlert(command: JarvisCommand): Promise<JarvisResponse> {
    const productName = command.entities.product_name;
    const targetPrice = command.entities.target_price;
    
    if (!productName) {
      return {
        type: 'text',
        content: '请告诉我您要为哪个商品设置价格提醒？',
      };
    }
    
    try {
      // 搜索商品
      const searchResult = await priceApiService.searchProducts({
        query: productName,
        limit: 1,
      });
      
      if (searchResult.products.length === 0) {
        return {
          type: 'text',
          content: `抱歉，没有找到"${productName}"的信息。`,
        };
      }
      
      const product = searchResult.products[0];
      const alertTargetPrice = targetPrice || product.price * 0.9; // 默认90%的价格
      
      // 设置价格提醒
      const alert = await priceApiService.setPriceAlert(
        product.product_id,
        alertTargetPrice
      );
      
      return {
        type: 'text',
        content: `已为您设置"${productName}"的价格提醒。\n` +
                `当前价格：¥${product.price}\n` +
                `目标价格：¥${alertTargetPrice}\n` +
                `当价格低于目标价格时，我会及时通知您。`,
        data: {
          alert,
          product,
          target_price: alertTargetPrice,
        },
      };
    } catch (error) {
      return {
        type: 'text',
        content: `设置价格提醒时出现错误，请稍后重试。`,
      };
    }
  }

  // 处理交通状况查询
  private async handleTrafficStatus(command: JarvisCommand): Promise<JarvisResponse> {
    const location = command.entities.location || 
                    (command.context as ConversationContext).location_context.current_location;
    
    if (!location) {
      return {
        type: 'text',
        content: '请告诉我您要查询哪里的交通状况？',
      };
    }
    
    try {
      const trafficInfo = await realTimeDataService.getRealTimeTraffic(
        location,
        location // 查询该点的交通状况
      );
      
      let statusContent = `当前交通状况：\n\n`;
      
      switch (trafficInfo.conditions) {
        case 'light':
          statusContent += '🟢 交通畅通';
          break;
        case 'moderate':
          statusContent += '🟡 交通一般';
          break;
        case 'heavy':
          statusContent += '🟠 交通拥堵';
          break;
        case 'severe':
          statusContent += '🔴 严重拥堵';
          break;
      }
      
      if (trafficInfo.estimated_delay > 0) {
        statusContent += `\n预计延误：${trafficInfo.estimated_delay}分钟`;
      }
      
      if (trafficInfo.incidents.length > 0) {
        statusContent += '\n\n交通事件：\n';
        trafficInfo.incidents.forEach(incident => {
          statusContent += `• ${incident.description}\n`;
        });
      }
      
      return {
        type: 'mixed',
        content: statusContent,
        data: {
          traffic_info: trafficInfo,
          location,
        },
      };
    } catch (error) {
      return {
        type: 'text',
        content: `查询交通状况时出现错误，请稍后重试。`,
      };
    }
  }

  // 处理未知意图
  private handleUnknownIntent(command: JarvisCommand): JarvisResponse {
    return {
      type: 'text',
      content: '抱歉，我不太理解您的意思。我可以帮您：\n' +
              '• 🗺️ 导航和地点搜索\n' +
              '• 💰 商品价格比较\n' +
              '• 🛍️ 购物建议\n' +
              '• 🔔 价格提醒\n' +
              '• 🚗 交通状况查询\n\n' +
              '请告诉我您需要什么帮助？',
      metadata: {
        suggestions: [
          '导航到北京西站',
          '附近的餐厅',
          '搜索iPhone 15价格',
          '比较iPad价格',
          '设置价格提醒',
          '查询交通状况',
        ],
      },
    };
  }

  // 更新对话历史
  private updateConversationHistory(
    context: ConversationContext,
    command: JarvisCommand,
    response: JarvisResponse
  ) {
    context.recent_interactions.push({
      timestamp: new Date().toISOString(),
      command,
      response,
    });
    
    // 只保留最近20次交互
    if (context.recent_interactions.length > 20) {
      context.recent_interactions = context.recent_interactions.slice(-20);
    }
  }

  // 处理价格变化通知
  private handlePriceChangeNotification(data: any) {
    // 通知相关用户价格变化
    console.log('Price change notification:', data);
  }

  // 处理交通变化通知
  private handleTrafficChangeNotification(data: any) {
    // 通知相关用户交通状况变化
    console.log('Traffic change notification:', data);
  }

  // 处理价格提醒触发
  private handlePriceAlertTriggered(data: any) {
    // 发送价格提醒通知
    console.log('Price alert triggered:', data);
  }

  // 获取用户上下文
  getUserContext(userId: string, sessionId: string): ConversationContext | null {
    const contextKey = `${userId}_${sessionId}`;
    return this.contexts.get(contextKey) || null;
  }

  // 更新用户配置
  updateUserProfile(
    userId: string,
    sessionId: string,
    updates: {
      location_context?: Partial<LocationContext>;
      shopping_profile?: Partial<ShoppingProfile>;
    }
  ) {
    const context = this.getOrCreateContext(userId, sessionId);
    
    if (updates.location_context) {
      Object.assign(context.location_context, updates.location_context);
    }
    
    if (updates.shopping_profile) {
      Object.assign(context.shopping_profile, updates.shopping_profile);
    }
  }

  // 清理过期上下文
  cleanupExpiredContexts() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    
    for (const [key, context] of this.contexts) {
      const lastInteraction = context.recent_interactions[context.recent_interactions.length - 1];
      if (lastInteraction) {
        const lastTime = new Date(lastInteraction.timestamp).getTime();
        if (now - lastTime > maxAge) {
          this.contexts.delete(key);
        }
      }
    }
  }
}

// 创建单例实例
export const jarvisIntegrationService = new JarvisIntegrationService();

// 定期清理过期上下文
setInterval(() => {
  jarvisIntegrationService.cleanupExpiredContexts();
}, 60 * 60 * 1000); // 每小时清理一次

export default JarvisIntegrationService;