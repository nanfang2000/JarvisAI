import { EventEmitter } from 'events';
import { mapService } from './mapService';
import { priceApiService, ProductPrice } from './priceApiService';
import { configManager } from '../config/apiConfig';

// 实时数据类型定义
export interface RealTimeUpdate {
  type: 'price' | 'traffic' | 'location' | 'promotion';
  timestamp: string;
  data: any;
  source: string;
}

export interface TrafficUpdate {
  location: {
    lat: number;
    lng: number;
  };
  conditions: 'light' | 'moderate' | 'heavy' | 'severe';
  incidents: TrafficIncident[];
  estimated_delay: number; // 分钟
  alternative_routes?: AlternativeRoute[];
}

export interface TrafficIncident {
  id: string;
  type: 'accident' | 'construction' | 'road_closure' | 'weather';
  location: {
    lat: number;
    lng: number;
    description: string;
  };
  severity: 'low' | 'medium' | 'high';
  estimated_duration: number; // 分钟
  description: string;
  created_at: string;
}

export interface AlternativeRoute {
  route_id: string;
  distance: string;
  duration: string;
  traffic_delay: number;
  description: string;
}

export interface PriceUpdate {
  product_id: string;
  platform: string;
  old_price: number;
  new_price: number;
  change_percentage: number;
  availability_change?: boolean;
  promotion_added?: boolean;
  timestamp: string;
}

export interface LocationUpdate {
  user_id: string;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
  };
  timestamp: string;
  nearby_pois?: Array<{
    name: string;
    type: string;
    distance: number;
  }>;
}

export interface PromotionUpdate {
  platform: string;
  promotion_type: 'coupon' | 'sale' | 'discount' | 'cashback';
  title: string;
  description: string;
  discount_value: number;
  min_order_amount?: number;
  expires_at: string;
  applicable_categories: string[];
  applicable_products?: string[];
}

// 缓存管理器
class CacheManager {
  private cache: Map<string, {
    data: any;
    timestamp: number;
    ttl: number;
  }> = new Map();

  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5分钟

  // 设置缓存
  set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // 设置过期清理
    setTimeout(() => {
      this.delete(key);
    }, ttl);
  }

  // 获取缓存
  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // 检查是否过期
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  // 删除缓存
  delete(key: string): void {
    this.cache.delete(key);
  }

  // 清除所有缓存
  clear(): void {
    this.cache.clear();
  }

  // 获取缓存统计
  getStats(): {
    total_keys: number;
    memory_usage: number;
    hit_rate: number;
  } {
    const totalKeys = this.cache.size;
    const memoryUsage = JSON.stringify(Array.from(this.cache.entries())).length;
    
    return {
      total_keys: totalKeys,
      memory_usage: memoryUsage,
      hit_rate: 0, // 需要实现命中率统计
    };
  }
}

// 实时数据服务
class RealTimeDataService extends EventEmitter {
  private cache: CacheManager;
  private websocket: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 1秒
  
  // 订阅管理
  private subscriptions: Map<string, {
    type: string;
    callback: (data: any) => void;
    interval?: number;
    lastUpdate?: number;
  }> = new Map();

  // 离线数据队列
  private offlineQueue: RealTimeUpdate[] = [];
  private maxOfflineQueueSize = 100;

  constructor() {
    super();
    this.cache = new CacheManager();
    this.initializeWebSocket();
    this.startPeriodicUpdates();
  }

  // 初始化WebSocket连接
  private initializeWebSocket(): void {
    const wsConfig = configManager.getWebSocketConfig();
    const wsUrl = wsConfig.url;
    
    try {
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        
        // 发送离线队列中的数据
        this.processOfflineQueue();
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const update: RealTimeUpdate = JSON.parse(event.data);
          this.handleRealTimeUpdate(update);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.websocket.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.emit('disconnected');
        this.attemptReconnect();
      };
      
      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };
      
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      this.fallbackToPolling();
    }
  }

  // 重连机制
  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避
      
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.initializeWebSocket();
      }, delay);
    } else {
      console.log('Max reconnection attempts reached, falling back to polling');
      this.fallbackToPolling();
    }
  }

  // 处理实时更新
  private handleRealTimeUpdate(update: RealTimeUpdate): void {
    // 缓存更新数据
    this.cache.set(`update_${update.type}_${update.timestamp}`, update, 10 * 60 * 1000);
    
    // 触发相应的事件
    this.emit(`update_${update.type}`, update.data);
    this.emit('update', update);
    
    // 处理特定类型的更新
    switch (update.type) {
      case 'price':
        this.handlePriceUpdate(update.data as PriceUpdate);
        break;
      case 'traffic':
        this.handleTrafficUpdate(update.data as TrafficUpdate);
        break;
      case 'location':
        this.handleLocationUpdate(update.data as LocationUpdate);
        break;
      case 'promotion':
        this.handlePromotionUpdate(update.data as PromotionUpdate);
        break;
    }
  }

  // 处理价格更新
  private handlePriceUpdate(update: PriceUpdate): void {
    // 更新价格缓存
    const cacheKey = `price_${update.product_id}_${update.platform}`;
    this.cache.set(cacheKey, update, 2 * 60 * 1000); // 2分钟缓存
    
    // 检查价格提醒
    this.checkPriceAlerts(update);
    
    // 触发价格变化事件
    this.emit('price_change', {
      product_id: update.product_id,
      platform: update.platform,
      change: update.change_percentage,
      new_price: update.new_price,
    });
  }

  // 处理交通更新
  private handleTrafficUpdate(update: TrafficUpdate): void {
    const cacheKey = `traffic_${update.location.lat}_${update.location.lng}`;
    this.cache.set(cacheKey, update, 1 * 60 * 1000); // 1分钟缓存
    
    // 触发交通状况变化事件
    this.emit('traffic_change', update);
  }

  // 处理位置更新
  private handleLocationUpdate(update: LocationUpdate): void {
    const cacheKey = `location_${update.user_id}`;
    this.cache.set(cacheKey, update, 5 * 60 * 1000); // 5分钟缓存
    
    // 触发位置变化事件
    this.emit('location_change', update);
  }

  // 处理促销更新
  private handlePromotionUpdate(update: PromotionUpdate): void {
    const cacheKey = `promotion_${update.platform}_${Date.now()}`;
    this.cache.set(cacheKey, update, 60 * 60 * 1000); // 1小时缓存
    
    // 触发促销活动事件
    this.emit('promotion_alert', update);
  }

  // 检查价格提醒
  private async checkPriceAlerts(update: PriceUpdate): Promise<void> {
    try {
      const alerts = await priceApiService.getPriceAlerts('current_user');
      
      alerts.forEach(alert => {
        if (alert.product_id === update.product_id && 
            alert.active && 
            update.new_price <= alert.target_price) {
          
          this.emit('price_alert_triggered', {
            alert_id: alert.id,
            product_id: update.product_id,
            target_price: alert.target_price,
            current_price: update.new_price,
            platform: update.platform,
          });
        }
      });
    } catch (error) {
      console.error('Error checking price alerts:', error);
    }
  }

  // 订阅实时更新
  subscribe(
    type: 'price' | 'traffic' | 'location' | 'promotion',
    identifier: string,
    callback: (data: any) => void,
    options?: {
      interval?: number;
      immediate?: boolean;
    }
  ): string {
    const subscriptionId = `${type}_${identifier}_${Date.now()}`;
    
    this.subscriptions.set(subscriptionId, {
      type,
      callback,
      interval: options?.interval,
      lastUpdate: options?.immediate ? 0 : Date.now(),
    });
    
    // 发送订阅请求到服务器
    if (this.isConnected && this.websocket) {
      this.websocket.send(JSON.stringify({
        action: 'subscribe',
        type,
        identifier,
        subscription_id: subscriptionId,
      }));
    }
    
    return subscriptionId;
  }

  // 取消订阅
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    
    if (subscription && this.isConnected && this.websocket) {
      this.websocket.send(JSON.stringify({
        action: 'unsubscribe',
        subscription_id: subscriptionId,
      }));
    }
    
    this.subscriptions.delete(subscriptionId);
  }

  // 获取实时交通信息
  async getRealTimeTraffic(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): Promise<TrafficUpdate> {
    const cacheKey = `traffic_${origin.lat}_${origin.lng}_${destination.lat}_${destination.lng}`;
    
    // 检查缓存
    const cached = this.cache.get<TrafficUpdate>(cacheKey);
    if (cached) return cached;
    
    try {
      // 尝试从WebSocket获取实时数据
      if (this.isConnected && this.websocket) {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Real-time traffic request timeout'));
          }, 5000);
          
          const messageHandler = (event: MessageEvent) => {
            try {
              const response = JSON.parse(event.data);
              if (response.type === 'traffic_response') {
                clearTimeout(timeout);
                this.websocket?.removeEventListener('message', messageHandler);
                
                const trafficData = response.data as TrafficUpdate;
                this.cache.set(cacheKey, trafficData, 1 * 60 * 1000);
                resolve(trafficData);
              }
            } catch (error) {
              reject(error);
            }
          };
          
          this.websocket?.addEventListener('message', messageHandler);
          this.websocket?.send(JSON.stringify({
            action: 'get_traffic',
            origin,
            destination,
          }));
        });
      }
      
      // 回退到模拟数据
      return this.getMockTrafficData(origin, destination);
      
    } catch (error) {
      console.error('Error getting real-time traffic:', error);
      return this.getMockTrafficData(origin, destination);
    }
  }

  // 获取实时价格更新
  async getRealTimePrices(productIds: string[]): Promise<PriceUpdate[]> {
    const updates: PriceUpdate[] = [];
    
    for (const productId of productIds) {
      const cacheKey = `price_updates_${productId}`;
      const cached = this.cache.get<PriceUpdate[]>(cacheKey);
      
      if (cached) {
        updates.push(...cached);
      } else {
        // 获取最新价格数据
        try {
          const searchResult = await priceApiService.searchProducts({
            query: productId,
            limit: 5,
          });
          
          // 转换为价格更新格式
          const priceUpdates = searchResult.products.map(product => ({
            product_id: productId,
            platform: product.platform,
            old_price: product.original_price || product.price,
            new_price: product.price,
            change_percentage: product.discount_percentage || 0,
            timestamp: new Date().toISOString(),
          }));
          
          this.cache.set(cacheKey, priceUpdates, 2 * 60 * 1000);
          updates.push(...priceUpdates);
        } catch (error) {
          console.error(`Error getting prices for ${productId}:`, error);
        }
      }
    }
    
    return updates;
  }

  // 启动定期更新
  private startPeriodicUpdates(): void {
    // 每30秒更新一次交通信息
    setInterval(() => {
      this.updateTrafficData();
    }, 30 * 1000);
    
    // 每分钟更新一次价格信息
    setInterval(() => {
      this.updatePriceData();
    }, 60 * 1000);
    
    // 每5分钟清理过期缓存
    setInterval(() => {
      this.cleanExpiredCache();
    }, 5 * 60 * 1000);
  }

  // 更新交通数据
  private updateTrafficData(): void {
    // 为活跃的交通订阅更新数据
    this.subscriptions.forEach((subscription, id) => {
      if (subscription.type === 'traffic') {
        // 这里可以实现具体的交通数据更新逻辑
      }
    });
  }

  // 更新价格数据
  private updatePriceData(): void {
    // 为活跃的价格订阅更新数据
    this.subscriptions.forEach(async (subscription, id) => {
      if (subscription.type === 'price') {
        // 这里可以实现具体的价格数据更新逻辑
      }
    });
  }

  // 清理过期缓存
  private cleanExpiredCache(): void {
    // CacheManager会自动清理过期项，这里可以添加额外的清理逻辑
    const stats = this.cache.getStats();
    console.log('Cache stats:', stats);
  }

  // 离线模式处理
  private fallbackToPolling(): void {
    console.log('Falling back to polling mode');
    
    // 实现轮询逻辑
    setInterval(() => {
      if (!this.isConnected) {
        this.pollForUpdates();
      }
    }, 10 * 1000); // 每10秒轮询一次
  }

  // 轮询更新
  private async pollForUpdates(): Promise<void> {
    try {
      // 轮询价格更新
      const activeSubscriptions = Array.from(this.subscriptions.values())
        .filter(sub => sub.type === 'price');
      
      for (const subscription of activeSubscriptions) {
        // 实现轮询逻辑
      }
    } catch (error) {
      console.error('Error polling for updates:', error);
    }
  }

  // 处理离线队列
  private processOfflineQueue(): void {
    while (this.offlineQueue.length > 0 && this.isConnected) {
      const update = this.offlineQueue.shift();
      if (update && this.websocket) {
        this.websocket.send(JSON.stringify(update));
      }
    }
  }

  // 添加到离线队列
  private addToOfflineQueue(update: RealTimeUpdate): void {
    if (this.offlineQueue.length >= this.maxOfflineQueueSize) {
      this.offlineQueue.shift(); // 移除最旧的项
    }
    this.offlineQueue.push(update);
  }

  // 模拟交通数据
  private getMockTrafficData(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): TrafficUpdate {
    return {
      location: origin,
      conditions: 'moderate',
      incidents: [
        {
          id: 'incident_1',
          type: 'construction',
          location: {
            lat: (origin.lat + destination.lat) / 2,
            lng: (origin.lng + destination.lng) / 2,
            description: '中途路段施工',
          },
          severity: 'medium',
          estimated_duration: 15,
          description: '道路施工，预计延误15分钟',
          created_at: new Date().toISOString(),
        },
      ],
      estimated_delay: 10,
      alternative_routes: [
        {
          route_id: 'alt_1',
          distance: '12.5 km',
          duration: '25 min',
          traffic_delay: 5,
          description: '绕行主干道',
        },
      ],
    };
  }

  // 获取缓存统计
  getCacheStats() {
    return this.cache.getStats();
  }

  // 清除所有缓存
  clearCache(): void {
    this.cache.clear();
  }

  // 断开连接
  disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.isConnected = false;
    this.subscriptions.clear();
  }
}

// 创建单例实例
export const realTimeDataService = new RealTimeDataService();

export default RealTimeDataService;