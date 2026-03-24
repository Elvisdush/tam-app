import React from 'react';
import { StyleSheet, Platform, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Car, Bike } from 'lucide-react-native';
import type { OnlineDriverMarker } from '@/types/online-driver';

interface Location {
  latitude: number;
  longitude: number;
  timestamp: string;
  address?: string;
}

interface NativeMapViewProps {
  currentLocation: Location | null;
  /** Drivers using the app nearby (real + optional demo) */
  nearbyDrivers?: OnlineDriverMarker[];
  /** Passenger taps a driver marker — opens booking flow on Home */
  onDriverPress?: (driver: OnlineDriverMarker) => void;
}

export default function NativeMapView({
  currentLocation,
  nearbyDrivers = [],
  onDriverPress,
}: NativeMapViewProps) {
  return (
    <MapView
      style={styles.map}
      {...(Platform.OS === 'web' && { googleMapsApiKey: 'AIzaSyCEmqLGnM67YcXjxkfbJaOICB3-dodxj4U' })}
      region={{
        latitude: currentLocation?.latitude || -1.9441,
        longitude: currentLocation?.longitude || 30.0619,
        latitudeDelta: 0.045,
        longitudeDelta: 0.045,
      }}
      customMapStyle={[
        {
          elementType: 'geometry',
          stylers: [{ color: '#f5f5f5' }],
        },
        {
          elementType: 'labels.icon',
          stylers: [{ visibility: 'off' }],
        },
        {
          elementType: 'labels.text.fill',
          stylers: [{ color: '#616161' }],
        },
        {
          elementType: 'labels.text.stroke',
          stylers: [{ color: '#f5f5f5' }],
        },
      ]}
    >
      {currentLocation && (
        <Marker
          coordinate={{
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          }}
          title="You"
          pinColor="#3182ce"
        />
      )}
      {nearbyDrivers.map((d) => (
        <Marker
          key={d.userId}
          coordinate={{ latitude: d.latitude, longitude: d.longitude }}
          title={d.transportType === 'motorbike' ? 'Taxi moto' : 'Taxi car'}
          description={d.isDemo ? `${d.username ?? 'Demo'} · test` : d.username ?? 'Driver'}
          onPress={() => onDriverPress?.(d)}
        >
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
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
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
  driverPinText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
});
