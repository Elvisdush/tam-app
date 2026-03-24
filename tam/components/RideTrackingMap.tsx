import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Car, User, MapPin } from 'lucide-react-native';
import { Ride, LiveLocation } from '@/types/ride';

interface RideTrackingMapProps {
  ride: Ride;
  driverLocation: LiveLocation | null;
  passengerLocation: LiveLocation | null;
  currentUserLocation: { latitude: number; longitude: number } | null;
  routeToPickup?: { distance: string; duration: string };
  routeToDropoff?: { distance: string; duration: string };
}

const KIGALI_CENTER = { latitude: -1.9441, longitude: 30.0619 };

export default function RideTrackingMap({
  ride,
  driverLocation,
  passengerLocation,
  currentUserLocation,
  routeToPickup,
  routeToDropoff,
}: RideTrackingMapProps) {
  const driverPos = driverLocation ?? ride.driverLocation;
  const passengerPos = passengerLocation ?? ride.passengerLocation;

  const allPoints: Array<{ latitude: number; longitude: number }> = [];
  if (driverPos) allPoints.push({ latitude: driverPos.latitude, longitude: driverPos.longitude });
  if (passengerPos) allPoints.push({ latitude: passengerPos.latitude, longitude: passengerPos.longitude });
  if (currentUserLocation) allPoints.push(currentUserLocation);
  if (ride.pickupLocation) allPoints.push({ latitude: ride.pickupLocation.latitude, longitude: ride.pickupLocation.longitude });
  if (ride.dropoffLocation) allPoints.push({ latitude: ride.dropoffLocation.latitude, longitude: ride.dropoffLocation.longitude });

  const routeCoords: Array<{ latitude: number; longitude: number }> = [];
  if (driverPos) routeCoords.push({ latitude: driverPos.latitude, longitude: driverPos.longitude });
  if (passengerPos) routeCoords.push({ latitude: passengerPos.latitude, longitude: passengerPos.longitude });
  if (routeCoords.length < 2 && currentUserLocation) {
    if (driverPos) routeCoords.push(currentUserLocation);
    else if (passengerPos) routeCoords.unshift(currentUserLocation);
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

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        {...(Platform.OS === 'web' && { googleMapsApiKey: 'AIzaSyCEmqLGnM67YcXjxkfbJaOICB3-dodxj4U' })}
        region={{
          ...mapCenter,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }}
        customMapStyle={[
          { elementType: 'geometry', stylers: [{ color: '#2c3e50' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#a0aec0' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#2c3e50' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#4a5568' }] },
          { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a0aec0' }] },
        ]}
        showsUserLocation={false}
        showsMyLocationButton
        showsCompass
      >
        {driverPos && (
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
        {routeCoords.length >= 2 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#007AFF"
            strokeWidth={5}
          />
        )}
      </MapView>

      {(routeToPickup || routeToDropoff) && (
        <View style={styles.etaPanel}>
          {routeToPickup && (
            <View style={styles.etaRow}>
              <Text style={styles.etaLabel}>To pickup</Text>
              <Text style={styles.etaValue}>{routeToPickup.distance} • {routeToPickup.duration}</Text>
            </View>
          )}
          {routeToDropoff && (
            <View style={styles.etaRow}>
              <Text style={styles.etaLabel}>To dropoff</Text>
              <Text style={styles.etaValue}>{routeToDropoff.distance} • {routeToDropoff.duration}</Text>
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
