import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, View, Platform, Text } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { Region, Details } from 'react-native-maps';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import { decodePolyline } from '@/lib/navigation/polyline';

/**
 * Waze-like driving puck: soft shadow, radial blue “ball,” thick white rim, forward wedge.
 * Map camera rotates with heading — marker stays unrotated so “up” is always forward.
 */
function WazeStyleNavigationPuck() {
  const size = 78;
  const c = size / 2;
  const r = 26;
  return (
    <View style={styles.wazePuckRoot} pointerEvents="none">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="wazePuckGrad" cx="40%" cy="32%" rx="72%" ry="72%">
            <Stop offset="0%" stopColor="#bae6fd" />
            <Stop offset="48%" stopColor="#0ea5e9" />
            <Stop offset="100%" stopColor="#075985" />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c + 3} r={r + 2} fill="rgba(0,0,0,0.24)" />
        <Circle cx={c} cy={c} r={r} fill="url(#wazePuckGrad)" stroke="#ffffff" strokeWidth={3.5} />
        {/* Forward wedge — tip above disc (classic Waze / nav “you are here” read) */}
        <Path
          d={`M ${c} 6 L ${c + 16} 31 L ${c + 6.5} 26.5 L ${c} 28.5 L ${c - 6.5} 26.5 L ${c - 16} 31 Z`}
          fill="#ffffff"
          stroke="#e0f2fe"
          strokeWidth={0.75}
        />
      </Svg>
    </View>
  );
}

/** ~meters between two lat/lng points (quick, short-range) */
function approxDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function minHeadingDegrees(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d < 0) d += 360;
  if (d > 180) d = 360 - d;
  return d;
}

/** Fallback when `getCamera()` has no `zoom` (e.g. some iOS cases) — keeps pinch level roughly stable. */
function estimateZoomFromLongitudeDelta(longitudeDelta: number): number {
  const d = Math.max(1e-8, longitudeDelta);
  const z = Math.log2(360 / d);
  return Math.max(2, Math.min(21, z));
}

interface TrafficLightMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  intersection?: string;
}

interface SpeedCameraMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  road?: string;
}

const speedCameraMarkerStyles = StyleSheet.create({
  cameraRoot: {
    alignItems: 'center',
  },
  cameraBody: {
    width: 36,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
  },
  cameraLens: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0f172a',
    borderWidth: 2,
    borderColor: '#64748b',
  },
  cameraLed: {
    position: 'absolute',
    top: 3,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  cameraLabel: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
});

function SpeedCameraMapIcon() {
  return (
    <View style={speedCameraMarkerStyles.cameraRoot} pointerEvents="none">
      <View style={speedCameraMarkerStyles.cameraBody}>
        <View style={speedCameraMarkerStyles.cameraLens} />
        <View style={speedCameraMarkerStyles.cameraLed} />
      </View>
      <Text style={speedCameraMarkerStyles.cameraLabel}>CAM</Text>
    </View>
  );
}
interface Location {
  latitude: number;
  longitude: number;
  timestamp: string;
  address?: string;
}

interface RouteData {
  distance: string;
  duration: string;
  polyline?: string;
  steps: Array<{
    instruction: string;
    distance: string;
    duration: string;
  }>;
}

interface NativeMapViewFullProps {
  currentLocation: Location | null;
  sharedLat: number | null;
  sharedLng: number | null;
  address: string;
  showLocation: boolean;
  showDirections: boolean;
  currentRoute: RouteData | null;
  isNavigationMode?: boolean;
  /** Compass / GPS course in degrees (0–360), drives map rotation in navigation */
  userHeading?: number;
  /** When true, use hybrid satellite + road labels (GPS tracks over aerial imagery) */
  satelliteMode?: boolean;
  onRouteUpdate?: () => void;
  trafficLights?: TrafficLightMarker[];
  /** Speed / enforcement camera pins (approximate locations for awareness) */
  speedCameras?: SpeedCameraMarker[];
}

export default function NativeMapViewFull({
  currentLocation,
  sharedLat,
  sharedLng,
  address,
  showLocation,
  showDirections,
  currentRoute,
  isNavigationMode = false,
  userHeading = 0,
  satelliteMode = false,
  onRouteUpdate,
  trafficLights = [],
  speedCameras = [],
}: NativeMapViewFullProps) {
  const mapRef = useRef<MapView>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const hasCenteredOnUser = useRef(false);
  /** Throttle nav camera — every GPS tick + animateCamera caused map bleaching */
  const lastNavCamAt = useRef(0);
  const lastNavCamHeading = useRef<number | null>(null);
  const lastNavCamLatLng = useRef<{ lat: number; lng: number } | null>(null);
  /** Avoid resetting pinch zoom on every GPS tick — `animateCamera` was forcing zoom 17 (hybrid/satellite felt unstable). */
  const navZoomRef = useRef(17);
  const lastNavAnimAt = useRef(0);
  const NAV_CAM_MIN_MS = 420;
  const NAV_HEADING_MIN_DELTA = 4;
  const NAV_MOVE_MIN_M = 6;
  const MIN_MS_AFTER_NAV_ANIM_FOR_USER_ZOOM = 480;

  const mapType = satelliteMode ? 'hybrid' : 'standard';
  const useDarkStyle = !satelliteMode;

  // Center map on user location when it first loads (no destination)
  useEffect(() => {
    if (currentLocation && !showLocation && !hasCenteredOnUser.current) {
      hasCenteredOnUser.current = true;
      mapRef.current?.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.018,
          longitudeDelta: 0.018,
        },
        500
      );
    }
  }, [currentLocation, showLocation]);

  /** Build route line + fit map — do NOT depend on every GPS tick (causes flicker/bleaching). */
  useEffect(() => {
    if (!showDirections) {
      setRouteCoordinates([]);
      return;
    }
    if (sharedLat == null || sharedLng == null) return;
    if (!currentLocation) return;

    let coords: Array<{ latitude: number; longitude: number }>;
    if (currentRoute?.polyline && currentRoute.polyline !== 'simulated_polyline_data') {
      try {
        coords = decodePolyline(currentRoute.polyline);
      } catch {
        coords = [
          { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
          { latitude: sharedLat, longitude: sharedLng },
        ];
      }
    } else {
      coords = [
        { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
        { latitude: sharedLat, longitude: sharedLng },
      ];
    }
    setRouteCoordinates(coords);
    if (onRouteUpdate) onRouteUpdate();
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 50, bottom: 80, left: 50 },
      animated: true,
    });
    lastNavAnimAt.current = Date.now();
    const syncZoomAfterFit = setTimeout(() => {
      mapRef.current?.getCamera().then((cam) => {
        if (typeof cam.zoom === 'number' && Number.isFinite(cam.zoom)) {
          navZoomRef.current = cam.zoom;
        }
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(syncZoomAfterFit);
    // `!!currentLocation` so we re-run once when GPS becomes available; omit lat/lng so every GPS tick doesn't re-fit (flicker).
  }, [showDirections, sharedLat, sharedLng, currentRoute?.polyline, onRouteUpdate, !!currentLocation]);

  const applyNavigationCamera = useCallback(() => {
    if (!isNavigationMode || !currentLocation || !mapRef.current) return;

    const now = Date.now();
    const lat = currentLocation.latitude;
    const lng = currentLocation.longitude;
    const prev = lastNavCamLatLng.current;
    const movedM =
      prev == null ? 999 : approxDistanceMeters(prev.lat, prev.lng, lat, lng);
    const headingDelta =
      lastNavCamHeading.current == null
        ? 999
        : minHeadingDegrees(userHeading, lastNavCamHeading.current);

    const timeOk = now - lastNavCamAt.current >= NAV_CAM_MIN_MS;
    const moveOk = movedM >= NAV_MOVE_MIN_M;
    const headingOk = headingDelta >= NAV_HEADING_MIN_DELTA;
    if (!timeOk && !moveOk && !headingOk) return;

    lastNavCamAt.current = now;
    lastNavCamHeading.current = userHeading;
    lastNavCamLatLng.current = { lat, lng };

    lastNavAnimAt.current = Date.now();
    const cam = {
      center: { latitude: lat, longitude: lng },
      pitch: 0,
      heading: userHeading,
      zoom: navZoomRef.current,
    };

    try {
      mapRef.current.animateCamera(cam, { duration: 280 });
    } catch {
      mapRef.current.animateToRegion(
        {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        },
        280
      );
    }
  }, [
    isNavigationMode,
    currentLocation?.latitude,
    currentLocation?.longitude,
    userHeading,
  ]);

  useEffect(() => {
    if (!isNavigationMode) {
      lastNavCamAt.current = 0;
      lastNavCamHeading.current = null;
      lastNavCamLatLng.current = null;
      return;
    }
    const sync = setTimeout(() => {
      mapRef.current?.getCamera().then((cam) => {
        if (typeof cam.zoom === 'number' && Number.isFinite(cam.zoom)) {
          navZoomRef.current = cam.zoom;
        }
      }).catch(() => {});
    }, 80);
    applyNavigationCamera();
    return () => clearTimeout(sync);
  }, [isNavigationMode, applyNavigationCamera]);

  const onRegionChangeComplete = useCallback(
    (region: Region, details?: Details) => {
      if (!isNavigationMode || !mapRef.current) return;
      if (details?.isGesture === false) return;
      if (
        details?.isGesture !== true &&
        Date.now() - lastNavAnimAt.current < MIN_MS_AFTER_NAV_ANIM_FOR_USER_ZOOM
      ) {
        return;
      }
      mapRef.current
        .getCamera()
        .then((cam) => {
          if (typeof cam.zoom === 'number' && Number.isFinite(cam.zoom)) {
            navZoomRef.current = cam.zoom;
          }
        })
        .catch(() => {
          navZoomRef.current = estimateZoomFromLongitudeDelta(region.longitudeDelta);
        });
    },
    [isNavigationMode]
  );

  const defaultLat = currentLocation?.latitude || sharedLat || -1.9441;
  const defaultLng = currentLocation?.longitude || sharedLng || 30.0619;

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      mapType={mapType}
      {...(Platform.OS === 'web' && { googleMapsApiKey: 'AIzaSyCEmqLGnM67YcXjxkfbJaOICB3-dodxj4U' })}
      {...(isNavigationMode
        ? {
            initialRegion: {
              latitude: defaultLat,
              longitude: defaultLng,
              latitudeDelta: 0.004,
              longitudeDelta: 0.004,
            },
          }
        : {
            /** Uncontrolled region: a controlled `region` tied to GPS caused constant re-renders (map flashing/bleaching). */
            initialRegion: {
              latitude: -1.9441,
              longitude: 30.0619,
              latitudeDelta: 0.018,
              longitudeDelta: 0.018,
            },
          })}
      followsUserLocation={false}
      showsUserLocation={!isNavigationMode}
      showsCompass={!isNavigationMode}
      showsMyLocationButton={!isNavigationMode}
      rotateEnabled
      pitchEnabled={false}
      onRegionChangeComplete={onRegionChangeComplete}
      customMapStyle={
        useDarkStyle && Platform.OS === 'android'
          ? [
              { elementType: 'geometry', stylers: [{ color: '#2c3e50' }] },
              { elementType: 'labels.text.fill', stylers: [{ color: '#a0aec0' }] },
              { elementType: 'labels.text.stroke', stylers: [{ color: '#2c3e50' }] },
              { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#4a5568' }] },
              { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a0aec0' }] },
            ]
          : undefined
      }
    >
      {currentLocation && !isNavigationMode && (
        <Marker
          coordinate={{
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          }}
          title="Your Location"
          pinColor="#3182ce"
        />
      )}
      {currentLocation && isNavigationMode && (
        <Marker
          coordinate={{
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          }}
          anchor={{ x: 0.5, y: 0.5 }}
          flat
          tracksViewChanges={false}
          /**
           * Map camera already rotates with `heading` — do NOT rotate marker too (double rotation / jitter).
           * Arrow points “up” = direction of travel on screen.
           */
          rotation={0}
        >
          <View style={styles.navigationMarker} pointerEvents="none">
            <View style={styles.compassRing}>
              <Text style={styles.compassN}>N</Text>
              <Text style={styles.compassE}>E</Text>
              <Text style={styles.compassS}>S</Text>
              <Text style={styles.compassW}>W</Text>
            </View>
            <WazeStyleNavigationPuck />
          </View>
        </Marker>
      )}
      {showLocation && sharedLat && sharedLng && (
        <Marker
          coordinate={{
            latitude: sharedLat,
            longitude: sharedLng,
          }}
          title={address || 'Shared Location'}
          pinColor="#ff4444"
        />
      )}
      {showDirections && routeCoordinates.length > 0 && (
        <Polyline
          coordinates={routeCoordinates}
          strokeColor="#33ccff"
          strokeWidth={isNavigationMode ? 7 : 6}
          lineCap="round"
          lineJoin="round"
          zIndex={2}
          geodesic={false}
        />
      )}
      {trafficLights.map((tl) => (
        <Marker
          key={tl.id}
          coordinate={{ latitude: tl.latitude, longitude: tl.longitude }}
          title={`Traffic light — ${tl.name}`}
          description={
            tl.intersection
              ? `${tl.intersection}${tl.distanceKm != null ? ` · ~${tl.distanceKm.toFixed(1)} km` : ''}`
              : tl.distanceKm != null
                ? `~${tl.distanceKm.toFixed(1)} km away`
                : undefined
          }
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.trafficLightMarker}>
            <View style={[styles.trafficLightDot, styles.trafficRed]} />
            <View style={[styles.trafficLightDot, styles.trafficYellow]} />
            <View style={[styles.trafficLightDot, styles.trafficGreen]} />
          </View>
        </Marker>
      ))}
      {speedCameras.map((sc) => (
        <Marker
          key={sc.id}
          coordinate={{ latitude: sc.latitude, longitude: sc.longitude }}
          title={`Speed camera — ${sc.name}`}
          description={
            sc.road
              ? `${sc.road}${sc.distanceKm != null ? ` · ~${sc.distanceKm.toFixed(1)} km` : ''}`
              : sc.distanceKm != null
                ? `~${sc.distanceKm.toFixed(1)} km away`
                : 'Stay within speed limits'
          }
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={false}
        >
          <SpeedCameraMapIcon />
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: '#2c3e50',
  },
  navigationMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
  },
  /** Compass ring — world directions; map rotates so “N” tracks real north */
  compassRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.38)',
    backgroundColor: 'rgba(15,23,42,0.28)',
  },
  compassN: {
    position: 'absolute',
    top: 5,
    alignSelf: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: '#86efac',
    letterSpacing: 0.5,
  },
  compassE: {
    position: 'absolute',
    right: 7,
    top: '50%',
    marginTop: -8,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
  },
  compassS: {
    position: 'absolute',
    bottom: 5,
    alignSelf: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  compassW: {
    position: 'absolute',
    left: 7,
    top: '50%',
    marginTop: -8,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
  },
  wazePuckRoot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trafficLightMarker: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
  },
  trafficLightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginVertical: 1,
  },
  trafficRed: { backgroundColor: '#ef4444' },
  trafficYellow: { backgroundColor: '#eab308' },
  trafficGreen: { backgroundColor: '#22c55e' },
});
