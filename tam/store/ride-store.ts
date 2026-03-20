import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, push, set as firebaseSet, update as firebaseUpdate, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import { Ride, LiveLocation } from '@/types/ride';

interface RideState {
  rides: Ride[];
  searchResults: Ride[];
  lastSearchParams: {
    from: string;
    to: string;
    price?: number;
    transportType: 'car' | 'motorbike';
  } | null;
  searchRides: (from: string, to: string, price?: number, transportType?: 'car' | 'motorbike') => void;
  getNearbyAvailableDrivers: (userLat: number, userLng: number, radiusKm?: number) => { moto: Ride[]; car: Ride[] };
  addRide: (ride: Omit<Ride, 'id'>) => Promise<void>;
  acceptRide: (rideId: number | string) => Promise<void>;
  loadRides: () => void;
  updateDriverLocation: (rideId: number, location: LiveLocation) => Promise<void>;
  updatePassengerLocation: (rideId: number, location: LiveLocation) => Promise<void>;
  subscribeToRideLocations: (rideId: number, callback: (ride: Ride) => void) => () => void;
}

export const useRideStore = create<RideState>()(
  persist(
    (set, get) => ({
      rides: [],
      searchResults: [],
      lastSearchParams: null,
      
      loadRides: () => {
        const ridesRef = ref(database, 'rides');
        onValue(ridesRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const ridesArray = Object.keys(data).map(key => ({
              ...data[key],
              id: /^-?\d+$/.test(key) ? parseInt(key, 10) : key,
              firebaseKey: key
            }));
            set({ rides: ridesArray });
          } else {
            set({ rides: [] });
          }
        });
      },
      
      searchRides: (from, to, price, transportType = 'motorbike') => {
        const rides = get().rides;
        const currentUser = (window as any).__authStore?.getState()?.user;
        
        set({ 
          lastSearchParams: { from, to, price, transportType }
        });
        
        let results = rides.filter(ride => {
          if (!ride.from || !ride.to) return false;
          
          const matchesLocation = ride.from.toLowerCase().includes(from.toLowerCase()) &&
            ride.to.toLowerCase().includes(to.toLowerCase());
          const matchesTransport = transportType ? ride.transportType === transportType : true;
          
          const now = new Date().getTime();
          const createdAt = new Date(ride.createdAt).getTime();
          const thirtyMinutes = 30 * 60 * 1000;
          const isExpired = (now - createdAt) > thirtyMinutes;
          
          if (isExpired) return false;
          
          if (currentUser?.type === 'driver') {
            return matchesLocation && matchesTransport && ride.passengerId !== null;
          } else if (currentUser?.type === 'passenger') {
            return matchesLocation && matchesTransport && ride.driverId !== null;
          }
          
          return matchesLocation && matchesTransport;
        });
        
        if (price) {
          results = results.sort((a, b) => 
            Math.abs(a.price - price) - Math.abs(b.price - price)
          );
        }
        
        set({ searchResults: results });
      },

      getNearbyAvailableDrivers: (userLat, userLng, radiusKm = 15) => {
        const rides = get().rides;
        const R = 6371;
        const toRad = (deg: number) => deg * Math.PI / 180;
        const distance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        };

        const now = Date.now();
        const thirtyMinutes = 30 * 60 * 1000;
        const available = rides.filter(ride => {
          if (ride.driverId == null || ride.passengerId != null) return false;
          const createdAt = new Date(ride.createdAt).getTime();
          if (now - createdAt > thirtyMinutes) return false;
          const lat = ride.pickupLocation?.latitude ?? ride.driverLocation?.latitude;
          const lng = ride.pickupLocation?.longitude ?? ride.driverLocation?.longitude;
          if (lat == null || lng == null) return false;
          return distance(userLat, userLng, lat, lng) <= radiusKm;
        });

        const withDist = available.map(ride => {
          const lat = ride.pickupLocation?.latitude ?? ride.driverLocation?.latitude!;
          const lng = ride.pickupLocation?.longitude ?? ride.driverLocation?.longitude!;
          return { ride, dist: distance(userLat, userLng, lat, lng) };
        }).sort((a, b) => a.dist - b.dist);

        return {
          moto: withDist.filter(d => d.ride.transportType === 'motorbike').map(d => d.ride),
          car: withDist.filter(d => d.ride.transportType === 'car').map(d => d.ride),
        };
      },
      
      addRide: async (ride) => {
        try {
          const ridesRef = ref(database, 'rides');
          const newRideRef = push(ridesRef);
          
          await firebaseSet(newRideRef, ride);
          
          get().loadRides();
        } catch (error) {
          console.error('Error adding ride:', error);
        }
      },
      
      acceptRide: async (rideId) => {
        try {
          const key = typeof rideId === 'string' ? rideId : String(rideId);
          await firebaseUpdate(ref(database, `rides/${key}`), {
            status: 'accepted'
          });
          
          get().loadRides();
        } catch (error) {
          console.error('Error accepting ride:', error);
        }
      },

      updateDriverLocation: async (rideId, location) => {
        try {
          const key = typeof rideId === 'number' && !Number.isNaN(rideId) ? String(rideId) : rideId;
          await firebaseUpdate(ref(database, `rides/${key}`), {
            driverLocation: location
          });
        } catch (error) {
          console.error('Error updating driver location:', error);
        }
      },

      updatePassengerLocation: async (rideId, location) => {
        try {
          const key = typeof rideId === 'number' && !Number.isNaN(rideId) ? String(rideId) : rideId;
          await firebaseUpdate(ref(database, `rides/${key}`), {
            passengerLocation: location
          });
        } catch (error) {
          console.error('Error updating passenger location:', error);
        }
      },

      subscribeToRideLocations: (rideId, callback) => {
        const key = typeof rideId === 'number' && !Number.isNaN(rideId) ? String(rideId) : rideId;
        const rideRef = ref(database, `rides/${key}`);
        const unsubscribe = onValue(rideRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const ride: Ride = {
              ...data,
              id: data.id ?? (typeof key === 'string' && /^-?\d+$/.test(key) ? parseInt(key, 10) : 0),
              firebaseKey: key,
              driverLocation: data.driverLocation,
              passengerLocation: data.passengerLocation,
              pickupLocation: data.pickupLocation,
              dropoffLocation: data.dropoffLocation,
            };
            callback(ride);
          }
        });
        return () => {
          unsubscribe();
        };
      },
    }),
    {
      name: 'ride-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lastSearchParams: state.lastSearchParams }),
    }
  )
);
