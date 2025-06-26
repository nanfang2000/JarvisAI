// 地图和导航相关类型定义

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

export default {};