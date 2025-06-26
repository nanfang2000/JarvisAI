// 服务层导出
export { mapService, default as MapService } from './mapService';
export { priceApiService, default as PriceApiService } from './priceApiService';
export { shoppingRecommendationEngine, default as ShoppingRecommendationEngine } from './shoppingRecommendationEngine';
export { realTimeDataService, default as RealTimeDataService } from './realTimeDataService';
export { jarvisIntegrationService, default as JarvisIntegrationService } from './jarvisIntegrationService';

// 重新导出类型
export type {
  MapLocation,
  RouteOptions,
  RouteResult,
  PlaceSearchOptions,
  PlaceResult,
  TrafficInfo,
} from './mapService';

export type {
  ProductPrice,
  ProductInfo,
  PriceHistory,
  PriceAlert,
  ShoppingRecommendation,
  PlatformInfo,
  PriceSearchRequest,
  CouponInfo,
} from './priceApiService';

export type {
  SmartRecommendation,
  PricePrediction,
  ShoppingContext,
} from './shoppingRecommendationEngine';

export type {
  RealTimeUpdate,
  TrafficUpdate,
  PriceUpdate,
  LocationUpdate,
  PromotionUpdate,
} from './realTimeDataService';

export type {
  JarvisCommand,
  JarvisResponse,
  JarvisAction,
  ConversationContext,
} from './jarvisIntegrationService';