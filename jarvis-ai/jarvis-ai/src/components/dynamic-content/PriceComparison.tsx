import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Tooltip,
  Badge,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  Slider,
  Rating,
  Divider,
  Skeleton,
} from '@mui/material';
import {
  Search,
  ShoppingCart,
  Compare,
  TrendingUp,
  TrendingDown,
  Star,
  LocalOffer,
  History,
  Notifications,
  FilterList,
  Sort,
  Share,
  Favorite,
  FavoriteBorder,
  ExpandMore,
  OpenInNew,
  Assessment,
  Refresh,
  NotificationsActive,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';

// 数据接口定义
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
  coupon?: {
    code: string;
    discount: number;
    description: string;
    expires_at: string;
  };
}

export interface PriceHistory {
  date: string;
  price: number;
  platform: string;
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
  lowest_price: {
    price: number;
    platform: string;
    date: string;
  };
  highest_price: {
    price: number;
    platform: string;
    date: string;
  };
  price_trend: 'up' | 'down' | 'stable';
  recommendations: string[];
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

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface PriceComparisonProps {
  className?: string;
  onProductSelect?: (product: ProductInfo) => void;
  onPriceAlert?: (productId: string, targetPrice: number) => void;
}

const PriceComparison: React.FC<PriceComparisonProps> = ({
  className,
  onProductSelect,
  onPriceAlert,
}) => {
  // 状态管理
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductPrice[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priceAlertDialog, setPriceAlertDialog] = useState(false);
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [priceAlerts, setPriceAlerts] = useState<Array<{
    productId: string;
    targetPrice: number;
    currentPrice: number;
    active: boolean;
  }>>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(300); // 5分钟

  // 模拟数据
  const mockSearchResults: ProductPrice[] = [
    {
      id: '1',
      product_id: 'iphone-15-pro',
      platform: '京东',
      platform_logo: '/logos/jd.png',
      title: 'Apple iPhone 15 Pro 128GB 深空黑色',
      price: 7999,
      original_price: 8999,
      currency: 'CNY',
      discount_percentage: 11,
      availability: 'in_stock',
      shipping_cost: 0,
      shipping_time: '当日达',
      seller: '京东自营',
      seller_rating: 4.9,
      product_rating: 4.8,
      review_count: 12580,
      image_url: '/images/iphone-15-pro.jpg',
      product_url: 'https://item.jd.com/100012043978.html',
      last_updated: new Date().toISOString(),
      coupon: {
        code: 'SAVE1000',
        discount: 1000,
        description: '满8000减1000',
        expires_at: '2024-12-31T23:59:59Z',
      },
    },
    {
      id: '2',
      product_id: 'iphone-15-pro',
      platform: '天猫',
      platform_logo: '/logos/tmall.png',
      title: 'Apple iPhone 15 Pro 128GB 深空黑色 官方正品',
      price: 8199,
      original_price: 8999,
      currency: 'CNY',
      discount_percentage: 9,
      availability: 'in_stock',
      shipping_cost: 0,
      shipping_time: '24小时发货',
      seller: 'Apple官方旗舰店',
      seller_rating: 5.0,
      product_rating: 4.9,
      review_count: 8756,
      image_url: '/images/iphone-15-pro.jpg',
      product_url: 'https://detail.tmall.com/item.htm?id=123456789',
      last_updated: new Date().toISOString(),
    },
    {
      id: '3',
      product_id: 'iphone-15-pro',
      platform: '拼多多',
      platform_logo: '/logos/pdd.png',
      title: 'Apple iPhone 15 Pro 128GB 全新未拆封',
      price: 7699,
      currency: 'CNY',
      availability: 'limited_stock',
      shipping_cost: 0,
      shipping_time: '48小时发货',
      seller: '数码专营店',
      seller_rating: 4.6,
      product_rating: 4.7,
      review_count: 3421,
      image_url: '/images/iphone-15-pro.jpg',
      product_url: 'https://mobile.yangkeduo.com/goods.html?goods_id=123456789',
      last_updated: new Date().toISOString(),
    },
  ];

  const mockProductInfo: ProductInfo = {
    id: 'iphone-15-pro',
    name: 'Apple iPhone 15 Pro',
    description: 'iPhone 15 Pro采用钛金属设计，配备A17 Pro芯片，支持5G网络，拥有出色的摄影系统。',
    category: '智能手机',
    brand: 'Apple',
    model: 'iPhone 15 Pro',
    specifications: {
      '屏幕尺寸': '6.1英寸',
      '存储容量': '128GB',
      '处理器': 'A17 Pro',
      '摄像头': '48MP主摄 + 12MP超广角 + 12MP长焦',
      '电池': '3274mAh',
      '系统': 'iOS 17',
    },
    images: ['/images/iphone-15-pro-1.jpg', '/images/iphone-15-pro-2.jpg'],
    average_rating: 4.8,
    total_reviews: 24757,
    price_history: [
      { date: '2024-01-01', price: 8999, platform: '官方价格' },
      { date: '2024-01-15', price: 8799, platform: '京东' },
      { date: '2024-02-01', price: 8599, platform: '天猫' },
      { date: '2024-02-15', price: 8399, platform: '京东' },
      { date: '2024-03-01', price: 8199, platform: '拼多多' },
      { date: '2024-03-15', price: 7999, platform: '京东' },
    ],
    lowest_price: {
      price: 7699,
      platform: '拼多多',
      date: '2024-03-20',
    },
    highest_price: {
      price: 8999,
      platform: '官方价格',
      date: '2024-01-01',
    },
    price_trend: 'down',
    recommendations: [
      '建议等待双11大促，可能会有更大优惠',
      '拼多多价格最低，但需要注意商家信誉',
      '京东自营最可靠，售后服务好',
    ],
  };

  // 搜索产品
  const searchProducts = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // 模拟API调用延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 这里应该调用实际的价格比对API
      setSearchResults(mockSearchResults);
      setSelectedProduct(mockProductInfo);
    } catch (err) {
      setError('搜索商品失败，请稍后重试');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  // 刷新价格
  const refreshPrices = useCallback(async () => {
    if (searchResults.length === 0) return;

    setIsLoading(true);
    try {
      // 模拟刷新延迟
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 这里应该调用实际的API刷新价格
      const refreshedResults = searchResults.map(result => ({
        ...result,
        last_updated: new Date().toISOString(),
        // 模拟价格变化
        price: result.price + Math.round((Math.random() - 0.5) * 200),
      }));
      
      setSearchResults(refreshedResults);
    } catch (err) {
      setError('刷新价格失败');
    } finally {
      setIsLoading(false);
    }
  }, [searchResults]);

  // 自动刷新逻辑
  useEffect(() => {
    if (!autoRefresh || searchResults.length === 0) return;

    const interval = setInterval(() => {
      refreshPrices();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refreshPrices, searchResults.length]);

  // 添加/移除收藏
  const toggleFavorite = useCallback((productId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(productId)) {
        newFavorites.delete(productId);
      } else {
        newFavorites.add(productId);
      }
      return newFavorites;
    });
  }, []);

  // 设置价格提醒
  const setPriceAlert = useCallback(() => {
    if (!selectedProduct || targetPrice <= 0) return;

    const alert = {
      productId: selectedProduct.id,
      targetPrice,
      currentPrice: selectedProduct.lowest_price.price,
      active: true,
    };

    setPriceAlerts(prev => [...prev, alert]);
    setPriceAlertDialog(false);
    setTargetPrice(0);

    if (onPriceAlert) {
      onPriceAlert(selectedProduct.id, targetPrice);
    }
  }, [selectedProduct, targetPrice, onPriceAlert]);

  // 获取价格趋势图表数据
  const getPriceChartData = useCallback(() => {
    if (!selectedProduct) return [];

    return selectedProduct.price_history.map(item => ({
      date: format(parseISO(item.date), 'MM/dd'),
      price: item.price,
      platform: item.platform,
    }));
  }, [selectedProduct]);

  // 获取平台分布数据
  const getPlatformData = useCallback(() => {
    const platformCounts = searchResults.reduce((acc, result) => {
      acc[result.platform] = (acc[result.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(platformCounts).map(([platform, count]) => ({
      name: platform,
      value: count,
    }));
  }, [searchResults]);

  // 排序产品
  const sortedResults = React.useMemo(() => {
    let sorted = [...searchResults];

    switch (filters.sort_by) {
      case 'price_asc':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        sorted.sort((a, b) => (b.product_rating || 0) - (a.product_rating || 0));
        break;
      case 'reviews':
        sorted.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
        break;
      case 'discount':
        sorted.sort((a, b) => (b.discount_percentage || 0) - (a.discount_percentage || 0));
        break;
      default:
        break;
    }

    return sorted.filter(result => {
      if (filters.min_price && result.price < filters.min_price) return false;
      if (filters.max_price && result.price > filters.max_price) return false;
      if (filters.platforms && filters.platforms.length > 0 && !filters.platforms.includes(result.platform)) return false;
      if (filters.availability && filters.availability.length > 0 && !filters.availability.includes(result.availability)) return false;
      if (filters.min_rating && (result.product_rating || 0) < filters.min_rating) return false;
      return true;
    });
  }, [searchResults, filters]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <Box className={className} sx={{ p: 2 }}>
      {/* 搜索栏 */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              variant="outlined"
              label="搜索商品"
              placeholder="输入商品名称或关键词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchProducts()}
              InputProps={{
                endAdornment: (
                  <IconButton onClick={searchProducts} disabled={isLoading}>
                    {isLoading ? <CircularProgress size={24} /> : <Search />}
                  </IconButton>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                startIcon={<FilterList />}
                onClick={() => setFiltersOpen(true)}
              >
                筛选
              </Button>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={refreshPrices}
                disabled={isLoading || searchResults.length === 0}
              >
                刷新
              </Button>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                }
                label="自动刷新"
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 主内容区域 */}
      {searchResults.length > 0 && (
        <Box>
          <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
            <Tab label="价格对比" />
            <Tab label="价格趋势" />
            <Tab label="商品详情" />
            <Tab label="价格提醒" />
          </Tabs>

          {/* 价格对比标签页 */}
          <TabPanel value={currentTab} index={0}>
            <Grid container spacing={2}>
              {sortedResults.map((result) => (
                <Grid item xs={12} md={6} lg={4} key={result.id}>
                  <Card
                    elevation={3}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                    }}
                  >
                    {result.discount_percentage && (
                      <Chip
                        label={`${result.discount_percentage}% OFF`}
                        color="error"
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          zIndex: 1,
                        }}
                      />
                    )}

                    <CardMedia
                      component="img"
                      height="200"
                      image={result.image_url}
                      alt={result.title}
                      sx={{ objectFit: 'contain', p: 1 }}
                    />

                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box display="flex" alignItems="center" mb={1}>
                        <Avatar src={result.platform_logo} sx={{ width: 24, height: 24, mr: 1 }} />
                        <Typography variant="subtitle2" color="primary">
                          {result.platform}
                        </Typography>
                      </Box>

                      <Typography variant="h6" gutterBottom noWrap>
                        {result.title}
                      </Typography>

                      <Box display="flex" alignItems="center" mb={1}>
                        <Typography variant="h5" color="error" sx={{ mr: 2 }}>
                          ¥{result.price.toLocaleString()}
                        </Typography>
                        {result.original_price && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ textDecoration: 'line-through' }}
                          >
                            ¥{result.original_price.toLocaleString()}
                          </Typography>
                        )}
                      </Box>

                      <Box display="flex" alignItems="center" mb={1}>
                        <Rating value={result.product_rating || 0} precision={0.1} size="small" readOnly />
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                          ({result.review_count})
                        </Typography>
                      </Box>

                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {result.seller} · {result.shipping_time}
                      </Typography>

                      <Chip
                        label={result.availability === 'in_stock' ? '现货' : result.availability === 'limited_stock' ? '库存有限' : '缺货'}
                        color={result.availability === 'in_stock' ? 'success' : result.availability === 'limited_stock' ? 'warning' : 'error'}
                        size="small"
                      />

                      {result.coupon && (
                        <Box mt={1}>
                          <Chip
                            icon={<LocalOffer />}
                            label={result.coupon.description}
                            variant="outlined"
                            color="secondary"
                            size="small"
                          />
                        </Box>
                      )}
                    </CardContent>

                    <CardActions>
                      <Button
                        size="small"
                        startIcon={<ShoppingCart />}
                        href={result.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        去购买
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => toggleFavorite(result.product_id)}
                      >
                        {favorites.has(result.product_id) ? <Favorite color="error" /> : <FavoriteBorder />}
                      </IconButton>
                      <IconButton size="small">
                        <Share />
                      </IconButton>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </TabPanel>

          {/* 价格趋势标签页 */}
          <TabPanel value={currentTab} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12} lg={8}>
                <Paper elevation={2} sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    价格趋势图
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={getPriceChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RechartsTooltip />
                      <Line type="monotone" dataKey="price" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              <Grid item xs={12} lg={4}>
                <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    价格统计
                  </Typography>
                  {selectedProduct && (
                    <List dense>
                      <ListItem>
                        <ListItemText
                          primary="最低价格"
                          secondary={`¥${selectedProduct.lowest_price.price} (${selectedProduct.lowest_price.platform})`}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="最高价格"
                          secondary={`¥${selectedProduct.highest_price.price} (${selectedProduct.highest_price.platform})`}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="价格趋势"
                          secondary={
                            <Box display="flex" alignItems="center">
                              {selectedProduct.price_trend === 'up' ? (
                                <TrendingUp color="error" />
                              ) : selectedProduct.price_trend === 'down' ? (
                                <TrendingDown color="success" />
                              ) : (
                                <Typography variant="body2">稳定</Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    </List>
                  )}
                </Paper>

                <Paper elevation={2} sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    平台分布
                  </Typography>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={getPlatformData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getPlatformData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>

          {/* 商品详情标签页 */}
          <TabPanel value={currentTab} index={2}>
            {selectedProduct && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper elevation={2} sx={{ p: 2 }}>
                    <Typography variant="h5" gutterBottom>
                      {selectedProduct.name}
                    </Typography>
                    <Typography variant="body1" paragraph>
                      {selectedProduct.description}
                    </Typography>
                    
                    <Box display="flex" alignItems="center" mb={2}>
                      <Rating value={selectedProduct.average_rating} precision={0.1} readOnly />
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        {selectedProduct.average_rating} ({selectedProduct.total_reviews} 评价)
                      </Typography>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="h6" gutterBottom>
                      规格参数
                    </Typography>
                    <List dense>
                      {Object.entries(selectedProduct.specifications).map(([key, value]) => (
                        <ListItem key={key} divider>
                          <ListItemText primary={key} secondary={value} />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper elevation={2} sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      购买建议
                    </Typography>
                    <List>
                      {selectedProduct.recommendations.map((recommendation, index) => (
                        <ListItem key={index}>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: 'primary.main' }}>
                              <Assessment />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText primary={recommendation} />
                        </ListItem>
                      ))}
                    </List>

                    <Box mt={3}>
                      <Button
                        variant="contained"
                        fullWidth
                        startIcon={<NotificationsActive />}
                        onClick={() => setPriceAlertDialog(true)}
                      >
                        设置价格提醒
                      </Button>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            )}
          </TabPanel>

          {/* 价格提醒标签页 */}
          <TabPanel value={currentTab} index={3}>
            <Paper elevation={2} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                我的价格提醒
              </Typography>
              
              {priceAlerts.length === 0 ? (
                <Box textAlign="center" py={4}>
                  <Typography variant="body1" color="text.secondary">
                    暂无价格提醒，去设置一个吧！
                  </Typography>
                  <Button
                    variant="contained"
                    sx={{ mt: 2 }}
                    onClick={() => setPriceAlertDialog(true)}
                  >
                    设置价格提醒
                  </Button>
                </Box>
              ) : (
                <List>
                  {priceAlerts.map((alert, index) => (
                    <ListItem key={index} divider>
                      <ListItemText
                        primary={`商品ID: ${alert.productId}`}
                        secondary={`目标价格: ¥${alert.targetPrice} | 当前价格: ¥${alert.currentPrice}`}
                      />
                      <Badge
                        color={alert.currentPrice <= alert.targetPrice ? 'success' : 'default'}
                        variant="dot"
                      >
                        <IconButton>
                          <Notifications />
                        </IconButton>
                      </Badge>
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </TabPanel>
        </Box>
      )}

      {/* 价格提醒对话框 */}
      <Dialog open={priceAlertDialog} onClose={() => setPriceAlertDialog(false)}>
        <DialogTitle>设置价格提醒</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            当商品价格低于设定价格时，我们会及时通知您。
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="目标价格"
            type="number"
            fullWidth
            variant="outlined"
            value={targetPrice}
            onChange={(e) => setTargetPrice(Number(e.target.value))}
            InputProps={{
              startAdornment: '¥',
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPriceAlertDialog(false)}>取消</Button>
          <Button onClick={setPriceAlert} variant="contained">
            设置提醒
          </Button>
        </DialogActions>
      </Dialog>

      {/* 筛选对话框 */}
      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>价格筛选</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label="最低价格"
                type="number"
                fullWidth
                margin="normal"
                value={filters.min_price || ''}
                onChange={(e) => setFilters({...filters, min_price: Number(e.target.value)})}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="最高价格"
                type="number"
                fullWidth
                margin="normal"
                value={filters.max_price || ''}
                onChange={(e) => setFilters({...filters, max_price: Number(e.target.value)})}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography gutterBottom>最低评分</Typography>
              <Slider
                value={filters.min_rating || 0}
                onChange={(_, value) => setFilters({...filters, min_rating: value as number})}
                min={0}
                max={5}
                step={0.1}
                marks
                valueLabelDisplay="auto"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilters({})}>清除筛选</Button>
          <Button onClick={() => setFiltersOpen(false)} variant="contained">
            应用筛选
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PriceComparison;