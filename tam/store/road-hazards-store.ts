import { create } from 'zustand';
import { ref, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import { KIGALI_ROAD_HAZARDS, type RoadHazard, type RoadHazardType } from '@/constants/road-hazards';

const SEED_ACTIVE = (): RoadHazard[] => KIGALI_ROAD_HAZARDS.filter((h) => h.active);

const HAZARD_TYPES: RoadHazardType[] = ['accident', 'flood', 'weather', 'closure', 'other'];

function isHazardType(v: unknown): v is RoadHazardType {
  return typeof v === 'string' && (HAZARD_TYPES as string[]).includes(v);
}

/**
 * Realtime Database path: `roadHazards/{id}`
 *
 * Example entry (admin can toggle `active`):
 * {
 *   "title": "Mudslide risk",
 *   "description": "Slippery surface after rain.",
 *   "type": "weather",
 *   "latitude": -1.95,
 *   "longitude": 30.08,
 *   "radiusM": 140,
 *   "avoidanceHint": "Use parallel road via ...",
 *   "active": true
 * }
 */
function parseFirebaseHazard(raw: Record<string, unknown>, firebaseKey: string): RoadHazard | null {
  const lat = Number(raw.latitude);
  const lng = Number(raw.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Road hazard';
  const description =
    typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : '';
  const type: RoadHazardType = isHazardType(raw.type) ? raw.type : 'other';
  const radiusM = Number(raw.radiusM);
  const radius = Number.isFinite(radiusM) && radiusM > 10 && radiusM < 5000 ? radiusM : 120;
  const avoidanceHint =
    typeof raw.avoidanceHint === 'string' && raw.avoidanceHint.trim()
      ? raw.avoidanceHint.trim()
      : 'Slow down and follow local guidance.';
  const active = raw.active !== false;

  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : `fb-${firebaseKey}`;

  return {
    id,
    title,
    description,
    type,
    latitude: lat,
    longitude: lng,
    radiusM: radius,
    avoidanceHint,
    active,
  };
}

interface RoadHazardsState {
  /** Active hazards for routing + in-nav alerts (Firebase merged rules below) */
  hazards: RoadHazard[];
  /** `firebase` when at least one row came from RTDB; `seed` when using bundled fallback */
  source: 'firebase' | 'seed';
  /** Subscribe to `roadHazards` — call once at app root; returns unsubscribe */
  subscribeRoadHazards: () => () => void;
}

export const useRoadHazardsStore = create<RoadHazardsState>(() => ({
  hazards: SEED_ACTIVE(),
  source: 'seed',

  subscribeRoadHazards: () => {
    const r = ref(database, 'roadHazards');
    return onValue(r, (snapshot) => {
      const val = snapshot.val() as Record<string, Record<string, unknown>> | null;

      if (val == null) {
        useRoadHazardsStore.setState({ hazards: SEED_ACTIVE(), source: 'seed' });
        return;
      }

      const entries = Object.entries(val).filter(([, v]) => v && typeof v === 'object');
      if (entries.length === 0) {
        useRoadHazardsStore.setState({ hazards: [], source: 'firebase' });
        return;
      }

      const list: RoadHazard[] = [];
      for (const [key, raw] of entries) {
        const h = parseFirebaseHazard(raw, key);
        if (h && h.active) list.push(h);
      }

      if (list.length === 0) {
        useRoadHazardsStore.setState({ hazards: [], source: 'firebase' });
      } else {
        useRoadHazardsStore.setState({ hazards: list, source: 'firebase' });
      }
    });
  },
}));

/** Non-React callers (e.g. `calculateRoute` OSRM scoring) */
export function getRoadHazardsForRouting(): RoadHazard[] {
  return useRoadHazardsStore.getState().hazards;
}
