import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth-store';
import { BrandingLogo } from '@/components/branding/BrandingLogo';
import { AUTH } from '@/constants/auth-theme';

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && isAuthenticated) {
      setTimeout(() => {
        router.replace('/home');
      }, 100);
    }
  }, [isAuthenticated, isMounted]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <LinearGradient colors={[AUTH.bgTop, AUTH.bgBottom]} style={StyleSheet.absoluteFill} />
      <View
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 20) + 24,
            paddingBottom: Math.max(insets.bottom, 20) + 24,
          },
        ]}
      >
        <BrandingLogo size={110} containerStyle={styles.logo} />
        <Text style={styles.appName}>tam-app</Text>
        <Text style={styles.tagline}>Rides across Rwanda — book a taxi moto or car in seconds.</Text>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryWrap}
            onPress={() => router.push('/auth/sign-in')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[AUTH.primary, AUTH.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryText}>Sign in</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/auth/register')}
            activeOpacity={0.88}
          >
            <Text style={styles.secondaryText}>Create account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AUTH.bgTop,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: AUTH.text,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 16,
    lineHeight: 24,
    color: AUTH.muted,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 40,
  },
  buttons: {
    width: '100%',
    maxWidth: 400,
    gap: 14,
  },
  primaryWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: AUTH.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  primaryBtn: {
    paddingVertical: 17,
    alignItems: 'center',
    borderRadius: 16,
  },
  primaryText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 17,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AUTH.border,
  },
  secondaryText: {
    color: AUTH.text,
    fontSize: 17,
    fontWeight: '700',
  },
});
