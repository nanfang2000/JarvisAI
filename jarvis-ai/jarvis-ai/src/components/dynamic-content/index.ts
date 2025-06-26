// 动态内容组件导出
export { default as MapView } from './MapView';
export { default as PriceComparison } from './PriceComparison';
export { default as NavigationShoppingDemo } from './NavigationShoppingDemo';
export { default as AndroidEmulator } from './AndroidEmulator';

// 重新导出类型
export type { ProductPrice, ProductInfo, SearchFilters } from '../../types/shopping';
export type { MapLocation, RouteResult, PlaceResult } from '../../types/navigation';
export type { 
  AndroidEmulator as AndroidEmulatorType,
  EmulatorStatus,
  EmulatorType,
  ADBDevice,
  TouchEvent,
  KeyEvent,
  ScreenInfo,
  AndroidApp,
  AutomationScript,
  PriceComparisonTask,
  SecurityProfile,
  AIDecision
} from '../../types/android-emulator';