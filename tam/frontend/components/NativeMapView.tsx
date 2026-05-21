import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Platform, View, Text } from 'react-native';
import MapView, { Marker, Callout, Circle, Polyline, type EdgePadding } from 'react-native-maps';
import { Car, Bike, MapPin } from 'lucide-react-native';
import type { OnlineDriverMarker } from '@/types/online-driver';
import { decodePolyline } from '@/lib/navigation/polyline';

interface Location {
  latitude: number;
  longitude: number;
  timestamp: string;
  address?: string;
  accuracyMeters?: number;
}

export interface NativeMapRouteOverlay {
  polyline: string;
  distance?: string;
  duration?: string;
}

export interface NativeMapViewProps {
  currentLocation: Location | null;
  /** When set, pickup pin uses this instead of currentLocation (manual / map tap). */
  pickupLocation?: Location | null;
  /** Trip destination marker + route endpoint */
  destinationLocation?: { latitude: number; longitude: number; label?: string } | null;
  routeOverlay?: NativeMapRouteOverlay | null;
  /** Drivers using the app nearby (real + optional demo) */
  nearbyDrivers?: OnlineDriverMarker[];
  /** Passenger taps a driver marker — opens booking flow on Home */
  onDriverPress?: (driver: OnlineDriverMarker) => void;
  /** Shown on pickup bubble when > 0 (e.g. “3 nearby”) — hidden when pickupEtaLabel is set */
  userNearbyDriverCount?: number;
  /** Trip ETA on pickup bubble (e.g. “18 min”) */
  pickupEtaLabel?: string | null;
  /** Tap map to choose pickup (Home passenger flow) */
  onMapPress?: (coord: { latitude: number; longitude: number }) => void;
  /** Keeps your pin in the visible area above bottom sheets / chrome */
  mapPadding?: EdgePadding;
}

const DEFAULT_LAT = -1.9441;
const DEFAULT_LNG = 30.0619;

const NativeMapView = forwardRef<MapView, NativeMapViewProps>(function NativeMapView(
  {
    currentLocation,
    pickupLocation,
    destinationLocation,
    routeOverlay,
    nearbyDrivers = [],
    onDriverPress,
    userNearbyDriverCount = 0,
    pickupEtaLabel,
    onMapPress,
    mapPadding,
  },
  ref
) {
  const pinLocation = pickupLocation ?? currentLocation;

  const routeCoordinates = useMemo(() => {
    if (!routeOverlay || !pinLocation || !destinationLocation) return [];
    if (routeOverlay.polyline && routeOverlay.polyline !== 'simulated_polyline_data') {
      try {
        const coords = decodePolyline(routeOverlay.polyline);
        if (coords.length >= 2) return coords;
      } catch {
        /* fall through */
      }
    }
    return [
      { latitude: pinLocation.latitude, longitude: pinLocation.longitude },
      { latitude: destinationLocation.latitude, longitude: destinationLocation.longitude },
    ];
  }, [
    routeOverlay?.polyline,
    pinLocation?.latitude,
    pinLocation?.longitude,
    destinationLocation?.latitude,
    destinationLocation?.longitude,
  ]);

  const acc = pinLocation?.accuracyMeters;
  const circleRadius =
    typeof acc === 'number' && Number.isFinite(acc) && acc > 0
      ? Math.min(Math.max(acc, 10), 450)
      : null;

  const bubbleLabel =
    pickupEtaLabel?.trim() ||
    (userNearbyDriverCount > 0 ? `${userNearbyDriverCount} NEARBY` : null);

  return (
    <View style={styles.mapWrap}>
      <MapView
        ref={ref}
        style={styles.map}
        initialRegion={{
          latitude: DEFAULT_LAT,
          longitude: DEFAULT_LNG,
          latitudeDelta: 0.045,
          longitudeDelta: 0.045,
        }}
        {...(Platform.OS === 'web' && { googleMapsApiKey: 'AIzaSyCEmqLGnM67YcXjxkfbJaOICB3-dodxj4U' })}
        mapPadding={mapPadding}
        showsUserLocation={false}
        showsMyLocationButton={false}
        rotateEnabled
        pitchEnabled={false}
        onPress={
          onMapPress
            ? (e) => onMapPress(e.nativeEvent.coordinate)
            : undefined
        }
        customMapStyle={
          /** Google Maps JSON styles only — iOS Apple Maps rejects them and can red-screen. */
          Platform.OS === 'android'
            ? [
                { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
                { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
                { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
                { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
              ]
            : undefined
        }
      >
        {routeCoordinates.length >= 2 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#2563eb"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {pinLocation && circleRadius != null && (
          <Circle
            center={{
              latitude: pinLocation.latitude,
              longitude: pinLocation.longitude,
            }}
            radius={circleRadius}
            fillColor="rgba(37, 99, 235, 0.14)"
            strokeColor="rgba(29, 78, 216, 0.55)"
            strokeWidth={1.5}
          />
        )}
        {pinLocation && (
          <Marker
            coordinate={{
              latitude: pinLocation.latitude,
              longitude: pinLocation.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.pickupColumn}>
              {bubbleLabel ? (
                <View style={styles.etaBubble}>
                  <Text style={styles.etaBubbleText}>{bubbleLabel}</Text>
                </View>
              ) : null}
              <View style={styles.pickupPulseOuter}>
                <View style={styles.pickupPulseInner}>
                  <View style={styles.pickupDot} />
                </View>
              </View>
            </View>
          </Marker>
        )}

        {destinationLocation && (
          <Marker
            coordinate={{
              latitude: destinationLocation.latitude,
              longitude: destinationLocation.longitude,
            }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.destColumn}>
              <View style={styles.destPin}>
                <MapPin color="#fff" size={18} strokeWidth={2.5} />
              </View>
            </View>
          </Marker>
        )}

        {nearbyDrivers.map((d) => (
          <Marker
            key={d.userId}
            coordinate={{ latitude: d.latitude, longitude: d.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => onDriverPress?.(d)}
          >
            <View style={styles.markerColumn}>
              {d.vehiclePlate?.trim() ? (
                <Text style={styles.plateTag} numberOfLines={1}>
                  {d.vehiclePlate.trim()}
                </Text>
              ) : null}
              <View
                style={[
                  styles.driverPin,
                  d.transportType === 'car' ? styles.driverPinCar : styles.driverPinMoto,
                ]}
              >
                {d.transportType === 'car' ? (
                  <Car color="#fff" size={16} strokeWidth={2.5} />
                ) : (
                  <Bike color="#fff" size={16} strokeWidth={2.5} />
                )}
              </View>
            </View>
            <Callout onPress={() => onDriverPress?.(d)}>
              <View style={styles.calloutBox}>
                <Text style={styles.calloutTitle}>
                  {d.transportType === 'motorbike' ? 'Taxi moto' : 'Taxi car'}
                  {d.isDemo ? ' · Demo' : ''}
                </Text>
                <Text style={styles.calloutLine}>{d.username ?? 'Driver'}</Text>
                <Text style={styles.calloutPlate}>
                  Plate: {d.vehiclePlate?.trim() || '—'}
                </Text>
                {d.vehicleModel?.trim() ? (
                  <Text style={styles.calloutLine} numberOfLines={2}>
                    {d.vehicleModel.trim()}
                  </Text>
                ) : null}
                <Text style={styles.calloutHint}>Tap for driver details</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </View>
  );
});

export default NativeMapView;

const styles = StyleSheet.create({
  mapWrap: {
    flex: 1,
    width: '100%',
    minHeight: 200,
  },
  map: {
    flex: 1,
    width: '100%',
  },
  pickupColumn: {
    alignItems: 'center',
  },
  destColumn: {
    alignItems: 'center',
  },
  destPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#16a34a',
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  etaBubble: {
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
  etaBubbleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.4,
  },
  pickupPulseOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(37, 99, 235, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupPulseInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  pickupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  driverPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 4,
  },
  driverPinMoto: {
    backgroundColor: '#ea580c',
  },
  driverPinCar: {
    backgroundColor: '#16a34a',
  },
  markerColumn: {
    alignItems: 'center',
  },
  plateTag: {
    marginBottom: 2,
    maxWidth: 88,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(15,23,42,0.88)',
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
  },
  calloutBox: {
    width: 200,
    padding: 10,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  calloutLine: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 2,
  },
  calloutPlate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
    marginBottom: 2,
  },
  calloutHint: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 6,
  },
});
