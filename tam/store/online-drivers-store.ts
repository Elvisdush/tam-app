import { create } from 'zustand';
import { ref, set as firebaseSet, remove, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import { buildDemoNearbyDrivers, includeDemoNearbyDrivers } from '@/lib/demo-nearby-drivers';
import type { User } from '@/types/user';
import type { OnlineDriverMarker } from '@/types/online-driver';

export type { OnlineDriverMarker } from '@/types/online-driver';

interface OnlineDriversState {
  onlineDrivers: OnlineDriverMarker[];
  loadOnlineDrivers: () => () => void;
  setMyPresence: (user: User, latitude: number, longitude: number) => Promise<void>;
  clearMyPresence: (userId: string) => Promise<void>;
  /** Real + optional demo drivers within radius, excluding optional viewer id */
  getNearbyMarkers: (
    viewerLat: number,
    viewerLng: number,
    radiusKm?: number,
    excludeUserId?: string
  ) => OnlineDriverMarker[];
  getNearbyCounts: (
    viewerLat: number,
    viewerLng: number,
    radiusKm?: number,
    excludeUserId?: string
  ) => { moto: number; car: number };
}

const PRESENCE_MAX_AGE_MS = 5 * 60 * 1000;
const DEFAULT_RADIUS_KM = 12;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const useOnlineDriversStore = create<OnlineDriversState>((set, get) => ({
  onlineDrivers: [],

  loadOnlineDrivers: () => {
    const r = ref(database, 'onlineDrivers');
    const unsub = onValue(r, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        set({ onlineDrivers: [] });
        return;
      }
      const list: OnlineDriverMarker[] = Object.keys(data).map((key) => {
        const row = data[key];
        return {
          userId: key,
          username: row.username,
          latitude: row.latitude,
          longitude: row.longitude,
          transportType: row.transportType === 'car' ? 'car' : 'motorbike',
          updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : Date.now(),
          vehiclePlate: typeof row.vehiclePlate === 'string' ? row.vehiclePlate : undefined,
          vehicleModel: typeof row.vehicleModel === 'string' ? row.vehicleModel : undefined,
        };
      });
      set({ onlineDrivers: list });
    });
    return unsub;
  },

  setMyPresence: async (user, latitude, longitude) => {
    if (user.type !== 'driver') return;
    const transportType = user.vehicleType ?? 'motorbike';
    await firebaseSet(ref(database, `onlineDrivers/${user.id}`), {
      latitude,
      longitude,
      transportType,
      username: user.username,
      updatedAt: Date.now(),
      ...(user.vehiclePlate?.trim() ? { vehiclePlate: user.vehiclePlate.trim() } : {}),
      ...(user.vehicleModel?.trim() ? { vehicleModel: user.vehicleModel.trim() } : {}),
    });
  },

  clearMyPresence: async (userId: string) => {
    try {
      await remove(ref(database, `onlineDrivers/${userId}`));
    } catch {
      // ignore
    }
  },

  getNearbyMarkers: (viewerLat, viewerLng, radiusKm = DEFAULT_RADIUS_KM, excludeUserId) => {
    const now = Date.now();
    const real = get().onlineDrivers.filter((d) => {
      if (excludeUserId && d.userId === excludeUserId) return false;
      if (now - d.updatedAt > PRESENCE_MAX_AGE_MS) return false;
      const km = haversineKm(viewerLat, viewerLng, d.latitude, d.longitude);
      return km <= radiusKm;
    });

    const demo = includeDemoNearbyDrivers() ? buildDemoNearbyDrivers(viewerLat, viewerLng) : [];
    return [...real, ...demo];
  },

  getNearbyCounts: (viewerLat, viewerLng, radiusKm = DEFAULT_RADIUS_KM, excludeUserId) => {
    const markers = get().getNearbyMarkers(viewerLat, viewerLng, radiusKm, excludeUserId);
    return {
      moto: markers.filter((m) => m.transportType === 'motorbike').length,
      car: markers.filter((m) => m.transportType === 'car').length,
    };
  },
}));
