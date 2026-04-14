import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, MapPin, Navigation, Coins, CarFront, Bike, CircleCheck } from 'lucide-react-native';
import { router } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Localization from 'expo-localization';
import { fetchBigDataCloudReverseGeo } from '@/lib/reverse-geocode-net';
import { useRideStore } from '@/store/ride-store';
import { useAuthStore } from '@/store/auth-store';
import { useLocationStore } from '@/store/location-store';
import { TransportTypeSelector } from '@/components/TransportTypeSelector';
import { DriverRwandaSuggestList } from '@/components/DriverRwandaSuggestList';

export default function PostRideScreen() {
  const navigation = useNavigation();
  const user = useAuthStore(state => state.user);
  const addRide = useRideStore(state => state.addRide);
  const lastSearchParams = useRideStore(state => state.lastSearchParams);
  const currentLocation = useLocationStore(state => state.currentLocation);
  const startLocationTracking = useLocationStore(state => state.startLocationTracking);
  
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [price, setPrice] = useState('');
  const [transportType, setTransportType] = useState<'car' | 'motorbike'>('motorbike');
  const [pricePlaceholder, setPricePlaceholder] = useState<string>('Price');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestField, setSuggestField] = useState<'from' | 'to' | null>(null);

  const priceNumber = useMemo(() => Number(price), [price]);
  const isFormValid = from.trim().length > 1 && to.trim().length > 1 && Number.isFinite(priceNumber) && priceNumber > 0;

  useEffect(() => {
    return () => {
      setSuggestField(null);
    };
  }, []);
  
  useEffect(() => {
    if (lastSearchParams) {
      setFrom(lastSearchParams.from);
      setTo(lastSearchParams.to);
      setTransportType(lastSearchParams.transportType);
      if (lastSearchParams.price) {
        setPrice(lastSearchParams.price.toString());
      }
    }
  }, [lastSearchParams]);

  useEffect(() => {
    startLocationTracking();
  }, [startLocationTracking]);

  useEffect(() => {
    const getCurrencyAndLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          const { latitude, longitude } = location.coords;

          let countryRwanda = false;
          if (Platform.OS === 'android') {
            const geo = await fetchBigDataCloudReverseGeo(latitude, longitude);
            const code = geo?.countryCode?.toUpperCase();
            const name = geo?.countryName?.toLowerCase();
            countryRwanda = code === 'RW' || name === 'rwanda';
          } else {
            const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
            countryRwanda = geocode.length > 0 && geocode[0].country === 'Rwanda';
          }

          if (countryRwanda) {
            setPricePlaceholder('Price (RWF)');
          } else {
            const locale = Localization.getLocales()[0];
            const currencyCode = locale?.currencyCode || '';
            if (currencyCode) {
              setPricePlaceholder(`Price (${currencyCode})`);
            } else {
              setPricePlaceholder('Price');
            }
          }
        } else {
          const locale = Localization.getLocales()[0];
          const currencyCode = locale?.currencyCode || '';
          if (currencyCode) {
            setPricePlaceholder(`Price (${currencyCode})`);
          } else {
            setPricePlaceholder('Price');
          }
        }
      } catch (error) {
        console.log('Error getting location or currency:', error);
        setPricePlaceholder('Price');
      }
    };
    
    getCurrencyAndLocation();
  }, []);
  
  const handlePost = async () => {
    if (!from.trim() || !to.trim()) {
      Alert.alert('Missing route', 'Please enter both From and To locations.');
      return;
    }
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
      Alert.alert('Invalid price', 'Please enter a valid price amount.');
      return;
    }

    setIsSubmitting(true);
    const rideData: Parameters<typeof addRide>[0] = {
      from: from.trim(),
      to: to.trim(),
      price: priceNumber,
      transportType,
      driverId: user?.type === 'driver' ? user.id : null,
      passengerId: user?.type === 'passenger' ? user.id : null,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    if (currentLocation) {
      rideData.pickupLocation = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        address: from.trim(),
      };
    }
    await addRide(rideData);
    setIsSubmitting(false);
    router.replace('/home');
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/home');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ChevronLeft color="#0f172a" size={24} />
            </TouchableOpacity>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Post a Ride</Text>
              <Text style={styles.headerSubtitle}>Share your trip and get matched quickly</Text>
            </View>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.card}>
              <Text style={styles.cardHeading}>Transport</Text>
              <TransportTypeSelector selected={transportType} onSelect={setTransportType} />
              <View style={styles.modeHintRow}>
                {transportType === 'car' ? (
                  <CarFront color="#2563eb" size={16} />
                ) : (
                  <Bike color="#0d9488" size={16} />
                )}
                <Text style={styles.modeHintText}>
                  {transportType === 'car' ? 'Taxi car ride posting' : 'Taxi moto ride posting'}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardHeading}>Trip details</Text>

              <Text style={styles.inputLabel}>From</Text>
              <View style={styles.inputWrap}>
                <MapPin color="#64748b" size={18} />
                <TextInput
                  style={styles.input}
                  placeholder="Pickup area"
                  placeholderTextColor="#94a3b8"
                  value={from}
                  onChangeText={setFrom}
                  onFocus={() => setSuggestField('from')}
                  onBlur={() => setTimeout(() => setSuggestField((f) => (f === 'from' ? null : f)), 120)}
                />
              </View>
              {suggestField === 'from' ? (
                <DriverRwandaSuggestList
                  query={from}
                  onPick={(d) => {
                    setFrom(d.name);
                    setSuggestField(null);
                  }}
                />
              ) : null}

              <Text style={styles.inputLabel}>To</Text>
              <View style={styles.inputWrap}>
                <Navigation color="#64748b" size={18} />
                <TextInput
                  style={styles.input}
                  placeholder="Destination"
                  placeholderTextColor="#94a3b8"
                  value={to}
                  onChangeText={setTo}
                  onFocus={() => setSuggestField('to')}
                  onBlur={() => setTimeout(() => setSuggestField((f) => (f === 'to' ? null : f)), 120)}
                />
              </View>
              {suggestField === 'to' ? (
                <DriverRwandaSuggestList
                  query={to}
                  onPick={(d) => {
                    setTo(d.name);
                    setSuggestField(null);
                  }}
                />
              ) : null}

              <Text style={styles.inputLabel}>Price</Text>
              <View style={styles.inputWrap}>
                <Coins color="#64748b" size={18} />
                <TextInput
                  style={styles.input}
                  placeholder={pricePlaceholder}
                  placeholderTextColor="#94a3b8"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />
              </View>

              {currentLocation ? (
                <View style={styles.locationChip}>
                  <CircleCheck color="#16a34a" size={14} />
                  <Text style={styles.locationChipText}>Current location will be used as pickup point</Text>
                </View>
              ) : (
                <View style={[styles.locationChip, styles.locationChipWarn]}>
                  <Text style={styles.locationChipWarnText}>
                    Location not ready yet. Ride will post without pickup coordinates.
                  </Text>
                </View>
              )}
              <Text style={styles.searchHint}>Tip: You can search by district, sector, or street (e.g. KK 454 St).</Text>
            </View>

            <TouchableOpacity
              style={[styles.postButton, (!isFormValid || isSubmitting) && styles.postButtonDisabled]}
              onPress={handlePost}
              disabled={!isFormValid || isSubmitting}
            >
              <Text style={styles.postButtonText}>{isSubmitting ? 'Posting...' : 'Post Ride'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  backButton: {
    marginRight: 12,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
    marginTop: 2,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#64748b',
  },
  formContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modeHintRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeHintText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 16,
    color: '#0f172a',
  },
  locationChip: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationChipText: {
    flex: 1,
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },
  locationChipWarn: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  locationChipWarnText: {
    fontSize: 12,
    color: '#9a3412',
    fontWeight: '600',
  },
  searchHint: {
    marginTop: 10,
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
    fontWeight: '500',
  },
  postButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  postButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  postButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});