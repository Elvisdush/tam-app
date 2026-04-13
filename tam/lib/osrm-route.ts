/**
 * OSRM public demo server — road geometry when Google Routes returns no polyline or fails.
 * Uses GeoJSON geometry then encodes to precision-5 polyline.
 * With `hazardsToScore`, requests alternative routes and picks the lowest hazard penalty.
 */

import { encodePolyline } from '@/lib/navigation/polyline';
import { scorePolylineAgainstHazards } from '@/lib/navigation/route-hazards';
import type { RoadHazard } from '@/constants/road-hazards';

type OsrmStep = {
  distance?: number;
  duration?: number;
  name?: string;
  maneuver?: { type?: string; modifier?: string };
};

type OsrmRouteRaw = {
  distance?: number;
  duration?: number;
  geometry?: { type?: string; coordinates?: number[][] };
  legs?: { steps?: OsrmStep[] }[];
};

export type OsrmRouteResult = {
  distanceLabel: string;
  durationText: string;
  encodedPolyline: string;
  steps: Array<{ instruction: string; distance: string; duration: string }>;
};

function formatStepDistanceMeters(meters: number): string {
  const m = Math.max(0, meters);
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function osrmInstruction(step: OsrmStep, index: number): string {
  const type = step.maneuver?.type ?? '';
  const mod = step.maneuver?.modifier ?? '';
  const name = (step.name ?? '').trim();
  const typePart = [type, mod].filter(Boolean).join(' ');
  if (name && typePart) return `${typePart} onto ${name}`;
  if (name) return name;
  if (typePart) return typePart;
  return `Continue (${index + 1})`;
}

function geometryToPoints(geom: OsrmRouteRaw['geometry']): Array<{ latitude: number; longitude: number }> | null {
  if (geom?.type !== 'LineString' || !Array.isArray(geom.coordinates) || geom.coordinates.length < 2) {
    return null;
  }
  return geom.coordinates.map(([lng, lat]) => ({
    latitude: lat,
    longitude: lng,
  }));
}

function packOsrmRoute(r: OsrmRouteRaw): OsrmRouteResult | null {
  const geom = r.geometry;
  const points = geometryToPoints(geom);
  if (!points) return null;

  let encodedPolyline: string;
  try {
    encodedPolyline = encodePolyline(points);
  } catch {
    return null;
  }

  const distanceKm = ((r.distance ?? 0) / 1000).toFixed(1);
  const durationMinutes = Math.ceil((r.duration ?? 0) / 60);
  const durationText =
    durationMinutes >= 60
      ? `${Math.floor(durationMinutes / 60)} hr ${durationMinutes % 60} min`
      : `${durationMinutes} min`;

  const legSteps: OsrmStep[] = r.legs?.[0]?.steps ?? [];
  const steps =
    legSteps.length > 0
      ? legSteps.map((s, i) => ({
          instruction: osrmInstruction(s, i),
          distance: formatStepDistanceMeters(s.distance ?? 0),
          duration: `${Math.ceil((s.duration ?? 0) / 60)} min`,
        }))
      : [
          {
            instruction: 'Follow the highlighted route',
            distance: formatStepDistanceMeters(r.distance ?? 0),
            duration: durationText,
          },
        ];

  return {
    distanceLabel: `${distanceKm} km`,
    durationText,
    encodedPolyline,
    steps,
  };
}

export async function fetchOsrmDrivingRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  options?: { hazardsToScore?: RoadHazard[] }
): Promise<OsrmRouteResult | null> {
  try {
    const hazards = options?.hazardsToScore?.filter((h) => h.active !== false) ?? [];
    const useAlternatives = hazards.length > 0;
    const baseUrl =
      `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}` +
      `?overview=full&geometries=geojson&steps=true`;

    const fetchOsrm = async (fullUrl: string) => {
      const res = await fetch(fullUrl);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.code !== 'Ok' || !data.routes?.[0]) return null;
      return data;
    };

    let data = await fetchOsrm(useAlternatives ? `${baseUrl}&alternatives=2` : baseUrl);
    if (!data && useAlternatives) {
      data = await fetchOsrm(baseUrl);
    }
    if (!data) return null;

    const routes = data.routes as OsrmRouteRaw[];

    if (!useAlternatives || routes.length <= 1) {
      return packOsrmRoute(routes[0]);
    }

    type Scored = { route: OsrmRouteRaw; score: number; duration: number };
    const scored: Scored[] = [];
    for (const route of routes) {
      const pts = geometryToPoints(route.geometry);
      if (!pts) continue;
      const score = scorePolylineAgainstHazards(pts, hazards);
      scored.push({
        route,
        score,
        duration: route.duration ?? 0,
      });
    }

    if (scored.length === 0) return packOsrmRoute(routes[0]);

    scored.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.duration - b.duration;
    });

    return packOsrmRoute(scored[0].route);
  } catch {
    return null;
  }
}
