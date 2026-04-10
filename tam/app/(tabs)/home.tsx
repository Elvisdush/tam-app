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
  Image,
  Linking,
} from 'react-native';
import MapView from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu, Crosshair, X, Radio, Shield, Phone, Mail, Bike, Car } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth-store';
import { useRideStore } from '@/store/ride-store';
import { useOnlineDriversStore } from '@/store/online-drivers-store';
import { PassengerDestinationPicker } from '@/components/PassengerDestinationPicker';
import { useLocationStore } from '@/store/location-store';
import NativeMapView from '@/components/NativeMapView';
import { includeDemoNearbyDrivers } from '@/lib/demo-nearby-drivers';
import type { RwandaDestination } from '@/constants/rwanda-destinations';
import {
  minPriceRwfForDestination,
  MIN_PRICE_CAR_KIGALI_RWF,
  MIN_PRICE_CAR_OUTSIDE_KIGALI_RWF,
  MIN_PRICE_MOTO_KIGALI_RWF,
  MIN_PRICE_MOTO_OUTSIDE_KIGALI_RWF,
} from '@/lib/rwanda-passenger-pricing';
import type { OnlineDriverMarker } from '@/types/online-driver';
import { StarRatingRow } from '@/components/StarRatingRow';
import { openPhoneDialer } from '@/lib/open-phone-dialer';

const TAB_BAR_OFFSET = 52;

const PLACEHOLDER_AVATAR =
  'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop';

/** Demo drivers show **4 / 5** stars when Firebase has no average yet */
const DEMO_FALLBACK_RATING = 4;

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
  const users = useAuthStore((state) => state.users);
  const [from, setFrom] = useState('');
  /** When false, "From" stays synced to GPS / reverse-geocoded address */
  const [fromIsManual, setFromIsManual] = useState(false);
  const [to, setTo] = useState('');
  const [price, setPrice] = useState('');
  const [transportType, setTransportType] = useState<'car' | 'motorbike'>('motorbike');
  const [selectedDestination, setSelectedDestination] = useState<RwandaDestination | null>(null);

  const [bookingDriver, setBookingDriver] = useState<OnlineDriverMarker | null>(null);
  /** Passenger tapped a nearby driver pin — show profile sheet before booking */
  const [driverDetailsDriver, setDriverDetailsDriver] = useState<OnlineDriverMarker | null>(null);
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

  const openTripDetails = () => {
    setShowTripDetails(true);
  };

  const trySelectTaxiMoto = () => {
    setTransportType('motorbike');
    setShowTripDetails(true);
  };

  const minFareRwf = useMemo(() => {
    if (user?.type !== 'passenger') return null;
    return minPriceRwfForDestination(transportType, selectedDestination?.id ?? null);
  }, [user?.type, transportType, selectedDestination?.id]);

  /** Bump offer up if it falls below the new minimum when transport or destination changes */
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
      if (!selectedDestination) {
        Alert.alert('Destination', 'Choose a district or city in Rwanda.');
        return;
      }
      const min = minPriceRwfForDestination(transportType, selectedDestination.id);
      if (min == null) {
        Alert.alert('Destination', 'Choose a district or city in Rwanda.');
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

  /** Open driver details (name, phone, ratings, fares) — then passenger can book */
  const handleOpenDriverDetails = (driver: OnlineDriverMarker) => {
    if (user?.type !== 'passenger') return;
    setDriverDetailsDriver(driver);
  };

  /** Opens full-screen contact (phone + email); passenger calls or emails the driver */
  const handleBookFromDriverDetails = () => {
    if (!driverDetailsDriver) return;
    const d = driverDetailsDriver;
    setDriverDetailsDriver(null);
    router.push({
      pathname: '/driver-contact',
      params: {
        userId: d.userId,
        isDemo: d.isDemo ? '1' : '0',
        name: d.username ?? 'Driver',
      },
    });
  };

  const closeDriverDetails = () => setDriverDetailsDriver(null);

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
        onDriverPress={user?.type === 'passenger' ? handleOpenDriverDetails : undefined}
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
              <View style={styles.rideTypeCard}>
                <Text style={styles.rideTypeCardHeading}>Choose your ride</Text>
                <View style={styles.rideTypeGrid}>
                  <TouchableOpacity
                    style={[
                      styles.rideTypeTile,
                      styles.rideTypeTileGap,
                      transportType === 'motorbike' && styles.rideTypeTileActive,
                    ]}
                    onPress={trySelectTaxiMoto}
                    activeOpacity={0.88}
                  >
                    <View
                      style={[
                        styles.rideTypeIconWrap,
                        transportType === 'motorbike' && styles.rideTypeIconWrapActive,
                      ]}
                    >
                      <Bike
                        size={26}
                        strokeWidth={2.4}
                        color={transportType === 'motorbike' ? '#ffffff' : '#ea580c'}
                      />
                    </View>
                    <Text
                      style={[
                        styles.rideTypeTileTitle,
                        transportType === 'motorbike' && styles.rideTypeTileTitleActive,
                      ]}
                    >
                      Taxi Moto
                    </Text>
                    <Text
                      style={[
                        styles.rideTypeTileHint,
                        transportType === 'motorbike' && styles.rideTypeTileHintActive,
                      ]}
                      numberOfLines={1}
                    >
                      Rwanda-wide
                    </Text>
                    {nearbyCounts != null && (
                      <View
                        style={[
                          styles.rideTypeBadge,
                          transportType === 'motorbike'
                            ? styles.rideTypeBadgeOnActive
                            : styles.rideTypeBadgeMotoIdle,
                        ]}
                      >
                        <Text
                          style={[
                            styles.rideTypeBadgeText,
                            transportType === 'motorbike'
                              ? styles.rideTypeBadgeTxtLight
                              : styles.rideTypeBadgeTxtMoto,
                          ]}
                        >
                          {nearbyCounts.moto} nearby
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.rideTypeTile, transportType === 'car' && styles.rideTypeTileActiveCar]}
                    onPress={() => {
                      setTransportType('car');
                      setShowTripDetails(true);
                    }}
                    activeOpacity={0.88}
                  >
                    <View
                      style={[
                        styles.rideTypeIconWrap,
                        transportType === 'car' && styles.rideTypeIconWrapActiveCar,
                      ]}
                    >
                      <Car
                        size={26}
                        strokeWidth={2.4}
                        color={transportType === 'car' ? '#ffffff' : '#16a34a'}
                      />
                    </View>
                    <Text
                      style={[
                        styles.rideTypeTileTitle,
                        transportType === 'car' && styles.rideTypeTileTitleActive,
                      ]}
                    >
                      Taxi Car
                    </Text>
                    <Text
                      style={[
                        styles.rideTypeTileHint,
                        transportType === 'car' && styles.rideTypeTileHintActive,
                      ]}
                      numberOfLines={1}
                    >
                      Kigali & beyond
                    </Text>
                    {nearbyCounts != null && (
                      <View
                        style={[
                          styles.rideTypeBadge,
                          transportType === 'car' ? styles.rideTypeBadgeOnActive : styles.rideTypeBadgeCarIdle,
                        ]}
                      >
                        <Text
                          style={[
                            styles.rideTypeBadgeText,
                            transportType === 'car' ? styles.rideTypeBadgeTxtLight : styles.rideTypeBadgeTxtCar,
                          ]}
                        >
                          {nearbyCounts.car} nearby
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
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
                    : `Taxi moto: min ${MIN_PRICE_MOTO_KIGALI_RWF.toLocaleString()} RWF in Kigali · min ${MIN_PRICE_MOTO_OUTSIDE_KIGALI_RWF.toLocaleString()} RWF outside Kigali.`}
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

      <Modal
        visible={user?.type === 'passenger' && driverDetailsDriver !== null}
        animationType="fade"
        transparent
        onRequestClose={closeDriverDetails}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeDriverDetails}>
          <Pressable style={styles.driverDetailCard} onPress={(e) => e.stopPropagation()}>
            {driverDetailsDriver && (() => {
              const d = driverDetailsDriver;
              const profile = users.find((u) => u.id === d.userId);
              const name =
                profile?.username?.trim() || d.username?.trim() || 'Driver';
              const phoneRaw =
                profile?.phone?.trim() || (d.isDemo ? d.demoPhone?.trim() ?? '' : '');
              const emailRaw =
                profile?.email?.trim() || (d.isDemo ? d.demoEmail?.trim() ?? '' : '');
              const avatarUri =
                profile?.profileImage && !profile.profileImage.startsWith('blob:')
                  ? profile.profileImage
                  : PLACEHOLDER_AVATAR;
              const tripMinForDriver =
                selectedDestination && d.transportType === transportType
                  ? minPriceRwfForDestination(transportType, selectedDestination.id)
                  : null;
              const typeMismatch = d.transportType !== transportType;

              return (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.driverDetailHeaderRow}>
                    <Image source={{ uri: avatarUri }} style={styles.driverDetailAvatar} />
                    <View style={styles.driverDetailHeaderText}>
                      <Text style={styles.driverDetailName} numberOfLines={2}>
                        {name}
                        {d.isDemo ? (
                          <Text style={styles.driverDetailDemo}> · Demo</Text>
                        ) : null}
                      </Text>
                      <Text style={styles.driverDetailVehicle}>
                        {d.transportType === 'car' ? 'Taxi car' : 'Taxi moto'}
                        {d.vehiclePlate?.trim() ? ` · ${d.vehiclePlate.trim()}` : ''}
                      </Text>
                    </View>
                  </View>

                  {d.vehicleModel?.trim() ? (
                    <Text style={styles.driverDetailMetaLine}>
                      <Text style={styles.modalLabel}>Vehicle: </Text>
                      {d.vehicleModel.trim()}
                    </Text>
                  ) : null}

                  <View style={styles.driverDetailBlock}>
                    <Text style={styles.driverDetailBlockTitle}>Contact the driver</Text>
                    <Text style={styles.driverContactHint}>
                      Reach them by phone or email. You can also use in-app chat after booking.
                    </Text>
                    <Text style={styles.driverContactSubheading}>Phone</Text>
                    {phoneRaw.length > 0 ? (
                      <TouchableOpacity
                        style={styles.driverPhoneRow}
                        onPress={() => {
                          void openPhoneDialer(phoneRaw);
                        }}
                        activeOpacity={0.75}
                      >
                        <Phone color="#2563eb" size={18} strokeWidth={2.2} style={{ marginRight: 8 }} />
                        <Text style={styles.driverPhoneText}>{phoneRaw}</Text>
                        <Text style={styles.driverPhoneTap}>Call</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.driverDetailMuted}>Not on file</Text>
                    )}
                    <Text style={[styles.driverContactSubheading, styles.driverContactSubheadingSpaced]}>
                      Email
                    </Text>
                    {emailRaw.length > 0 ? (
                      <TouchableOpacity
                        style={styles.driverPhoneRow}
                        onPress={() => {
                          void Linking.openURL(`mailto:${encodeURIComponent(emailRaw)}`);
                        }}
                        activeOpacity={0.75}
                      >
                        <Mail color="#2563eb" size={18} strokeWidth={2.2} style={{ marginRight: 8 }} />
                        <Text style={styles.driverPhoneText} numberOfLines={2}>
                          {emailRaw}
                        </Text>
                        <Text style={styles.driverPhoneTap}>Email</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.driverDetailMuted}>Not on file</Text>
                    )}
                  </View>

                  <View style={styles.driverDetailBlock}>
                    <Text style={styles.driverDetailBlockTitle}>Rider ratings</Text>
                    {(() => {
                      const hasFirebaseRating =
                        profile?.averageRating != null && profile.averageRating > 0;
                      const displayValue = hasFirebaseRating
                        ? profile!.averageRating
                        : d.isDemo
                          ? DEMO_FALLBACK_RATING
                          : null;
                      return (
                        <>
                          <StarRatingRow
                            value={displayValue ?? undefined}
                            size={22}
                            ratingCount={hasFirebaseRating ? profile?.ratingCount : undefined}
                            showEmpty={displayValue == null}
                            emptyLabel="No ratings yet"
                            badge={!hasFirebaseRating && d.isDemo ? 'Demo' : undefined}
                            showMaxHint
                          />
                        </>
                      );
                    })()}
                  </View>

                  <View style={styles.driverDetailBlock}>
                    <Text style={styles.driverDetailBlockTitle}>Fare minimums (app rules)</Text>
                    {d.transportType === 'motorbike' ? (
                      <>
                        <Text style={styles.driverFareLine}>
                          Kigali (taxi moto): from {MIN_PRICE_MOTO_KIGALI_RWF.toLocaleString()} RWF
                        </Text>
                        <Text style={styles.driverFareLine}>
                          Outside Kigali (taxi moto): from {MIN_PRICE_MOTO_OUTSIDE_KIGALI_RWF.toLocaleString()} RWF
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.driverFareLine}>
                          Kigali (taxi car): from {MIN_PRICE_CAR_KIGALI_RWF.toLocaleString()} RWF
                        </Text>
                        <Text style={styles.driverFareLine}>
                          Outside Kigali: from {MIN_PRICE_CAR_OUTSIDE_KIGALI_RWF.toLocaleString()} RWF
                        </Text>
                      </>
                    )}
                    {tripMinForDriver != null && (
                      <Text style={styles.driverTripMin}>
                        Your current trip minimum: {tripMinForDriver.toLocaleString()} RWF
                      </Text>
                    )}
                  </View>

                  {typeMismatch && (
                    <Text style={styles.driverMismatch}>
                      You have{' '}
                      {transportType === 'car' ? 'Taxi car' : 'Taxi moto'} selected — switch vehicle type
                      above to book this driver.
                    </Text>
                  )}

                  <TouchableOpacity
                    style={styles.modalPrimaryBtn}
                    onPress={handleBookFromDriverDetails}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.modalPrimaryBtnText}>Contact this driver</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={closeDriverDetails}>
                    <Text style={styles.modalCancelText}>Close</Text>
                  </TouchableOpacity>
                </ScrollView>
              );
            })()}
          </Pressable>
        </Pressable>
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
  rideTypeCard: {
    marginHorizontal: 14,
    marginTop: 4,
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  rideTypeCardHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    color: '#64748b',
    marginBottom: 12,
    marginLeft: 2,
  },
  rideTypeGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rideTypeTileGap: {
    marginRight: 10,
  },
  rideTypeTile: {
    flex: 1,
    minHeight: 152,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  rideTypeTileActive: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8',
    ...Platform.select({
      ios: {
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  rideTypeTileActiveCar: {
    backgroundColor: '#15803d',
    borderColor: '#166534',
    ...Platform.select({
      ios: {
        shadowColor: '#15803d',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  rideTypeTileMuted: {
    opacity: 0.72,
    backgroundColor: '#f1f5f9',
  },
  rideTypeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rideTypeIconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  rideTypeIconWrapActiveCar: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  rideTypeIconWrapMuted: {
    backgroundColor: '#f1f5f9',
  },
  rideTypeTileTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  rideTypeTileTitleActive: {
    color: '#ffffff',
  },
  rideTypeTileTitleMuted: {
    color: '#64748b',
  },
  rideTypeTileHint: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  rideTypeTileHintActive: {
    color: 'rgba(255,255,255,0.92)',
  },
  rideTypeTileHintWarn: {
    color: '#b91c1c',
  },
  rideTypeBadge: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  rideTypeBadgeMotoIdle: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  rideTypeBadgeCarIdle: {
    backgroundColor: 'rgba(22, 163, 74, 0.14)',
  },
  rideTypeBadgeOnActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  rideTypeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  rideTypeBadgeTxtMoto: {
    color: '#1d4ed8',
  },
  rideTypeBadgeTxtCar: {
    color: '#15803d',
  },
  rideTypeBadgeTxtLight: {
    color: '#ffffff',
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
  driverDetailCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 20,
    maxHeight: '88%',
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  driverDetailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverDetailAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 14,
    backgroundColor: '#e2e8f0',
    borderWidth: 2,
    borderColor: '#e0f2fe',
  },
  driverDetailHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  driverDetailName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  driverDetailDemo: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  driverDetailVehicle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  driverDetailMetaLine: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 14,
    lineHeight: 20,
  },
  driverDetailBlock: {
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  driverDetailBlockTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  driverContactHint: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748b',
    marginBottom: 12,
  },
  driverContactSubheading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  driverContactSubheadingSpaced: {
    marginTop: 14,
  },
  driverPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverPhoneText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  driverPhoneTap: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#2563eb',
  },
  driverDetailMuted: {
    fontSize: 15,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  driverFareLine: {
    fontSize: 15,
    color: '#334155',
    marginBottom: 6,
    lineHeight: 22,
  },
  driverTripMin: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  driverMismatch: {
    fontSize: 13,
    lineHeight: 19,
    color: '#b45309',
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    overflow: 'hidden',
  },
});
