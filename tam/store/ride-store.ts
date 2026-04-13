import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, push, set as firebaseSet, update as firebaseUpdate, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import { Ride, LiveLocation } from '@/types/ride';

export type LastSearchParams = {
  from: string;
  to: string;
  price?: number;
  transportType: 'car' | 'motorbike';
};

function getCurrentUserFromWindow() {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { __authStore?: { getState: () => { user?: { type: string } | null } } })
    .__authStore?.getState()?.user ?? null;
}

/** Filter/sort rides for the Posted list — used by search and after Firebase `rides` updates */
function computeSearchResults(
  rides: Ride[],
  params: LastSearchParams
): Ride[] {
  const { from, to, price, transportType } = params;
  const currentUser = getCurrentUserFromWindow();

  let results = rides.filter((ride) => {
    if (!ride.from || !ride.to) return false;

    const matchesLocation =
      ride.from.toLowerCase().includes(from.toLowerCase()) &&
      ride.to.toLowerCase().includes(to.toLowerCase());
    const matchesTransport = transportType ? ride.transportType === transportType : true;

    const now = new Date().getTime();
    const createdAt = new Date(ride.createdAt).getTime();
    const thirtyMinutes = 30 * 60 * 1000;
    let isExpired = now - createdAt > thirtyMinutes;
    if (ride.status === 'scheduled' && ride.scheduledPickupAt) {
      const pickup = new Date(ride.scheduledPickupAt).getTime();
      isExpired = pickup < now - thirtyMinutes;
    }
    if (isExpired) return false;

    if (currentUser?.type === 'driver') {
      return matchesLocation && matchesTransport && ride.passengerId !== null;
    }
    if (currentUser?.type === 'passenger') {
      return matchesLocation && matchesTransport && ride.driverId !== null;
    }

    return matchesLocation && matchesTransport;
  });

  if (price) {
    results = [...results].sort((a, b) => Math.abs(a.price - price!) - Math.abs(b.price - price!));
  }

  return results;
}

function paramsEqual(a: LastSearchParams | null, b: LastSearchParams): boolean {
  if (!a) return false;
  return (
    a.from === b.from &&
    a.to === b.to &&
    a.price === b.price &&
    a.transportType === b.transportType
  );
}

/** Rides posted by passengers still waiting for a driver — for the driver “nearby” map */
export type WaitingPassengerRideNearby = { ride: Ride; distanceKm: number };

interface RideState {
  rides: Ride[];
  searchResults: Ride[];
  lastSearchParams: LastSearchParams | null;
  searchRides: (from: string, to: string, price?: number, transportType?: 'car' | 'motorbike') => void;
  getNearbyAvailableDrivers: (userLat: number, userLng: number, radiusKm?: number) => { moto: Ride[]; car: Ride[] };
  /** Passengers waiting for pickup within radius (pending/scheduled, no driver assigned, has coordinates) */
  getWaitingPassengerRidesNearLocation: (
    driverLat: number,
    driverLng: number,
    radiusKm?: number
  ) => WaitingPassengerRideNearby[];
  addRide: (ride: Omit<Ride, 'id'>) => Promise<string | null>;
  /** Assigns current driver or passenger on accept; updates Firebase `status` + `driverId` / `passengerId` */
  acceptRide: (
    rideId: number | string,
    assign: { driverId?: string; passengerId?: string }
  ) => Promise<void>;
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
          let ridesArray: Ride[] = [];
          if (data) {
            ridesArray = Object.keys(data).map((key) => ({
              ...data[key],
              id: /^-?\d+$/.test(key) ? parseInt(key, 10) : key,
              firebaseKey: key,
            }));
          }
          const lastSearchParams = get().lastSearchParams;
          if (lastSearchParams) {
            const searchResults = computeSearchResults(ridesArray, lastSearchParams);
            set({ rides: ridesArray, searchResults });
          } else {
            set({ rides: ridesArray });
          }
        });
      },

      searchRides: (from, to, price, transportType = 'motorbike') => {
        const rides = get().rides;
        const params: LastSearchParams = { from, to, price, transportType };
        const searchResults = computeSearchResults(rides, params);
        const prev = get().lastSearchParams;
        if (paramsEqual(prev, params)) {
          set({ searchResults });
        } else {
          set({ lastSearchParams: params, searchResults });
        }
      },

      getWaitingPassengerRidesNearLocation: (driverLat, driverLng, radiusKm = 15) => {
        const rides = get().rides;
        const R = 6371;
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        const now = Date.now();
        const thirtyMinutes = 30 * 60 * 1000;
        const out: WaitingPassengerRideNearby[] = [];

        for (const ride of rides) {
          if (ride.passengerId == null || ride.driverId != null) continue;
          if (ride.status !== 'pending' && ride.status !== 'scheduled') continue;

          let isExpired = now - new Date(ride.createdAt).getTime() > thirtyMinutes;
          if (ride.status === 'scheduled' && ride.scheduledPickupAt) {
            const pickup = new Date(ride.scheduledPickupAt).getTime();
            isExpired = pickup < now - thirtyMinutes;
          }
          if (isExpired) continue;

          const loc = ride.passengerLocation ?? ride.pickupLocation;
          if (loc == null || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') continue;

          const d = distanceKm(driverLat, driverLng, loc.latitude, loc.longitude);
          if (d > radiusKm) continue;

          out.push({ ride, distanceKm: d });
        }

        out.sort((a, b) => a.distanceKm - b.distanceKm);
        return out;
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
          return newRideRef.key ?? null;
        } catch (error) {
          console.error('Error adding ride:', error);
          return null;
        }
      },
      
      acceptRide: async (rideId, assign) => {
        try {
          const key = typeof rideId === 'string' ? rideId : String(rideId);
          const updates: Record<string, unknown> = { status: 'accepted' };
          if (assign.driverId != null && assign.driverId !== '') {
            updates.driverId = assign.driverId;
          }
          if (assign.passengerId != null && assign.passengerId !== '') {
            updates.passengerId = assign.passengerId;
          }
          await firebaseUpdate(ref(database, `rides/${key}`), updates);

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
