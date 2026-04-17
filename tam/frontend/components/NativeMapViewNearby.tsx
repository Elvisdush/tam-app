import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { StyleSheet, Image, Platform, View, TouchableOpacity } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Crosshair, User } from 'lucide-react-native';

/** Pin data for the driver “nearby passengers” map — exported so it matches `app/nearby.tsx` */
export interface NearbyPassengerPin {
  id: string;
  rideId: string;
  name: string;
  profileImage: string;
  from: string;
  to: string;
  price: string;
  distance: string;
  transportType: 'car' | 'motorbike';
  location: {
    latitude: number;
    longitude: number;
  };
}

export type NativeMapViewNearbyRef = {
  recenter: () => void;
};

interface Location {
  latitude: number;
  longitude: number;
  timestamp: string;
  address?: string;
}

interface NativeMapViewNearbyProps {
  currentLocation: Location | null;
  passengers: NearbyPassengerPin[];
  onPassengerPress: (passenger: NearbyPassengerPin) => void;
}

const DEFAULT_DELTA = 0.06;

const NativeMapViewNearby = forwardRef<NativeMapViewNearbyRef, NativeMapViewNearbyProps>(
  function NativeMapViewNearby({ currentLocation, passengers, onPassengerPress }, ref) {
    const mapRef = useRef<MapView>(null);

    const fitMap = useCallback(() => {
      const coords: Array<{ latitude: number; longitude: number }> = [];
      if (currentLocation) {
        coords.push({ latitude: currentLocation.latitude, longitude: currentLocation.longitude });
      }
      for (const p of passengers) {
        coords.push({ latitude: p.location.latitude, longitude: p.location.longitude });
      }
      if (coords.length === 0) return;
      if (coords.length === 1) {
        mapRef.current?.animateToRegion(
          {
            ...coords[0],
            latitudeDelta: DEFAULT_DELTA,
            longitudeDelta: DEFAULT_DELTA,
          },
          350
        );
      } else {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 72, right: 48, bottom: 48, left: 48 },
          animated: true,
        });
      }
    }, [currentLocation, passengers]);

    useImperativeHandle(ref, () => ({ recenter: fitMap }), [fitMap]);

    useEffect(() => {
      const t = setTimeout(fitMap, 120);
      return () => clearTimeout(t);
    }, [fitMap]);

    const centerLat = currentLocation?.latitude ?? -1.9441;
    const centerLng = currentLocation?.longitude ?? 30.0619;

    return (
      <View style={styles.wrap}>
        <MapView
          ref={mapRef}
          style={styles.map}
          {...(Platform.OS === 'web' && { googleMapsApiKey: 'AIzaSyCEmqLGnM67YcXjxkfbJaOICB3-dodxj4U' })}
          initialRegion={{
            latitude: centerLat,
            longitude: centerLng,
            latitudeDelta: DEFAULT_DELTA,
            longitudeDelta: DEFAULT_DELTA,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          customMapStyle={
            Platform.OS === 'android'
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
          {currentLocation && (
            <Marker
              coordinate={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              }}
              title="You"
              description="Your position"
              pinColor="#2563eb"
            />
          )}
          {passengers.map((passenger) => (
            <Marker
              key={passenger.id}
              coordinate={{
                latitude: passenger.location.latitude,
                longitude: passenger.location.longitude,
              }}
              title={passenger.name}
              description={`${passenger.distance} · ${passenger.from}`}
              onPress={() => onPassengerPress(passenger)}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.passengerPin} pointerEvents="none">
                <Image source={{ uri: passenger.profileImage }} style={styles.pinAvatar} />
                <View style={styles.pinBadge}>
                  <User color="#fff" size={10} strokeWidth={2.5} />
                </View>
              </View>
            </Marker>
          ))}
        </MapView>

        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={fitMap}
          activeOpacity={0.85}
          accessibilityLabel="Fit map to you and passengers"
        >
          <Crosshair color="#1e293b" size={22} strokeWidth={2.25} />
        </TouchableOpacity>
      </View>
    );
  }
);

export default NativeMapViewNearby;

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
    backgroundColor: '#2c3e50',
  },
  recenterBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  passengerPin: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#22c55e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  pinAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  pinBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
