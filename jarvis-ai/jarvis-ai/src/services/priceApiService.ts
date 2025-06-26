import axios from 'axios';

// 价格比对服务接口定义
export interface PriceSearchRequest {
  query: string;
  category?: string;
  platforms?: string[];
  min_price?: number;
  max_price?: number;
  sort_by?: 'price_asc' | 'price_desc' | 'rating' | 'reviews' | 'discount';
  page?: number;
  limit?: number;
}

export interface ProductPrice {
  id: string;
  product_id: string;
  platform: string;
  platform_logo: string;
  title: string;
  price: number;
  original_price?: number;
  currency: string;
  discount_percentage?: number;
  availability: 'in_stock' | 'out_of_stock' | 'limited_stock';
  shipping_cost?: number;
  shipping_time?: string;
  seller: string;
  seller_rating?: number;
  product_rating?: number;
  review_count?: number;
  image_url: string;
  product_url: string;
  last_updated: string;
  coupon?: CouponInfo;
  specifications?: Record<string, string>;
}

export interface CouponInfo {
  code: string;
  discount: number;
  discount_type: 'percentage' | 'fixed';
  description: string;
  expires_at: string;
  min_order_amount?: number;
}

export interface ProductInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  model?: string;
  specifications: Record<string, string>;
  images: string[];
  average_rating: number;
  total_reviews: number;
  price_history: PriceHistory[];
  lowest_price: PricePoint;
  highest_price: PricePoint;
  price_trend: 'up' | 'down' | 'stable';
  recommendations: string[];
  related_products: string[];
}

export interface PriceHistory {
  date: string;
  price: number;
  platform: string;
  availability: string;
}

export interface PricePoint {
  price: number;
  platform: string;
  date: string;
}

export interface PriceAlert {
  id: string;
  user_id: string;
  product_id: string;
  target_price: number;
  current_price: number;
  created_at: string;
  triggered_at?: string;
  active: boolean;
  notification_method: 'email' | 'sms' | 'push';
}

export interface ShoppingRecommendation {
  type: 'buy_now' | 'wait' | 'compare_more';
  reason: string;
  confidence: number;
  alternative_options?: string[];
  price_prediction?: {
    trend: 'up' | 'down' | 'stable';
    confidence: number;
    predicted_price: number;
    prediction_date: string;
  };
}

export interface PlatformInfo {
  id: string;
  name: string;
  logo_url: string;
  base_url: string;
  supported_categories: string[];
  shipping_info: {
    free_shipping_threshold?: number;
    delivery_time: string;
  };
  return_policy: string;
  reliability_score: number;
}

class PriceApiService {
  private baseURL: string;
  private apiKey: string;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  constructor() {
    this.baseURL = process.env.REACT_APP_PRICE_API_BASE_URL || 'https://api.pricecomparison.com';
    this.apiKey = process.env.REACT_APP_PRICE_API_KEY || '';
  }

  // 获取API headers
  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-API-Version': '1.0',
    };
  }

  // 生成缓存键
  private getCacheKey(endpoint: string, params: any): string {
    return `${endpoint}_${JSON.stringify(params)}`;
  }

  // 检查缓存
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  // 设置缓存
  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // 搜索商品价格
  async searchProducts(request: PriceSearchRequest): Promise<{
    products: ProductPrice[];
    total: number;
    page: number;
    limit: number;
    platforms: string[];
  }> {
    const cacheKey = this.getCacheKey('search', request);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseURL}/search`, {
        headers: this.getHeaders(),
        params: request,
      });

      const result = response.data;
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error searching products:', error);
      
      // 返回模拟数据作为备用
      return this.getMockSearchResults(request);
    }
  }

  // 获取商品详细信息
  async getProductInfo(productId: string): Promise<ProductInfo> {
    const cacheKey = this.getCacheKey('product', { productId });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseURL}/products/${productId}`, {
        headers: this.getHeaders(),
      });

      const result = response.data;
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error getting product info:', error);
      return this.getMockProductInfo(productId);
    }
  }

  // 获取价格历史
  async getPriceHistory(
    productId: string,
    platform?: string,
    days: number = 30
  ): Promise<PriceHistory[]> {
    const cacheKey = this.getCacheKey('price-history', { productId, platform, days });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseURL}/products/${productId}/price-history`, {
        headers: this.getHeaders(),
        params: { platform, days },
      });

      const result = response.data;
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error getting price history:', error);
      return this.getMockPriceHistory(productId, days);
    }
  }

  // 设置价格提醒
  async setPriceAlert(
    productId: string,
    targetPrice: number,
    notificationMethod: 'email' | 'sms' | 'push' = 'email'
  ): Promise<PriceAlert> {
    try {
      const response = await axios.post(`${this.baseURL}/price-alerts`, {
        product_id: productId,
        target_price: targetPrice,
        notification_method: notificationMethod,
      }, {
        headers: this.getHeaders(),
      });

      return response.data;
    } catch (error) {
      console.error('Error setting price alert:', error);
      
      // 返回模拟数据
      return {
        id: `alert_${Date.now()}`,
        user_id: 'user_123',
        product_id: productId,
        target_price: targetPrice,
        current_price: targetPrice + 100,
        created_at: new Date().toISOString(),
        active: true,
        notification_method: notificationMethod,
      };
    }
  }

  // 获取用户的价格提醒
  async getPriceAlerts(userId: string): Promise<PriceAlert[]> {
    try {
      const response = await axios.get(`${this.baseURL}/users/${userId}/price-alerts`, {
        headers: this.getHeaders(),
      });

      return response.data;
    } catch (error) {
      console.error('Error getting price alerts:', error);
      return [];
    }
  }

  // 删除价格提醒
  async deletePriceAlert(alertId: string): Promise<void> {
    try {
      await axios.delete(`${this.baseURL}/price-alerts/${alertId}`, {
        headers: this.getHeaders(),
      });
    } catch (error) {
      console.error('Error deleting price alert:', error);
    }
  }

  // 获取购物建议
  async getShoppingRecommendation(productId: string): Promise<ShoppingRecommendation> {
    const cacheKey = this.getCacheKey('recommendation', { productId });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseURL}/products/${productId}/recommendation`, {
        headers: this.getHeaders(),
      });

      const result = response.data;
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error getting shopping recommendation:', error);
      return this.getMockRecommendation(productId);
    }
  }

  // 获取优惠券信息
  async getCoupons(platform: string, category?: string): Promise<CouponInfo[]> {
    const cacheKey = this.getCacheKey('coupons', { platform, category });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseURL}/coupons`, {
        headers: this.getHeaders(),
        params: { platform, category },
      });

      const result = response.data;
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error getting coupons:', error);
      return this.getMockCoupons(platform);
    }
  }

  // 获取平台信息
  async getPlatforms(): Promise<PlatformInfo[]> {
    const cacheKey = this.getCacheKey('platforms', {});
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseURL}/platforms`, {
        headers: this.getHeaders(),
      });

      const result = response.data;
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error getting platforms:', error);
      return this.getMockPlatforms();
    }
  }

  // 比较商品价格
  async compareProducts(productIds: string[]): Promise<{
    products: ProductInfo[];
    comparison: {
      cheapest: string;
      most_expensive: string;
      best_rated: string;
      price_difference: number;
    };
  }> {
    try {
      const response = await axios.post(`${this.baseURL}/compare`, {
        product_ids: productIds,
      }, {
        headers: this.getHeaders(),
      });

      return response.data;
    } catch (error) {
      console.error('Error comparing products:', error);
      return {
        products: [],
        comparison: {
          cheapest: productIds[0] || '',
          most_expensive: productIds[0] || '',
          best_rated: productIds[0] || '',
          price_difference: 0,
        },
      };
    }
  }

  // 获取热门商品
  async getTrendingProducts(category?: string, limit: number = 10): Promise<ProductPrice[]> {
    const cacheKey = this.getCacheKey('trending', { category, limit });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseURL}/trending`, {
        headers: this.getHeaders(),
        params: { category, limit },
      });

      const result = response.data;
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error getting trending products:', error);
      return this.getMockTrendingProducts(category, limit);
    }
  }

  // 模拟数据方法
  private getMockSearchResults(request: PriceSearchRequest): {
    products: ProductPrice[];
    total: number;
    page: number;
    limit: number;
    platforms: string[];
  } {
    const mockProducts: ProductPrice[] = [
      {
        id: '1',
        product_id: 'mock-product-1',
        platform: '京东',
        platform_logo: '/logos/jd.png',
        title: request.query + ' - 京东自营',
        price: 999,
        original_price: 1199,
        currency: 'CNY',
        discount_percentage: 17,
        availability: 'in_stock',
        shipping_cost: 0,
        shipping_time: '当日达',
        seller: '京东自营',
        seller_rating: 4.9,
        product_rating: 4.8,
        review_count: 12580,
        image_url: '/images/product-1.jpg',
        product_url: 'https://item.jd.com/mock',
        last_updated: new Date().toISOString(),
        coupon: {
          code: 'SAVE100',
          discount: 100,
          discount_type: 'fixed',
          description: '满999减100',
          expires_at: '2024-12-31T23:59:59Z',
        },
      },
      {
        id: '2',
        product_id: 'mock-product-1',
        platform: '天猫',
        platform_logo: '/logos/tmall.png',
        title: request.query + ' - 天猫官方',
        price: 1099,
        original_price: 1199,
        currency: 'CNY',
        discount_percentage: 8,
        availability: 'in_stock',
        shipping_cost: 0,
        shipping_time: '24小时发货',
        seller: '官方旗舰店',
        seller_rating: 5.0,
        product_rating: 4.9,
        review_count: 8756,
        image_url: '/images/product-1.jpg',
        product_url: 'https://detail.tmall.com/mock',
        last_updated: new Date().toISOString(),
      },
    ];

    return {
      products: mockProducts,
      total: mockProducts.length,
      page: request.page || 1,
      limit: request.limit || 10,
      platforms: ['京东', '天猫', '拼多多'],
    };
  }

  private getMockProductInfo(productId: string): ProductInfo {
    return {
      id: productId,
      name: '模拟商品',
      description: '这是一个模拟的商品描述',
      category: '电子产品',
      brand: '模拟品牌',
      specifications: {
        '尺寸': '15.6英寸',
        '重量': '2.5kg',
        '颜色': '黑色',
      },
      images: ['/images/product-1.jpg'],
      average_rating: 4.5,
      total_reviews: 1000,
      price_history: this.getMockPriceHistory(productId, 30),
      lowest_price: {
        price: 899,
        platform: '拼多多',
        date: '2024-03-15',
      },
      highest_price: {
        price: 1299,
        platform: '苹果官网',
        date: '2024-01-01',
      },
      price_trend: 'down',
      recommendations: [
        '建议等待双11大促',
        '拼多多价格更优惠',
        '京东售后服务更好',
      ],
      related_products: ['related-1', 'related-2'],
    };
  }

  private getMockPriceHistory(productId: string, days: number): PriceHistory[] {
    const history: PriceHistory[] = [];
    const basePrice = 1000;
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      history.push({
        date: date.toISOString().split('T')[0],
        price: basePrice + Math.random() * 200 - 100,
        platform: i % 3 === 0 ? '京东' : i % 3 === 1 ? '天猫' : '拼多多',
        availability: 'in_stock',
      });
    }
    
    return history;
  }

  private getMockRecommendation(productId: string): ShoppingRecommendation {
    return {
      type: 'wait',
      reason: '价格可能会在双11期间下降',
      confidence: 0.8,
      alternative_options: ['相似产品A', '相似产品B'],
      price_prediction: {
        trend: 'down',
        confidence: 0.75,
        predicted_price: 899,
        prediction_date: '2024-11-11',
      },
    };
  }

  private getMockCoupons(platform: string): CouponInfo[] {
    return [
      {
        code: 'SAVE100',
        discount: 100,
        discount_type: 'fixed',
        description: '满999减100',
        expires_at: '2024-12-31T23:59:59Z',
        min_order_amount: 999,
      },
      {
        code: 'PERCENT10',
        discount: 10,
        discount_type: 'percentage',
        description: '全场9折',
        expires_at: '2024-12-31T23:59:59Z',
      },
    ];
  }

  private getMockPlatforms(): PlatformInfo[] {
    return [
      {
        id: 'jd',
        name: '京东',
        logo_url: '/logos/jd.png',
        base_url: 'https://www.jd.com',
        supported_categories: ['电子产品', '家居用品', '服装'],
        shipping_info: {
          free_shipping_threshold: 99,
          delivery_time: '当日达/次日达',
        },
        return_policy: '7天无理由退换',
        reliability_score: 4.8,
      },
      {
        id: 'tmall',
        name: '天猫',
        logo_url: '/logos/tmall.png',
        base_url: 'https://www.tmall.com',
        supported_categories: ['电子产品', '美妆', '服装'],
        shipping_info: {
          free_shipping_threshold: 88,
          delivery_time: '24小时发货',
        },
        return_policy: '7天无理由退换',
        reliability_score: 4.7,
      },
    ];
  }

  private getMockTrendingProducts(category?: string, limit: number = 10): ProductPrice[] {
    const products: ProductPrice[] = [];
    
    for (let i = 0; i < limit; i++) {
      products.push({
        id: `trending-${i}`,
        product_id: `trending-product-${i}`,
        platform: i % 3 === 0 ? '京东' : i % 3 === 1 ? '天猫' : '拼多多',
        platform_logo: `/logos/${i % 3 === 0 ? 'jd' : i % 3 === 1 ? 'tmall' : 'pdd'}.png`,
        title: `热门商品 ${i + 1}`,
        price: Math.floor(Math.random() * 1000) + 100,
        currency: 'CNY',
        availability: 'in_stock',
        seller: '官方旗舰店',
        product_rating: 4 + Math.random(),
        review_count: Math.floor(Math.random() * 10000) + 1000,
        image_url: `/images/trending-${i}.jpg`,
        product_url: `https://example.com/product-${i}`,
        last_updated: new Date().toISOString(),
      });
    }
    
    return products;
  }

  // 清除缓存
  clearCache(): void {
    this.cache.clear();
  }
}

// 创建单例实例
export const priceApiService = new PriceApiService();

export default PriceApiService;