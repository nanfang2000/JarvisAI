// 购物和价格比对相关类型定义

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

export interface SearchFilters {
  min_price?: number;
  max_price?: number;
  platforms?: string[];
  availability?: string[];
  min_rating?: number;
  sort_by?: 'price_asc' | 'price_desc' | 'rating' | 'reviews' | 'discount';
  include_shipping?: boolean;
}

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

export default {};