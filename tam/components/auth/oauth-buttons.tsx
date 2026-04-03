/**
 * OAuth Sign-In Buttons Component
 * Provides Google and Apple sign-in options
 */

import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import { Chrome, Apple as AppleIcon, Info } from 'lucide-react-native';
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

  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    if (!isOAuthConfigured(provider)) {
      const instructions = getOAuthSetupInstructions(provider);
      Alert.alert(
        `${provider === 'google' ? 'Google' : 'Apple'} Sign-In Not Configured`,
        instructions,
        [{ text: 'OK' }]
      );
      return;
    }

    setLoadingProvider(provider);
    
    try {
      const result = await signInWithOAuth(provider);
      
      if (result.ok) {
        onSuccess?.();
      } else {
        const errorMessages: Record<string, string> = {
          'oauth_failed': 'Sign-in failed. Please try again.',
          'unsupported_provider': 'This sign-in method is not supported.',
          'unknown': 'An unexpected error occurred.',
        };
        onError?.(errorMessages[result.error] || 'Sign-in failed');
      }
    } catch (error) {
      onError?.('An unexpected error occurred');
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.buttonRow}>
        {isOAuthConfigured('google') ? (
          <TouchableOpacity
            style={[styles.oauthButton, styles.googleButton]}
            onPress={() => handleOAuthSignIn('google')}
            disabled={loadingProvider !== null}
            activeOpacity={0.8}
          >
            {loadingProvider === 'google' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Chrome color="#fff" size={20} strokeWidth={2} />
            )}
            <Text style={styles.oauthButtonText}>Google</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.oauthButton, styles.demoButton]}
            onPress={() => handleOAuthSignIn('google')}
            disabled={loadingProvider !== null}
            activeOpacity={0.8}
          >
            {loadingProvider === 'google' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Chrome color="#fff" size={20} strokeWidth={2} />
            )}
            <Text style={styles.oauthButtonText}>Google (Demo)</Text>
          </TouchableOpacity>
        )}

        {isOAuthConfigured('apple') ? (
          <TouchableOpacity
            style={[styles.oauthButton, styles.appleButton]}
            onPress={() => handleOAuthSignIn('apple')}
            disabled={loadingProvider !== null}
            activeOpacity={0.8}
          >
            {loadingProvider === 'apple' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <AppleIcon color="#fff" size={20} strokeWidth={2} />
            )}
            <Text style={styles.oauthButtonText}>Apple</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.oauthButton, styles.demoButton]}
            onPress={() => handleOAuthSignIn('apple')}
            disabled={loadingProvider !== null}
            activeOpacity={0.8}
          >
            <Info color="#fff" size={20} strokeWidth={2} />
            <Text style={styles.oauthButtonText}>Setup OAuth</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
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
    height: 1,
    backgroundColor: AUTH.border,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 13,
    color: AUTH.muted,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  oauthButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
  },
  googleButton: {
    backgroundColor: '#4285f4',
    borderColor: '#4285f4',
  },
  appleButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  demoButton: {
    backgroundColor: '#6b7280',
    borderColor: '#6b7280',
  },
  oauthButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
