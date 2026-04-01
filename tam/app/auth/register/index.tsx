import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, ChevronRight, Car, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandingLogo } from '@/components/branding/BrandingLogo';
import { AUTH } from '@/constants/auth-theme';

export default function RegisterTypeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
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

      <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}>
        <BrandingLogo size={88} containerStyle={styles.logoWrap} />

        <Text style={styles.kicker}>Get started</Text>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Choose how you’ll use the app. You can change details later in profile.</Text>

        <TouchableOpacity
          style={styles.choiceCard}
          onPress={() => router.push('/auth/register/driver')}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Register as driver"
        >
          <LinearGradient
            colors={['#fff', '#f8fafc']}
            style={styles.choiceInner}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#eff6ff' }]}>
              <Car color={AUTH.primary} size={28} strokeWidth={2} />
            </View>
            <View style={styles.choiceText}>
              <Text style={styles.choiceTitle}>Driver</Text>
              <Text style={styles.choiceHint}>Offer rides with your taxi car or moto</Text>
            </View>
            <ChevronRight color={AUTH.muted} size={20} />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.choiceCard}
          onPress={() => router.push('/auth/register/passenger')}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Register as passenger"
        >
          <LinearGradient
            colors={['#fff', '#f8fafc']}
            style={styles.choiceInner}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#ecfdf5' }]}>
              <User color="#059669" size={28} strokeWidth={2} />
            </View>
            <View style={styles.choiceText}>
              <Text style={styles.choiceTitle}>Passenger</Text>
              <Text style={styles.choiceHint}>Book rides and find drivers</Text>
            </View>
            <ChevronRight color={AUTH.muted} size={20} />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signInLink}
          onPress={() => router.push('/auth/sign-in')}
          hitSlop={8}
        >
          <Text style={styles.signInLinkText}>
            Already have an account? <Text style={styles.signInLinkBold}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AUTH.bgTop,
  },
  backBtn: {
    position: 'absolute',
    left: 14,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AUTH.border,
  },
  body: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 120,
    alignItems: 'center',
  },
  logoWrap: {
    marginBottom: 18,
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
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: AUTH.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 340,
  },
  choiceCard: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden',
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
  choiceInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 14,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: {
    flex: 1,
    minWidth: 0,
  },
  choiceTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AUTH.text,
    marginBottom: 4,
  },
  choiceHint: {
    fontSize: 13,
    color: AUTH.muted,
    lineHeight: 18,
  },
  signInLink: {
    marginTop: 24,
  },
  signInLinkText: {
    fontSize: 15,
    color: AUTH.muted,
    textAlign: 'center',
  },
  signInLinkBold: {
    color: AUTH.primary,
    fontWeight: '700',
  },
});
