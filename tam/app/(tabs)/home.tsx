import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import { useRideStore } from '@/store/ride-store';
import { useOnlineDriversStore } from '@/store/online-drivers-store';
import { TransportTypeSelector } from '@/components/TransportTypeSelector';
import { PassengerDestinationPicker } from '@/components/PassengerDestinationPicker';
import { useLocationStore } from '@/store/location-store';
import NativeMapView from '@/components/NativeMapView';
import { includeDemoNearbyDrivers } from '@/lib/demo-nearby-drivers';
import type { RwandaDestination } from '@/constants/rwanda-destinations';
import { isKigaliDestination } from '@/constants/kigali-destinations';
import {
  minPriceRwfForDestination,
  MIN_PRICE_CAR_KIGALI_RWF,
  MIN_PRICE_CAR_OUTSIDE_KIGALI_RWF,
  MIN_PRICE_MOTO_KIGALI_RWF,
} from '@/lib/rwanda-passenger-pricing';
import type { OnlineDriverMarker } from '@/types/online-driver';

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [price, setPrice] = useState('');
  const [transportType, setTransportType] = useState<'car' | 'motorbike'>('motorbike');
  const [selectedDestination, setSelectedDestination] = useState<RwandaDestination | null>(null);

  const [bookingDriver, setBookingDriver] = useState<OnlineDriverMarker | null>(null);
  /** actions = Book now / Later; schedule = date/time for Later */
  const [bookingStep, setBookingStep] = useState<'actions' | 'schedule'>('actions');
  const [scheduleDate, setScheduleDate] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [showAndroidSchedulePicker, setShowAndroidSchedulePicker] = useState(false);

  const searchRides = useRideStore((state) => state.searchRides);
  const addRide = useRideStore((state) => state.addRide);
  const { currentLocation, startLocationTracking } = useLocationStore();
  const onlineDrivers = useOnlineDriversStore((state) => state.onlineDrivers);

  useEffect(() => {
    startLocationTracking();
  }, [startLocationTracking]);

  useEffect(() => {
    const unsubscribe = useOnlineDriversStore.getState().loadOnlineDrivers();
    return unsubscribe;
  }, []);

  /** Drivers using the app: publish location so passengers see nearby taxis */
  useEffect(() => {
    if (user?.type !== 'driver' || !currentLocation) return;
    const { setMyPresence } = useOnlineDriversStore.getState();
    setMyPresence(user, currentLocation.latitude, currentLocation.longitude);
    const interval = setInterval(() => {
      const loc = useLocationStore.getState().currentLocation;
      const u = useAuthStore.getState().user;
      if (loc && u?.type === 'driver') {
        setMyPresence(u, loc.latitude, loc.longitude);
      }
    }, 22000);
    return () => clearInterval(interval);
  }, [user?.id, user?.type, user?.vehicleType, currentLocation?.latitude, currentLocation?.longitude]);

  const excludeViewer =
    user?.type === 'driver' ? user.id : undefined;

  const nearbyDrivers = useMemo(() => {
    if (!currentLocation) return [];
    return useOnlineDriversStore
      .getState()
      .getNearbyMarkers(
        currentLocation.latitude,
        currentLocation.longitude,
        12,
        excludeViewer
      );
  }, [currentLocation?.latitude, currentLocation?.longitude, onlineDrivers, excludeViewer]);

  const nearbyCounts = useMemo(() => {
    if (!currentLocation) return null;
    return useOnlineDriversStore
      .getState()
      .getNearbyCounts(
        currentLocation.latitude,
        currentLocation.longitude,
        12,
        excludeViewer
      );
  }, [currentLocation?.latitude, currentLocation?.longitude, onlineDrivers, excludeViewer]);

  /** Taxi moto is Kigali-only — clear an out-of-Kigali destination when switching to moto */
  useEffect(() => {
    if (user?.type !== 'passenger') return;
    if (transportType !== 'motorbike') return;
    if (selectedDestination && !isKigaliDestination(selectedDestination.id)) {
      setSelectedDestination(null);
      setTo('');
      setPrice('');
    }
  }, [transportType, selectedDestination, user?.type]);

  const minFareRwf = useMemo(() => {
    if (user?.type !== 'passenger') return null;
    return minPriceRwfForDestination(transportType, selectedDestination?.id ?? null);
  }, [user?.type, transportType, selectedDestination?.id]);

  /** Bump offer up if it falls below the new minimum (e.g. moto → car in Kigali) */
  useEffect(() => {
    if (user?.type !== 'passenger' || !selectedDestination) return;
    const m = minPriceRwfForDestination(transportType, selectedDestination.id);
    if (m == null) return;
    const p = Number(price.replace(/\s/g, ''));
    if (Number.isNaN(p) || p < m) setPrice(String(m));
  }, [transportType, selectedDestination?.id, user?.type]);

  const handleSearch = () => {
    if (user?.type === 'passenger') {
      if (!from.trim()) {
        Alert.alert('From', 'Enter where you are leaving from.');
        return;
      }
      if (!selectedDestination) {
        Alert.alert('Destination', 'Choose a district or city in Rwanda.');
        return;
      }
      const min = minPriceRwfForDestination(transportType, selectedDestination.id);
      if (min == null) {
        Alert.alert('Destination', 'Taxi moto is only available within Kigali City. Pick a Kigali destination.');
        return;
      }
      const p = Number(price.replace(/\s/g, ''));
      if (Number.isNaN(p) || p < min) {
        Alert.alert(
          'Price',
          `Minimum fare for ${transportType === 'car' ? 'taxi car' : 'taxi moto'} to this destination is ${min.toLocaleString()} RWF.`
        );
        return;
      }
      searchRides(from.trim(), selectedDestination.name, p, transportType);
      router.push('/rides');
      return;
    }

    if (from && to) {
      searchRides(from, to, undefined, transportType);
      router.push('/rides');
    }
  };

  const closeBookingModal = () => {
    setBookingDriver(null);
    setBookingStep('actions');
    setShowAndroidSchedulePicker(false);
  };

  const validatePassengerSearchForBooking = (): boolean => {
    if (user?.type !== 'passenger') return false;
    if (!from.trim()) {
      Alert.alert('From', 'Enter where you are leaving from.');
      return false;
    }
    if (!selectedDestination) {
      Alert.alert('Destination', 'Choose a district or city in Rwanda.');
      return false;
    }
    const min = minPriceRwfForDestination(transportType, selectedDestination.id);
    if (min == null) {
      Alert.alert('Destination', 'Taxi moto is only available within Kigali City. Pick a Kigali destination.');
      return false;
    }
    const p = Number(price.replace(/\s/g, ''));
    if (Number.isNaN(p) || p < min) {
      Alert.alert(
        'Price',
        `Minimum fare for ${transportType === 'car' ? 'taxi car' : 'taxi moto'} to this destination is ${min.toLocaleString()} RWF.`
      );
      return false;
    }
    return true;
  };

  const handleDriverPress = (driver: OnlineDriverMarker) => {
    if (user?.type !== 'passenger') return;
    if (!validatePassengerSearchForBooking()) return;
    if (driver.transportType !== transportType) {
      Alert.alert(
        'Vehicle type',
        `This driver is a ${driver.transportType === 'car' ? 'taxi car' : 'taxi moto'}. Switch “Taxi moto or taxi car” above or choose another driver.`
      );
      return;
    }
    setScheduleDate(new Date(Date.now() + 60 * 60 * 1000));
    setBookingStep('actions');
    setBookingDriver(driver);
  };

  const onScheduleDateChange = (event: { type?: string }, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowAndroidSchedulePicker(false);
      if (event.type === 'dismissed') return;
    }
    if (date) setScheduleDate(date);
  };

  const confirmBooking = async (scheduled: boolean) => {
    if (!user || user.type !== 'passenger' || !selectedDestination || !bookingDriver) return;
    if (scheduled) {
      if (Platform.OS === 'web') {
        Alert.alert('Scheduling', 'Please use the iOS or Android app to pick a date and time.');
        return;
      }
      const minMs = Date.now() + 15 * 60 * 1000;
      if (scheduleDate.getTime() < minMs) {
        Alert.alert('Time', 'Pick a pickup time at least 15 minutes from now.');
        return;
      }
    }
    const p = Number(price.replace(/\s/g, ''));
    const ride: Parameters<typeof addRide>[0] = {
      from: from.trim(),
      to: selectedDestination.name,
      price: p,
      transportType,
      driverId: bookingDriver.userId,
      passengerId: user.id,
      status: scheduled ? 'scheduled' : 'pending',
      createdAt: new Date().toISOString(),
      ...(scheduled ? { scheduledPickupAt: scheduleDate.toISOString() } : {}),
    };
    if (currentLocation) {
      ride.pickupLocation = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        address: from.trim(),
      };
    }
    const key = await addRide(ride);
    closeBookingModal();
    if (key) {
      router.push({ pathname: '/rides/track', params: { rideId: key } });
    } else {
      Alert.alert('Booking', 'Could not create the ride. Try again.');
    }
  };

  const offerRwf =
    user?.type === 'passenger' && selectedDestination
      ? Number(price.replace(/\s/g, ''))
      : NaN;
  const minForOffer =
    user?.type === 'passenger' && selectedDestination
      ? minPriceRwfForDestination(transportType, selectedDestination.id)
      : null;

  return (
    <View style={styles.container}>
      <View style={styles.mapSection}>
        <NativeMapView
          currentLocation={currentLocation}
          nearbyDrivers={nearbyDrivers}
          onDriverPress={user?.type === 'passenger' ? handleDriverPress : undefined}
        />
      </View>

      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator
      >
        <View style={styles.searchCard}>
          {user?.type === 'passenger' && (
            <>
              <Text style={styles.sectionLabel}>Taxi moto or taxi car?</Text>
              <Text style={styles.sectionSub}>
                You&apos;re booking as a passenger — tap the vehicle you want. The map and &quot;nearby&quot; counts
                show drivers for that type, and Search uses the same choice.
              </Text>
              <TransportTypeSelector
                selected={transportType}
                onSelect={setTransportType}
                nearbyCounts={nearbyCounts ?? undefined}
              />
              {nearbyCounts != null && includeDemoNearbyDrivers() && (
                <Text style={styles.demoHint}>Includes test drivers on the map (demo)</Text>
              )}
            </>
          )}

          {user?.type === 'driver' && currentLocation && (
            <Text style={styles.driverPresenceHint}>
              You appear on the map for passengers when location is on.
            </Text>
          )}

          <TextInput
            style={styles.input}
            placeholder="From (e.g. your area)"
            placeholderTextColor="#999"
            value={from}
            onChangeText={setFrom}
          />

          {user?.type === 'passenger' ? (
            <>
              <PassengerDestinationPicker
                transportType={transportType}
                selected={selectedDestination}
                onSelect={(d) => {
                  setSelectedDestination(d);
                  setTo(d.name);
                  const m = minPriceRwfForDestination(transportType, d.id);
                  if (m != null) setPrice(String(m));
                }}
              />
              <Text style={styles.priceRules}>
                {transportType === 'car'
                  ? `Taxi car: min ${MIN_PRICE_CAR_KIGALI_RWF.toLocaleString()} RWF in Kigali · min ${MIN_PRICE_CAR_OUTSIDE_KIGALI_RWF.toLocaleString()} RWF outside Kigali.`
                  : `Taxi moto: Kigali only · min ${MIN_PRICE_MOTO_KIGALI_RWF.toLocaleString()} RWF.`}
              </Text>
              {minFareRwf != null && (
                <Text style={styles.minFare}>Minimum for this trip: {minFareRwf.toLocaleString()} RWF</Text>
              )}
              <TextInput
                style={styles.input}
                placeholder={minFareRwf != null ? `Offer (min ${minFareRwf.toLocaleString()} RWF)` : 'Offer (RWF)'}
                placeholderTextColor="#999"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />
            </>
          ) : (
            <TextInput
              style={styles.input}
              placeholder="To?"
              placeholderTextColor="#999"
              value={to}
              onChangeText={setTo}
            />
          )}

          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>

          {user?.type === 'driver' && (
            <TouchableOpacity style={styles.nearbyButton} onPress={() => router.push('/nearby')}>
              <Text style={styles.nearbyButtonText}>Near By</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <Modal visible={bookingDriver !== null} animationType="fade" transparent>
          <Pressable style={styles.modalBackdrop} onPress={closeBookingModal}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {bookingDriver && bookingStep === 'actions' && (
                  <>
                    <Text style={styles.modalTitle}>Book this driver</Text>
                    <Text style={styles.modalLine}>
                      <Text style={styles.modalLabel}>Name: </Text>
                      {bookingDriver.username ?? 'Driver'}
                    </Text>
                    <Text style={styles.modalLine}>
                      <Text style={styles.modalLabel}>Vehicle: </Text>
                      {bookingDriver.transportType === 'car' ? 'Taxi car' : 'Taxi moto'}
                    </Text>
                    {(bookingDriver.vehiclePlate || bookingDriver.vehicleModel) && (
                      <Text style={styles.modalLine}>
                        <Text style={styles.modalLabel}>Plate / model: </Text>
                        {[bookingDriver.vehiclePlate, bookingDriver.vehicleModel].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                    {minForOffer != null && !Number.isNaN(offerRwf) && (
                      <Text style={styles.modalLine}>
                        <Text style={styles.modalLabel}>Your offer: </Text>
                        {offerRwf.toLocaleString()} RWF
                        <Text style={styles.modalHint}> (min {minForOffer.toLocaleString()} RWF)</Text>
                      </Text>
                    )}
                    <View style={styles.modalButtons}>
                      <TouchableOpacity
                        style={styles.modalPrimaryBtn}
                        onPress={() => void confirmBooking(false)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.modalPrimaryBtnText}>Book now</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.modalSecondaryBtn}
                        onPress={() => {
                          if (Platform.OS === 'web') {
                            Alert.alert('Scheduling', 'Please use the iOS or Android app to schedule a pickup time.');
                            return;
                          }
                          setBookingStep('schedule');
                          if (Platform.OS === 'android') {
                            setShowAndroidSchedulePicker(true);
                          }
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.modalSecondaryBtnText}>Later</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.modalCancelBtn} onPress={closeBookingModal}>
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {bookingDriver && bookingStep === 'schedule' && Platform.OS !== 'web' && (
                  <>
                    <Text style={styles.modalTitle}>Pickup time</Text>
                    <Text style={styles.modalSub}>At least 15 minutes from now.</Text>
                    {Platform.OS === 'ios' && (
                      <DateTimePicker
                        value={scheduleDate}
                        mode="datetime"
                        display="spinner"
                        minimumDate={new Date(Date.now() + 15 * 60 * 1000)}
                        onChange={(_, d) => {
                          if (d) setScheduleDate(d);
                        }}
                      />
                    )}
                    {Platform.OS === 'android' && (
                      <>
                        <Text style={styles.modalLine}>{scheduleDate.toLocaleString()}</Text>
                        <TouchableOpacity
                          style={styles.modalSecondaryBtn}
                          onPress={() => setShowAndroidSchedulePicker(true)}
                        >
                          <Text style={styles.modalSecondaryBtnText}>Change date & time</Text>
                        </TouchableOpacity>
                        {showAndroidSchedulePicker && (
                          <DateTimePicker
                            value={scheduleDate}
                            mode="datetime"
                            display="default"
                            minimumDate={new Date(Date.now() + 15 * 60 * 1000)}
                            onChange={onScheduleDateChange}
                          />
                        )}
                      </>
                    )}
                    <TouchableOpacity
                      style={styles.modalPrimaryBtn}
                      onPress={() => void confirmBooking(true)}
                    >
                      <Text style={styles.modalPrimaryBtnText}>Confirm & book</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      onPress={() => {
                        setBookingStep('actions');
                        setShowAndroidSchedulePicker(false);
                      }}
                    >
                      <Text style={styles.modalCancelText}>Back</Text>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  /** Top area: map stays visible and tappable (not covered by the form) */
  mapSection: {
    flex: 2,
    minHeight: 220,
    width: '100%',
  },
  formScroll: {
    flex: 3,
  },
  formContent: {
    paddingBottom: 28,
  },
  searchCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionLabel: {
    fontSize: 16,
    color: '#111',
    marginBottom: 6,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 12,
  },
  demoHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 10,
    marginTop: -4,
  },
  driverPresenceHint: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  priceRules: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
    marginBottom: 6,
  },
  minFare: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 30,
    marginBottom: 10,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#333',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 5,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  nearbyButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 10,
  },
  nearbyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  modalSub: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  modalLine: {
    fontSize: 15,
    color: '#334155',
    marginBottom: 8,
    lineHeight: 22,
  },
  modalLabel: {
    fontWeight: '700',
    color: '#0f172a',
  },
  modalHint: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  modalButtons: {
    marginTop: 16,
  },
  modalPrimaryBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalPrimaryBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSecondaryBtn: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalSecondaryBtnText: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
});
