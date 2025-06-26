import { Loader } from '@googlemaps/js-api-loader';

// 地图服务接口定义
export interface MapLocation {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

export interface RouteOptions {
  origin: string | MapLocation;
  destination: string | MapLocation;
  travelMode: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'BICYCLING';
  waypoints?: google.maps.DirectionsWaypoint[];
  optimizeWaypoints?: boolean;
  avoidHighways?: boolean;
  avoidTolls?: boolean;
  region?: string;
}

export interface RouteResult {
  routes: google.maps.DirectionsRoute[];
  status: google.maps.DirectionsStatus;
  distance: string;
  duration: string;
  steps: google.maps.DirectionsStep[];
  bounds: google.maps.LatLngBounds;
}

export interface PlaceSearchOptions {
  query: string;
  location?: MapLocation;
  radius?: number;
  type?: string;
  minPriceLevel?: number;
  maxPriceLevel?: number;
  openNow?: boolean;
}

export interface PlaceResult {
  place_id: string;
  name: string;
  address: string;
  location: MapLocation;
  rating?: number;
  price_level?: number;
  photos?: string[];
  phone?: string;
  website?: string;
  opening_hours?: {
    open_now: boolean;
    weekday_text: string[];
  };
  types: string[];
  reviews?: google.maps.places.PlaceReview[];
}

export interface TrafficInfo {
  current_conditions: string;
  incidents: Array<{
    type: string;
    description: string;
    location: MapLocation;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  alternative_routes?: RouteResult[];
}

class MapService {
  private loader: Loader;
  private isInitialized = false;
  private directionsService: google.maps.DirectionsService | null = null;
  private placesService: google.maps.places.PlacesService | null = null;
  private geocoder: google.maps.Geocoder | null = null;
  private distanceMatrixService: google.maps.DistanceMatrixService | null = null;
  
  // 缓存
  private routeCache = new Map<string, RouteResult>();
  private placeCache = new Map<string, PlaceResult[]>();
  private geocodeCache = new Map<string, MapLocation>();
  
  // 缓存过期时间（毫秒）
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10分钟

  constructor(apiKey: string) {
    this.loader = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['places', 'geometry', 'directions'],
    });
  }

  // 初始化服务
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loader.load();
      
      // 创建一个临时的地图实例来初始化PlacesService
      const tempDiv = document.createElement('div');
      const tempMap = new google.maps.Map(tempDiv, {
        center: { lat: 0, lng: 0 },
        zoom: 1,
      });
      
      this.directionsService = new google.maps.DirectionsService();
      this.placesService = new google.maps.places.PlacesService(tempMap);
      this.geocoder = new google.maps.Geocoder();
      this.distanceMatrixService = new google.maps.DistanceMatrixService();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize MapService:', error);
      throw new Error('地图服务初始化失败');
    }
  }

  // 确保服务已初始化
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // 生成缓存键
  private getCacheKey(prefix: string, data: any): string {
    return `${prefix}_${JSON.stringify(data)}_${Date.now()}`;
  }

  // 检查缓存是否过期
  private isCacheExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.CACHE_DURATION;
  }

  // 地理编码：地址转坐标
  async geocodeAddress(address: string): Promise<MapLocation> {
    await this.ensureInitialized();
    
    // 检查缓存
    const cached = this.geocodeCache.get(address);
    if (cached) return cached;
    
    if (!this.geocoder) {
      throw new Error('Geocoder service not available');
    }

    return new Promise((resolve, reject) => {
      this.geocoder!.geocode({ address }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
          const location = results[0].geometry.location;
          const result: MapLocation = {
            lat: location.lat(),
            lng: location.lng(),
            address: results[0].formatted_address,
          };
          
          // 缓存结果
          this.geocodeCache.set(address, result);
          resolve(result);
        } else {
          reject(new Error(`地理编码失败: ${status}`));
        }
      });
    });
  }

  // 反向地理编码：坐标转地址
  async reverseGeocode(location: MapLocation): Promise<string> {
    await this.ensureInitialized();
    
    if (!this.geocoder) {
      throw new Error('Geocoder service not available');
    }

    const latLng = new google.maps.LatLng(location.lat, location.lng);
    
    return new Promise((resolve, reject) => {
      this.geocoder!.geocode({ location: latLng }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
          resolve(results[0].formatted_address);
        } else {
          reject(new Error(`反向地理编码失败: ${status}`));
        }
      });
    });
  }

  // 计算路线
  async calculateRoute(options: RouteOptions): Promise<RouteResult> {
    await this.ensureInitialized();
    
    // 检查缓存
    const cacheKey = this.getCacheKey('route', options);
    const cached = this.routeCache.get(cacheKey);
    if (cached) return cached;
    
    if (!this.directionsService) {
      throw new Error('Directions service not available');
    }

    // 处理起点和终点
    let origin: string | google.maps.LatLng;
    let destination: string | google.maps.LatLng;
    
    if (typeof options.origin === 'string') {
      origin = options.origin;
    } else {
      origin = new google.maps.LatLng(options.origin.lat, options.origin.lng);
    }
    
    if (typeof options.destination === 'string') {
      destination = options.destination;
    } else {
      destination = new google.maps.LatLng(options.destination.lat, options.destination.lng);
    }

    const request: google.maps.DirectionsRequest = {
      origin,
      destination,
      travelMode: google.maps.TravelMode[options.travelMode],
      waypoints: options.waypoints || [],
      optimizeWaypoints: options.optimizeWaypoints || false,
      avoidHighways: options.avoidHighways || false,
      avoidTolls: options.avoidTolls || false,
      region: options.region || 'CN',
      unitSystem: google.maps.UnitSystem.METRIC,
    };

    return new Promise((resolve, reject) => {
      this.directionsService!.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          const route = result.routes[0];
          const leg = route.legs[0];
          
          const routeResult: RouteResult = {
            routes: result.routes,
            status,
            distance: leg.distance?.text || '',
            duration: leg.duration?.text || '',
            steps: leg.steps,
            bounds: route.bounds,
          };
          
          // 缓存结果
          this.routeCache.set(cacheKey, routeResult);
          resolve(routeResult);
        } else {
          reject(new Error(`路线计算失败: ${status}`));
        }
      });
    });
  }

  // 搜索地点
  async searchPlaces(options: PlaceSearchOptions): Promise<PlaceResult[]> {
    await this.ensureInitialized();
    
    // 检查缓存
    const cacheKey = this.getCacheKey('places', options);
    const cached = this.placeCache.get(cacheKey);
    if (cached) return cached;
    
    if (!this.placesService) {
      throw new Error('Places service not available');
    }

    const request: google.maps.places.TextSearchRequest = {
      query: options.query,
      location: options.location ? 
        new google.maps.LatLng(options.location.lat, options.location.lng) : 
        undefined,
      radius: options.radius,
      type: options.type,
      minPriceLevel: options.minPriceLevel,
      maxPriceLevel: options.maxPriceLevel,
      openNow: options.openNow,
    };

    return new Promise((resolve, reject) => {
      this.placesService!.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const placeResults: PlaceResult[] = results.map(place => ({
            place_id: place.place_id || '',
            name: place.name || '',
            address: place.formatted_address || '',
            location: {
              lat: place.geometry?.location?.lat() || 0,
              lng: place.geometry?.location?.lng() || 0,
            },
            rating: place.rating,
            price_level: place.price_level,
            photos: place.photos?.map(photo => 
              photo.getUrl({ maxWidth: 400, maxHeight: 400 })
            ),
            types: place.types || [],
          }));
          
          // 缓存结果
          this.placeCache.set(cacheKey, placeResults);
          resolve(placeResults);
        } else {
          reject(new Error(`地点搜索失败: ${status}`));
        }
      });
    });
  }

  // 获取地点详细信息
  async getPlaceDetails(placeId: string): Promise<PlaceResult> {
    await this.ensureInitialized();
    
    if (!this.placesService) {
      throw new Error('Places service not available');
    }

    const request: google.maps.places.PlaceDetailsRequest = {
      placeId,
      fields: [
        'place_id',
        'name',
        'formatted_address',
        'geometry',
        'rating',
        'price_level',
        'photos',
        'formatted_phone_number',
        'website',
        'opening_hours',
        'types',
        'reviews',
      ],
    };

    return new Promise((resolve, reject) => {
      this.placesService!.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const result: PlaceResult = {
            place_id: place.place_id || '',
            name: place.name || '',
            address: place.formatted_address || '',
            location: {
              lat: place.geometry?.location?.lat() || 0,
              lng: place.geometry?.location?.lng() || 0,
            },
            rating: place.rating,
            price_level: place.price_level,
            photos: place.photos?.map(photo => 
              photo.getUrl({ maxWidth: 800, maxHeight: 600 })
            ),
            phone: place.formatted_phone_number,
            website: place.website,
            opening_hours: place.opening_hours ? {
              open_now: place.opening_hours.isOpen(),
              weekday_text: place.opening_hours.weekday_text || [],
            } : undefined,
            types: place.types || [],
            reviews: place.reviews,
          };
          
          resolve(result);
        } else {
          reject(new Error(`获取地点详情失败: ${status}`));
        }
      });
    });
  }

  // 计算多个目的地的距离矩阵
  async calculateDistanceMatrix(
    origins: (string | MapLocation)[],
    destinations: (string | MapLocation)[],
    travelMode: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'BICYCLING' = 'DRIVING'
  ): Promise<google.maps.DistanceMatrixResponse> {
    await this.ensureInitialized();
    
    if (!this.distanceMatrixService) {
      throw new Error('Distance Matrix service not available');
    }

    const processedOrigins = origins.map(origin => 
      typeof origin === 'string' ? origin : new google.maps.LatLng(origin.lat, origin.lng)
    );
    
    const processedDestinations = destinations.map(destination => 
      typeof destination === 'string' ? destination : new google.maps.LatLng(destination.lat, destination.lng)
    );

    return new Promise((resolve, reject) => {
      this.distanceMatrixService!.getDistanceMatrix({
        origins: processedOrigins,
        destinations: processedDestinations,
        travelMode: google.maps.TravelMode[travelMode],
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false,
      }, (response, status) => {
        if (status === google.maps.DistanceMatrixStatus.OK && response) {
          resolve(response);
        } else {
          reject(new Error(`距离矩阵计算失败: ${status}`));
        }
      });
    });
  }

  // 获取附近地点
  async getNearbyPlaces(
    location: MapLocation,
    radius: number = 1000,
    type?: string,
    keyword?: string
  ): Promise<PlaceResult[]> {
    await this.ensureInitialized();
    
    if (!this.placesService) {
      throw new Error('Places service not available');
    }

    const request: google.maps.places.PlaceSearchRequest = {
      location: new google.maps.LatLng(location.lat, location.lng),
      radius,
      type,
      keyword,
    };

    return new Promise((resolve, reject) => {
      this.placesService!.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const placeResults: PlaceResult[] = results.map(place => ({
            place_id: place.place_id || '',
            name: place.name || '',
            address: place.vicinity || '',
            location: {
              lat: place.geometry?.location?.lat() || 0,
              lng: place.geometry?.location?.lng() || 0,
            },
            rating: place.rating,
            price_level: place.price_level,
            photos: place.photos?.map(photo => 
              photo.getUrl({ maxWidth: 400, maxHeight: 400 })
            ),
            types: place.types || [],
          }));
          
          resolve(placeResults);
        } else {
          reject(new Error(`附近地点搜索失败: ${status}`));
        }
      });
    });
  }

  // 获取交通信息（模拟实现）
  async getTrafficInfo(route: RouteResult): Promise<TrafficInfo> {
    // 这里可以集成实际的交通信息API
    // 目前返回模拟数据
    return {
      current_conditions: 'moderate',
      incidents: [],
      alternative_routes: [],
    };
  }

  // 清除缓存
  clearCache(): void {
    this.routeCache.clear();
    this.placeCache.clear();
    this.geocodeCache.clear();
  }

  // 获取当前位置
  async getCurrentLocation(): Promise<MapLocation> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('浏览器不支持地理定位'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          reject(new Error(`获取当前位置失败: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000, // 1分钟
        }
      );
    });
  }

  // 监听位置变化
  watchLocation(
    callback: (location: MapLocation) => void,
    errorCallback?: (error: GeolocationPositionError) => void
  ): number | null {
    if (!navigator.geolocation) {
      console.error('浏览器不支持地理定位');
      return null;
    }

    return navigator.geolocation.watchPosition(
      (position) => {
        callback({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      errorCallback,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }

  // 停止监听位置变化
  clearLocationWatch(watchId: number): void {
    navigator.geolocation.clearWatch(watchId);
  }
}

// 创建单例实例
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';
export const mapService = new MapService(GOOGLE_MAPS_API_KEY);

export default MapService;