import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, Smartphone } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth-store';
import { BrandingLogo } from '@/components/branding/BrandingLogo';
import { AUTH } from '@/constants/auth-theme';

function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function OtpVerifyScreen() {
  const insets = useSafeAreaInsets();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const phoneMasked = useAuthStore((s) => s.pendingAuth?.phoneMasked ?? '');
  const pendingOtpExpiresAt = useAuthStore((s) => s.pendingOtpExpiresAt);
  const verifySignInOtp = useAuthStore((s) => s.verifySignInOtp);
  const resendSignInOtp = useAuthStore((s) => s.resendSignInOtp);
  const clearPendingAuth = useAuthStore((s) => s.clearPendingAuth);

  const [otp, setOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const exp = useAuthStore.getState().pendingOtpExpiresAt;
    return exp != null ? Math.max(0, Math.ceil((exp - Date.now()) / 1000)) : 0;
  });
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const email = emailParam?.trim() ?? '';

  useEffect(() => {
    const expected = email.toLowerCase();
    const pending = useAuthStore.getState().pendingAuth;
    if (!expected || !pending || pending.email.toLowerCase() !== expected) {
      router.replace('/auth/sign-in');
    }
  }, [email]);

  useEffect(() => {
    const exp = pendingOtpExpiresAt;
    if (exp == null) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((exp - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pendingOtpExpiresAt]);

  const handleVerify = useCallback(async () => {
    const code = otp.trim();
    if (code.length !== 6 || submitting) return;
    setSubmitting(true);
    try {
      const ok = await verifySignInOtp(email, code);
      if (ok) {
        router.replace('/home');
      } else {
        Alert.alert('Invalid or expired code', 'Check the text message we sent or request a new code.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [email, otp, submitting, verifySignInOtp]);

  const handleResend = useCallback(async () => {
    if (secondsLeft > 0 || resending) return;
    setResending(true);
    try {
      const result = await resendSignInOtp();
      if (result.ok) {
        if (result.devOtpCode) {
          Alert.alert('Development', `SMS not configured. Your OTP is ${result.devOtpCode}`);
        } else {
          Alert.alert('Code sent', 'We sent a new code by text message.');
        }
      } else if (result.error === 'no_pending') {
        router.replace('/auth/sign-in');
      } else if (result.error === 'sms_not_configured') {
        Alert.alert(
          'SMS not available',
          'Configure Twilio in .env (EXPO_PUBLIC_TWILIO_*) and restart Expo.'
        );
      } else {
        Alert.alert('Could not resend', 'Please try again.');
      }
    } finally {
      setResending(false);
    }
  }, [secondsLeft, resending, resendSignInOtp]);

  const handleBack = () => {
    clearPendingAuth();
    router.back();
  };

  const expired = pendingOtpExpiresAt != null && secondsLeft === 0;

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
          onPress={handleBack}
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

          <Text style={styles.kicker}>Check your phone</Text>
          <Text style={styles.title}>Enter code</Text>
          <Text style={styles.subtitle}>
            We texted a 6-digit code to{' '}
            <Text style={styles.subtitleStrong}>{phoneMasked || 'your phone'}</Text> (the number on your account). It
            expires in 2 minutes.
          </Text>

          <View style={styles.card}>
            <View style={styles.timerRow}>
              <Smartphone color={AUTH.primary} size={18} strokeWidth={2} />
              <Text style={styles.timerText}>
                {expired ? 'Code expired' : `Expires in ${formatMmSs(secondsLeft)}`}
              </Text>
            </View>

            <View style={styles.fieldRow}>
              <TextInput
                style={styles.input}
                placeholder="000000"
                placeholderTextColor={AUTH.muted}
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, (otp.length !== 6 || submitting) && styles.primaryBtnDisabled]}
              onPress={handleVerify}
              disabled={otp.length !== 6 || submitting}
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
                  <Text style={styles.primaryBtnText}>Verify & sign in</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resendBtn, (secondsLeft > 0 || resending) && styles.resendBtnDisabled]}
              onPress={handleResend}
              disabled={secondsLeft > 0 || resending}
            >
              {resending ? (
                <ActivityIndicator color={AUTH.primary} />
              ) : (
                <Text style={styles.resendText}>
                  {secondsLeft > 0 ? `Resend code in ${formatMmSs(secondsLeft)}` : 'Resend code'}
                </Text>
              )}
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
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  subtitleStrong: {
    color: AUTH.text,
    fontWeight: '700',
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
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  timerText: {
    fontSize: 15,
    fontWeight: '600',
    color: AUTH.text,
  },
  fieldRow: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AUTH.border,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  input: {
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 8,
    color: AUTH.text,
    textAlign: 'center',
  },
  primaryBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryBtnDisabled: {
    opacity: 0.55,
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
  resendBtn: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendBtnDisabled: {
    opacity: 0.55,
  },
  resendText: {
    fontSize: 15,
    fontWeight: '700',
    color: AUTH.primary,
  },
});
