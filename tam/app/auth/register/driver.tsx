import React, { useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ImageBackground,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  Animated,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, Camera, Car, Bike } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth-store';

const ACCENT = '#2563eb';
const ACCENT_SOFT = 'rgba(37, 99, 235, 0.12)';

export default function RegisterDriverScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [vehicleImage, setVehicleImage] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<'car' | 'motorbike'>('motorbike');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});

  const register = useAuthStore((state) => state.register);

  const shakeAnimations = {
    username: useRef(new Animated.Value(0)).current,
    email: useRef(new Animated.Value(0)).current,
    phone: useRef(new Animated.Value(0)).current,
    password: useRef(new Animated.Value(0)).current,
    vehiclePlate: useRef(new Animated.Value(0)).current,
    vehicleModel: useRef(new Animated.Value(0)).current,
  };

  const layout = useMemo(() => {
    const isWide = width >= 520;
    const horizontalPad = Math.max(16, Math.min(28, width * 0.06));
    const formMaxWidth = Math.min(560, width - horizontalPad * 2);
    return { isWide, horizontalPad, formMaxWidth };
  }, [width]);

  const pickImage = async (type: 'profile' | 'vehicle') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      if (type === 'profile') {
        setProfileImage(result.assets[0].uri);
      } else {
        setVehicleImage(result.assets[0].uri);
      }
    }
  };

  const shakeField = (fieldName: string) => {
    const animation = shakeAnimations[fieldName as keyof typeof shakeAnimations];
    if (!animation) return;
    Animated.sequence([
      Animated.timing(animation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleRegister = async () => {
    const newErrors: { [key: string]: boolean } = {};
    const emptyFields: string[] = [];

    if (!username.trim()) {
      newErrors.username = true;
      emptyFields.push('username');
    }
    if (!email.trim()) {
      newErrors.email = true;
      emptyFields.push('email');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = true;
        emptyFields.push('email');
        setErrors(newErrors);
        shakeField('email');
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
        return;
      }
    }
    if (!phone.trim()) {
      newErrors.phone = true;
      emptyFields.push('phone');
    }
    if (!password.trim()) {
      newErrors.password = true;
      emptyFields.push('password');
    }
    if (!vehiclePlate.trim()) {
      newErrors.vehiclePlate = true;
      emptyFields.push('vehiclePlate');
    }
    if (!vehicleModel.trim()) {
      newErrors.vehicleModel = true;
      emptyFields.push('vehicleModel');
    }

    setErrors(newErrors);

    if (emptyFields.length > 0) {
      emptyFields.forEach((field) => shakeField(field));
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (!profileImage || !vehicleImage) {
      Alert.alert('Missing Images', 'Please add both profile and vehicle photos.');
      return;
    }

    await register({
      username,
      email,
      phone,
      password,
      profileImage,
      vehicleImage,
      type: 'driver',
      vehicleType,
      vehiclePlate: vehiclePlate.trim(),
      vehicleModel: vehicleModel.trim(),
    });
    router.replace('/home');
  };

  const photoRowStyle = [
    styles.photoRow,
    layout.isWide ? styles.photoRowWide : styles.photoRowNarrow,
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <StatusBar style="light" />
      <ImageBackground
        source={{
          uri: 'https://images.unsplash.com/photo-1682686580391-615b1f28e6d1?q=80&w=1470&auto=format&fit=crop',
        }}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient colors={['rgba(15, 23, 42, 0.45)', 'rgba(15, 23, 42, 0.88)']} style={styles.gradient}>
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 8, left: layout.horizontalPad }]}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft color="white" size={26} />
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: insets.top + 52,
                paddingBottom: Math.max(insets.bottom, 24) + 16,
                paddingHorizontal: layout.horizontalPad,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.formShell, { maxWidth: layout.formMaxWidth, width: '100%' }]}>
              <View style={styles.headerBlock}>
                <Text style={styles.kicker}>Become a driver</Text>
                <Text style={styles.title}>Create your driver profile</Text>
                <Text style={styles.subtitle}>
                  Add your photos, account details, and vehicle info. You can edit these later in settings.
                </Text>
              </View>

              <Text style={styles.sectionLabel}>Photos</Text>
              <View style={photoRowStyle}>
                <TouchableOpacity
                  style={[styles.photoCard, layout.isWide && styles.photoCardWide]}
                  onPress={() => pickImage('profile')}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Add profile photo"
                >
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.photoImage} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Camera color={ACCENT} size={28} strokeWidth={2} />
                      <Text style={styles.photoPlaceholderTitle}>Profile</Text>
                      <Text style={styles.photoPlaceholderHint}>Clear face photo</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.photoCard, layout.isWide && styles.photoCardWide]}
                  onPress={() => pickImage('vehicle')}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Add vehicle photo"
                >
                  {vehicleImage ? (
                    <Image source={{ uri: vehicleImage }} style={styles.photoImage} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Car color={ACCENT} size={28} strokeWidth={2} />
                      <Text style={styles.photoPlaceholderTitle}>Vehicle</Text>
                      <Text style={styles.photoPlaceholderHint}>Your taxi in frame</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionLabel}>Account</Text>
              <Animated.View style={{ transform: [{ translateX: shakeAnimations.username }] }}>
                <TextInput
                  style={[styles.input, errors.username && styles.errorInput]}
                  placeholder="Full name"
                  placeholderTextColor={errors.username ? '#ef4444' : '#64748b'}
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    if (errors.username) setErrors((prev) => ({ ...prev, username: false }));
                  }}
                />
                {errors.username ? <Text style={styles.errorText}>Name is required</Text> : null}
              </Animated.View>

              <Animated.View style={{ transform: [{ translateX: shakeAnimations.email }] }}>
                <TextInput
                  style={[styles.input, errors.email && styles.errorInput]}
                  placeholder="Email"
                  placeholderTextColor={errors.email ? '#ef4444' : '#64748b'}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: false }));
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {errors.email ? <Text style={styles.errorText}>Valid email is required</Text> : null}
              </Animated.View>

              <Animated.View style={{ transform: [{ translateX: shakeAnimations.phone }] }}>
                <TextInput
                  style={[styles.input, errors.phone && styles.errorInput]}
                  placeholder="Phone number"
                  placeholderTextColor={errors.phone ? '#ef4444' : '#64748b'}
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: false }));
                  }}
                  keyboardType="phone-pad"
                />
                {errors.phone ? <Text style={styles.errorText}>Phone is required</Text> : null}
              </Animated.View>

              <Animated.View style={{ transform: [{ translateX: shakeAnimations.password }] }}>
                <TextInput
                  style={[styles.input, errors.password && styles.errorInput]}
                  placeholder="Password"
                  placeholderTextColor={errors.password ? '#ef4444' : '#64748b'}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: false }));
                  }}
                  secureTextEntry
                />
                {errors.password ? <Text style={styles.errorText}>Password is required</Text> : null}
              </Animated.View>

              <Text style={styles.sectionLabel}>Vehicle</Text>
              <Text style={styles.fieldHint}>What will you drive for rides?</Text>
              <View style={styles.vehicleTypeRow}>
                <TouchableOpacity
                  style={[styles.vehicleTypeChip, vehicleType === 'motorbike' && styles.vehicleTypeChipActive]}
                  onPress={() => setVehicleType('motorbike')}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityState={{ selected: vehicleType === 'motorbike' }}
                >
                  <Bike
                    color={vehicleType === 'motorbike' ? ACCENT : '#64748b'}
                    size={20}
                    strokeWidth={2}
                  />
                  <Text
                    style={[
                      styles.vehicleTypeChipText,
                      vehicleType === 'motorbike' && styles.vehicleTypeChipTextActive,
                    ]}
                  >
                    Taxi Moto
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.vehicleTypeChip, vehicleType === 'car' && styles.vehicleTypeChipActive]}
                  onPress={() => setVehicleType('car')}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityState={{ selected: vehicleType === 'car' }}
                >
                  <Car color={vehicleType === 'car' ? ACCENT : '#64748b'} size={20} strokeWidth={2} />
                  <Text
                    style={[styles.vehicleTypeChipText, vehicleType === 'car' && styles.vehicleTypeChipTextActive]}
                  >
                    Taxi Car
                  </Text>
                </TouchableOpacity>
              </View>

              <Animated.View style={{ transform: [{ translateX: shakeAnimations.vehiclePlate }] }}>
                <TextInput
                  style={[styles.input, errors.vehiclePlate && styles.errorInput]}
                  placeholder="License plate"
                  placeholderTextColor={errors.vehiclePlate ? '#ef4444' : '#64748b'}
                  value={vehiclePlate}
                  onChangeText={(text) => {
                    setVehiclePlate(text);
                    if (errors.vehiclePlate) setErrors((prev) => ({ ...prev, vehiclePlate: false }));
                  }}
                  autoCapitalize="characters"
                />
                {errors.vehiclePlate ? <Text style={styles.errorText}>Plate number is required</Text> : null}
              </Animated.View>

              <Animated.View style={{ transform: [{ translateX: shakeAnimations.vehicleModel }] }}>
                <TextInput
                  style={[styles.input, errors.vehicleModel && styles.errorInput]}
                  placeholder="Model (e.g. Toyota Corolla)"
                  placeholderTextColor={errors.vehicleModel ? '#ef4444' : '#64748b'}
                  value={vehicleModel}
                  onChangeText={(text) => {
                    setVehicleModel(text);
                    if (errors.vehicleModel) setErrors((prev) => ({ ...prev, vehicleModel: false }));
                  }}
                />
                {errors.vehicleModel ? <Text style={styles.errorText}>Vehicle model is required</Text> : null}
              </Animated.View>

              <TouchableOpacity style={styles.registerButton} onPress={handleRegister} activeOpacity={0.9}>
                <Text style={styles.registerText}>Complete registration</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </LinearGradient>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
  },
  gradient: {
    flex: 1,
    minHeight: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formShell: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderRadius: 24,
    padding: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
      default: {
        boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
      },
    }),
  },
  headerBlock: {
    marginBottom: 20,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: ACCENT,
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
  },
  sectionLabel: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
    marginTop: 4,
  },
  fieldHint: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
    marginTop: -4,
  },
  photoRow: {
    width: '100%',
    marginBottom: 8,
  },
  photoRowWide: {
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  photoRowNarrow: {
    flexDirection: 'column',
    gap: 12,
  },
  photoCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    aspectRatio: 1,
    maxHeight: 200,
  },
  photoCardWide: {
    flex: 1,
    minWidth: 0,
    maxHeight: 220,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    minHeight: 140,
  },
  photoPlaceholderTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  photoPlaceholderHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#f8fafc',
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 14,
    fontSize: 16,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  registerButton: {
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  registerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  errorInput: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
    marginTop: -8,
    marginBottom: 10,
    marginLeft: 4,
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 16,
    gap: 10,
  },
  vehicleTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  vehicleTypeChipActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT_SOFT,
  },
  vehicleTypeChipText: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '600',
  },
  vehicleTypeChipTextActive: {
    color: ACCENT,
  },
});
