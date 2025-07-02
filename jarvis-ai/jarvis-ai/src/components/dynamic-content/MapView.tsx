import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Chip,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  MyLocation,
  DirectionsWalk,
  DirectionsCar,
  DirectionsTransit,
  DirectionsBike,
  Search,
  Navigation,
  Place,
  Star,
  Phone,
  Schedule,
  Language,
  Close,
} from '@mui/icons-material';

interface MapViewProps {
  className?: string;
  onLocationSelect?: (location: google.maps.LatLng) => void;
  onRouteCalculated?: (route: google.maps.DirectionsResult) => void;
}

interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  price_level?: number;
  photos?: google.maps.places.PlacePhoto[];
  phone_number?: string;
  website?: string;
  opening_hours?: google.maps.places.OpeningHours;
  types: string[];
}

type TravelMode = 'DRIVING' | 'WALKING' | 'TRANSIT' | 'BICYCLING';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const MapView: React.FC<MapViewProps> = ({ className, onLocationSelect, onRouteCalculated }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [travelMode, setTravelMode] = useState<TravelMode>('DRIVING');
  const [currentLocation, setCurrentLocation] = useState<google.maps.LatLng | null>(null);
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);
  const [searchResults, setSearchResults] = useState<google.maps.places.PlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [placeDetailsDialog, setPlaceDetailsDialog] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
    steps: google.maps.DirectionsStep[];
  } | null>(null);

  // 初始化Google Maps
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError('Google Maps API key is not configured');
      setIsLoading(false);
      return;
    }

    const loader = new Loader({
      apiKey: GOOGLE_MAPS_API_KEY,
      version: 'weekly',
      libraries: ['places', 'geometry'],
    });

    loader.load().then(() => {
      if (mapRef.current) {
        const mapInstance = new google.maps.Map(mapRef.current, {
          center: { lat: 39.9042, lng: 116.4074 }, // 北京天安门广场
          zoom: 13,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
        });

        const directionsServiceInstance = new google.maps.DirectionsService();
        const directionsRendererInstance = new google.maps.DirectionsRenderer({
          draggable: true,
          panel: document.getElementById('directions-panel') as HTMLElement,
        });
        const placesServiceInstance = new google.maps.places.PlacesService(mapInstance);

        directionsRendererInstance.setMap(mapInstance);

        // 添加点击事件监听器
        mapInstance.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (event.latLng && onLocationSelect) {
            onLocationSelect(event.latLng);
          }
        });

        // 路线更改监听器
        directionsRendererInstance.addListener('directions_changed', () => {
          const directions = directionsRendererInstance.getDirections();
          if (directions && onRouteCalculated) {
            onRouteCalculated(directions);
            
            // 更新路线信息
            const route = directions.routes[0];
            if (route) {
              setRouteInfo({
                distance: route.legs[0].distance?.text || '',
                duration: route.legs[0].duration?.text || '',
                steps: route.legs[0].steps || [],
              });
            }
          }
        });

        setMap(mapInstance);
        setDirectionsService(directionsServiceInstance);
        setDirectionsRenderer(directionsRendererInstance);
        setPlacesService(placesServiceInstance);
        setIsLoading(false);

        // 尝试获取用户当前位置
        getCurrentLocation();
      }
    }).catch((error) => {
      console.error('Error loading Google Maps:', error);
      setError('Failed to load Google Maps');
      setIsLoading(false);
    });
  }, [onLocationSelect, onRouteCalculated]);

  // 获取当前位置
  const getCurrentLocation = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const location = new google.maps.LatLng(lat, lng);
          
          setCurrentLocation(location);
          if (map) {
            map.setCenter(location);
            new google.maps.Marker({
              position: location,
              map: map,
              title: '我的位置',
              icon: {
                url: 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20fill%3D%22%234285f4%22%20d%3D%22M12%202C8.13%202%205%205.13%205%209c0%205.25%207%2013%207%2013s7-7.75%207-13c0-3.87-3.13-7-7-7zm0%209.5c-1.38%200-2.5-1.12-2.5-2.5s1.12-2.5%202.5-2.5%202.5%201.12%202.5%202.5-1.12%202.5-2.5%202.5z%22/%3E%3C/svg%3E',
                scaledSize: new google.maps.Size(24, 24),
              },
            });
          }
        },
        (error) => {
          console.warn('Error getting current location:', error);
        }
      );
    }
  }, [map]);

  // 搜索地点
  const searchPlaces = useCallback(() => {
    if (!placesService || !searchQuery.trim()) return;

    const request: google.maps.places.TextSearchRequest = {
      query: searchQuery,
      bounds: map?.getBounds(),
    };

    placesService.textSearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        setSearchResults(results);
        
        // 清除之前的标记
        // 这里可以添加标记管理逻辑
        
        // 在地图上显示搜索结果
        results.forEach((place, index) => {
          if (place.geometry?.location && map) {
            const marker = new google.maps.Marker({
              position: place.geometry.location,
              map: map,
              title: place.name,
              label: (index + 1).toString(),
            });

            marker.addListener('click', () => {
              getPlaceDetails(place.place_id || '');
            });
          }
        });

        // 调整地图视图以显示所有结果
        if (results.length > 0) {
          const bounds = new google.maps.LatLngBounds();
          results.forEach(place => {
            if (place.geometry?.location) {
              bounds.extend(place.geometry.location);
            }
          });
          map?.fitBounds(bounds);
        }
      }
    });
  }, [placesService, searchQuery, map]);

  // 获取地点详细信息
  const getPlaceDetails = useCallback((placeId: string) => {
    if (!placesService) return;

    const request: google.maps.places.PlaceDetailsRequest = {
      placeId: placeId,
      fields: [
        'place_id',
        'name',
        'formatted_address',
        'rating',
        'price_level',
        'photos',
        'formatted_phone_number',
        'website',
        'opening_hours',
        'types',
      ],
    };

    placesService.getDetails(request, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        setSelectedPlace({
          place_id: place.place_id || '',
          name: place.name || '',
          formatted_address: place.formatted_address || '',
          rating: place.rating,
          price_level: place.price_level,
          photos: place.photos,
          phone_number: place.formatted_phone_number,
          website: place.website,
          opening_hours: place.opening_hours,
          types: place.types || [],
        });
        setPlaceDetailsDialog(true);
      }
    });
  }, [placesService]);

  // 计算路线
  const calculateRoute = useCallback(() => {
    if (!directionsService || !directionsRenderer || !origin || !destination) {
      setError('Please enter both origin and destination');
      return;
    }

    const request: google.maps.DirectionsRequest = {
      origin: origin,
      destination: destination,
      travelMode: google.maps.TravelMode[travelMode],
      unitSystem: google.maps.UnitSystem.METRIC,
      avoidHighways: false,
      avoidTolls: false,
    };

    directionsService.route(request, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK && result) {
        directionsRenderer.setDirections(result);
        setError(null);
      } else {
        setError('Could not calculate route: ' + status);
      }
    });
  }, [directionsService, directionsRenderer, origin, destination, travelMode]);

  // 获取出行方式图标
  const getTravelModeIcon = (mode: TravelMode) => {
    switch (mode) {
      case 'DRIVING':
        return <DirectionsCar />;
      case 'WALKING':
        return <DirectionsWalk />;
      case 'TRANSIT':
        return <DirectionsTransit />;
      case 'BICYCLING':
        return <DirectionsBike />;
      default:
        return <DirectionsCar />;
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading Google Maps...
        </Typography>
      </Box>
    );
  }

  if (error && !map) {
    return (
      <Alert severity="error" sx={{ margin: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box className={className} sx={{ position: 'relative', height: '100%' }}>
      {/* 搜索和控制面板 */}
      <Paper
        elevation={3}
        sx={{
          position: 'absolute',
          top: 10,
          left: 10,
          right: 10,
          zIndex: 1000,
          p: 2,
        }}
      >
        <Grid container spacing={2} alignItems="center">
          {/* 地点搜索 */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              label="搜索地点"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchPlaces()}
              InputProps={{
                endAdornment: (
                  <IconButton size="small" onClick={searchPlaces}>
                    <Search />
                  </IconButton>
                ),
              }}
            />
          </Grid>

          {/* 路线规划 */}
          <Grid item xs={12} md={6}>
            <Grid container spacing={1}>
              <Grid item xs={5}>
                <TextField
                  fullWidth
                  size="small"
                  label="起点"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                />
              </Grid>
              <Grid item xs={5}>
                <TextField
                  fullWidth
                  size="small"
                  label="终点"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </Grid>
              <Grid item xs={2}>
                <Button
                  fullWidth
                  variant="contained"
                  size="small"
                  onClick={calculateRoute}
                  startIcon={<Navigation />}
                >
                  导航
                </Button>
              </Grid>
            </Grid>
          </Grid>

          {/* 出行方式选择 */}
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>出行方式</InputLabel>
              <Select
                value={travelMode}
                onChange={(e) => setTravelMode(e.target.value as TravelMode)}
                label="出行方式"
              >
                <MenuItem value="DRIVING">
                  <Box display="flex" alignItems="center">
                    <DirectionsCar sx={{ mr: 1 }} />
                    驾车
                  </Box>
                </MenuItem>
                <MenuItem value="WALKING">
                  <Box display="flex" alignItems="center">
                    <DirectionsWalk sx={{ mr: 1 }} />
                    步行
                  </Box>
                </MenuItem>
                <MenuItem value="TRANSIT">
                  <Box display="flex" alignItems="center">
                    <DirectionsTransit sx={{ mr: 1 }} />
                    公交
                  </Box>
                </MenuItem>
                <MenuItem value="BICYCLING">
                  <Box display="flex" alignItems="center">
                    <DirectionsBike sx={{ mr: 1 }} />
                    骑行
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </Paper>

      {/* 地图容器 */}
      <Box
        ref={mapRef}
        sx={{
          width: '100%',
          height: '100%',
          minHeight: '400px',
        }}
      />

      {/* 当前位置按钮 */}
      <Fab
        color="primary"
        size="small"
        onClick={getCurrentLocation}
        sx={{
          position: 'absolute',
          bottom: 120,
          right: 16,
          zIndex: 1000,
        }}
      >
        <MyLocation />
      </Fab>

      {/* 路线信息面板 */}
      {routeInfo && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            maxWidth: 300,
            zIndex: 1000,
            p: 2,
          }}
        >
          <Typography variant="h6" gutterBottom>
            路线信息
          </Typography>
          <Box display="flex" alignItems="center" mb={1}>
            {getTravelModeIcon(travelMode)}
            <Typography variant="body1" sx={{ ml: 1 }}>
              {routeInfo.distance} · {routeInfo.duration}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            点击路线查看详细步骤
          </Typography>
        </Paper>
      )}

      {/* 搜索结果列表 */}
      {searchResults.length > 0 && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: 120,
            right: 10,
            width: 300,
            maxHeight: 400,
            zIndex: 1000,
            overflow: 'auto',
          }}
        >
          <Typography variant="h6" sx={{ p: 2, pb: 1 }}>
            搜索结果
          </Typography>
          <List dense>
            {searchResults.map((place, index) => (
              <ListItem
                key={place.place_id}
                button
                onClick={() => place.place_id && getPlaceDetails(place.place_id)}
              >
                <ListItemText
                  primary={place.name}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {place.formatted_address}
                      </Typography>
                      {place.rating && (
                        <Box display="flex" alignItems="center" mt={0.5}>
                          <Star sx={{ fontSize: 16, color: 'gold' }} />
                          <Typography variant="body2" sx={{ ml: 0.5 }}>
                            {place.rating}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* 地点详情对话框 */}
      <Dialog
        open={placeDetailsDialog}
        onClose={() => setPlaceDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">{selectedPlace?.name}</Typography>
            <IconButton onClick={() => setPlaceDetailsDialog(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedPlace && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="body1" gutterBottom>
                  <Place sx={{ verticalAlign: 'middle', mr: 1 }} />
                  {selectedPlace.formatted_address}
                </Typography>
              </Grid>

              {selectedPlace.rating && (
                <Grid item xs={6}>
                  <Box display="flex" alignItems="center">
                    <Star sx={{ color: 'gold', mr: 1 }} />
                    <Typography variant="body1">
                      {selectedPlace.rating} / 5
                    </Typography>
                  </Box>
                </Grid>
              )}

              {selectedPlace.price_level !== undefined && (
                <Grid item xs={6}>
                  <Typography variant="body1">
                    价格水平: {'¥'.repeat(selectedPlace.price_level + 1)}
                  </Typography>
                </Grid>
              )}

              {selectedPlace.phone_number && (
                <Grid item xs={12}>
                  <Typography variant="body1">
                    <Phone sx={{ verticalAlign: 'middle', mr: 1 }} />
                    {selectedPlace.phone_number}
                  </Typography>
                </Grid>
              )}

              {selectedPlace.website && (
                <Grid item xs={12}>
                  <Typography variant="body1">
                    <Language sx={{ verticalAlign: 'middle', mr: 1 }} />
                    <a href={selectedPlace.website} target="_blank" rel="noopener noreferrer">
                      官方网站
                    </a>
                  </Typography>
                </Grid>
              )}

              {selectedPlace.opening_hours && (
                <Grid item xs={12}>
                  <Typography variant="body1" gutterBottom>
                    <Schedule sx={{ verticalAlign: 'middle', mr: 1 }} />
                    营业时间:
                  </Typography>
                  {selectedPlace.opening_hours.weekday_text?.map((text, index) => (
                    <Typography key={index} variant="body2" sx={{ ml: 3 }}>
                      {text}
                    </Typography>
                  ))}
                </Grid>
              )}

              <Grid item xs={12}>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {selectedPlace.types.map((type) => (
                    <Chip key={type} label={type.replace(/_/g, ' ')} size="small" />
                  ))}
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlaceDetailsDialog(false)}>
            关闭
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedPlace) {
                setDestination(selectedPlace.formatted_address);
                setPlaceDetailsDialog(false);
              }
            }}
          >
            设为目的地
          </Button>
        </DialogActions>
      </Dialog>

      {/* 路线步骤面板 */}
      <div id="directions-panel" style={{ display: 'none' }} />
    </Box>
  );
};

export default MapView;