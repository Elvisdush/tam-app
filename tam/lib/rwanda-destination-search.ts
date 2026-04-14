import { RWANDA_DESTINATIONS, type RwandaDestination } from '@/constants/rwanda-destinations';
import { RWANDA_SEARCH_PLACES } from '@/constants/rwanda-search-places';
import type { LocationSuggestion } from '@/lib/places-search';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
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

type SearchLocation = Pick<RwandaDestination, 'id' | 'name' | 'subtitle' | 'latitude' | 'longitude' | 'search'>;

function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchesQuery(dest: SearchLocation, q: string): boolean {
  const hayRaw = `${dest.name} ${dest.subtitle} ${dest.search}`.toLowerCase();
  const hay = normalizeForSearch(hayRaw);
  const normalizedQ = normalizeForSearch(q);
  const compactQ = normalizedQ.replace(/\s+/g, '');
  const compactHay = hay.replace(/\s+/g, '');
  return hay.includes(normalizedQ) || compactHay.includes(compactQ);
}

function toSuggestion(
  dest: SearchLocation,
  userLat: number | null | undefined,
  userLng: number | null | undefined
): LocationSuggestion {
  let distance = '—';
  let time = '—';
  if (userLat != null && userLng != null) {
    const km = haversineKm(userLat, userLng, dest.latitude, dest.longitude);
    distance = `${km.toFixed(1)} km`;
    time = `${Math.ceil((km / 40) * 60)} min`;
  }
  return {
    id: dest.id,
    name: dest.name,
    address: dest.subtitle,
    distance,
    time,
    latitude: dest.latitude,
    longitude: dest.longitude,
  };
}

const MAX_RESULTS = 80;

/**
 * Filter Rwanda destinations by search text and sort by distance when GPS is available.
 */
export function buildRwandaSuggestions(
  query: string,
  userLat: number | null | undefined,
  userLng: number | null | undefined
): LocationSuggestion[] {
  const q = query.trim().toLowerCase();
  const allPlaces: SearchLocation[] = [...RWANDA_DESTINATIONS, ...RWANDA_SEARCH_PLACES];
  let list = q ? allPlaces.filter((d) => matchesQuery(d, q)) : [...allPlaces];

  if (userLat != null && userLng != null) {
    list = [...list].sort((a, b) => {
      const da = haversineKm(userLat, userLng, a.latitude, a.longitude);
      const db = haversineKm(userLat, userLng, b.latitude, b.longitude);
      return da - db;
    });
  } else {
    list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  }

  return list.slice(0, MAX_RESULTS).map((d) => toSuggestion(d, userLat, userLng));
}
