/** District / city entries that count as Kigali City for passenger pricing & moto service area */
export const KIGALI_DESTINATION_IDS = new Set([
  'kigali-city',
  'gasabo',
  'kicukiro',
  'nyarugenge',
]);

export function isKigaliDestination(destinationId: string): boolean {
  return KIGALI_DESTINATION_IDS.has(destinationId);
}

/**
 * Approximate bounding box for Kigali City (taxi moto pickup zone).
 * Used with GPS so passengers outside this area cannot select taxi moto.
 */
const KIGALI_CITY_BBOX = {
  /** Southern edge (more negative latitude) */
  minLat: -2.06,
  /** Northern edge */
  maxLat: -1.87,
  minLng: 29.95,
  maxLng: 30.22,
} as const;

export function isCoordinateInKigaliCity(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return (
    latitude >= KIGALI_CITY_BBOX.minLat &&
    latitude <= KIGALI_CITY_BBOX.maxLat &&
    longitude >= KIGALI_CITY_BBOX.minLng &&
    longitude <= KIGALI_CITY_BBOX.maxLng
  );
}
