/**
 * OAuth sign-in: Google & Apple, with clear states when env keys are missing.
 */

import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth-store';
import { isOAuthConfigured, OAuthProvider, getOAuthSetupInstructions } from '@/lib/oauth';
import { AUTH } from '@/constants/auth-theme';

interface OAuthButtonsProps {
  onError?: (error: string) => void;
  onSuccess?: () => void;
}

export function OAuthButtons({ onError, onSuccess }: OAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const signInWithOAuth = useAuthStore((state) => state.signInWithOAuth);

  const showSetupSheet = useCallback((provider: OAuthProvider) => {
    const title = provider === 'google' ? 'Connect Google sign-in' : 'Connect Apple sign-in';
    const instructions = getOAuthSetupInstructions(provider);
    Alert.alert(title, instructions, [{ text: 'OK' }], { cancelable: true });
  }, []);

  const runSignIn = useCallback(
    async (provider: OAuthProvider) => {
      if (!isOAuthConfigured(provider)) {
        showSetupSheet(provider);
        return;
      }

      setLoadingProvider(provider);
      try {
        const result = await signInWithOAuth(provider);
        if (result.ok) {
          onSuccess?.();
        } else {
          const errorMessages: Record<string, string> = {
            oauth_failed: 'Sign-in failed. Please try again.',
            unsupported_provider: 'This sign-in method is not supported on this device.',
            unknown: 'An unexpected error occurred.',
          };
          onError?.(errorMessages[result.error] ?? 'Sign-in failed');
        }
      } catch {
        onError?.('An unexpected error occurred');
      } finally {
        setLoadingProvider(null);
      }
    },
    [onError, onSuccess, showSetupSheet, signInWithOAuth]
  );

  const googleReady = isOAuthConfigured('google');
  const appleReady = isOAuthConfigured('apple');

  return (
    <View style={styles.container}>
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.buttonRow}>
        <OAuthChip
          provider="google"
          configured={googleReady}
          loading={loadingProvider === 'google'}
          onPress={() => (googleReady ? runSignIn('google') : showSetupSheet('google'))}
        />
        <OAuthChip
          provider="apple"
          configured={appleReady}
          loading={loadingProvider === 'apple'}
          onPress={() => (appleReady ? runSignIn('apple') : showSetupSheet('apple'))}
        />
      </View>

      {(!googleReady || !appleReady) && (
        <Text style={styles.hint}>
          Add{' '}
          {!googleReady && !appleReady
            ? 'EXPO_PUBLIC_GOOGLE_CLIENT_ID and EXPO_PUBLIC_APPLE_CLIENT_ID'
            : !googleReady
              ? 'EXPO_PUBLIC_GOOGLE_CLIENT_ID'
              : 'EXPO_PUBLIC_APPLE_CLIENT_ID'}{' '}
          to your env file, then restart the app.
          {Platform.OS === 'web' ? ' For web, create a Web client in Google Cloud with this origin as authorized.' : ''}
        </Text>
      )}
    </View>
  );
}

function OAuthChip({
  provider,
  configured,
  loading,
  onPress,
}: {
  provider: OAuthProvider;
  configured: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  const isGoogle = provider === 'google';
  const label = isGoogle ? 'Google' : 'Apple';
  const a11yLabel = configured
    ? `Sign in with ${label}`
    : `${label} sign-in — open setup instructions`;

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        isGoogle ? (configured ? styles.googleFilled : styles.googleOutline) : configured ? styles.appleFilled : styles.appleOutline,
      ]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      {loading ? (
        <ActivityIndicator color={configured ? '#fff' : AUTH.text} size="small" />
      ) : (
        <FontAwesome5
          name={isGoogle ? 'google' : 'apple'}
          brand
          size={18}
          color={
            configured
              ? '#ffffff'
              : isGoogle
                ? '#4285F4'
                : '#000000'
          }
        />
      )}
      <View style={styles.chipTextWrap}>
        <Text
          style={[
            styles.chipTitle,
            configured ? styles.chipTitleOnBrand : styles.chipTitleOutline,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          style={[
            styles.chipSubtitle,
            configured ? styles.chipSubtitleOnBrand : styles.chipSubtitleOutline,
          ]}
          numberOfLines={1}
        >
          {configured ? 'Sign in' : 'Tap to set up'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: AUTH.border,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 13,
    color: AUTH.muted,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  googleFilled: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  googleOutline: {
    backgroundColor: '#ffffff',
    borderColor: '#dadce0',
  },
  appleFilled: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  appleOutline: {
    backgroundColor: '#ffffff',
    borderColor: '#1f1f1f',
  },
  chipTextWrap: {
    flexShrink: 1,
  },
  chipTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  chipTitleOnBrand: {
    color: '#ffffff',
  },
  chipTitleOutline: {
    color: '#202124',
  },
  chipSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  chipSubtitleOnBrand: {
    color: 'rgba(255,255,255,0.88)',
  },
  chipSubtitleOutline: {
    color: AUTH.muted,
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 17,
    color: AUTH.muted,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});
