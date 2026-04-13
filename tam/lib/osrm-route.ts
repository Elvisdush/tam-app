/**
 * OSRM public demo server — road geometry when Google Routes returns no polyline or fails.
 * Uses GeoJSON geometry (unambiguous) then encodes to precision-5 polyline for the rest of the app.
 */

import { encodePolyline } from '@/lib/navigation/polyline';

type OsrmStep = {
  distance?: number;
  duration?: number;
  name?: string;
  maneuver?: { type?: string; modifier?: string };
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

export async function fetchOsrmDrivingRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<OsrmRouteResult | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}` +
      `?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]) return null;

    const r = data.routes[0];
    const geom = r.geometry as { type?: string; coordinates?: number[][] } | undefined;
    if (geom?.type !== 'LineString' || !Array.isArray(geom.coordinates) || geom.coordinates.length < 2) {
      return null;
    }

    const points = geom.coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));

    let encodedPolyline: string;
    try {
      encodedPolyline = encodePolyline(points);
    } catch {
      return null;
    }

    const distanceKm = (r.distance / 1000).toFixed(1);
    const durationMinutes = Math.ceil(r.duration / 60);
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
  } catch {
    return null;
  }
}
