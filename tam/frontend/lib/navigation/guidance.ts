import { decodePolyline } from './polyline';

export interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
}

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
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Parse step distance string like "0.5 km" or "200 m" to meters */
export function parseStepDistanceToMeters(s: string): number {
  const km = s.match(/([\d.]+)\s*km/i);
  if (km) return parseFloat(km[1]) * 1000;
  const m = s.match(/([\d.]+)\s*m\b/i);
  if (m) return parseFloat(m[1]);
  return 0;
}

/** Distance along polyline from start to segment end at index (exclusive of point index) */
function distanceAlongPolylineToIndex(
  points: Array<{ latitude: number; longitude: number }>,
  endIndex: number
): number {
  let d = 0;
  for (let i = 0; i < endIndex && i + 1 < points.length; i++) {
    d += haversineMeters(
      points[i].latitude,
      points[i].longitude,
      points[i + 1].latitude,
      points[i + 1].longitude
    );
  }
  return d;
}

/** Closest vertex on route → distance traveled from route start */
function nearestAlongRoute(
  userLat: number,
  userLng: number,
  points: Array<{ latitude: number; longitude: number }>
): { traveledMeters: number } {
  if (points.length < 2) {
    return { traveledMeters: 0 };
  }

  let bestDist = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < points.length; i++) {
    const d = haversineMeters(userLat, userLng, points[i].latitude, points[i].longitude);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  return { traveledMeters: distanceAlongPolylineToIndex(points, bestIdx) };
}

export interface NavigationGuidance {
  nextInstruction: string;
  distanceToNextMeters: number;
  /** Human-readable distance e.g. "250 m" */
  distanceLabel: string;
  currentStepIndex: number;
}

function formatDistanceMeters(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

/**
 * Compute next-turn guidance from GPS position, encoded polyline, and route steps.
 */
export function getNavigationGuidance(
  userLat: number,
  userLng: number,
  polylineEncoded: string | undefined,
  steps: RouteStep[]
): NavigationGuidance | null {
  if (!steps.length) return null;

  if (!polylineEncoded || polylineEncoded === 'simulated_polyline_data') {
    return {
      nextInstruction: steps[0]?.instruction ?? 'Continue',
      distanceToNextMeters: 0,
      distanceLabel: '',
      currentStepIndex: 0,
    };
  }

  let points: Array<{ latitude: number; longitude: number }>;
  try {
    points = decodePolyline(polylineEncoded);
  } catch {
    return {
      nextInstruction: steps[Math.min(1, steps.length - 1)]?.instruction ?? steps[0].instruction,
      distanceToNextMeters: 0,
      distanceLabel: '',
      currentStepIndex: 0,
    };
  }

  if (points.length < 2) {
    return {
      nextInstruction: steps[0].instruction,
      distanceToNextMeters: 0,
      distanceLabel: '',
      currentStepIndex: 0,
    };
  }

  const { traveledMeters } = nearestAlongRoute(userLat, userLng, points);

  const cumul: number[] = [0];
  for (let i = 0; i < steps.length; i++) {
    cumul.push(cumul[cumul.length - 1] + parseStepDistanceToMeters(steps[i].distance));
  }

  let nextIdx = Math.min(1, steps.length - 1);
  for (let i = 0; i < steps.length; i++) {
    if (traveledMeters < cumul[i + 1]) {
      nextIdx = Math.min(i + 1, steps.length - 1);
      break;
    }
  }
  if (traveledMeters >= cumul[steps.length]) {
    nextIdx = steps.length - 1;
  }

  const nextInstruction = steps[nextIdx].instruction;
  const distanceToNextMeters = Math.max(0, cumul[nextIdx] - traveledMeters);
  const distanceLabel = formatDistanceMeters(distanceToNextMeters);

  return {
    nextInstruction,
    distanceToNextMeters,
    distanceLabel,
    currentStepIndex: nextIdx,
  };
}
