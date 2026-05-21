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
import {
  ChevronLeft,
  MapPin,
  Navigation,
  Coins,
  CarFront,
  Bike,
  CircleCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react-native';
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

/** Matches tab bar & primary actions across the app */
const BRAND = '#3498db';
const BRAND_DEEP = '#2980b9';
const TEXT_MAIN = '#0f172a';
const TEXT_MUTED = '#64748b';

export default function PostRideScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const addRide = useRideStore((state) => state.addRide);
  const lastSearchParams = useRideStore((state) => state.lastSearchParams);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const startLocationTracking = useLocationStore((state) => state.startLocationTracking);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [price, setPrice] = useState('');
  const [transportType, setTransportType] = useState<'car' | 'motorbike'>('motorbike');
  const [pricePlaceholder, setPricePlaceholder] = useState<string>('Price');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestField, setSuggestField] = useState<'from' | 'to' | null>(null);

  const priceNumber = useMemo(() => Number(price), [price]);
  const isFormValid =
    from.trim().length > 1 && to.trim().length > 1 && Number.isFinite(priceNumber) && priceNumber > 0;

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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack} accessibilityLabel="Go back">
              <ChevronLeft color="#fff" size={26} />
            </TouchableOpacity>
          </View>

          {/* Hero — quick to scan, high contrast */}
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Sparkles color="#fff" size={16} />
              <Text style={styles.heroBadgeText}>Visible to nearby drivers</Text>
            </View>
            <Text style={styles.heroTitle}>Post your ride</Text>
            <Text style={styles.heroSubtitle}>
              Set pickup → drop-off → fair price. Drivers nearby can accept in seconds.
            </Text>
          </View>

          {/* Visual route strip */}
          <View style={styles.routeVisual}>
            <View style={styles.routeDot}>
              <MapPin color={BRAND} size={18} />
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeDot}>
              <Navigation color={BRAND_DEEP} size={18} />
            </View>
          </View>

          <View style={styles.sheet}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Vehicle</Text>
              <View style={styles.cardHintRow}>
                {transportType === 'car' ? (
                  <CarFront color={BRAND} size={16} />
                ) : (
                  <Bike color="#16a085" size={16} />
                )}
                <Text style={styles.cardHintText}>
                  {transportType === 'car'
                    ? 'Taxi car — more space & comfort'
                    : 'Taxi moto — fast in traffic'}
                </Text>
              </View>
              <TransportTypeSelector selected={transportType} onSelect={setTransportType} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Route & price</Text>

              <Text style={styles.fieldLabel}>From</Text>
              <View style={styles.inputWrap}>
                <MapPin color={BRAND} size={20} />
                <TextInput
                  style={styles.input}
                  placeholder="Pickup area"
                  placeholderTextColor="#94a3b8"
                  value={from}
                  onChangeText={setFrom}
                  onFocus={() => setSuggestField('from')}
                  onBlur={() =>
                    setTimeout(() => setSuggestField((f) => (f === 'from' ? null : f)), 120)
                  }
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

              <Text style={styles.fieldLabel}>To</Text>
              <View style={styles.inputWrap}>
                <Navigation color={BRAND_DEEP} size={20} />
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

              <Text style={styles.fieldLabel}>Your fare</Text>
              <View style={[styles.inputWrap, styles.priceWrap]}>
                <Coins color="#f39c12" size={20} />
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
                  <CircleCheck color="#27ae60" size={16} />
                  <Text style={styles.locationChipText}>GPS pickup point ready — drivers see where to meet you</Text>
                </View>
              ) : (
                <View style={[styles.locationChip, styles.locationChipWarn]}>
                  <Text style={styles.locationChipWarnText}>
                    Turn on location for a precise pickup pin. You can still post with text only.
                  </Text>
                </View>
              )}
              <Text style={styles.tip}>
                Tip: district, sector, or street (e.g. KK 454 St) — same as on Home.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.cta, (!isFormValid || isSubmitting) && styles.ctaDisabled]}
              onPress={handlePost}
              disabled={!isFormValid || isSubmitting}
              activeOpacity={0.9}
            >
              <Text style={styles.ctaText}>{isSubmitting ? 'Posting…' : 'Post ride'}</Text>
              <View style={styles.ctaIconCircle}>
                <ArrowRight color="#fff" size={22} />
              </View>
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
    backgroundColor: BRAND,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  topBar: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '600',
  },
  routeVisual: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 40,
    gap: 10,
  },
  routeDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  routeLine: {
    flex: 1,
    maxWidth: 120,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  sheet: {
    flex: 1,
    backgroundColor: '#f4f9fd',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.12)',
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_MAIN,
    marginBottom: 6,
  },
  cardHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardHintText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_MUTED,
    fontWeight: '600',
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 13,
    color: TEXT_MUTED,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  priceWrap: {
    borderColor: 'rgba(243, 156, 18, 0.35)',
    backgroundColor: '#fffbeb',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: TEXT_MAIN,
    fontWeight: '600',
  },
  locationChip: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#e8f8f2',
    borderWidth: 1,
    borderColor: '#c8eed9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationChipText: {
    flex: 1,
    fontSize: 13,
    color: '#1e8449',
    fontWeight: '700',
    lineHeight: 18,
  },
  locationChipWarn: {
    backgroundColor: '#fef5e7',
    borderColor: '#fad7a0',
  },
  locationChipWarnText: {
    fontSize: 13,
    color: '#b9770e',
    fontWeight: '700',
    lineHeight: 18,
  },
  tip: {
    marginTop: 12,
    fontSize: 12,
    color: TEXT_MUTED,
    lineHeight: 17,
    fontWeight: '500',
  },
  cta: {
    backgroundColor: BRAND,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  ctaDisabled: {
    backgroundColor: '#bdc3c7',
    shadowOpacity: 0,
  },
  ctaText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  ctaIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
