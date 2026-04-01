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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, Mail, Phone } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandingLogo } from '@/components/branding/BrandingLogo';
import { AUTH } from '@/constants/auth-theme';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ email: boolean; phone: boolean }>({ email: false, phone: false });

  const emailShake = useRef(new Animated.Value(0)).current;
  const phoneShake = useRef(new Animated.Value(0)).current;

  const shakeField = (animation: Animated.Value) => {
    Animated.sequence([
      Animated.timing(animation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleSend = () => {
    const emailEmpty = !email.trim();
    const phoneEmpty = !phone.trim();
    let emailInvalid = false;

    if (!emailEmpty) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        emailInvalid = true;
      }
    }

    const newErrors = {
      email: emailEmpty || emailInvalid,
      phone: phoneEmpty,
    };

    setErrors(newErrors);

    if (newErrors.email) {
      shakeField(emailShake);
    }
    if (newErrors.phone) {
      shakeField(phoneShake);
    }

    if (emailInvalid && !emailEmpty) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    if (!newErrors.email && !newErrors.phone) {
      Alert.alert(
        'Check your inbox',
        'If an account exists for this email and phone, we’ll send reset instructions shortly.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
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
              paddingBottom: Math.max(insets.bottom, 24) + 16,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandingLogo size={80} containerStyle={styles.logoWrap} />

          <Text style={styles.kicker}>Account recovery</Text>
          <Text style={styles.title}>Forgot password?</Text>
          <Text style={styles.subtitle}>
            Enter the email and phone number linked to your account. We’ll send you steps to reset your password.
          </Text>

          <View style={styles.card}>
            <Animated.View style={{ transform: [{ translateX: emailShake }] }}>
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

            <Animated.View style={{ transform: [{ translateX: phoneShake }] }}>
              <View style={[styles.fieldRow, errors.phone && styles.fieldRowError]}>
                <Phone color={errors.phone ? AUTH.error : AUTH.muted} size={20} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  placeholder="Phone number"
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

            <TouchableOpacity style={styles.primaryBtnWrap} onPress={handleSend} activeOpacity={0.9}>
              <LinearGradient
                colors={[AUTH.primary, AUTH.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtnInner}
              >
                <Text style={styles.primaryBtnText}>Send reset instructions</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryLink}
              onPress={() => router.push('/auth/sign-in')}
              hitSlop={8}
            >
              <Text style={styles.secondaryLinkText}>
                Remember your password? <Text style={styles.secondaryLinkBold}>Sign in</Text>
              </Text>
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
    marginBottom: 16,
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
    fontSize: 28,
    fontWeight: '800',
    color: AUTH.text,
    letterSpacing: -0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: AUTH.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 26,
    maxWidth: 340,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
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
    marginBottom: 14,
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
  primaryBtnWrap: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryBtnInner: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryLink: {
    marginTop: 22,
    alignItems: 'center',
  },
  secondaryLinkText: {
    fontSize: 15,
    color: AUTH.muted,
    textAlign: 'center',
  },
  secondaryLinkBold: {
    color: AUTH.primary,
    fontWeight: '700',
  },
});
