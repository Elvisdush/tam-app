/**
 * Approximate speed / traffic enforcement camera locations around Kigali & main corridors.
 * For driver & passenger awareness only — not official enforcement data.
 * Update coordinates with local authority or verified sources when available.
 */
import { getDistanceKm } from '@/constants/traffic-light-locations';

export interface SpeedCamera {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Road or zone label */
  road?: string;
}

export const KIGALI_SPEED_CAMERAS: SpeedCamera[] = [
  { id: 'sc-1', name: 'KN 3 Ave', latitude: -1.9472, longitude: 30.0598, road: 'City centre corridor' },
  { id: 'sc-2', name: 'KG 11 Ave', latitude: -1.951, longitude: 30.0645, road: 'Nyarugenge' },
  { id: 'sc-3', name: 'Airport Rd', latitude: -1.9682, longitude: 30.1395, road: 'Near airport approach' },
  { id: 'sc-4', name: 'Kigali–Butare (S)', latitude: -1.989, longitude: 30.048, road: 'Southern exit' },
  { id: 'sc-5', name: 'Remera ring', latitude: -1.9765, longitude: 30.1152, road: 'Remera' },
  { id: 'sc-6', name: 'Kimironko Rd', latitude: -1.9718, longitude: 30.121, road: 'Kimironko' },
  { id: 'sc-7', name: 'Kacyiru hill', latitude: -1.9365, longitude: 30.0788, road: 'Kacyiru' },
  { id: 'sc-8', name: 'Gisozi stretch', latitude: -1.9312, longitude: 30.0885, road: 'Gisozi' },
  { id: 'sc-9', name: 'Nyabugogo approach', latitude: -1.9415, longitude: 30.0288, road: 'Nyabugogo' },
  { id: 'sc-10', name: 'Kicukiro industrial', latitude: -2.0055, longitude: 30.0968, road: 'Kicukiro' },
  { id: 'sc-11', name: 'Sonatubes', latitude: -1.982, longitude: 30.1012, road: 'Eastern corridor' },
  { id: 'sc-12', name: 'Nyarutarama', latitude: -1.9185, longitude: 30.0655, road: 'Lakeside road' },
  { id: 'sc-13', name: 'Gahanga road', latitude: -2.012, longitude: 30.078, road: 'South-east' },
  { id: 'sc-14', name: 'Masaka highway', latitude: -1.895, longitude: 30.045, road: 'Northern approach' },
  { id: 'sc-15', name: 'Rubavu road (W)', latitude: -1.952, longitude: 29.985, road: 'Western corridor' },
  { id: 'sc-16', name: 'Muhima waterfront', latitude: -1.9425, longitude: 30.0555, road: 'Muhima' },
  { id: 'sc-17', name: 'Gikondo bypass', latitude: -1.9888, longitude: 30.084, road: 'Gikondo' },
  { id: 'sc-18', name: 'Niboye junction', latitude: -2.0195, longitude: 30.069, road: 'Niboye' },
];

export function getNearbySpeedCameras(
  userLat: number,
  userLng: number,
  radiusKm: number = 8
): Array<SpeedCamera & { distanceKm: number }> {
  return KIGALI_SPEED_CAMERAS.map((sc) => ({
    ...sc,
    distanceKm: getDistanceKm(userLat, userLng, sc.latitude, sc.longitude),
  }))
    .filter((sc) => sc.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
