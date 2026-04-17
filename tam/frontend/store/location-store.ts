import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import {
  fetchBigDataCloudReverseGeo,
  formatPlaceLineWithSectorFromBdc,
} from '@/lib/reverse-geocode-net';
import { fetchOsrmDrivingRoute } from '@/lib/osrm-route';
import { getRoadHazardsForRouting } from '@/store/road-hazards-store';

/** Native watch subscription — must be removed to avoid duplicate watches and permission errors */
let nativeLocationSubscription: Location.LocationSubscription | null = null;

/** After one failed system geocoder call, skip it (watch fires often; avoids repeated UNAVAILABLE work). */
let nativeSystemGeocoderUnavailable = false;

let lastNetworkGeocodeAt = 0;
let lastNetworkAddress: string | undefined;
const NETWORK_REVERSE_GEOCODE_MIN_MS = 120_000; // Increased from 45s to 2min

/**
 * Human-readable place line for current coordinates.
 * Android: skip Expo reverseGeocodeAsync entirely — the system Geocoder often returns UNAVAILABLE and Expo still logs native rejections.
 * iOS: try system geocoder first, then HTTP fallback.
 */
function coordFallback(latitude: number, longitude: number): string {
  const coords = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  lastNetworkGeocodeAt = Date.now();
  lastNetworkAddress = coords;
  return coords;
}

async function reverseGeocodeAddress(latitude: number, longitude: number): Promise<string | undefined> {
  try {
    const useIosSystemGeocoder = Platform.OS === 'ios';

    if (useIosSystemGeocoder && !nativeSystemGeocoderUnavailable) {
      try {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        const address = results[0];
        if (address) {
          const line = `${address.street || ''} ${address.city || ''} ${address.region || ''}`.trim();
          if (line) {
            const now = Date.now();
            if (
              now - lastNetworkGeocodeAt < NETWORK_REVERSE_GEOCODE_MIN_MS &&
              lastNetworkAddress !== undefined
            ) {
              return lastNetworkAddress;
            }
            const data = await fetchBigDataCloudReverseGeo(latitude, longitude);
            const rich = data ? formatPlaceLineWithSectorFromBdc(data) : undefined;
            if (rich) {
              lastNetworkGeocodeAt = now;
              lastNetworkAddress = rich;
              return rich;
            }
            return line;
          }
        }
      } catch {
        nativeSystemGeocoderUnavailable = true;
      }
    }

    const now = Date.now();
    if (
      now - lastNetworkGeocodeAt < NETWORK_REVERSE_GEOCODE_MIN_MS &&
      lastNetworkAddress !== undefined
    ) {
      return lastNetworkAddress;
    }

    const data = await fetchBigDataCloudReverseGeo(latitude, longitude);
    if (data) {
      const line = formatPlaceLineWithSectorFromBdc(data);
      if (line) {
        lastNetworkGeocodeAt = now;
        lastNetworkAddress = line;
        return line;
      }
    }

    return coordFallback(latitude, longitude);
  } catch (e) {
    console.warn('[location] reverseGeocodeAddress failed', e);
    return coordFallback(latitude, longitude);
  }
}

function parseGoogleDurationSeconds(duration: unknown): number {
  if (typeof duration === 'string') {
    return parseInt(duration.replace(/s$/i, ''), 10) || 0;
  }
  if (duration && typeof duration === 'object' && 'seconds' in duration) {
    return parseInt(String((duration as { seconds: string }).seconds), 10) || 0;
  }
  return 0;
}

const calculateDistanceHelper = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export interface LocationData {
  latitude: number;
  longitude: number;
  /** GPS horizontal accuracy in meters (when provided by the OS) */
  accuracyMeters?: number;
  /** Human-readable line (includes sector when available from reverse geocode) */
  address?: string;
  timestamp: string;
}

export interface RouteData {
  distance: string;
  duration: string;
  polyline: string;
  steps: {
    instruction: string;
    distance: string;
    duration: string;
  }[];

}

export interface SharedLocation {
  id: string;
  senderId: string;
  receiverId: string;
  location: LocationData;
  isActive: boolean;
}

interface LocationState {
  currentLocation: LocationData | null;
  sharedLocations: SharedLocation[];
  isTrackingLocation: boolean;
  locationPermission: boolean;
  currentRoute: RouteData | null;
  isCalculatingRoute: boolean;
  
  requestLocationPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<LocationData | null>;
  startLocationTracking: () => Promise<void>;
  stopLocationTracking: () => void;
  shareLocation: (receiverId: string, senderId?: string) => Promise<string | null>;
  addSharedLocation: (sharedLocation: SharedLocation) => void;
  removeSharedLocation: (id: string) => void;
  updateCurrentLocation: (location: LocationData) => void;
  calculateRoute: (
    origin: LocationData,
    destination: LocationData,
    options?: { persistToStore?: boolean }
  ) => Promise<RouteData | null>;
  clearRoute: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      currentLocation: null,
      sharedLocations: [],
      isTrackingLocation: false,
      locationPermission: false,
      currentRoute: null,
      isCalculatingRoute: false,
      
      requestLocationPermission: async () => {
        if (Platform.OS === 'web') {
          try {
            await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject);
            });
            set({ locationPermission: true });
            return true;
          } catch (error) {
            console.log('Web geolocation permission denied:', error);
            set({ locationPermission: false });
            return false;
          }
        }
        
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          const granted = status === 'granted';
          set({ locationPermission: granted });
          return granted;
        } catch (error) {
          console.log('Location permission error:', error);
          set({ locationPermission: false });
          return false;
        }
      },
      
      getCurrentLocation: async () => {
        const { locationPermission } = get();
        if (!locationPermission) {
          const granted = await get().requestLocationPermission();
          if (!granted) return null;
        }
        
        try {
          if (Platform.OS === 'web') {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
              });
            });
            
            const acc = position.coords.accuracy;
            const locationData: LocationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: new Date().toISOString(),
              ...(typeof acc === 'number' && Number.isFinite(acc) ? { accuracyMeters: acc } : {}),
            };
            
            // Try to get address using reverse geocoding API
            try {
              const data = await fetchBigDataCloudReverseGeo(
                position.coords.latitude,
                position.coords.longitude
              );
              const line = data ? formatPlaceLineWithSectorFromBdc(data) : undefined;
              if (line) locationData.address = line;
            } catch (error) {
              console.log('Web reverse geocoding failed:', error);
            }
            
            set({ currentLocation: locationData });
            return locationData;
          } else {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            
            const acc = location.coords.accuracy;
            const locationData: LocationData = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              timestamp: new Date().toISOString(),
              ...(typeof acc === 'number' && Number.isFinite(acc) ? { accuracyMeters: acc } : {}),
            };
            
            const addr = await reverseGeocodeAddress(location.coords.latitude, location.coords.longitude);
            if (addr) locationData.address = addr;
            
            set({ currentLocation: locationData });
            return locationData;
          }
        } catch (error) {
          console.log('Get current location error:', error);
          return null;
        }
      },
      
      startLocationTracking: async () => {
        if (Platform.OS !== 'web') {
          const existing = await Location.getForegroundPermissionsAsync();
          let granted = existing.status === 'granted';
          if (!granted) {
            const req = await Location.requestForegroundPermissionsAsync();
            granted = req.status === 'granted';
          }
          set({ locationPermission: granted });
          if (!granted) {
            return;
          }
          if (nativeLocationSubscription) {
            return;
          }
        } else {
          const { locationPermission } = get();
          if (!locationPermission) {
            const ok = await get().requestLocationPermission();
            if (!ok) return;
          }
        }

        set({ isTrackingLocation: true });

        if (Platform.OS === 'web') {
          const watchId = navigator.geolocation.watchPosition(
            async (position) => {
              const acc = position.coords.accuracy;
              const locationData: LocationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timestamp: new Date().toISOString(),
                ...(typeof acc === 'number' && Number.isFinite(acc) ? { accuracyMeters: acc } : {}),
              };
              
              // Try to get address using reverse geocoding API for web tracking
              try {
                const data = await fetchBigDataCloudReverseGeo(
                  position.coords.latitude,
                  position.coords.longitude
                );
                const line = data ? formatPlaceLineWithSectorFromBdc(data) : undefined;
                if (line) locationData.address = line;
              } catch (error) {
                console.log('Web reverse geocoding failed:', error);
              }
              
              set({ currentLocation: locationData });
            },
            (error) => console.log('Location tracking error:', error),
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 5000
            }
          );
          
          // Store watchId for cleanup
          (get() as any).webWatchId = watchId;
        } else {
          try {
            // One sharp fix so the map can zoom to the user immediately (watch may start slower).
            try {
              const snap = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Highest,
              });
              const sAcc = snap.coords.accuracy;
              const snapData: LocationData = {
                latitude: snap.coords.latitude,
                longitude: snap.coords.longitude,
                timestamp: new Date().toISOString(),
                ...(typeof sAcc === 'number' && Number.isFinite(sAcc) ? { accuracyMeters: sAcc } : {}),
              };
              const addr = await reverseGeocodeAddress(snap.coords.latitude, snap.coords.longitude);
              if (addr) snapData.address = addr;
              set({ currentLocation: snapData });
            } catch {
              /* watch below will still populate */
            }

            nativeLocationSubscription = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.Highest,
                timeInterval: 2500,
                distanceInterval: 5,
              },
              async (location) => {
                const acc = location.coords.accuracy;
                const locationData: LocationData = {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  timestamp: new Date().toISOString(),
                  ...(typeof acc === 'number' && Number.isFinite(acc) ? { accuracyMeters: acc } : {}),
                };
                
                const addr = await reverseGeocodeAddress(
                  location.coords.latitude,
                  location.coords.longitude
                );
                if (addr) locationData.address = addr;
                
                set({ currentLocation: locationData });
              }
            );
          } catch (error) {
            console.log('Location tracking error:', error);
            set({ isTrackingLocation: false, locationPermission: false });
            nativeLocationSubscription = null;
          }
        }
      },
      
      stopLocationTracking: () => {
        set({ isTrackingLocation: false });
        
        if (Platform.OS === 'web') {
          const watchId = (get() as any).webWatchId;
          if (watchId) {
            navigator.geolocation.clearWatch(watchId);
          }
        } else {
          nativeLocationSubscription?.remove();
          nativeLocationSubscription = null;
        }
      },
      
      shareLocation: async (receiverId: string, senderId?: string) => {
        const location = await get().getCurrentLocation();
        if (!location) return null;
        
        const sharedLocationId = `location_${Date.now()}`;
        const actualSenderId = senderId || 'current_user';
        const sharedLocation: SharedLocation = {
          id: sharedLocationId,
          senderId: actualSenderId,
          receiverId,
          location,
          isActive: true
        };
        
        get().addSharedLocation(sharedLocation);
        
        // Create deep link
        const deepLink = `taxiapp://location?id=${sharedLocationId}&lat=${location.latitude}&lng=${location.longitude}&sender=${actualSenderId}&receiver=${receiverId}`;
        return deepLink;
      },
      
      addSharedLocation: (sharedLocation) => {
        set(state => ({
          sharedLocations: [...state.sharedLocations, sharedLocation]
        }));
      },
      
      removeSharedLocation: (id) => {
        set(state => ({
          sharedLocations: state.sharedLocations.filter(loc => loc.id !== id)
        }));
      },
      
      updateCurrentLocation: (location) => {
        set({ currentLocation: location });
      },
      
      calculateRoute: async (
        origin: LocationData,
        destination: LocationData,
        options?: { persistToStore?: boolean }
      ) => {
        const persistToStore = options?.persistToStore !== false;

        const applyRouteToStore = (routeData: RouteData) => {
          if (persistToStore) {
            set({ currentRoute: routeData, isCalculatingRoute: false });
          }
        };

        if (persistToStore) {
          set({ isCalculatingRoute: true });
        }

        const buildStraightLineFallback = (): RouteData => {
          const distanceKm = calculateDistanceHelper(
            origin.latitude,
            origin.longitude,
            destination.latitude,
            destination.longitude
          ).toFixed(1);
          const durationMinutes = Math.ceil((parseFloat(distanceKm) / 40) * 60);
          const durationText =
            durationMinutes >= 60
              ? `${Math.floor(durationMinutes / 60)} hr ${durationMinutes % 60} min`
              : `${durationMinutes} min`;
          return {
            distance: `${distanceKm} km`,
            duration: durationText,
            polyline: 'simulated_polyline_data',
            steps: [
              {
                instruction: `Head toward ${destination.address || 'destination'}`,
                distance: `${distanceKm} km`,
                duration: durationText,
              },
            ],
          };
        };

        const applyOsrmIfPossible = async (): Promise<RouteData | null> => {
          const hazards = getRoadHazardsForRouting();
          const osrm = await fetchOsrmDrivingRoute(
            origin.latitude,
            origin.longitude,
            destination.latitude,
            destination.longitude,
            hazards.length > 0 ? { hazardsToScore: hazards } : undefined
          );
          if (!osrm?.encodedPolyline) return null;
          return {
            distance: osrm.distanceLabel,
            duration: osrm.durationText,
            polyline: osrm.encodedPolyline,
            steps: osrm.steps,
          };
        };

        try {
          // Use OSRM first for better performance and reliability
          const osrm = await applyOsrmIfPossible();
          if (osrm) {
            applyRouteToStore(osrm);
            return osrm;
          }

          // Fallback to Google Routes with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
          
          const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCEmqLGnM67YcXjxkfbJaOICB3-dodxj4U';
          const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

          const requestBody = {
            origin: {
              location: {
                latLng: {
                  latitude: origin.latitude,
                  longitude: origin.longitude,
                },
              },
            },
            destination: {
              location: {
                latLng: {
                  latitude: destination.latitude,
                  longitude: destination.longitude,
                },
              },
            },
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE',
            polylineQuality: 'HIGH_QUALITY',
            computeAlternativeRoutes: false,
            routeModifiers: {
              avoidTolls: false,
              avoidHighways: false,
              avoidFerries: false,
            },
            languageCode: 'en-US',
            units: 'METRIC',
          };

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask':
                'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const data = await response.json();

          if (!response.ok || (data as { error?: unknown }).error) {
            if (__DEV__) {
              console.warn(
                'Routes API did not return OK:',
                !response.ok ? response.status : '',
                (data as { error?: unknown }).error ?? data
              );
            }
            const osrm = await applyOsrmIfPossible();
            const routeData = osrm ?? buildStraightLineFallback();
            applyRouteToStore(routeData);
            return routeData;
          }

          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0] as {
              distanceMeters?: number;
              duration?: string;
              polyline?: { encodedPolyline?: string };
            };
            const distanceKm = ((route.distanceMeters ?? 0) / 1000).toFixed(1);
            const durationSeconds = parseGoogleDurationSeconds(route.duration);
            const durationMinutes = Math.ceil(durationSeconds / 60);
            const durationText =
              durationMinutes >= 60
                ? `${Math.floor(durationMinutes / 60)} hr ${durationMinutes % 60} min`
                : `${durationMinutes} min`;

            const steps =
              (route as { legs?: { steps?: any[] }[] }).legs?.[0]?.steps?.map((step: any) => {
                const instr = step.navigationInstruction?.instructions;
                const instructionText =
                  typeof instr === 'string' ? instr : (instr?.text ?? 'Continue');
                const dm = Math.max(0, Number(step.distanceMeters) || 0);
                const distanceLabel =
                  dm < 1000 ? `${Math.round(dm)} m` : `${(dm / 1000).toFixed(1)} km`;
                return {
                  instruction: instructionText,
                  distance: distanceLabel,
                  duration: `${Math.ceil(parseInt(String(step.staticDuration ?? '0s').replace(/s$/i, ''), 10) / 60)} min`,
                };
              }) ?? [];

            const encoded =
              route.polyline?.encodedPolyline?.trim() ||
              (route.polyline as { encoded_polyline?: string } | undefined)?.encoded_polyline?.trim();

            if (!encoded) {
              const osrm = await applyOsrmIfPossible();
              const routeData = osrm ?? buildStraightLineFallback();
              applyRouteToStore(routeData);
              return routeData;
            }

            const routeData: RouteData = {
              distance: `${distanceKm} km`,
              duration: durationText,
              polyline: encoded,
              steps:
                steps.length > 0
                  ? steps
                  : [
                      {
                        instruction: `Head toward ${destination.address || 'destination'}`,
                        distance: `${distanceKm} km`,
                        duration: durationText,
                      },
                    ],
            };

            applyRouteToStore(routeData);
            return routeData;
          }

          const fallbackOsrm = await applyOsrmIfPossible();
          const routeData = fallbackOsrm ?? buildStraightLineFallback();
          applyRouteToStore(routeData);
          return routeData;
        } catch (error) {
          if (__DEV__) {
            console.log('Route calculation error:', error);
          }
          const errorOsrm = await applyOsrmIfPossible();
          const routeData = errorOsrm ?? buildStraightLineFallback();
          applyRouteToStore(routeData);
          return routeData;
        }
      },
      
      calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      },
      
      clearRoute: () => {
        set({ currentRoute: null });
      },
    }),
    {
      name: 'location-storage-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sharedLocations: state.sharedLocations,
        currentRoute: state.currentRoute,
      }),
    }
  )
);