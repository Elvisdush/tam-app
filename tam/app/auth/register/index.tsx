import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, User, Mail, Phone, Lock, Camera, Car, Bike } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/auth-store';
import { BrandingLogo } from '@/components/branding/BrandingLogo';
import { AUTH } from '@/constants/auth-theme';

type AccountType = 'passenger' | 'driver';
type FieldKey = 'username' | 'email' | 'phone' | 'password' | 'vehiclePlate' | 'vehicleModel';

const AVATAR = 108;

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ role?: string | string[] }>();
  const roleParam = Array.isArray(params.role) ? params.role[0] : params.role;
  const roleFromLink = roleParam === 'driver' ? 'driver' : 'passenger';
  const [accountType, setAccountType] = useState<AccountType>(roleFromLink);

  useEffect(() => {
    setAccountType(roleFromLink);
  }, [roleFromLink]);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [vehicleImage, setVehicleImage] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<'car' | 'motorbike'>('motorbike');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [errors, setErrors] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);

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
    return { isWide };
  }, [width]);

  const pickImage = async (kind: 'profile' | 'vehicle') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      if (kind === 'profile') {
        setProfileImage(result.assets[0].uri);
      } else {
        setVehicleImage(result.assets[0].uri);
      }
    }
  };

  const shakeField = (fieldName: FieldKey) => {
    const animation = shakeAnimations[fieldName];
    if (!animation) return;
    Animated.sequence([
      Animated.timing(animation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleRegister = async () => {
    const newErrors: Partial<Record<FieldKey, boolean>> = {};
    const emptyFields: FieldKey[] = [];

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
        Alert.alert('Invalid email', 'Please enter a valid email address.');
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

    if (accountType === 'driver') {
      if (!vehiclePlate.trim()) {
        newErrors.vehiclePlate = true;
        emptyFields.push('vehiclePlate');
      }
      if (!vehicleModel.trim()) {
        newErrors.vehicleModel = true;
        emptyFields.push('vehicleModel');
      }
    }

    setErrors(newErrors);

    if (emptyFields.length > 0) {
      emptyFields.forEach((field) => shakeField(field));
      Alert.alert('Missing information', 'Please fill in all required fields.');
      return;
    }

    if (accountType === 'driver') {
      if (!profileImage || !vehicleImage) {
        Alert.alert('Missing photos', 'Drivers need a profile photo and a vehicle photo.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (accountType === 'passenger') {
        await register({
          username: username.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          profileImage: profileImage || '',
          type: 'passenger',
        });
      } else {
        await register({
          username: username.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          profileImage: profileImage!,
          vehicleImage: vehicleImage!,
          type: 'driver',
          vehicleType,
          vehiclePlate: vehiclePlate.trim(),
          vehicleModel: vehicleModel.trim(),
        });
      }
      router.replace('/home');
    } finally {
      setSubmitting(false);
    }
  };

  const subtitle =
    accountType === 'passenger'
      ? 'Add your details and optional photo. Drivers can recognize you. You’ll sign in with email and a one-time code.'
      : 'Add your photos, account details, and vehicle info. Riders will see your taxi on the map.';

  const kicker = accountType === 'passenger' ? 'Passenger' : 'Driver';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <StatusBar style="dark" />
      <View style={styles.fill}>
        <LinearGradient colors={[AUTH.bgTop, AUTH.bgBottom]} style={StyleSheet.absoluteFill} />
        <TouchableOpacity
          style={[styles.backBtn, { top: Math.max(insets.top, 12) }]}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft color={AUTH.text} size={26} />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: Math.max(insets.top, 12) + 56,
              paddingBottom: Math.max(insets.bottom, 28) + 16,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandingLogo size={80} containerStyle={styles.logoWrap} />

          <Text style={styles.kickerTop}>Create account</Text>
          <Text style={styles.title}>Sign up</Text>
          <Text style={styles.subtitleLead}>First, choose how you’ll use tam-app. You can update your profile later.</Text>

          <View style={styles.roleRow} accessibilityRole="tablist">
            <TouchableOpacity
              style={[styles.roleChip, accountType === 'passenger' && styles.roleChipActive]}
              onPress={() => setAccountType('passenger')}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityState={{ selected: accountType === 'passenger' }}
              accessibilityLabel="Sign up as passenger"
            >
              <User
                color={accountType === 'passenger' ? '#fff' : AUTH.muted}
                size={22}
                strokeWidth={2}
              />
              <Text style={[styles.roleChipText, accountType === 'passenger' && styles.roleChipTextActive]}>
                Passenger
              </Text>
              <Text style={[styles.roleChipHint, accountType === 'passenger' && styles.roleChipHintActive]}>
                Book rides
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleChip, accountType === 'driver' && styles.roleChipActiveDriver]}
              onPress={() => setAccountType('driver')}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityState={{ selected: accountType === 'driver' }}
              accessibilityLabel="Sign up as driver"
            >
              <Car
                color={accountType === 'driver' ? '#fff' : AUTH.muted}
                size={22}
                strokeWidth={2}
              />
              <Text style={[styles.roleChipText, accountType === 'driver' && styles.roleChipTextActive]}>
                Driver
              </Text>
              <Text style={[styles.roleChipHint, accountType === 'driver' && styles.roleChipHintActive]}>
                Offer rides
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.modeKicker}>{kicker}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.card}>
            {accountType === 'driver' ? (
              <>
                <Text style={styles.sectionLabel}>Photos</Text>
                <View style={[styles.photoRow, layout.isWide ? styles.photoRowWide : styles.photoRowNarrow]}>
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
                        <Camera color={AUTH.primary} size={26} strokeWidth={2} />
                        <Text style={styles.photoPlaceholderTitle}>Profile</Text>
                        <Text style={styles.photoPlaceholderHint}>Clear face</Text>
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
                        <Car color={AUTH.primary} size={26} strokeWidth={2} />
                        <Text style={styles.photoPlaceholderTitle}>Vehicle</Text>
                        <Text style={styles.photoPlaceholderHint}>Your taxi in frame</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Profile photo</Text>
                <TouchableOpacity
                  style={styles.avatarWrap}
                  onPress={() => pickImage('profile')}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Choose profile photo"
                >
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Camera color={AUTH.primary} size={28} strokeWidth={2} />
                      <Text style={styles.avatarHint}>Tap to add</Text>
                    </View>
                  )}
                  <View style={styles.avatarBadge}>
                    <Camera color="#fff" size={16} strokeWidth={2.5} />
                  </View>
                </TouchableOpacity>
                <Text style={styles.photoCaption}>Optional — helps drivers know it’s you.</Text>
              </>
            )}

            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Your details</Text>

            <Animated.View style={{ transform: [{ translateX: shakeAnimations.username }] }}>
              <View style={[styles.fieldRow, errors.username && styles.fieldRowError]}>
                <User color={errors.username ? AUTH.error : AUTH.muted} size={20} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  placeholderTextColor={errors.username ? AUTH.error : AUTH.muted}
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    if (errors.username) setErrors((prev) => ({ ...prev, username: false }));
                  }}
                  autoCapitalize="words"
                />
              </View>
            </Animated.View>

            <Animated.View style={{ transform: [{ translateX: shakeAnimations.email }] }}>
              <View style={[styles.fieldRow, errors.email && styles.fieldRowError]}>
                <Mail color={errors.email ? AUTH.error : AUTH.muted} size={20} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={errors.email ? AUTH.error : AUTH.muted}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: false }));
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </Animated.View>

            <Animated.View style={{ transform: [{ translateX: shakeAnimations.phone }] }}>
              <View style={[styles.fieldRow, errors.phone && styles.fieldRowError]}>
                <Phone color={errors.phone ? AUTH.error : AUTH.muted} size={20} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  placeholder="Phone (+country code, e.g. +250…)"
                  placeholderTextColor={errors.phone ? AUTH.error : AUTH.muted}
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: false }));
                  }}
                  keyboardType="phone-pad"
                />
              </View>
            </Animated.View>

            <Animated.View style={{ transform: [{ translateX: shakeAnimations.password }] }}>
              <View style={[styles.fieldRow, errors.password && styles.fieldRowError]}>
                <Lock color={errors.password ? AUTH.error : AUTH.muted} size={20} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={errors.password ? AUTH.error : AUTH.muted}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: false }));
                  }}
                  secureTextEntry
                />
              </View>
            </Animated.View>

            {accountType === 'driver' && (
              <>
                <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Vehicle</Text>
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
                      color={vehicleType === 'motorbike' ? AUTH.primary : AUTH.muted}
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
                    <Car color={vehicleType === 'car' ? AUTH.primary : AUTH.muted} size={20} strokeWidth={2} />
                    <Text
                      style={[styles.vehicleTypeChipText, vehicleType === 'car' && styles.vehicleTypeChipTextActive]}
                    >
                      Taxi Car
                    </Text>
                  </TouchableOpacity>
                </View>

                <Animated.View style={{ transform: [{ translateX: shakeAnimations.vehiclePlate }] }}>
                  <View style={[styles.fieldRow, errors.vehiclePlate && styles.fieldRowError]}>
                    <TextInput
                      style={[styles.input, styles.inputNoIcon]}
                      placeholder="License plate"
                      placeholderTextColor={errors.vehiclePlate ? AUTH.error : AUTH.muted}
                      value={vehiclePlate}
                      onChangeText={(text) => {
                        setVehiclePlate(text);
                        if (errors.vehiclePlate) setErrors((prev) => ({ ...prev, vehiclePlate: false }));
                      }}
                      autoCapitalize="characters"
                    />
                  </View>
                </Animated.View>

                <Animated.View style={{ transform: [{ translateX: shakeAnimations.vehicleModel }] }}>
                  <View style={[styles.fieldRow, errors.vehicleModel && styles.fieldRowError]}>
                    <TextInput
                      style={[styles.input, styles.inputNoIcon]}
                      placeholder="Model (e.g. Toyota Corolla)"
                      placeholderTextColor={errors.vehicleModel ? AUTH.error : AUTH.muted}
                      value={vehicleModel}
                      onChangeText={(text) => {
                        setVehicleModel(text);
                        if (errors.vehicleModel) setErrors((prev) => ({ ...prev, vehicleModel: false }));
                      }}
                    />
                  </View>
                </Animated.View>
              </>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
              onPress={handleRegister}
              disabled={submitting}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[AUTH.primary, AUTH.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtnInner}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {accountType === 'passenger' ? 'Create passenger account' : 'Create driver account'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.signInRow} onPress={() => router.push('/auth/sign-in')} hitSlop={8}>
              <Text style={styles.signInMuted}>Already have an account? </Text>
              <Text style={styles.signInStrong}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AUTH.bgTop,
  },
  fill: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: 14,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AUTH.border,
  },
  logoWrap: {
    marginBottom: 12,
    marginTop: 4,
  },
  kickerTop: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: AUTH.primary,
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: AUTH.text,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitleLead: {
    fontSize: 15,
    color: AUTH.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
    paddingHorizontal: 4,
    maxWidth: 400,
  },
  roleRow: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 400,
    gap: 10,
    marginBottom: 20,
  },
  roleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: AUTH.border,
    backgroundColor: AUTH.card,
  },
  roleChipActive: {
    borderColor: AUTH.primary,
    backgroundColor: AUTH.primary,
  },
  roleChipActiveDriver: {
    borderColor: '#059669',
    backgroundColor: '#059669',
  },
  roleChipText: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '800',
    color: AUTH.text,
  },
  roleChipTextActive: {
    color: '#fff',
  },
  roleChipHint: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: AUTH.muted,
  },
  roleChipHintActive: {
    color: 'rgba(255,255,255,0.9)',
  },
  modeKicker: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: AUTH.primary,
    marginBottom: 6,
    alignSelf: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: AUTH.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 18,
    paddingHorizontal: 4,
    maxWidth: 400,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: AUTH.card,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: AUTH.border,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
      },
      android: { elevation: 4 },
    }),
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: AUTH.muted,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  sectionLabelSpaced: {
    marginTop: 8,
  },
  fieldHint: {
    fontSize: 13,
    color: AUTH.muted,
    marginBottom: 12,
    marginTop: -4,
  },
  photoRow: {
    width: '100%',
    marginBottom: 8,
  },
  photoRowWide: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  photoRowNarrow: {
    flexDirection: 'column',
    gap: 12,
  },
  photoCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: AUTH.border,
    aspectRatio: 1,
    maxHeight: 200,
  },
  photoCardWide: {
    flex: 1,
    minWidth: 0,
    maxHeight: 200,
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
    minHeight: 120,
  },
  photoPlaceholderTitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
    color: AUTH.text,
  },
  photoPlaceholderHint: {
    marginTop: 4,
    fontSize: 12,
    color: AUTH.muted,
    textAlign: 'center',
  },
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  avatarPlaceholder: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: AUTH.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  avatarImage: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarHint: {
    fontSize: 12,
    fontWeight: '600',
    color: AUTH.primary,
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AUTH.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: AUTH.card,
  },
  photoCaption: {
    fontSize: 13,
    color: AUTH.muted,
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 18,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AUTH.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 12,
  },
  fieldRowError: {
    borderColor: AUTH.error,
    backgroundColor: '#fef2f2',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: AUTH.text,
  },
  inputNoIcon: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 14,
    gap: 10,
  },
  vehicleTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: AUTH.border,
    backgroundColor: '#fff',
  },
  vehicleTypeChipActive: {
    borderColor: AUTH.primary,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  vehicleTypeChipText: {
    fontSize: 14,
    color: AUTH.muted,
    fontWeight: '600',
  },
  vehicleTypeChipTextActive: {
    color: AUTH.primary,
  },
  primaryBtn: {
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnInner: {
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 22,
  },
  signInMuted: {
    fontSize: 15,
    color: AUTH.muted,
    fontWeight: '500',
  },
  signInStrong: {
    fontSize: 15,
    color: AUTH.primary,
    fontWeight: '700',
  },
});
