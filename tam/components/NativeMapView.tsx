import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

interface Location {
  latitude: number;
  longitude: number;
  timestamp: string;
  address?: string;
}

interface NativeMapViewProps {
  currentLocation: Location | null;
}

export default function NativeMapView({ currentLocation }: NativeMapViewProps) {
  return (
    <MapView
      style={styles.map}
      {...(Platform.OS === 'web' && { googleMapsApiKey: 'AIzaSyCEmqLGnM67YcXjxkfbJaOICB3-dodxj4U' })}
      region={{
        latitude: currentLocation?.latitude || -1.9441,
        longitude: currentLocation?.longitude || 30.0619,
        latitudeDelta: 0.018,
        longitudeDelta: 0.018,
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
          title="Your Location"
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
  },
});
