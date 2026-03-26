import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import MapView from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu, Crosshair, X, Radio, Shield } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth-store';
import { useRideStore } from '@/store/ride-store';
import { useOnlineDriversStore } from '@/store/online-drivers-store';
import { PassengerDestinationPicker } from '@/components/PassengerDestinationPicker';
import { useLocationStore } from '@/store/location-store';
import NativeMapView from '@/components/NativeMapView';
import { includeDemoNearbyDrivers } from '@/lib/demo-nearby-drivers';
import type { RwandaDestination } from '@/constants/rwanda-destinations';
import { isCoordinateInKigaliCity, isKigaliDestination } from '@/constants/kigali-destinations';
import {
  minPriceRwfForDestination,
  MIN_PRICE_CAR_KIGALI_RWF,
  MIN_PRICE_CAR_OUTSIDE_KIGALI_RWF,
  MIN_PRICE_MOTO_KIGALI_RWF,
} from '@/lib/rwanda-passenger-pricing';
import type { OnlineDriverMarker } from '@/types/online-driver';

const TAB_BAR_OFFSET = 52;

function pickupLineFromLocation(loc: {
  latitude: number;
  longitude: number;
  address?: string;
}): string {
  const addr = loc.address?.trim();
  if (addr) return addr;
  return `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const hasCenteredMapOnLoad = useRef(false);
  const user = useAuthStore((state) => state.user);
  const [from, setFrom] = useState('');
  /** When false, "From" stays synced to GPS / reverse-geocoded address */
  const [fromIsManual, setFromIsManual] = useState(false);
  const [to, setTo] = useState('');
  const [price, setPrice] = useState('');
  const [transportType, setTransportType] = useState<'car' | 'motorbike'>('motorbike');
  const [selectedDestination, setSelectedDestination] = useState<RwandaDestination | null>(null);

  const [bookingDriver, setBookingDriver] = useState<OnlineDriverMarker | null>(null);
  /** actions = Book now / Later; schedule = date/time for Later */
  const [bookingStep, setBookingStep] = useState<'actions' | 'schedule'>('actions');
  const [scheduleDate, setScheduleDate] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [showAndroidSchedulePicker, setShowAndroidSchedulePicker] = useState(false);
  /** Passenger: full trip form (from, destination, price) only after tapping Taxi Moto or Taxi Car */
  const [showTripDetails, setShowTripDetails] = useState(false);
  /** Uber-style “Help drivers find you” card */
  const [showPickupHelpCard, setShowPickupHelpCard] = useState(true);

  const searchRides = useRideStore((state) => state.searchRides);
  const addRide = useRideStore((state) => state.addRide);
  const { currentLocation, startLocationTracking } = useLocationStore();
  const onlineDrivers = useOnlineDriversStore((state) => state.onlineDrivers);

  useEffect(() => {
    startLocationTracking();
  }, [startLocationTracking]);

  useEffect(() => {
    if (fromIsManual || !currentLocation) return;
    setFrom(pickupLineFromLocation(currentLocation));
  }, [
    currentLocation?.latitude,
    currentLocation?.longitude,
    currentLocation?.address,
    fromIsManual,
  ]);

  const onFromChangeText = (text: string) => {
    setFrom(text);
    setFromIsManual(true);
  };

  const useCurrentLocationForFrom = () => {
    const loc = useLocationStore.getState().currentLocation;
    if (!loc) {
      Alert.alert('Location', 'Waiting for your position. Check location permissions.');
      return;
    }
    setFromIsManual(false);
    setFrom(pickupLineFromLocation(loc));
  };

  useEffect(() => {
    if (!currentLocation || hasCenteredMapOnLoad.current) return;
    hasCenteredMapOnLoad.current = true;
    mapRef.current?.animateToRegion(
      {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.045,
        longitudeDelta: 0.045,
      },
      500
    );
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  const recenterMapOnUser = () => {
    if (!currentLocation) {
      Alert.alert('Location', 'Waiting for your position. Check location permissions.');
      return;
    }
    mapRef.current?.animateToRegion(
      {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.035,
        longitudeDelta: 0.035,
      },
      450
    );
  };

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

  /** Taxi moto: pickup must be inside Kigali (GPS). */
  const passengerCanUseTaxiMoto = useMemo(() => {
    if (!currentLocation) return false;
    return isCoordinateInKigaliCity(currentLocation.latitude, currentLocation.longitude);
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  /**
   * Keep transport in sync: taxi moto is invalid without Kigali GPS — never leave motorbike selected.
   * (Silent; alerts only when opening the trip sheet — see openTripDetails.)
   */
  useEffect(() => {
    if (user?.type !== 'passenger') return;
    if (transportType !== 'motorbike') return;
    if (passengerCanUseTaxiMoto) return;
    setTransportType('car');
  }, [user?.type, transportType, passengerCanUseTaxiMoto]);

  const openTripDetails = () => {
    if (user?.type === 'passenger' && transportType === 'motorbike' && !passengerCanUseTaxiMoto) {
      setTransportType('car');
      if (currentLocation && !isCoordinateInKigaliCity(currentLocation.latitude, currentLocation.longitude)) {
        Alert.alert(
          'Taxi moto only in Kigali',
          'Taxi moto is only available when your pickup is inside Kigali City. We switched you to Taxi Car for this trip.'
        );
      } else if (!currentLocation) {
        Alert.alert(
          'Location needed for taxi moto',
          'Turn on location to use taxi moto in Kigali. Using Taxi Car for this trip.'
        );
      }
    }
    setShowTripDetails(true);
  };

  const trySelectTaxiMoto = () => {
    if (!currentLocation) {
      Alert.alert(
        'Location required',
        'Taxi moto is only available in Kigali City. Turn on location so we can check that your pickup is inside Kigali.'
      );
      return;
    }
    if (!isCoordinateInKigaliCity(currentLocation.latitude, currentLocation.longitude)) {
      Alert.alert(
        'Taxi moto only in Kigali',
        'Taxi moto is only available when you are in Kigali City. Outside Kigali, use Taxi Car for your trip.'
      );
      return;
    }
    setTransportType('motorbike');
    setShowTripDetails(true);
  };

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
      if (!showTripDetails) {
        Alert.alert('Trip', 'Choose Taxi Moto or Taxi Car above to enter your destination and price.');
        return;
      }
      if (!from.trim()) {
        Alert.alert('From', 'Enter where you are leaving from.');
        return;
      }
      if (transportType === 'motorbike') {
        if (!currentLocation) {
          Alert.alert(
            'Location required',
            'Taxi moto is only available in Kigali City. Turn on location so we can verify your pickup area.'
          );
          return;
        }
        if (!isCoordinateInKigaliCity(currentLocation.latitude, currentLocation.longitude)) {
          Alert.alert(
            'Taxi moto only in Kigali',
            'Taxi moto is only available when your pickup is inside Kigali City. Switch to Taxi Car or move your pickup into Kigali.'
          );
          return;
        }
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
    if (!showTripDetails) {
      Alert.alert('Trip', 'Choose Taxi Moto or Taxi Car above to plan your ride.');
      return false;
    }
    if (!from.trim()) {
      Alert.alert('From', 'Enter where you are leaving from.');
      return false;
    }
    if (transportType === 'motorbike') {
      if (!currentLocation) {
        Alert.alert(
          'Location required',
          'Taxi moto is only available in Kigali City. Turn on location so we can verify your pickup area.'
        );
        return false;
      }
      if (!isCoordinateInKigaliCity(currentLocation.latitude, currentLocation.longitude)) {
        Alert.alert(
          'Taxi moto only in Kigali',
          'Taxi moto is only available when your pickup is inside Kigali City. Use Taxi Car for trips outside Kigali.'
        );
        return false;
      }
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

  const bottomSafe = insets.bottom + TAB_BAR_OFFSET;
  const passengerHintSheetMaxHeight = useMemo(
    () => Math.min(200, Math.round(Dimensions.get('window').height * 0.28)),
    []
  );
  const driverSheetMaxHeight = useMemo(
    () => Math.min(520, Math.round(Dimensions.get('window').height * 0.52)),
    []
  );

  return (
    <View style={styles.container}>
      <NativeMapView
        ref={mapRef}
        currentLocation={currentLocation}
        nearbyDrivers={nearbyDrivers}
        userNearbyDriverCount={user?.type === 'passenger' ? nearbyDrivers.length : 0}
        onDriverPress={user?.type === 'passenger' ? handleDriverPress : undefined}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.topBarRow, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => router.push('/profile')}
            activeOpacity={0.85}
            accessibilityLabel="Menu"
          >
            <Menu color="#111" size={22} strokeWidth={2.25} />
          </TouchableOpacity>
          {user?.type === 'passenger' ? (
            <TouchableOpacity
              style={styles.pickupBar}
              onPress={openTripDetails}
              activeOpacity={0.88}
              accessibilityLabel="Edit pickup"
            >
              <Text style={styles.pickupBarText} numberOfLines={1}>
                Meet at the pickup point{from.trim() ? ` for ${from.trim()}` : ''}
              </Text>
              <Text style={styles.pickupEdit}>EDIT</Text>
            </TouchableOpacity>
          ) : user?.type === 'driver' ? (
            <TouchableOpacity
              style={styles.pickupBar}
              onPress={() => router.push('/profile')}
              activeOpacity={0.88}
              accessibilityLabel="Driver profile"
            >
              <Text style={styles.pickupBarText} numberOfLines={1}>
                Driver mode · you appear on the map for riders
              </Text>
              <Text style={styles.pickupEdit}>PROFILE</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.pickupBar, styles.pickupBarMuted]}>
              <Text style={styles.pickupBarText} numberOfLines={1}>
                Loading your account…
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.rightFabColumn, { top: insets.top + 76 }]}>
          <TouchableOpacity
            style={styles.fabRound}
            onPress={recenterMapOnUser}
            activeOpacity={0.85}
            accessibilityLabel="Center map on my location"
          >
            <Crosshair color="#111" size={22} strokeWidth={2.25} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fabRound}
            onPress={() =>
              Alert.alert(
                'Live location',
                'Keep location enabled so drivers can reach your pickup. You can adjust permissions in system settings.'
              )
            }
            activeOpacity={0.85}
            accessibilityLabel="About live location"
          >
            <Radio color="#111" size={22} strokeWidth={2.25} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fabRound, styles.fabRoundSafety]}
            onPress={() =>
              Alert.alert('Safety', 'Use in-app chat and trip sharing with a contact when you ride.')
            }
            activeOpacity={0.85}
            accessibilityLabel="Safety"
          >
            <Shield color="#1e40af" size={22} strokeWidth={2.25} />
          </TouchableOpacity>
        </View>

        {user?.type === 'passenger' && showPickupHelpCard && (
          <View style={styles.helpCard} pointerEvents="box-none">
            <View style={styles.helpCardInner}>
              <View style={styles.helpCardPointer} />
              <TouchableOpacity
                style={styles.helpCardDismiss}
                onPress={() => setShowPickupHelpCard(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Dismiss"
              >
                <X color="#64748b" size={18} strokeWidth={2.5} />
              </TouchableOpacity>
              <Text style={styles.helpCardTitle}>Help drivers find you more quickly</Text>
              <Text style={styles.helpCardBody}>Share live location for pick-ups and keep your pickup note updated.</Text>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.bottomChrome, { paddingBottom: bottomSafe }]} pointerEvents="box-none">
        {user?.type === 'passenger' && (
          <View style={styles.uberSheet}>
            <View style={styles.sheetBlueStrip}>
              <Text style={styles.sheetBlueStripText}>All drivers are screened</Text>
            </View>
            <View style={styles.uberSheetBody}>
              <View style={styles.sheetHandle} />
              <View style={styles.taxiPill}>
                <TouchableOpacity
                  style={[
                    styles.taxiPillSeg,
                    transportType === 'motorbike' && styles.taxiPillSegActive,
                    !passengerCanUseTaxiMoto && styles.taxiPillSegMuted,
                  ]}
                  onPress={trySelectTaxiMoto}
                  activeOpacity={0.9}
                >
                  <Text
                    style={[
                      styles.taxiPillText,
                      transportType === 'motorbike' && styles.taxiPillTextActive,
                      !passengerCanUseTaxiMoto && styles.taxiPillTextMuted,
                    ]}
                  >
                    Taxi Moto
                  </Text>
                  <Text
                    style={[
                      styles.taxiPillKigaliNote,
                      transportType === 'motorbike' && passengerCanUseTaxiMoto && styles.taxiPillKigaliNoteOnActive,
                      !passengerCanUseTaxiMoto && styles.taxiPillKigaliNoteMuted,
                    ]}
                    numberOfLines={1}
                  >
                    {passengerCanUseTaxiMoto ? 'Kigali only' : 'Not available here'}
                  </Text>
                  {nearbyCounts != null && (
                    <Text
                      style={[
                        styles.taxiPillSub,
                        transportType === 'motorbike' && styles.taxiPillSubActive,
                        !passengerCanUseTaxiMoto && styles.taxiPillSubMuted,
                      ]}
                    >
                      {nearbyCounts.moto} nearby
                    </Text>
                  )}
                </TouchableOpacity>
                <View style={styles.taxiPillDivider} />
                <TouchableOpacity
                  style={[styles.taxiPillSeg, transportType === 'car' && styles.taxiPillSegActive]}
                  onPress={() => {
                    setTransportType('car');
                    setShowTripDetails(true);
                  }}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.taxiPillText, transportType === 'car' && styles.taxiPillTextActive]}>
                    Taxi Car
                  </Text>
                  {nearbyCounts != null && (
                    <Text
                      style={[styles.taxiPillSub, transportType === 'car' && styles.taxiPillSubActive]}
                    >
                      {nearbyCounts.car} nearby
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {!showTripDetails && (
                <ScrollView
                  contentContainerStyle={styles.uberSheetScroll}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: passengerHintSheetMaxHeight }}
                >
                  {nearbyCounts != null && includeDemoNearbyDrivers() && (
                    <Text style={styles.demoHint}>Demo drivers on the map</Text>
                  )}
                  <Text style={styles.tripHint}>
                    Tap <Text style={styles.tripHintStrong}>Taxi Moto</Text> or{' '}
                    <Text style={styles.tripHintStrong}>Taxi Car</Text>, then set pickup, destination, and your offer.
                  </Text>
                </ScrollView>
              )}

              {showTripDetails && (
                <TouchableOpacity
                  style={styles.destinationPreviewRow}
                  onPress={openTripDetails}
                  activeOpacity={0.88}
                >
                  <View style={styles.destinationPreviewDot} />
                  <View style={styles.destinationPreviewTextWrap}>
                    <Text style={styles.destinationPreviewLabel}>Going to</Text>
                    <Text style={styles.destinationPreviewValue} numberOfLines={1}>
                      {selectedDestination?.name ?? 'Add destination'}
                    </Text>
                  </View>
                  <Text style={styles.destinationPreviewAction}>Add or change</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {user?.type === 'driver' && (
          <View style={styles.uberSheet}>
            <View style={styles.sheetBlueStrip}>
              <Text style={styles.sheetBlueStripText}>Stay visible · riders book nearby drivers</Text>
            </View>
            <View style={styles.uberSheetBody}>
              <View style={styles.sheetHandle} />
              <ScrollView
                contentContainerStyle={styles.sheetScroll}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: driverSheetMaxHeight }}
              >
                {currentLocation && (
                  <Text style={styles.driverPresenceHint}>
                    You appear on the map for passengers when location is on.
                  </Text>
                )}
                <TextInput
                  style={styles.input}
                  placeholder={fromIsManual ? 'From (e.g. your area)' : 'Current location (auto)'}
                  placeholderTextColor="#94a3b8"
                  value={from}
                  onChangeText={onFromChangeText}
                />
                <View style={styles.pickupFromMeta}>
                  <Text style={styles.pickupAutoHint}>
                    {fromIsManual ? 'Custom pickup' : 'Filled from your GPS'}
                  </Text>
                  <TouchableOpacity onPress={useCurrentLocationForFrom} hitSlop={8}>
                    <Text style={styles.pickupLocationLink}>Use current location</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="To?"
                  placeholderTextColor="#94a3b8"
                  value={to}
                  onChangeText={setTo}
                />
                <TouchableOpacity style={styles.searchButton} onPress={handleSearch} activeOpacity={0.9}>
                  <Text style={styles.searchButtonText}>Search</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.nearbyButton} onPress={() => router.push('/nearby')} activeOpacity={0.9}>
                  <Text style={styles.nearbyButtonText}>Near By</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        )}
      </View>

      <Modal
        visible={user?.type === 'passenger' && showTripDetails}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTripDetails(false)}
      >
        <View style={styles.tripCenterRoot}>
          <View style={styles.tripCenterBackdrop} />
          <KeyboardAvoidingView
            style={styles.tripCenterAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.tripCenterCardInner}>
              <View style={styles.tripCenterHeader}>
                <Text style={styles.tripCenterTitle}>Your trip</Text>
                <TouchableOpacity
                  onPress={() => setShowTripDetails(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel="Close"
                >
                  <X color="#64748b" size={26} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.tripCenterScroll}
              >
                {nearbyCounts != null && includeDemoNearbyDrivers() && (
                  <Text style={styles.demoHint}>Demo drivers on the map</Text>
                )}
                <TextInput
                  style={styles.input}
                  placeholder={fromIsManual ? 'From (e.g. your area)' : 'Current location (auto)'}
                  placeholderTextColor="#94a3b8"
                  value={from}
                  onChangeText={onFromChangeText}
                />
                <View style={styles.pickupFromMeta}>
                  <Text style={styles.pickupAutoHint}>
                    {fromIsManual ? 'Custom pickup' : 'Filled from your GPS'}
                  </Text>
                  <TouchableOpacity onPress={useCurrentLocationForFrom} hitSlop={8}>
                    <Text style={styles.pickupLocationLink}>Use current location</Text>
                  </TouchableOpacity>
                </View>
                <PassengerDestinationPicker
                  transportType={transportType}
                  selected={selectedDestination}
                  appearance="waze"
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
                  placeholderTextColor="#94a3b8"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={styles.searchButton} onPress={handleSearch} activeOpacity={0.9}>
                  <Text style={styles.searchButtonText}>Search</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

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
    width: '100%',
    backgroundColor: '#e8eef3',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  menuBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
  },
  pickupBar: {
    flex: 1,
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  pickupBarText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 12,
  },
  pickupEdit: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  pickupBarMuted: {
    opacity: 0.85,
  },
  rightFabColumn: {
    position: 'absolute',
    right: 12,
  },
  fabRound: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
  },
  fabRoundSafety: {
    backgroundColor: '#eff6ff',
  },
  helpCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '36%',
    alignItems: 'center',
  },
  helpCardInner: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 10,
  },
  helpCardPointer: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#ffffff',
  },
  helpCardDismiss: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
  },
  helpCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    paddingRight: 8,
  },
  helpCardBody: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  bottomChrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    maxWidth: '100%',
  },
  uberSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetBlueStrip: {
    backgroundColor: '#276ef1',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sheetBlueStripText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  uberSheetBody: {
    paddingBottom: 12,
  },
  uberSheetScroll: {
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  destinationPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  destinationPreviewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#276ef1',
    marginRight: 12,
  },
  destinationPreviewTextWrap: {
    flex: 1,
  },
  destinationPreviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
  },
  destinationPreviewValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  destinationPreviewAction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#276ef1',
  },
  taxiPill: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(39, 110, 241, 0.12)',
    borderRadius: 28,
    padding: 3,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    shadowColor: '#276ef1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  taxiPillSeg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 25,
  },
  taxiPillSegActive: {
    backgroundColor: '#276ef1',
  },
  taxiPillDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(39, 110, 241, 0.35)',
    marginVertical: 6,
  },
  taxiPillText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e40af',
  },
  taxiPillTextActive: {
    color: '#ffffff',
  },
  taxiPillSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563eb',
    marginTop: 2,
  },
  taxiPillSubActive: {
    color: 'rgba(255,255,255,0.92)',
  },
  taxiPillSegMuted: {
    opacity: 0.65,
  },
  taxiPillTextMuted: {
    color: '#64748b',
  },
  taxiPillSubMuted: {
    color: '#94a3b8',
  },
  taxiPillKigaliNote: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
    marginTop: 2,
  },
  taxiPillKigaliNoteOnActive: {
    color: 'rgba(255,255,255,0.88)',
  },
  taxiPillKigaliNoteMuted: {
    color: '#b91c1c',
  },
  tripHint: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  tripHintStrong: {
    fontWeight: '800',
    color: '#276ef1',
  },
  tripCenterRoot: {
    flex: 1,
  },
  tripCenterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  tripCenterAvoid: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 28,
    zIndex: 1,
  },
  tripCenterCardInner: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    maxHeight: '88%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  tripCenterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  tripCenterTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
  },
  tripCenterScroll: {
    paddingBottom: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginBottom: 12,
  },
  sheetScroll: {
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  demoHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 8,
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
    backgroundColor: '#f1f5f9',
    padding: 15,
    borderRadius: 28,
    marginBottom: 6,
    fontSize: 16,
    color: '#0f172a',
  },
  pickupFromMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  pickupAutoHint: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  pickupLocationLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#276ef1',
  },
  searchButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
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
