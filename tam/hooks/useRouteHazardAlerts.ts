import { useEffect, useRef, useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { getActiveRoadHazards } from '@/constants/road-hazards';
import {
  findHazardsAheadOnRoute,
  assumedSpeedFromRoute,
  type HazardOnRoute,
} from '@/lib/navigation/route-hazards';

const FALLBACK_SPEED_KMH = 36;
/** Second-stage reminder when the driver is about this many minutes from the hazard */
const APPROACH_MINUTES = 7;

export type RouteHazardBannerState = {
  hazard: HazardOnRoute;
  phase: 'advance' | 'approaching';
};

/**
 * Detects hazards along the active route polyline, shows advance + ~7‑minute alerts,
 * and exposes banner state for a persistent on-map warning.
 */
export function useRouteHazardAlerts(options: {
  enabled: boolean;
  polyline: string | undefined;
  userLat: number | null;
  userLng: number | null;
  routeDistanceLabel?: string;
  routeDurationLabel?: string;
  /** Change when the route is replanned — clears “already notified” memory */
  routeKey?: string;
}) {
  const {
    enabled,
    polyline,
    userLat,
    userLng,
    routeDistanceLabel = '',
    routeDurationLabel = '',
    routeKey = '',
  } = options;

  const [hazardsAhead, setHazardsAhead] = useState<HazardOnRoute[]>([]);
  const [banner, setBanner] = useState<RouteHazardBannerState | null>(null);

  const earlyAlerted = useRef<Set<string>>(new Set());
  const sevenAlerted = useRef<Set<string>>(new Set());

  useEffect(() => {
    earlyAlerted.current.clear();
    sevenAlerted.current.clear();
    setBanner(null);
  }, [routeKey, polyline]);

  const dismissBanner = useCallback(() => {
    setBanner(null);
  }, []);

  useEffect(() => {
    if (!enabled || !polyline || polyline === 'simulated_polyline_data' || userLat == null || userLng == null) {
      setHazardsAhead([]);
      setBanner(null);
      return;
    }

    const speed = assumedSpeedFromRoute(routeDistanceLabel, routeDurationLabel, FALLBACK_SPEED_KMH);
    const list = findHazardsAheadOnRoute(polyline, userLat, userLng, getActiveRoadHazards(), speed);
    setHazardsAhead(list);

    if (list.length === 0) {
      setBanner(null);
      return;
    }

    for (const item of list) {
      const { hazard, etaMinutes } = item;
      const id = hazard.id;

      if (etaMinutes <= APPROACH_MINUTES) {
        if (!sevenAlerted.current.has(id)) {
          sevenAlerted.current.add(id);
          if (Platform.OS !== 'web') {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
          Alert.alert(
            `Hazard in ~${Math.max(1, Math.round(etaMinutes))} min`,
            `${hazard.title}\n\n${hazard.description}\n\nUse another road if you can:\n${hazard.avoidanceHint}`,
            [{ text: 'OK' }]
          );
        }
      } else {
        if (!earlyAlerted.current.has(id)) {
          earlyAlerted.current.add(id);
          if (Platform.OS !== 'web') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          Alert.alert(
            'Hazard on your route',
            `${hazard.title}\n\n${hazard.description}\n\n${hazard.avoidanceHint}\n\nYou’ll get another alert about ${APPROACH_MINUTES} minutes before you reach this area.`,
            [{ text: 'OK' }]
          );
        }
      }
    }

    const nearest = list[0];
    const phase: 'advance' | 'approaching' =
      nearest.etaMinutes <= APPROACH_MINUTES ? 'approaching' : 'advance';
    setBanner({ hazard: nearest, phase });
  }, [
    enabled,
    polyline,
    userLat,
    userLng,
    routeDistanceLabel,
    routeDurationLabel,
    routeKey,
  ]);

  return { hazardsAhead, banner, dismissBanner, approachMinutes: APPROACH_MINUTES };
}
