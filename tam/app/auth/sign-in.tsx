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
import { ChevronLeft, Mail, Info } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth-store';
import { BrandingLogo } from '@/components/branding/BrandingLogo';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { AUTH } from '@/constants/auth-theme';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(false);
  const requestSignInOtp = useAuthStore((state) => state.requestSignInOtp);

  const emailShake = useRef(new Animated.Value(0)).current;

  const shakeField = (animation: Animated.Value) => {
    Animated.sequence([
      Animated.timing(animation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(animation, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleSignIn = async () => {
    if (!email.trim()) {
      setEmailError(true);
      shakeField(emailShake);
      return;
    }

    const result = await requestSignInOtp(email);
    if (result.ok) {
      if (result.devOtpCode) {
        Alert.alert('Development', `SMS not configured. Your OTP is ${result.devOtpCode}`);
      }
      router.push({ pathname: '/auth/otp-verify', params: { email: email.trim() } });
    } else {
      if (result.error === 'sms_not_configured') {
        Alert.alert(
          'SMS not available',
          'Add Twilio to .env: EXPO_PUBLIC_TWILIO_ACCOUNT_SID, EXPO_PUBLIC_TWILIO_AUTH_TOKEN, EXPO_PUBLIC_TWILIO_FROM, then restart Expo.'
        );
        return;
      }
      if (result.error === 'no_phone') {
        Alert.alert(
          'No phone number',
          'Your account does not have a phone number on file. Update your profile or create a new account with a phone number.'
        );
        return;
      }
      if (result.error === 'invalid_phone') {
        Alert.alert(
          'Invalid phone number',
          'The phone number saved on your account could not be used for SMS. Edit your profile to use a full number with country code.'
        );
        return;
      }
      if (result.error === 'unknown') {
        Alert.alert('Sign in failed', 'Please try again.');
      }
      setEmailError(true);
      shakeField(emailShake);
    }
  };

  const handleOAuthError = (error: string) => {
    Alert.alert('Sign-in Error', error);
  };

  const handleOAuthSuccess = () => {
    // Navigate to home or appropriate screen after successful OAuth sign-in
    router.replace('/');
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
          <BrandingLogo size={96} containerStyle={styles.logoWrap} />

          <Text style={styles.kicker}>Welcome back</Text>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>
            Enter your account email. We’ll text a one-time code to the phone number you used when you registered.
          </Text>

          <View style={styles.card}>
            <View style={styles.notice}>
              <Info color={AUTH.primary} size={20} strokeWidth={2} style={styles.noticeIcon} />
              <Text style={styles.noticeText}>
                Enter the same email you used when you created your passenger account. We’ll send a one-time code by SMS
                to the phone number on your profile—enter it on the next screen to sign in.
              </Text>
            </View>

            <Animated.View style={{ transform: [{ translateX: emailShake }] }}>
              <View style={[styles.fieldRow, emailError && styles.fieldRowError]}>
                <Mail color={emailError ? AUTH.error : AUTH.muted} size={20} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={emailError ? AUTH.error : AUTH.muted}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) setEmailError(false);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </Animated.View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleSignIn} activeOpacity={0.9}>
              <LinearGradient
                colors={[AUTH.primary, AUTH.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtnInner}
              >
                <Text style={styles.primaryBtnText}>Send code</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.links}>
              <TouchableOpacity onPress={() => router.push('/auth/forgot-password')} hitSlop={8}>
                <Text style={styles.linkMuted}>Forgot password?</Text>
              </TouchableOpacity>
              <Text style={styles.dot}>·</Text>
              <TouchableOpacity onPress={() => router.push('/auth/register')} hitSlop={8}>
                <Text style={styles.linkStrong}>Create account</Text>
              </TouchableOpacity>
            </View>

            <OAuthButtons 
              onError={handleOAuthError}
              onSuccess={handleOAuthSuccess}
            />
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
    marginBottom: 20,
    marginTop: 8,
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
    marginBottom: 20,
    paddingHorizontal: 8,
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
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.25)',
    padding: 14,
    marginBottom: 18,
  },
  noticeIcon: {
    marginTop: 2,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: AUTH.text,
    fontWeight: '500',
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
  primaryBtn: {
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
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    flexWrap: 'wrap',
    gap: 6,
  },
  linkMuted: {
    fontSize: 14,
    color: AUTH.muted,
    fontWeight: '600',
  },
  linkStrong: {
    fontSize: 14,
    color: AUTH.primary,
    fontWeight: '700',
  },
  dot: {
    color: AUTH.muted,
    fontSize: 14,
  },
});
