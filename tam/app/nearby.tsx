import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, X, Car, Bike } from 'lucide-react-native';
import { router } from 'expo-router';
import { useLocationStore } from '@/store/location-store';
import { useRideStore } from '@/store/ride-store';
import { useAuthStore } from '@/store/auth-store';
import NativeMapViewNearby, { type NearbyPassengerPin } from '@/components/NativeMapViewNearby';

const NEARBY_RADIUS_KM = 15;

const DEFAULT_PASSENGER_AVATAR =
  'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop';

function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export default function NearbyScreen() {
  const [selectedPassenger, setSelectedPassenger] = useState<NearbyPassengerPin | null>(null);
  const [showModal, setShowModal] = useState(false);

  const { currentLocation, startLocationTracking } = useLocationStore();
  const rides = useRideStore((s) => s.rides);
  const loadRides = useRideStore((s) => s.loadRides);
  const acceptRide = useRideStore((s) => s.acceptRide);
  const getWaitingPassengerRidesNearLocation = useRideStore((s) => s.getWaitingPassengerRidesNearLocation);

  const user = useAuthStore((s) => s.user);
  const users = useAuthStore((s) => s.users);

  const isDriver = user?.type === 'driver';

  useEffect(() => {
    startLocationTracking();
    loadRides();
  }, [startLocationTracking, loadRides]);

  const nearbyPassengers: NearbyPassengerPin[] = useMemo(() => {
    if (!isDriver || !currentLocation) return [];

    const rows = getWaitingPassengerRidesNearLocation(
      currentLocation.latitude,
      currentLocation.longitude,
      NEARBY_RADIUS_KM
    );

    return rows.map(({ ride, distanceKm }) => {
      const loc = ride.passengerLocation ?? ride.pickupLocation!;
      const passengerUser = users.find((u) => u.id === ride.passengerId);
      const rideKey = ride.firebaseKey ?? String(ride.id);

      return {
        id: rideKey,
        rideId: rideKey,
        name: passengerUser?.username ?? 'Passenger',
        profileImage: passengerUser?.profileImage ?? DEFAULT_PASSENGER_AVATAR,
        from: ride.from,
        to: ride.to,
        price: `${ride.price} RWF`,
        distance: formatDistanceKm(distanceKm),
        transportType: ride.transportType,
        location: {
          latitude: loc.latitude,
          longitude: loc.longitude,
        },
      };
    });
  }, [isDriver, currentLocation, rides, users, getWaitingPassengerRidesNearLocation]);

  const handlePassengerPress = (passenger: NearbyPassengerPin) => {
    setSelectedPassenger(passenger);
    setShowModal(true);
  };

  const handleTakePassenger = () => {
    if (!selectedPassenger || !user?.id || user.type !== 'driver') return;
    setShowModal(false);
    const rideId = selectedPassenger.rideId;
    acceptRide(rideId, { driverId: user.id });
    router.push({
      pathname: '/rides/track',
      params: { rideId },
    });
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft color="#333" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nearby passengers</Text>
        </View>
        <View style={styles.driverOnlyWrap}>
          <Text style={styles.driverOnlyTitle}>Sign in</Text>
          <Text style={styles.driverOnlyText}>
            Sign in as a driver to see passengers who are waiting for a ride near you.
          </Text>
          <TouchableOpacity style={styles.driverOnlyBtn} onPress={() => router.push('/auth/sign-in')}>
            <Text style={styles.driverOnlyBtnText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!isDriver) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft color="#333" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nearby passengers</Text>
        </View>
        <View style={styles.driverOnlyWrap}>
          <Text style={styles.driverOnlyTitle}>Drivers only</Text>
          <Text style={styles.driverOnlyText}>
            This map shows passengers waiting for a ride near you. Switch to a driver account to use it.
          </Text>
          <TouchableOpacity style={styles.driverOnlyBtn} onPress={() => router.back()}>
            <Text style={styles.driverOnlyBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft color="#333" size={24} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Nearby passengers</Text>
          <Text style={styles.headerSubtitle}>
            {currentLocation
              ? `Within ${NEARBY_RADIUS_KM} km · waiting for a driver`
              : 'Turn on location to see who is near you'}
          </Text>
        </View>
      </View>

      <View style={styles.mapContainer}>
        {!currentLocation ? (
          <View style={styles.locLoading}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.locLoadingText}>Getting your position…</Text>
          </View>
        ) : (
          <NativeMapViewNearby
            currentLocation={currentLocation}
            passengers={nearbyPassengers}
            onPassengerPress={handlePassengerPress}
          />
        )}
      </View>

      <View style={styles.passengerList}>
        {nearbyPassengers.length > 0 ? (
          <FlatList
            data={nearbyPassengers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.passengerItem} onPress={() => handlePassengerPress(item)}>
                <Image source={{ uri: item.profileImage }} style={styles.passengerAvatar} />
                <View style={styles.passengerInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.passengerName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View
                      style={[
                        styles.modeBadge,
                        item.transportType === 'car' ? styles.modeCar : styles.modeMoto,
                      ]}
                    >
                      {item.transportType === 'car' ? (
                        <Car color="#fff" size={12} />
                      ) : (
                        <Bike color="#fff" size={12} />
                      )}
                    </View>
                  </View>
                  <Text style={styles.passengerLocation} numberOfLines={1}>
                    {item.from} → {item.to}
                  </Text>
                </View>
                <View style={styles.distanceContainer}>
                  <Text style={styles.distance}>{item.distance}</Text>
                  <Text style={styles.arrowText}>→</Text>
                </View>
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No passengers nearby</Text>
            <Text style={styles.emptyText}>
              {currentLocation
                ? `No open ride requests within ${NEARBY_RADIUS_KM} km right now. New posts appear here when passengers request a pickup.`
                : 'Enable location services to see passengers waiting near you.'}
            </Text>
          </View>
        )}
      </View>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowModal(false)}>
          <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            {selectedPassenger && (
              <>
                <TouchableOpacity style={styles.closeButton} onPress={() => setShowModal(false)}>
                  <X color="#666" size={24} />
                </TouchableOpacity>

                <Image source={{ uri: selectedPassenger.profileImage }} style={styles.modalAvatar} />

                <Text style={styles.modalName}>{selectedPassenger.name}</Text>

                <View style={styles.tripDetails}>
                  <Text style={styles.tripLabel}>
                    From: <Text style={styles.tripValue}>{selectedPassenger.from}</Text>
                  </Text>
                  <Text style={styles.tripLabel}>
                    To: <Text style={styles.tripValue}>{selectedPassenger.to}</Text>
                  </Text>
                  <Text style={styles.tripLabel}>
                    Offer: <Text style={styles.tripValue}>{selectedPassenger.price}</Text>
                  </Text>
                  <Text style={styles.tripLabel}>
                    Distance: <Text style={styles.tripValue}>{selectedPassenger.distance}</Text>
                  </Text>
                </View>

                <TouchableOpacity style={styles.takePassengerButton} onPress={handleTakePassenger}>
                  <Text style={styles.takePassengerText}>Accept & navigate</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 12,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  locLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    gap: 12,
  },
  locLoadingText: {
    fontSize: 15,
    color: '#64748b',
  },
  passengerList: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  passengerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  passengerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  passengerInfo: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  modeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modeCar: {
    backgroundColor: '#2563eb',
  },
  modeMoto: {
    backgroundColor: '#0d9488',
  },
  passengerLocation: {
    fontSize: 13,
    color: '#64748b',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distance: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  arrowText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '85%',
    maxWidth: 350,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    left: 15,
    zIndex: 1,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 20,
  },
  modalName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  tripDetails: {
    alignSelf: 'stretch',
    marginBottom: 28,
  },
  tripLabel: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 10,
  },
  tripValue: {
    fontWeight: '600',
    color: '#1e293b',
  },
  takePassengerButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  takePassengerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 21,
  },
  driverOnlyWrap: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  driverOnlyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 10,
  },
  driverOnlyText: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
    marginBottom: 24,
  },
  driverOnlyBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  driverOnlyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
