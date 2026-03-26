import React from 'react';
import { StyleSheet, Image, TouchableOpacity, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

interface NearbyPassenger {
  id: string;
  name: string;
  profileImage: string;
  from: string;
  to: string;
  price: string;
  distance: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

interface Location {
  latitude: number;
  longitude: number;
  timestamp: string;
  address?: string;
}

interface NativeMapViewNearbyProps {
  currentLocation: Location | null;
  passengers: NearbyPassenger[];
  onPassengerPress: (passenger: NearbyPassenger) => void;
}

export default function NativeMapViewNearby({ 
  currentLocation, 
  passengers,
  onPassengerPress 
}: NativeMapViewNearbyProps) {
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
      customMapStyle={
        Platform.OS === 'android'
          ? [
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
          title="Your Location"
          pinColor="#3182ce"
        />
      )}
      {passengers.map((passenger) => (
        <Marker
          key={passenger.id}
          coordinate={{
            latitude: passenger.location.latitude,
            longitude: passenger.location.longitude,
          }}
          onPress={() => onPassengerPress(passenger)}
        >
          <TouchableOpacity 
            style={styles.passengerPin}
            onPress={() => onPassengerPress(passenger)}
          >
            <Image 
              source={{ uri: passenger.profileImage }} 
              style={styles.pinAvatar} 
            />
          </TouchableOpacity>
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
  passengerPin: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  pinAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
