/**
 * Traffic light locations in Kigali, Rwanda
 * Based on known signalized intersections (Kigali has ~13+ traffic lights)
 * Coordinates are approximate - can be updated with official RTDA data
 */
export interface TrafficLight {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Street/intersection description */
  intersection?: string;
}

export const KIGALI_TRAFFIC_LIGHTS: TrafficLight[] = [
  { id: 'tl-1', name: 'Muhima', latitude: -1.9441, longitude: 30.0619, intersection: 'Muhima Feu Rouge' },
  { id: 'tl-2', name: 'Remera', latitude: -1.9756, longitude: 30.1189, intersection: 'Remera Junction' },
  { id: 'tl-3', name: 'Kimironko', latitude: -1.9736, longitude: 30.1234, intersection: 'Kimironko Bus Park' },
  { id: 'tl-4', name: 'Nyamirambo', latitude: -1.9698, longitude: 29.9988, intersection: 'Nyamirambo Centre' },
  { id: 'tl-5', name: 'Kicukiro', latitude: -2.0089, longitude: 30.0945, intersection: 'Kicukiro Centre' },
  { id: 'tl-6', name: 'Nyarugenge', latitude: -1.9456, longitude: 30.0438, intersection: 'City Centre' },
  { id: 'tl-7', name: 'Gikondo', latitude: -1.9923, longitude: 30.0876, intersection: 'Gikondo Industrial' },
  { id: 'tl-8', name: 'Kacyiru', latitude: -1.9345, longitude: 30.0823, intersection: 'Kacyiru Roundabout' },
  { id: 'tl-9', name: 'Gisozi', latitude: -1.9289, longitude: 30.0912, intersection: 'Gisozi Junction' },
  { id: 'tl-10', name: 'Niboye', latitude: -2.0234, longitude: 30.0654, intersection: 'Niboye Centre' },
  { id: 'tl-11', name: 'Gikondo Expo', latitude: -1.9856, longitude: 30.0923, intersection: 'Expo Grounds' },
  { id: 'tl-12', name: 'Kabuga', latitude: -1.9123, longitude: 30.1123, intersection: 'Kabuga Junction' },
  { id: 'tl-13', name: 'Nyabugogo', latitude: -1.9389, longitude: 30.0312, intersection: 'Nyabugogo Bus Park' },
];

const R = 6371; // Earth radius in km

export function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Get traffic lights within radius (km) of user location, sorted by distance */
export function getNearbyTrafficLights(
  userLat: number,
  userLng: number,
  radiusKm: number = 5
): Array<TrafficLight & { distanceKm: number }> {
  return KIGALI_TRAFFIC_LIGHTS.map((tl) => ({
    ...tl,
    distanceKm: getDistanceKm(userLat, userLng, tl.latitude, tl.longitude),
  }))
    .filter((tl) => tl.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
