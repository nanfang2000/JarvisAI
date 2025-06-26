# JARVIS 地图导航和价格比对系统

这是一个集成到JARVIS AI助手中的智能地图导航和价格比对购物系统，提供全面的位置服务和购物决策支持。

## 🚀 主要功能

### 1. 智能地图导航
- **Google Maps集成**：完整的地图显示和交互功能
- **路线规划**：支持驾车、步行、公交、骑行多种出行方式
- **实时交通**：交通状况监控和智能路线推荐
- **地点搜索**：POI搜索和详细信息展示
- **位置服务**：GPS定位和位置分享

### 2. 价格比对系统
- **多平台比价**：京东、天猫、拼多多等主流电商平台
- **实时价格监控**：自动价格更新和变动通知
- **优惠券查找**：自动搜索和应用可用优惠券
- **价格历史追踪**：价格趋势分析和预测
- **智能购买建议**：基于AI的购买时机推荐

### 3. JARVIS AI集成
- **自然语言交互**：支持中英文语音和文字指令
- **智能意图识别**：准确理解用户需求
- **上下文感知**：基于位置和购物历史的个性化服务
- **多模态响应**：文字、地图、图表等多种回复形式

## 📁 项目结构

```
jarvis-ai/src/
├── components/dynamic-content/
│   ├── MapView.tsx                    # 地图组件
│   ├── PriceComparison.tsx           # 价格比对组件
│   └── NavigationShoppingDemo.tsx    # 功能演示组件
├── services/
│   ├── mapService.ts                 # 地图服务
│   ├── priceApiService.ts           # 价格API服务
│   ├── shoppingRecommendationEngine.ts # 购物建议引擎
│   ├── realTimeDataService.ts       # 实时数据服务
│   └── jarvisIntegrationService.ts  # JARVIS集成服务
└── types/
    ├── navigation.ts                 # 导航类型定义
    └── shopping.ts                   # 购物类型定义
```

## ⚙️ 环境配置

### 1. 安装依赖
```bash
npm install @googlemaps/js-api-loader @types/google.maps date-fns recharts --legacy-peer-deps
```

### 2. 环境变量配置
复制 `.env.example` 到 `.env` 并填入您的API密钥：

```env
# Google Maps API
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# 价格比对API
REACT_APP_PRICE_API_BASE_URL=https://api.pricecomparison.com
REACT_APP_PRICE_API_KEY=your_price_api_key_here

# WebSocket服务
REACT_APP_WEBSOCKET_URL=wss://api.jarvis-ai.com/ws
```

### 3. Google Maps API设置
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用以下API：
   - Maps JavaScript API
   - Places API
   - Directions API
   - Geocoding API
4. 创建API密钥并添加到环境变量

## 🛠️ 使用指南

### 地图导航功能

#### 基本地图操作
```typescript
import MapView from './components/dynamic-content/MapView';

<MapView
  onLocationSelect={(location) => {
    console.log('选中位置:', location);
  }}
  onRouteCalculated={(route) => {
    console.log('路线计算完成:', route);
  }}
/>
```

#### 程序化地图操作
```typescript
import { mapService } from './services/mapService';

// 搜索地点
const places = await mapService.searchPlaces({
  query: '咖啡店',
  location: { lat: 39.9042, lng: 116.4074 },
  radius: 1000
});

// 计算路线
const route = await mapService.calculateRoute({
  origin: '天安门',
  destination: '故宫',
  travelMode: 'WALKING'
});

// 获取当前位置
const location = await mapService.getCurrentLocation();
```

### 价格比对功能

#### 基本价格比较
```typescript
import PriceComparison from './components/dynamic-content/PriceComparison';

<PriceComparison
  onProductSelect={(product) => {
    console.log('选中商品:', product);
  }}
  onPriceAlert={(productId, targetPrice) => {
    console.log('设置价格提醒:', productId, targetPrice);
  }}
/>
```

#### 程序化价格查询
```typescript
import { priceApiService } from './services/priceApiService';

// 搜索商品价格
const searchResult = await priceApiService.searchProducts({
  query: 'iPhone 15',
  sort_by: 'price_asc',
  limit: 10
});

// 获取商品详情
const productInfo = await priceApiService.getProductInfo('product_id');

// 设置价格提醒
const alert = await priceApiService.setPriceAlert('product_id', 8000);
```

### JARVIS AI交互

#### 自然语言处理
```typescript
import { jarvisIntegrationService } from './services/jarvisIntegrationService';

// 处理用户输入
const response = await jarvisIntegrationService.processInput(
  '导航到北京西站',
  'user_id',
  'session_id'
);

console.log('JARVIS回复:', response.content);
```

#### 支持的指令类型
- **导航指令**: "导航到北京西站", "去最近的加油站"
- **搜索指令**: "附近的餐厅", "找咖啡店"
- **购物指令**: "搜索iPhone价格", "比较iPad价格"
- **建议指令**: "什么时候买最便宜", "推荐购买时机"
- **提醒指令**: "价格低于8000时通知我"

### 实时数据监控

#### 价格监控
```typescript
import { realTimeDataService } from './services/realTimeDataService';

// 订阅价格更新
const subscriptionId = realTimeDataService.subscribe(
  'price',
  'product_id',
  (data) => {
    console.log('价格更新:', data);
  }
);

// 取消订阅
realTimeDataService.unsubscribe(subscriptionId);
```

#### 交通监控
```typescript
// 获取实时交通信息
const trafficInfo = await realTimeDataService.getRealTimeTraffic(
  { lat: 39.9042, lng: 116.4074 },
  { lat: 39.9083, lng: 116.3972 }
);
```

## 🎯 高级功能

### 智能购物建议
```typescript
import { shoppingRecommendationEngine } from './services/shoppingRecommendationEngine';

// 生成购买建议
const recommendation = await shoppingRecommendationEngine.generateSmartRecommendation(
  productInfo,
  currentPrices,
  {
    user_budget: 10000,
    urgency: 'medium',
    quality_preference: 'balanced'
  }
);
```

### 缓存管理
```typescript
// 清除缓存
mapService.clearCache();
priceApiService.clearCache();
realTimeDataService.clearCache();

// 查看缓存统计
const stats = realTimeDataService.getCacheStats();
```

### 离线模式支持
系统自动检测网络状态并在离线时：
- 使用本地缓存数据
- 排队待发送的请求
- 网络恢复时自动同步

## 🔧 自定义配置

### 地图配置
```typescript
// 在MapView组件中自定义地图选项
const mapOptions = {
  center: { lat: 39.9042, lng: 116.4074 },
  zoom: 13,
  mapTypeControl: true,
  streetViewControl: true,
  fullscreenControl: true
};
```

### 价格比对配置
```typescript
// 自定义搜索过滤器
const filters = {
  min_price: 1000,
  max_price: 10000,
  platforms: ['京东', '天猫'],
  min_rating: 4.0,
  sort_by: 'price_asc'
};
```

## 🚀 部署说明

### 开发环境
```bash
npm run dev
```

### 生产构建
```bash
npm run build
```

### 环境要求
- Node.js >= 16
- React >= 18
- TypeScript >= 4.5

## 🛡️ 安全注意事项

1. **API密钥保护**: 确保API密钥不会暴露在客户端代码中
2. **HTTPS使用**: 生产环境必须使用HTTPS
3. **数据验证**: 对所有外部API响应进行验证
4. **权限控制**: 实现适当的用户权限和访问控制

## 📊 性能优化

1. **缓存策略**: 实现多层缓存减少API调用
2. **懒加载**: 按需加载地图和价格数据
3. **防抖节流**: 限制搜索和更新频率
4. **数据压缩**: 压缩传输数据减少带宽使用

## 🐛 故障排除

### 常见问题

**Q: 地图不显示**
A: 检查Google Maps API密钥是否正确配置

**Q: 价格数据加载失败**
A: 确认价格API服务可用性和网络连接

**Q: 实时更新不工作**
A: 检查WebSocket连接状态和防火墙设置

### 调试模式
```typescript
// 启用调试模式
localStorage.setItem('JARVIS_DEBUG', 'true');
```

## 📞 技术支持

如果您在使用过程中遇到问题，请：

1. 查看控制台错误信息
2. 检查网络连接和API配置
3. 参考故障排除指南
4. 联系技术支持团队

## 🔄 更新日志

### v1.0.0 (2024-06-25)
- 初始版本发布
- Google Maps集成
- 多平台价格比对
- JARVIS AI集成
- 实时数据监控
- 智能购物建议引擎

---

**注意**: 这是一个演示系统，某些功能使用模拟数据。在生产环境中使用前，请确保所有API服务都已正确配置和测试。