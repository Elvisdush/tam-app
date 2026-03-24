/**
 * Deterministic demo drivers around the user for testing the home map / counts
 * when few real drivers are online. Toggle with includeDemoNearbyDrivers().
 */

import type { OnlineDriverMarker } from '@/types/online-driver';

const DEMO_PREFIX = 'demo-';

/** ~600m–1.8km offsets (Rwanda lat scale) — stable for a given center */
const DEMO_OFFSETS: Array<{ lat: number; lng: number; transportType: 'car' | 'motorbike' }> = [
  { lat: 0.0042, lng: 0.0011, transportType: 'motorbike' },
  { lat: -0.0028, lng: 0.0035, transportType: 'motorbike' },
  { lat: 0.0015, lng: -0.0041, transportType: 'motorbike' },
  { lat: 0.0055, lng: -0.002, transportType: 'car' },
  { lat: -0.0045, lng: -0.0015, transportType: 'car' },
];

export function includeDemoNearbyDrivers(): boolean {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_DEMO_NEARBY_DRIVERS === '0') {
    return false;
  }
  return true;
}

export function buildDemoNearbyDrivers(
  centerLat: number,
  centerLng: number
): OnlineDriverMarker[] {
  if (!includeDemoNearbyDrivers()) return [];
  return DEMO_OFFSETS.map((o, i) => ({
    userId: `${DEMO_PREFIX}${i}`,
    username: o.transportType === 'motorbike' ? `Moto ${i + 1}` : `Car ${i + 1}`,
    latitude: centerLat + o.lat,
    longitude: centerLng + o.lng,
    transportType: o.transportType,
    updatedAt: Date.now(),
    isDemo: true,
  }));
}
