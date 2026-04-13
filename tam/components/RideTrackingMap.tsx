import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { Region, Details } from 'react-native-maps';
import { Car, User, MapPin } from 'lucide-react-native';
import { Ride, LiveLocation } from '@/types/ride';
import type { RouteData } from '@/store/location-store';
import { decodePolyline } from '@/lib/navigation/polyline';
import { WazeStyleNavigationPuck } from '@/components/NativeMapViewFull';
import NextManeuverBar from '@/components/navigation/NextManeuverBar';
import { getNavigationGuidance } from '@/lib/navigation/guidance';

interface RideTrackingMapProps {
  ride: Ride;
  driverLocation: LiveLocation | null;
  passengerLocation: LiveLocation | null;
  currentUserLocation: { latitude: number; longitude: number } | null;
  routeToPickup?: { distance: string; duration: string };
  routeToDropoff?: { distance: string; duration: string };
  /** Driver: single summary row for the active navigation leg (pickup vs dropoff) */
  driverRouteSummary?: { distance: string; duration: string; label: string } | null;
  /** Full driving route (polyline + steps) for the driver — turn-by-turn and road geometry */
  driverNavRoute?: RouteData | null;
  /** When true, map follows heading and shows navigation puck */
  driverNavigationMode?: boolean;
  userHeading?: number;
  /** Show the next-turn banner (driver can dismiss while keeping the route line) */
  showDriverNavBanner?: boolean;
  onDismissDriverNavBanner?: () => void;
}

const KIGALI_CENTER = { latitude: -1.9441, longitude: 30.0619 };

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

function estimateZoomFromLongitudeDelta(longitudeDelta: number): number {
  const d = Math.max(1e-8, longitudeDelta);
  const z = Math.log2(360 / d);
  return Math.max(2, Math.min(21, z));
}

export default function RideTrackingMap({
  ride,
  driverLocation,
  passengerLocation,
  currentUserLocation,
  routeToPickup,
  routeToDropoff,
  driverRouteSummary = null,
  driverNavRoute = null,
  driverNavigationMode = false,
  userHeading = 0,
  showDriverNavBanner = false,
  onDismissDriverNavBanner,
}: RideTrackingMapProps) {
  const mapRef = useRef<MapView>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const lastNavCamAt = useRef(0);
  const lastNavCamHeading = useRef<number | null>(null);
  const lastNavCamLatLng = useRef<{ lat: number; lng: number } | null>(null);
  const navZoomRef = useRef(17);
  const lastNavAnimAt = useRef(0);
  const lastFittedPolylineRef = useRef<string | null>(null);
  const NAV_CAM_MIN_MS = 420;
  const NAV_HEADING_MIN_DELTA = 4;
  const NAV_MOVE_MIN_M = 6;
  const MIN_MS_AFTER_NAV_ANIM_FOR_USER_ZOOM = 480;

  const driverPos = driverLocation ?? ride.driverLocation;
  const passengerPos = passengerLocation ?? ride.passengerLocation;

  const navigationGuidance = useMemo(() => {
    if (!driverNavigationMode || !currentUserLocation || !driverNavRoute?.steps?.length) return null;
    return getNavigationGuidance(
      currentUserLocation.latitude,
      currentUserLocation.longitude,
      driverNavRoute.polyline,
      driverNavRoute.steps
    );
  }, [driverNavigationMode, currentUserLocation, driverNavRoute]);

  const allPoints: Array<{ latitude: number; longitude: number }> = [];
  if (driverPos) allPoints.push({ latitude: driverPos.latitude, longitude: driverPos.longitude });
  if (passengerPos) allPoints.push({ latitude: passengerPos.latitude, longitude: passengerPos.longitude });
  if (currentUserLocation) allPoints.push(currentUserLocation);
  if (ride.pickupLocation) allPoints.push({ latitude: ride.pickupLocation.latitude, longitude: ride.pickupLocation.longitude });
  if (ride.dropoffLocation) allPoints.push({ latitude: ride.dropoffLocation.latitude, longitude: ride.dropoffLocation.longitude });

  const routeCoordsPassenger: Array<{ latitude: number; longitude: number }> = [];
  if (driverPos) routeCoordsPassenger.push({ latitude: driverPos.latitude, longitude: driverPos.longitude });
  if (passengerPos) routeCoordsPassenger.push({ latitude: passengerPos.latitude, longitude: passengerPos.longitude });
  if (routeCoordsPassenger.length < 2 && currentUserLocation) {
    if (driverPos) routeCoordsPassenger.push(currentUserLocation);
    else if (passengerPos) routeCoordsPassenger.unshift(currentUserLocation);
  }

  const mapCenter =
    allPoints.length > 0
      ? {
          latitude: allPoints.reduce((s, p) => s + p.latitude, 0) / allPoints.length,
          longitude: allPoints.reduce((s, p) => s + p.longitude, 0) / allPoints.length,
        }
      : KIGALI_CENTER;

  const pickupPos = ride.pickupLocation;
  const dropoffPos = ride.dropoffLocation;

  const mapType = driverNavigationMode ? 'hybrid' : 'standard';
  const useDarkStyle = !driverNavigationMode;

  /** Decode OSRM/Google polyline for full road path (driver) */
  useEffect(() => {
    if (!driverNavigationMode) {
      lastFittedPolylineRef.current = null;
      setRouteCoordinates([]);
      return;
    }
    if (!driverNavRoute) {
      setRouteCoordinates([]);
      return;
    }
    const pl = driverNavRoute.polyline;
    if (pl && pl !== 'simulated_polyline_data') {
      try {
        const coords = decodePolyline(pl);
        // Need real road geometry — 2 points is effectively a straight “displacement” line
        if (coords.length >= 3) {
          setRouteCoordinates(coords);
          if (mapRef.current && pl !== lastFittedPolylineRef.current) {
            lastFittedPolylineRef.current = pl;
            mapRef.current.fitToCoordinates(coords, {
              edgePadding: { top: 100, right: 44, bottom: 120, left: 44 },
              animated: true,
            });
            lastNavAnimAt.current = Date.now();
            setTimeout(() => {
              mapRef.current?.getCamera().then((cam) => {
                if (typeof cam.zoom === 'number' && Number.isFinite(cam.zoom)) {
                  navZoomRef.current = cam.zoom;
                }
              }).catch(() => {});
            }, 600);
          }
          return;
        }
      } catch {
        /* invalid encoding */
      }
    }
    // Do not draw a straight user→destination line — that reads as displacement, not drivable roads
    setRouteCoordinates([]);
  }, [driverNavigationMode, driverNavRoute]);

  const applyNavigationCamera = useCallback(() => {
    if (!driverNavigationMode || !currentUserLocation || !mapRef.current) return;

    const now = Date.now();
    const lat = currentUserLocation.latitude;
    const lng = currentUserLocation.longitude;
    const prev = lastNavCamLatLng.current;
    const movedM = prev == null ? 999 : approxDistanceMeters(prev.lat, prev.lng, lat, lng);
    const headingDelta =
      lastNavCamHeading.current == null ? 999 : minHeadingDegrees(userHeading, lastNavCamHeading.current);

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
  }, [driverNavigationMode, currentUserLocation?.latitude, currentUserLocation?.longitude, userHeading]);

  useEffect(() => {
    if (!driverNavigationMode) {
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
  }, [driverNavigationMode, applyNavigationCamera]);

  const onRegionChangeComplete = useCallback(
    (region: Region, details?: Details) => {
      if (!driverNavigationMode || !mapRef.current) return;
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
    [driverNavigationMode]
  );

  const showDriverPolyline = driverNavigationMode && routeCoordinates.length >= 2;
  const showPassengerPolyline =
    !driverNavigationMode && routeCoordsPassenger.length >= 2;

  const defaultLat = currentUserLocation?.latitude ?? mapCenter.latitude;
  const defaultLng = currentUserLocation?.longitude ?? mapCenter.longitude;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType={mapType}
        {...(Platform.OS === 'web' && { googleMapsApiKey: 'AIzaSyCEmqLGnM67YcXjxkfbJaOICB3-dodxj4U' })}
        {...(driverNavigationMode
          ? {
              initialRegion: {
                latitude: defaultLat,
                longitude: defaultLng,
                latitudeDelta: 0.004,
                longitudeDelta: 0.004,
              },
            }
          : {
              region: {
                ...mapCenter,
                latitudeDelta: 0.03,
                longitudeDelta: 0.03,
              },
            })}
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
        showsUserLocation={false}
        showsMyLocationButton={!driverNavigationMode}
        showsCompass={!driverNavigationMode}
        rotateEnabled
        pitchEnabled={false}
      >
        {driverPos && !(driverNavigationMode && currentUserLocation) && (
          <Marker
            coordinate={{ latitude: driverPos.latitude, longitude: driverPos.longitude }}
            title="Driver"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.markerContainer, styles.driverMarker]}>
              <Car color="white" size={20} />
            </View>
          </Marker>
        )}
        {driverNavigationMode && currentUserLocation && (
          <Marker
            coordinate={{
              latitude: currentUserLocation.latitude,
              longitude: currentUserLocation.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            tracksViewChanges={false}
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
        {passengerPos && (
          <Marker
            coordinate={{ latitude: passengerPos.latitude, longitude: passengerPos.longitude }}
            title="Passenger"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.markerContainer, styles.passengerMarker]}>
              <User color="white" size={20} />
            </View>
          </Marker>
        )}
        {currentUserLocation && !driverPos && !passengerPos && (
          <Marker
            coordinate={currentUserLocation}
            title="You"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.markerContainer, styles.youMarker]}>
              <MapPin color="white" size={20} />
            </View>
          </Marker>
        )}
        {pickupPos && 'latitude' in pickupPos && (
          <Marker
            coordinate={{ latitude: pickupPos.latitude, longitude: pickupPos.longitude }}
            title="Pickup"
            pinColor="#22c55e"
          />
        )}
        {dropoffPos && 'latitude' in dropoffPos && (
          <Marker
            coordinate={{ latitude: dropoffPos.latitude, longitude: dropoffPos.longitude }}
            title="Dropoff"
            pinColor="#ef4444"
          />
        )}
        {showDriverPolyline && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#33ccff"
            strokeWidth={7}
            lineCap="round"
            lineJoin="round"
            zIndex={2}
            geodesic={false}
          />
        )}
        {showPassengerPolyline && (
          <Polyline
            coordinates={routeCoordsPassenger}
            strokeColor="#007AFF"
            strokeWidth={5}
          />
        )}
      </MapView>

      {showDriverNavBanner &&
        navigationGuidance &&
        onDismissDriverNavBanner &&
        driverNavigationMode && (
          <NextManeuverBar
            instruction={navigationGuidance.nextInstruction}
            distanceLabel={navigationGuidance.distanceLabel}
            onExit={onDismissDriverNavBanner}
            topOffset={12}
          />
        )}

      {(driverRouteSummary || routeToPickup || routeToDropoff) && (
        <View style={styles.etaPanel}>
          {driverRouteSummary && (
            <View style={styles.etaRow}>
              <Text style={styles.etaLabel}>{driverRouteSummary.label}</Text>
              <Text style={styles.etaValue}>
                {driverRouteSummary.distance} • {driverRouteSummary.duration}
              </Text>
            </View>
          )}
          {!driverRouteSummary && routeToPickup && (
            <View style={styles.etaRow}>
              <Text style={styles.etaLabel}>To pickup</Text>
              <Text style={styles.etaValue}>
                {routeToPickup.distance} • {routeToPickup.duration}
              </Text>
            </View>
          )}
          {!driverRouteSummary && routeToDropoff && (
            <View style={styles.etaRow}>
              <Text style={styles.etaLabel}>To dropoff</Text>
              <Text style={styles.etaValue}>
                {routeToDropoff.distance} • {routeToDropoff.duration}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  markerContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  driverMarker: {
    backgroundColor: '#2563eb',
  },
  passengerMarker: {
    backgroundColor: '#16a34a',
  },
  youMarker: {
    backgroundColor: '#7c3aed',
  },
  etaPanel: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  etaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  etaLabel: {
    fontSize: 14,
    color: '#666',
  },
  etaValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});
