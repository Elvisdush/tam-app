import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, User, Mail, Phone, Lock, Camera } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/auth-store';
import { BrandingLogo } from '@/components/branding/BrandingLogo';
import { AUTH } from '@/constants/auth-theme';

type FieldKey = 'username' | 'email' | 'phone' | 'password';

export default function RegisterPassengerScreen() {
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);

  const register = useAuthStore((state) => state.register);

  const shakeAnimations = {
    username: useRef(new Animated.Value(0)).current,
    email: useRef(new Animated.Value(0)).current,
    phone: useRef(new Animated.Value(0)).current,
    password: useRef(new Animated.Value(0)).current,
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const shakeField = (fieldName: FieldKey) => {
    const animation = shakeAnimations[fieldName];
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

    setErrors(newErrors);

    if (emptyFields.length > 0) {
      emptyFields.forEach((field) => shakeField(field));
      Alert.alert('Missing information', 'Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        profileImage: profileImage || '',
        type: 'passenger',
      });
      router.replace('/home');
    } finally {
      setSubmitting(false);
    }
  };

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

          <Text style={styles.kicker}>Passenger</Text>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>
            Add your details and a profile photo so drivers can recognize you. You’ll sign in with email and a one-time
            code.
          </Text>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Profile photo</Text>
            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={pickImage}
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
                  <Text style={styles.primaryBtnText}>Create passenger account</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signInRow}
              onPress={() => router.push('/auth/sign-in')}
              hitSlop={8}
            >
              <Text style={styles.signInMuted}>Already have an account? </Text>
              <Text style={styles.signInStrong}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const AVATAR = 108;

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
    marginBottom: 16,
    marginTop: 4,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: AUTH.primary,
    marginBottom: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: AUTH.text,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: AUTH.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
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
