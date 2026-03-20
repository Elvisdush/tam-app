import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

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
  calculateRoute: (origin: LocationData, destination: LocationData) => Promise<RouteData | null>;
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
            
            const locationData: LocationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: new Date().toISOString()
            };
            
            // Try to get address using reverse geocoding API
            try {
              const response = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`
              );
              const data = await response.json();
              
              if (data && (data.locality || data.city || data.principalSubdivision)) {
                locationData.address = `${data.locality || data.city || ''} ${data.principalSubdivision || ''}`.trim();
              }
            } catch (error) {
              console.log('Web reverse geocoding failed:', error);
            }
            
            set({ currentLocation: locationData });
            return locationData;
          } else {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            
            const locationData: LocationData = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              timestamp: new Date().toISOString()
            };
            
            // Try to get address
            try {
              const [address] = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });
              
              if (address) {
                locationData.address = `${address.street || ''} ${address.city || ''} ${address.region || ''}`.trim();
              }
            } catch (error) {
              console.log('Reverse geocoding failed:', error);
            }
            
            set({ currentLocation: locationData });
            return locationData;
          }
        } catch (error) {
          console.log('Get current location error:', error);
          return null;
        }
      },
      
      startLocationTracking: async () => {
        const { locationPermission } = get();
        if (!locationPermission) {
          const granted = await get().requestLocationPermission();
          if (!granted) return;
        }
        
        set({ isTrackingLocation: true });
        
        if (Platform.OS === 'web') {
          const watchId = navigator.geolocation.watchPosition(
            async (position) => {
              const locationData: LocationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timestamp: new Date().toISOString()
              };
              
              // Try to get address using reverse geocoding API for web tracking
              try {
                const response = await fetch(
                  `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`
                );
                const data = await response.json();
                
                if (data && (data.locality || data.city || data.principalSubdivision)) {
                  locationData.address = `${data.locality || data.city || ''} ${data.principalSubdivision || ''}`.trim();
                }
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
            await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.High,
                timeInterval: 5000,
                distanceInterval: 10,
              },
              async (location) => {
                const locationData: LocationData = {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  timestamp: new Date().toISOString()
                };
                
                // Try to get address for mobile tracking
                try {
                  const [address] = await Location.reverseGeocodeAsync({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                  });
                  
                  if (address) {
                    locationData.address = `${address.street || ''} ${address.city || ''} ${address.region || ''}`.trim();
                  }
                } catch (error) {
                  console.log('Mobile reverse geocoding failed:', error);
                }
                
                set({ currentLocation: locationData });
              }
            );
          } catch (error) {
            console.log('Location tracking error:', error);
            set({ isTrackingLocation: false });
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
      
      calculateRoute: async (origin: LocationData, destination: LocationData) => {
        set({ isCalculatingRoute: true });
        
        try {
          const apiKey = 'AIzaSyCEmqLGnM67YcXjxkfbJaOICB3-dodxj4U';
          const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
          
          const requestBody = {
            origin: {
              location: {
                latLng: {
                  latitude: origin.latitude,
                  longitude: origin.longitude
                }
              }
            },
            destination: {
              location: {
                latLng: {
                  latitude: destination.latitude,
                  longitude: destination.longitude
                }
              }
            },
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE',
            computeAlternativeRoutes: false,
            routeModifiers: {
              avoidTolls: false,
              avoidHighways: false,
              avoidFerries: false
            },
            languageCode: 'en-US',
            units: 'METRIC'
          };
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration'
            },
            body: JSON.stringify(requestBody)
          });
          
          const data = await response.json();
          
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const distanceKm = (route.distanceMeters / 1000).toFixed(1);
            const durationSeconds = parseInt(route.duration.replace('s', ''));
            const durationMinutes = Math.ceil(durationSeconds / 60);
            const durationText = durationMinutes >= 60 
              ? `${Math.floor(durationMinutes / 60)} hr ${durationMinutes % 60} min`
              : `${durationMinutes} min`;
            
            const steps = route.legs?.[0]?.steps?.map((step: any) => {
              const instr = step.navigationInstruction?.instructions;
              const instructionText = typeof instr === 'string' ? instr : (instr?.text ?? 'Continue');
              return {
              instruction: instructionText,
              distance: `${(step.distanceMeters / 1000).toFixed(1)} km`,
              duration: `${Math.ceil(parseInt(step.staticDuration?.replace('s', '') || '0') / 60)} min`
            };
            }) || [
              {
                instruction: `Head toward ${destination.address || 'destination'}`,
                distance: `${distanceKm} km`,
                duration: durationText
              }
            ];
            
            const routeData: RouteData = {
              distance: `${distanceKm} km`,
              duration: durationText,
              polyline: route.polyline?.encodedPolyline || '',
              steps: steps
            };
            
            set({ currentRoute: routeData, isCalculatingRoute: false });
            return routeData;
          } else {
            const distanceKm = calculateDistanceHelper(origin.latitude, origin.longitude, destination.latitude, destination.longitude).toFixed(1);
            const durationMinutes = Math.ceil((parseFloat(distanceKm) / 40) * 60);
            const durationText = durationMinutes >= 60 
              ? `${Math.floor(durationMinutes / 60)} hr ${durationMinutes % 60} min`
              : `${durationMinutes} min`;
            
            const simulatedRoute: RouteData = {
              distance: `${distanceKm} km`,
              duration: durationText,
              polyline: 'simulated_polyline_data',
              steps: [
                {
                  instruction: `Head toward ${destination.address || 'destination'}`,
                  distance: `${distanceKm} km`,
                  duration: durationText
                }
              ]
            };
            
            set({ currentRoute: simulatedRoute, isCalculatingRoute: false });
            return simulatedRoute;
          }
        } catch (error) {
          console.log('Route calculation error:', error);
          
          const distanceKm = calculateDistanceHelper(origin.latitude, origin.longitude, destination.latitude, destination.longitude).toFixed(1);
          const durationMinutes = Math.ceil((parseFloat(distanceKm) / 40) * 60);
          const durationText = durationMinutes >= 60 
            ? `${Math.floor(durationMinutes / 60)} hr ${durationMinutes % 60} min`
            : `${durationMinutes} min`;
          
          const simulatedRoute: RouteData = {
            distance: `${distanceKm} km`,
            duration: durationText,
            polyline: 'simulated_polyline_data',
            steps: [
              {
                instruction: `Head toward ${destination.address || 'destination'}`,
                distance: `${distanceKm} km`,
                duration: durationText
              }
            ]
          };
          
          set({ currentRoute: simulatedRoute, isCalculatingRoute: false });
          return simulatedRoute;
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
      name: 'location-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sharedLocations: state.sharedLocations,
        locationPermission: state.locationPermission,
        currentRoute: state.currentRoute,
      }),
    }
  )
);