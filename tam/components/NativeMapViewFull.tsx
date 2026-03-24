import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { decodePolyline } from '@/lib/navigation/polyline';

interface TrafficLightMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  intersection?: string;
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
}: NativeMapViewFullProps) {
  const mapRef = useRef<MapView>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const hasCenteredOnUser = useRef(false);

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

  useEffect(() => {
    if (!showDirections) {
      setRouteCoordinates([]);
      return;
    }
    if (currentLocation && sharedLat != null && sharedLng != null) {
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
    }
  }, [showDirections, currentLocation, sharedLat, sharedLng, currentRoute?.polyline, onRouteUpdate]);

  // Follow position + heading in navigation (satellite / road hybrid view)
  useEffect(() => {
    if (!isNavigationMode || !currentLocation || !mapRef.current) return;

    const cam: {
      center: { latitude: number; longitude: number };
      pitch: number;
      heading: number;
      zoom: number;
      altitude?: number;
    } = {
      center: {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      },
      pitch: 0,
      heading: userHeading,
      zoom: 17,
    };

    try {
      mapRef.current.animateCamera(cam, { duration: 400 });
    } catch {
      mapRef.current.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        },
        400
      );
    }
  }, [isNavigationMode, currentLocation?.latitude, currentLocation?.longitude, userHeading]);

  const defaultLat = currentLocation?.latitude || sharedLat || -1.9441;
  const defaultLng = currentLocation?.longitude || sharedLng || 30.0619;

  return (
    <MapView
      key={isNavigationMode ? 'navigation' : 'browse'}
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
            region: {
              latitude: defaultLat,
              longitude: defaultLng,
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
      customMapStyle={
        useDarkStyle
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
          rotation={userHeading}
        >
          <View style={styles.navigationMarker}>
            <View style={styles.navigationArrowContainer}>
              <View style={styles.navigationArrow} />
            </View>
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
          title={`Traffic light - ${tl.name}`}
          description={tl.intersection ? String(tl.intersection) : undefined}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.trafficLightMarker}>
            <View style={[styles.trafficLightDot, styles.trafficRed]} />
            <View style={[styles.trafficLightDot, styles.trafficYellow]} />
            <View style={[styles.trafficLightDot, styles.trafficGreen]} />
          </View>
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
  },
  navigationArrowContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  navigationArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 15,
    borderRightWidth: 15,
    borderBottomWidth: 30,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#33ccff',
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
