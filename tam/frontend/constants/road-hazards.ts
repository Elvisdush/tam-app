/**
 * Road incidents & weather-related hazards (flooding, debris, closures).
 * Replace or sync from your backend / civil protection feeds when available.
 * Coordinates are illustrative around Kigali — tune for real operations.
 */
export type RoadHazardType = 'accident' | 'flood' | 'weather' | 'closure' | 'other';

export interface RoadHazard {
  id: string;
  /** Short title for alerts */
  title: string;
  /** Extra context for the driver */
  description: string;
  type: RoadHazardType;
  latitude: number;
  longitude: number;
  /** Radius (m) — route is flagged if it passes within this distance */
  radiusM: number;
  /** Suggested action (shown in alerts) */
  avoidanceHint: string;
  /** If false, ignored by detectors (e.g. cleared incident) */
  active: boolean;
}

export const KIGALI_ROAD_HAZARDS: RoadHazard[] = [
  {
    id: 'rh-nyabugogo-accident',
    title: 'Accident reported — Nyabugogo approach',
    description: 'Possible delays and emergency vehicles. Drive with extra care.',
    type: 'accident',
    latitude: -1.9405,
    longitude: 30.0325,
    radiusM: 120,
    avoidanceHint: 'Use KK 15 Ave or bypass via Gitega if your nav allows rerouting.',
    active: true,
  },
  {
    id: 'rh-remera-flood',
    title: 'Heavy rain / flooding risk — Remera',
    description: 'Low-lying section may pool water during storms.',
    type: 'weather',
    latitude: -1.976,
    longitude: 30.112,
    radiusM: 150,
    avoidanceHint: 'Consider Airport Road or inner Remera links if water is visible ahead.',
    active: true,
  },
  {
    id: 'rh-kicukiro-closure',
    title: 'Road works / partial closure — Kicukiro',
    description: 'Lane reduction possible; follow local signage.',
    type: 'closure',
    latitude: -2.0065,
    longitude: 30.095,
    radiusM: 100,
    avoidanceHint: 'Allow extra time or reroute via Sonatubes ring if congested.',
    active: true,
  },
  {
    id: 'rh-gikondo-hazard',
    title: 'Hazard zone — Gikondo industrial',
    description: 'Mixed heavy traffic; previous incident reports in this corridor.',
    type: 'other',
    latitude: -1.9895,
    longitude: 30.086,
    radiusM: 130,
    avoidanceHint: 'Slow down early; keep distance from trucks.',
    active: true,
  },
];

/** Bundled demo hazards only — live data comes from Firebase via `useRoadHazardsStore` / `getRoadHazardsForRouting`. */
export function getActiveRoadHazards(): RoadHazard[] {
  return KIGALI_ROAD_HAZARDS.filter((h) => h.active);
}
