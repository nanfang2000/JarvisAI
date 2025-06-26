import { priceApiService, ProductPrice, ProductInfo, PriceHistory, ShoppingRecommendation } from './priceApiService';
import { format, subDays, parseISO, isAfter, isBefore } from 'date-fns';

// 购物建议类型
export interface SmartRecommendation {
  action: 'buy_now' | 'wait' | 'compare_more' | 'set_alert';
  confidence: number;
  reasoning: string[];
  estimated_savings?: number;
  best_time_to_buy?: string;
  price_prediction?: PricePrediction;
  alternative_products?: AlternativeProduct[];
  risk_factors?: string[];
}

export interface PricePrediction {
  direction: 'up' | 'down' | 'stable';
  confidence: number;
  predicted_price: number;
  prediction_date: string;
  factors: string[];
}

export interface AlternativeProduct {
  product_id: string;
  name: string;
  price_advantage: number;
  similarity_score: number;
  reason: string;
}

export interface SeasonalTrend {
  month: number;
  average_price: number;
  discount_probability: number;
  major_sales_events: string[];
}

export interface ShoppingContext {
  user_budget?: number;
  urgency: 'low' | 'medium' | 'high';
  quality_preference: 'budget' | 'balanced' | 'premium';
  brand_loyalty?: string[];
  previous_purchases?: string[];
  preferred_platforms?: string[];
}

class ShoppingRecommendationEngine {
  private seasonalTrends: Map<string, SeasonalTrend[]> = new Map();
  private promotionCalendar: Map<string, string[]> = new Map();
  private mlModels: Map<string, any> = new Map();

  constructor() {
    this.initializeSeasonalData();
    this.initializePromotionCalendar();
  }

  // 初始化季节性数据
  private initializeSeasonalData() {
    // 电子产品季节性趋势
    this.seasonalTrends.set('electronics', [
      { month: 1, average_price: 95, discount_probability: 0.3, major_sales_events: ['年货节'] },
      { month: 2, average_price: 98, discount_probability: 0.2, major_sales_events: [] },
      { month: 3, average_price: 100, discount_probability: 0.15, major_sales_events: ['三八节'] },
      { month: 4, average_price: 102, discount_probability: 0.1, major_sales_events: [] },
      { month: 5, average_price: 105, discount_probability: 0.2, major_sales_events: ['五一促销'] },
      { month: 6, average_price: 108, discount_probability: 0.25, major_sales_events: ['618购物节'] },
      { month: 7, average_price: 110, discount_probability: 0.1, major_sales_events: [] },
      { month: 8, average_price: 108, discount_probability: 0.15, major_sales_events: [] },
      { month: 9, average_price: 105, discount_probability: 0.2, major_sales_events: ['开学季'] },
      { month: 10, average_price: 102, discount_probability: 0.15, major_sales_events: [] },
      { month: 11, average_price: 85, discount_probability: 0.7, major_sales_events: ['双11'] },
      { month: 12, average_price: 90, discount_probability: 0.4, major_sales_events: ['双12', '年终促销'] },
    ]);

    // 服装季节性趋势
    this.seasonalTrends.set('clothing', [
      { month: 1, average_price: 80, discount_probability: 0.6, major_sales_events: ['年货节', '冬装清仓'] },
      { month: 2, average_price: 85, discount_probability: 0.5, major_sales_events: ['春装上新'] },
      { month: 3, average_price: 100, discount_probability: 0.2, major_sales_events: ['三八节'] },
      { month: 4, average_price: 105, discount_probability: 0.15, major_sales_events: [] },
      { month: 5, average_price: 110, discount_probability: 0.2, major_sales_events: ['五一促销'] },
      { month: 6, average_price: 108, discount_probability: 0.3, major_sales_events: ['618购物节'] },
      { month: 7, average_price: 90, discount_probability: 0.4, major_sales_events: ['夏装清仓'] },
      { month: 8, average_price: 95, discount_probability: 0.3, major_sales_events: [] },
      { month: 9, average_price: 100, discount_probability: 0.2, major_sales_events: ['秋装上新'] },
      { month: 10, average_price: 105, discount_probability: 0.15, major_sales_events: [] },
      { month: 11, average_price: 75, discount_probability: 0.8, major_sales_events: ['双11'] },
      { month: 12, average_price: 80, discount_probability: 0.5, major_sales_events: ['双12', '冬装促销'] },
    ]);
  }

  // 初始化促销日历
  private initializePromotionCalendar() {
    this.promotionCalendar.set('annual', [
      '1月: 年货节',
      '3月: 三八节',
      '5月: 五一促销',
      '6月: 618购物节',
      '8月: 返校季',
      '9月: 开学季',
      '11月: 双11购物节',
      '12月: 双12购物节',
    ]);

    this.promotionCalendar.set('quarterly', [
      'Q1: 春季新品发布',
      'Q2: 夏季清仓',
      'Q3: 秋季上新',
      'Q4: 年终大促',
    ]);
  }

  // 生成智能购物建议
  async generateSmartRecommendation(
    productInfo: ProductInfo,
    currentPrices: ProductPrice[],
    context: ShoppingContext
  ): Promise<SmartRecommendation> {
    // 分析价格趋势
    const priceAnalysis = this.analyzePriceTrend(productInfo.price_history);
    
    // 季节性分析
    const seasonalAnalysis = this.analyzeSeasonalTrends(productInfo.category);
    
    // 竞争分析
    const competitiveAnalysis = this.analyzeCompetitivePricing(currentPrices);
    
    // 预测价格变化
    const pricePrediction = this.predictPriceChange(
      productInfo.price_history,
      seasonalAnalysis,
      productInfo.category
    );
    
    // 生成建议
    const recommendation = this.synthesizeRecommendation(
      priceAnalysis,
      seasonalAnalysis,
      competitiveAnalysis,
      pricePrediction,
      context
    );

    return recommendation;
  }

  // 分析价格趋势
  private analyzePriceTrend(priceHistory: PriceHistory[]): {
    trend: 'up' | 'down' | 'stable';
    volatility: number;
    recent_change: number;
    support_levels: number[];
    resistance_levels: number[];
  } {
    if (priceHistory.length < 2) {
      return {
        trend: 'stable',
        volatility: 0,
        recent_change: 0,
        support_levels: [],
        resistance_levels: [],
      };
    }

    const prices = priceHistory.map(h => h.price).sort((a, b) => a - b);
    const recentPrices = priceHistory.slice(-7).map(h => h.price);
    
    // 计算趋势
    const firstPrice = priceHistory[0].price;
    const lastPrice = priceHistory[priceHistory.length - 1].price;
    const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (priceChange > 5) trend = 'up';
    else if (priceChange < -5) trend = 'down';
    
    // 计算波动性
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const volatility = Math.sqrt(
      prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length
    ) / avgPrice;
    
    // 计算近期变化
    const recentAvg = recentPrices.reduce((sum, price) => sum + price, 0) / recentPrices.length;
    const recentChange = ((recentAvg - avgPrice) / avgPrice) * 100;
    
    // 支撑位和阻力位
    const support_levels = this.findSupportLevels(prices);
    const resistance_levels = this.findResistanceLevels(prices);

    return {
      trend,
      volatility,
      recent_change: recentChange,
      support_levels,
      resistance_levels,
    };
  }

  // 寻找支撑位
  private findSupportLevels(prices: number[]): number[] {
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const quartile1 = sortedPrices[Math.floor(sortedPrices.length * 0.25)];
    const median = sortedPrices[Math.floor(sortedPrices.length * 0.5)];
    
    return [quartile1, median];
  }

  // 寻找阻力位
  private findResistanceLevels(prices: number[]): number[] {
    const sortedPrices = [...prices].sort((a, b) => b - a);
    const quartile3 = sortedPrices[Math.floor(sortedPrices.length * 0.25)];
    const max = sortedPrices[0];
    
    return [quartile3, max];
  }

  // 分析季节性趋势
  private analyzeSeasonalTrends(category: string): {
    current_month_index: number;
    current_discount_probability: number;
    next_major_sale: string;
    optimal_purchase_months: number[];
  } {
    const currentMonth = new Date().getMonth() + 1;
    const categoryTrends = this.seasonalTrends.get(category.toLowerCase()) || 
                          this.seasonalTrends.get('electronics') || [];
    
    const currentTrend = categoryTrends.find(t => t.month === currentMonth);
    
    // 找到下一个主要促销活动
    let nextMajorSale = '';
    for (let i = 0; i < 12; i++) {
      const checkMonth = ((currentMonth + i - 1) % 12) + 1;
      const trend = categoryTrends.find(t => t.month === checkMonth);
      if (trend && trend.major_sales_events.length > 0) {
        nextMajorSale = trend.major_sales_events[0];
        break;
      }
    }
    
    // 找到最佳购买月份（折扣概率最高）
    const optimalMonths = categoryTrends
      .filter(t => t.discount_probability > 0.4)
      .map(t => t.month)
      .sort((a, b) => {
        const trendA = categoryTrends.find(t => t.month === a);
        const trendB = categoryTrends.find(t => t.month === b);
        return (trendB?.discount_probability || 0) - (trendA?.discount_probability || 0);
      });

    return {
      current_month_index: currentMonth,
      current_discount_probability: currentTrend?.discount_probability || 0.1,
      next_major_sale: nextMajorSale,
      optimal_purchase_months: optimalMonths,
    };
  }

  // 分析竞争定价
  private analyzeCompetitivePricing(currentPrices: ProductPrice[]): {
    price_spread: number;
    cheapest_option: ProductPrice;
    premium_options: ProductPrice[];
    value_leader: ProductPrice;
    market_position: 'low' | 'mid' | 'high';
  } {
    if (currentPrices.length === 0) {
      throw new Error('No current prices available');
    }

    const sortedPrices = [...currentPrices].sort((a, b) => a.price - b.price);
    const cheapest = sortedPrices[0];
    const mostExpensive = sortedPrices[sortedPrices.length - 1];
    const priceSpread = ((mostExpensive.price - cheapest.price) / cheapest.price) * 100;
    
    // 找到高端选项（前25%最贵的）
    const premiumThreshold = Math.ceil(sortedPrices.length * 0.75);
    const premiumOptions = sortedPrices.slice(premiumThreshold);
    
    // 找到性价比之王（考虑价格、评分、评论数）
    const valueLeader = currentPrices.reduce((best, current) => {
      const currentScore = this.calculateValueScore(current);
      const bestScore = this.calculateValueScore(best);
      return currentScore > bestScore ? current : best;
    });
    
    // 确定市场定位
    const avgPrice = sortedPrices.reduce((sum, p) => sum + p.price, 0) / sortedPrices.length;
    let marketPosition: 'low' | 'mid' | 'high' = 'mid';
    if (avgPrice < sortedPrices[Math.floor(sortedPrices.length * 0.33)].price) {
      marketPosition = 'low';
    } else if (avgPrice > sortedPrices[Math.floor(sortedPrices.length * 0.67)].price) {
      marketPosition = 'high';
    }

    return {
      price_spread: priceSpread,
      cheapest_option: cheapest,
      premium_options: premiumOptions,
      value_leader: valueLeader,
      market_position: marketPosition,
    };
  }

  // 计算性价比得分
  private calculateValueScore(product: ProductPrice): number {
    const priceScore = 1 / (product.price / 1000); // 价格越低得分越高
    const ratingScore = product.product_rating || 0;
    const reviewScore = Math.log10((product.review_count || 1) + 1) / 5; // 评论数取对数
    const availabilityScore = product.availability === 'in_stock' ? 1 : 
                             product.availability === 'limited_stock' ? 0.5 : 0;
    
    return (priceScore * 0.4) + (ratingScore * 0.3) + (reviewScore * 0.2) + (availabilityScore * 0.1);
  }

  // 预测价格变化
  private predictPriceChange(
    priceHistory: PriceHistory[],
    seasonalAnalysis: any,
    category: string
  ): PricePrediction {
    if (priceHistory.length < 5) {
      return {
        direction: 'stable',
        confidence: 0.3,
        predicted_price: priceHistory[priceHistory.length - 1]?.price || 0,
        prediction_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        factors: ['数据不足'],
      };
    }

    const recentPrices = priceHistory.slice(-10);
    const currentPrice = recentPrices[recentPrices.length - 1].price;
    
    // 简单的线性回归预测
    const n = recentPrices.length;
    const sumX = recentPrices.reduce((sum, _, i) => sum + i, 0);
    const sumY = recentPrices.reduce((sum, p) => sum + p.price, 0);
    const sumXY = recentPrices.reduce((sum, p, i) => sum + i * p.price, 0);
    const sumX2 = recentPrices.reduce((sum, _, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // 预测30天后的价格
    const predictedPrice = intercept + slope * (n + 30);
    
    let direction: 'up' | 'down' | 'stable' = 'stable';
    const priceChange = ((predictedPrice - currentPrice) / currentPrice) * 100;
    
    if (priceChange > 3) direction = 'up';
    else if (priceChange < -3) direction = 'down';
    
    // 计算置信度（基于历史数据的一致性）
    const predictions = recentPrices.map((_, i) => intercept + slope * i);
    const errors = recentPrices.map((p, i) => Math.abs(p.price - predictions[i]));
    const avgError = errors.reduce((sum, e) => sum + e, 0) / errors.length;
    const confidence = Math.max(0.1, 1 - (avgError / currentPrice));
    
    // 影响因素
    const factors = [];
    if (seasonalAnalysis.current_discount_probability > 0.5) {
      factors.push('季节性促销概率高');
    }
    if (slope > 0) {
      factors.push('价格上升趋势');
    } else if (slope < 0) {
      factors.push('价格下降趋势');
    }
    if (seasonalAnalysis.next_major_sale) {
      factors.push(`即将到来的促销: ${seasonalAnalysis.next_major_sale}`);
    }

    return {
      direction,
      confidence: Math.min(confidence, 0.9),
      predicted_price: Math.max(predictedPrice, currentPrice * 0.5), // 防止预测价格过低
      prediction_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      factors,
    };
  }

  // 综合生成建议
  private synthesizeRecommendation(
    priceAnalysis: any,
    seasonalAnalysis: any,
    competitiveAnalysis: any,
    pricePrediction: PricePrediction,
    context: ShoppingContext
  ): SmartRecommendation {
    const reasoning: string[] = [];
    let action: 'buy_now' | 'wait' | 'compare_more' | 'set_alert' = 'compare_more';
    let confidence = 0.5;
    
    // 基于紧急程度的决策
    if (context.urgency === 'high') {
      action = 'buy_now';
      reasoning.push('紧急需求，建议立即购买');
      confidence += 0.2;
    }
    
    // 基于价格趋势的决策
    if (pricePrediction.direction === 'down' && pricePrediction.confidence > 0.6) {
      action = 'wait';
      reasoning.push(`预测价格将下降到¥${pricePrediction.predicted_price.toFixed(0)}`);
      confidence += 0.15;
    } else if (pricePrediction.direction === 'up' && pricePrediction.confidence > 0.6) {
      action = 'buy_now';
      reasoning.push('价格可能上涨，建议尽早购买');
      confidence += 0.15;
    }
    
    // 基于季节性的决策
    if (seasonalAnalysis.current_discount_probability > 0.5) {
      reasoning.push('当前处于促销高峰期');
      if (action !== 'buy_now') action = 'buy_now';
      confidence += 0.1;
    } else if (seasonalAnalysis.next_major_sale) {
      reasoning.push(`建议等待${seasonalAnalysis.next_major_sale}`);
      if (action !== 'buy_now') action = 'wait';
    }
    
    // 基于竞争分析的决策
    if (competitiveAnalysis.price_spread > 20) {
      reasoning.push('各平台价格差异较大，建议多比较');
      action = 'compare_more';
    }
    
    // 基于预算的调整
    if (context.user_budget && competitiveAnalysis.cheapest_option.price > context.user_budget) {
      action = 'set_alert';
      reasoning.push('当前价格超出预算，建议设置价格提醒');
    }
    
    // 计算潜在节省
    let estimatedSavings = 0;
    if (pricePrediction.direction === 'down') {
      estimatedSavings = competitiveAnalysis.cheapest_option.price - pricePrediction.predicted_price;
    }
    
    // 确定最佳购买时间
    let bestTimeToBuy = '';
    if (action === 'wait' && seasonalAnalysis.next_major_sale) {
      bestTimeToBuy = seasonalAnalysis.next_major_sale;
    } else if (action === 'buy_now') {
      bestTimeToBuy = '现在';
    }
    
    // 风险因素
    const riskFactors: string[] = [];
    if (priceAnalysis.volatility > 0.2) {
      riskFactors.push('价格波动较大');
    }
    if (competitiveAnalysis.cheapest_option.availability !== 'in_stock') {
      riskFactors.push('最低价商品库存不足');
    }
    
    return {
      action,
      confidence: Math.min(confidence, 0.9),
      reasoning,
      estimated_savings: estimatedSavings > 0 ? estimatedSavings : undefined,
      best_time_to_buy: bestTimeToBuy,
      price_prediction: pricePrediction,
      risk_factors: riskFactors.length > 0 ? riskFactors : undefined,
    };
  }

  // 获取价格历史分析
  async analyzePriceHistory(productId: string, days: number = 90): Promise<{
    trend_analysis: any;
    seasonal_patterns: any;
    anomalies: Array<{
      date: string;
      price: number;
      reason: string;
    }>;
    statistics: {
      min_price: number;
      max_price: number;
      avg_price: number;
      median_price: number;
      volatility: number;
    };
  }> {
    const history = await priceApiService.getPriceHistory(productId, undefined, days);
    
    if (history.length === 0) {
      throw new Error('No price history available');
    }
    
    const prices = history.map(h => h.price);
    const sortedPrices = [...prices].sort((a, b) => a - b);
    
    // 统计数据
    const statistics = {
      min_price: Math.min(...prices),
      max_price: Math.max(...prices),
      avg_price: prices.reduce((sum, p) => sum + p, 0) / prices.length,
      median_price: sortedPrices[Math.floor(sortedPrices.length / 2)],
      volatility: this.calculateVolatility(prices),
    };
    
    // 趋势分析
    const trendAnalysis = this.analyzePriceTrend(history);
    
    // 检测异常值
    const anomalies = this.detectPriceAnomalies(history, statistics);
    
    return {
      trend_analysis: trendAnalysis,
      seasonal_patterns: null, // 可以添加更复杂的季节性分析
      anomalies,
      statistics,
    };
  }

  // 计算波动性
  private calculateVolatility(prices: number[]): number {
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
    return Math.sqrt(variance) / avg;
  }

  // 检测价格异常
  private detectPriceAnomalies(history: PriceHistory[], statistics: any): Array<{
    date: string;
    price: number;
    reason: string;
  }> {
    const anomalies: Array<{ date: string; price: number; reason: string; }> = [];
    const threshold = statistics.avg_price * 0.2; // 20%的偏差认为是异常
    
    history.forEach(record => {
      if (record.price < statistics.avg_price - threshold) {
        anomalies.push({
          date: record.date,
          price: record.price,
          reason: '价格异常偏低',
        });
      } else if (record.price > statistics.avg_price + threshold) {
        anomalies.push({
          date: record.date,
          price: record.price,
          reason: '价格异常偏高',
        });
      }
    });
    
    return anomalies;
  }
}

// 创建单例实例
export const shoppingRecommendationEngine = new ShoppingRecommendationEngine();

export default ShoppingRecommendationEngine;