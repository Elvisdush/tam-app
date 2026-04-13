import { decodePolyline } from '@/lib/navigation/polyline';
import type { RoadHazard } from '@/constants/road-hazards';

const R = 6371000;

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Distance from point p to segment a–b in meters; returns along-segment distance from a to closest point */
function pointToSegmentMeters(
  plat: number,
  plng: number,
  alat: number,
  alng: number,
  blat: number,
  blng: number
): { crossTrackM: number; alongFromA: number } {
  const ax = alat;
  const ay = alng;
  const bx = blat;
  const by = blng;
  const px = plat;
  const py = plng;
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  let t = ab2 > 1e-18 ? (apx * abx + apy * aby) / ab2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  const crossTrackM = haversineMeters(plat, plng, cx, cy);
  const alongFromA = haversineMeters(ax, ay, cx, cy);
  return { crossTrackM, alongFromA };
}

/** Index of polyline vertex closest to user */
function nearestVertexIndex(
  userLat: number,
  userLng: number,
  points: Array<{ latitude: number; longitude: number }>
): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = haversineMeters(userLat, userLng, points[i].latitude, points[i].longitude);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Sum edge lengths from startIndex inclusive along segment starts */
function edgeLengthSum(
  points: Array<{ latitude: number; longitude: number }>,
  fromIndex: number,
  toIndexExclusive: number
): number {
  let s = 0;
  for (let i = fromIndex; i < toIndexExclusive && i + 1 < points.length; i++) {
    s += haversineMeters(
      points[i].latitude,
      points[i].longitude,
      points[i + 1].latitude,
      points[i + 1].longitude
    );
  }
  return s;
}

export type HazardOnRoute = {
  hazard: RoadHazard;
  /** Approximate driving distance along the route from the user’s position to the hazard zone (m) */
  metersAhead: number;
  /** ETA at assumed urban speed */
  etaMinutes: number;
};

const CORRIDOR_BUFFER_M = 85;

/**
 * Hazards whose zone intersects the route polyline ahead of the user.
 * `assumedSpeedKmh` drives ETA for alerts (e.g. 7 minutes before arrival).
 */
export function findHazardsAheadOnRoute(
  polylineEncoded: string | undefined,
  userLat: number,
  userLng: number,
  hazards: RoadHazard[],
  assumedSpeedKmh: number
): HazardOnRoute[] {
  if (!polylineEncoded || polylineEncoded === 'simulated_polyline_data' || hazards.length === 0) {
    return [];
  }

  let points: Array<{ latitude: number; longitude: number }>;
  try {
    points = decodePolyline(polylineEncoded);
  } catch {
    return [];
  }
  if (points.length < 2 || assumedSpeedKmh < 5) return [];

  const userIdx = nearestVertexIndex(userLat, userLng, points);
  const out: HazardOnRoute[] = [];

  for (const hazard of hazards) {
    const threshold = hazard.radiusM + CORRIDOR_BUFFER_M;
    let hitSegmentStart = -1;
    let metersIntoHit = 0;

    for (let i = userIdx; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const { crossTrackM, alongFromA } = pointToSegmentMeters(
        hazard.latitude,
        hazard.longitude,
        a.latitude,
        a.longitude,
        b.latitude,
        b.longitude
      );
      if (crossTrackM <= threshold) {
        hitSegmentStart = i;
        metersIntoHit = alongFromA;
        break;
      }
    }

    if (hitSegmentStart < 0) continue;

    const metersAhead =
      edgeLengthSum(points, userIdx, hitSegmentStart) +
      metersIntoHit;

    const speedMs = (assumedSpeedKmh * 1000) / 3600;
    const etaMinutes = Math.max(0.1, metersAhead / speedMs / 60);

    out.push({ hazard, metersAhead, etaMinutes });
  }

  return out.sort((a, b) => a.metersAhead - b.metersAhead);
}

/** Derive a reasonable speed (km/h) from total route length and duration text like "25 min" */
export function assumedSpeedFromRoute(distanceLabel: string, durationLabel: string, fallbackKmh: number): number {
  const kmMatch = distanceLabel.match(/([\d.]+)\s*km/i);
  const minMatch = durationLabel.match(/(\d+)\s*min/i);
  const hrMatch = durationLabel.match(/(\d+)\s*hr/);
  if (!kmMatch) return fallbackKmh;
  const km = parseFloat(kmMatch[1]);
  let minutes = 0;
  if (hrMatch) {
    minutes += parseInt(hrMatch[1], 10) * 60;
    const minRest = durationLabel.match(/hr\s*(\d+)\s*min/);
    if (minRest) minutes += parseInt(minRest[1], 10);
  } else if (minMatch) {
    minutes = parseInt(minMatch[1], 10);
  }
  if (minutes <= 0) return fallbackKmh;
  const implied = (km / minutes) * 60;
  if (!Number.isFinite(implied) || implied < 8) return fallbackKmh;
  if (implied > 90) return 90;
  return implied;
}
