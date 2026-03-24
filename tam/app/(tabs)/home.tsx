import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
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

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [price, setPrice] = useState('');
  const [transportType, setTransportType] = useState<'car' | 'motorbike'>('motorbike');
  const [selectedDestination, setSelectedDestination] = useState<RwandaDestination | null>(null);

  const searchRides = useRideStore((state) => state.searchRides);
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

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View style={styles.mapPreview}>
          <NativeMapView currentLocation={currentLocation} nearbyDrivers={nearbyDrivers} />
        </View>

        <View style={styles.searchContainer}>
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
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  mapPreview: {
    flex: 1,
    width: '100%',
  },
  searchContainer: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
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
});
