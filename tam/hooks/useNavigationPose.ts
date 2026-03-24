import { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

function computeBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * High-frequency heading (compass) + position for turn-by-turn navigation.
 * Heading uses device magnetometer / GPS course when available (satellite-trackable position).
 */
export function useNavigationPose(active: boolean) {
  const [heading, setHeading] = useState(0);
  const lastLoc = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!active) {
      setHeading(0);
      return;
    }

    let posSub: Location.LocationSubscription | null = null;
    let headingSub: { remove: () => void } | null = null;

    const start = async () => {
      try {
        if (Platform.OS !== 'web') {
          headingSub = await Location.watchHeadingAsync((hd) => {
            const th = hd.trueHeading >= 0 ? hd.trueHeading : hd.magHeading;
            if (th >= 0 && !Number.isNaN(th)) {
              setHeading(Math.round(th));
            }
          });
        }

        posSub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 5,
          },
          (loc) => {
            const { latitude, longitude, heading: course } = loc.coords;
            if (Platform.OS === 'web' && lastLoc.current) {
              const prev = lastLoc.current;
              const bearing = computeBearing(prev.lat, prev.lng, latitude, longitude);
              if (!Number.isNaN(bearing)) setHeading(Math.round(bearing));
            } else if (course != null && course >= 0) {
              setHeading(Math.round(course));
            }
            lastLoc.current = { lat: latitude, lng: longitude };
          }
        );
      } catch (e) {
        console.warn('useNavigationPose:', e);
      }
    };

    start();

    return () => {
      posSub?.remove();
      headingSub?.remove();
      lastLoc.current = null;
    };
  }, [active]);

  return { heading };
}
