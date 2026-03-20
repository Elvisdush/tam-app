import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { TrafficLight } from '@/constants/traffic-light-locations';

interface Location {
  latitude: number;
  longitude: number;
  timestamp: string;
  address?: string;
}

interface RouteData {
  distance: string;
  duration: string;
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
  onRouteUpdate?: () => void;
  /** Traffic lights to show on map (nearby) */
  trafficLights?: Array<TrafficLight & { distanceKm?: number }>;
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
  onRouteUpdate,
  trafficLights = [],
}: NativeMapViewFullProps) {
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{latitude: number; longitude: number}>>([]);
  const [userHeading, setUserHeading] = useState<number>(0);

  useEffect(() => {
    if (showDirections && currentLocation && sharedLat && sharedLng) {
      const updateRoute = () => {
        const coords = [
          {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          },
          {
            latitude: sharedLat,
            longitude: sharedLng,
          },
        ];
        setRouteCoordinates(coords);
        if (onRouteUpdate) {
          onRouteUpdate();
        }
      };

      updateRoute();
      const interval = setInterval(updateRoute, 3000);

      return () => clearInterval(interval);
    }
  }, [showDirections, currentLocation, sharedLat, sharedLng, onRouteUpdate]);

  return (
    <MapView
      style={styles.map}
      {...(Platform.OS === 'web' && { googleMapsApiKey: 'AIzaSyCEmqLGnM67YcXjxkfbJaOICB3-dodxj4U' })}
      region={{
        latitude: currentLocation?.latitude || sharedLat || -1.9441,
        longitude: currentLocation?.longitude || sharedLng || 30.0619,
        latitudeDelta: isNavigationMode ? 0.005 : 0.018,
        longitudeDelta: isNavigationMode ? 0.005 : 0.018,
      }}
      followsUserLocation={isNavigationMode}
      showsUserLocation={!isNavigationMode}
      showsCompass={!isNavigationMode}
      showsMyLocationButton={!isNavigationMode}
      customMapStyle={[
        {
          elementType: 'geometry',
          stylers: [{ color: '#2c3e50' }],
        },
        {
          elementType: 'labels.text.fill',
          stylers: [{ color: '#a0aec0' }],
        },
        {
          elementType: 'labels.text.stroke',
          stylers: [{ color: '#2c3e50' }],
        },
        {
          featureType: 'road',
          elementType: 'geometry',
          stylers: [{ color: '#4a5568' }],
        },
        {
          featureType: 'road',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#a0aec0' }],
        },
      ]}
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
          strokeWidth={6}
        />
      )}
      {trafficLights.map((tl) => (
        <Marker
          key={tl.id}
          coordinate={{ latitude: tl.latitude, longitude: tl.longitude }}
          title={`Traffic light - ${tl.name}`}
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
