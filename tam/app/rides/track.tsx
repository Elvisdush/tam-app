import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, MessageSquare } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useRideStore } from '@/store/ride-store';
import { useLocationStore } from '@/store/location-store';
import { useAuthStore } from '@/store/auth-store';
import RideTrackingMap from '@/components/RideTrackingMap';
import { Ride, LiveLocation } from '@/types/ride';

export default function RideTrackScreen() {
  const params = useLocalSearchParams<{ rideId: string }>();
  const rideId = params.rideId;
  const user = useAuthStore((s) => s.user);
  const users = useAuthStore((s) => s.users);
  const isDriver = user?.type === 'driver';

  const { currentLocation, startLocationTracking, calculateRoute } = useLocationStore();
  const {
    rides,
    subscribeToRideLocations,
    updateDriverLocation,
    updatePassengerLocation,
  } = useRideStore();

  const [ride, setRide] = useState<Ride | null>(null);
  const [routeToPickup, setRouteToPickup] = useState<{ distance: string; duration: string } | null>(null);
  const [routeToDropoff, setRouteToDropoff] = useState<{ distance: string; duration: string } | null>(null);
  const locationUpdateInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const firebaseKey = ride?.firebaseKey ?? rideId ?? String(ride?.id);

  useEffect(() => {
    startLocationTracking();
  }, [startLocationTracking]);

  useEffect(() => {
    if (!firebaseKey) return;

    const unsubscribe = subscribeToRideLocations(firebaseKey as any, (updatedRide) => {
      setRide({ ...updatedRide, firebaseKey });
    });

    const found = rides.find((r) => String(r.id) === rideId || r.firebaseKey === rideId);
    if (found) setRide(found);

    return unsubscribe;
  }, [firebaseKey, rideId, subscribeToRideLocations, rides]);

  useEffect(() => {
    if (!currentLocation || !ride || !firebaseKey) return;

    const location: LiveLocation = {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      timestamp: new Date().toISOString(),
      address: currentLocation.address,
    };

    if (isDriver) {
      updateDriverLocation(firebaseKey as any, location);
    } else {
      updatePassengerLocation(firebaseKey as any, location);
    }
  }, [currentLocation?.latitude, currentLocation?.longitude, isDriver, firebaseKey]);

  useEffect(() => {
    locationUpdateInterval.current = setInterval(() => {
      if (!currentLocation || !ride || !firebaseKey) return;

      const location: LiveLocation = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        timestamp: new Date().toISOString(),
        address: currentLocation.address,
      };

      if (isDriver) {
        updateDriverLocation(firebaseKey as any, location);
      } else {
        updatePassengerLocation(firebaseKey as any, location);
      }
    }, 5000);

    return () => {
      if (locationUpdateInterval.current) {
        clearInterval(locationUpdateInterval.current);
      }
    };
  }, [currentLocation, ride, firebaseKey, isDriver, updateDriverLocation, updatePassengerLocation]);

  useEffect(() => {
    if (!ride || !currentLocation) return;

    const driverPos = ride.driverLocation ?? (isDriver ? currentLocation : null);
    const passengerPos = ride.passengerLocation ?? (!isDriver ? currentLocation : null);

    const pickup = ride.pickupLocation ?? (isDriver ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : passengerPos);
    const dropoff = ride.dropoffLocation ?? (isDriver ? passengerPos : { latitude: currentLocation.latitude, longitude: currentLocation.longitude });

    if (isDriver && passengerPos) {
      calculateRoute(
        { ...currentLocation, timestamp: '' },
        { latitude: passengerPos.latitude, longitude: passengerPos.longitude, timestamp: '' }
      ).then((route) => route && setRouteToPickup({ distance: route.distance, duration: route.duration }));
    } else if (!isDriver && driverPos) {
      calculateRoute(
        { ...currentLocation, timestamp: '' },
        { latitude: driverPos.latitude, longitude: driverPos.longitude, timestamp: '' }
      ).then((route) => route && setRouteToPickup({ distance: route.distance, duration: route.duration }));
    }
  }, [ride, currentLocation, isDriver, calculateRoute]);

  if (!ride && !rideId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading ride...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayRide = ride ?? { from: 'Unknown', to: 'Unknown', id: 0 } as Ride;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft color="#fff" size={24} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Track Ride</Text>
          <Text style={styles.headerSubtitle}>
            {displayRide.from} → {displayRide.to}
          </Text>
        </View>
      </View>

      <View style={styles.mapWrapper}>
        <RideTrackingMap
          ride={displayRide}
          driverLocation={ride?.driverLocation ?? null}
          passengerLocation={ride?.passengerLocation ?? null}
          currentUserLocation={currentLocation}
          routeToPickup={routeToPickup ?? undefined}
          routeToDropoff={routeToDropoff ?? undefined}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {isDriver ? 'Your location is shared with the passenger' : 'Your location is shared with the driver'}
        </Text>
      </View>

      {ride && (() => {
        const partnerId = isDriver ? ride.passengerId : ride.driverId;
        const partner = users.find((u) => u.id === partnerId);
        return partner ? (
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() =>
              router.push({
                pathname: '/chat/[id]',
                params: {
                  id: partner.id,
                  name: partner.username,
                  profileImage: partner.profileImage ?? '',
                  from: ride.from,
                  to: ride.to,
                  price: `${ride.price} RWF`,
                },
              })
            }
          >
            <MessageSquare color="white" size={22} />
            <Text style={styles.chatButtonText}>Chat</Text>
          </TouchableOpacity>
        ) : null;
      })()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#16213e',
  },
  backButton: {
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#a0aec0',
    marginTop: 2,
  },
  mapWrapper: {
    flex: 1,
  },
  footer: {
    padding: 16,
    backgroundColor: '#16213e',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  chatButton: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
