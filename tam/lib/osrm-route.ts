/**
 * OSRM public demo server — road geometry when Google Routes returns no polyline or fails.
 * Same encoded-polyline format as Google (precision 5).
 */

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

export async function fetchOsrmDrivingRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<OsrmRouteResult | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}` +
      `?overview=full&geometries=polyline&steps=true`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]?.geometry) return null;

    const r = data.routes[0];
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
            instruction: s.name || s.maneuver?.type || `Step ${i + 1}`,
            distance: `${((s.distance ?? 0) / 1000).toFixed(1)} km`,
            duration: `${Math.ceil((s.duration ?? 0) / 60)} min`,
          }))
        : [
            {
              instruction: 'Follow the route',
              distance: `${distanceKm} km`,
              duration: durationText,
            },
          ];

    return {
      distanceLabel: `${distanceKm} km`,
      durationText,
      encodedPolyline: r.geometry as string,
      steps,
    };
  } catch {
    return null;
  }
}
