/**
 * OAuth 2.0 Authentication Service
 * Supports Google Sign-In and Apple Sign-In (Web-based for Expo Go)
 */

import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import Crypto from 'expo-crypto';

// Note: @react-native-google-signin/google-signin requires native code
// and won't work in Expo Go. For Expo Go, we'll use web-based OAuth.
// For production builds, you can add the native module.

WebBrowser.maybeCompleteAuthSession();

// OAuth Provider Types
export type OAuthProvider = 'google' | 'apple';

export interface OAuthUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  provider: OAuthProvider;
  providerId: string;
}

export interface OAuthConfig {
  clientId: string;
  redirectUri?: string;
  scopes?: string[];
}

// OAuth Configurations
const OAUTH_CONFIGS: Record<OAuthProvider, OAuthConfig> = {
  google: {
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
    redirectUri: AuthSession.makeRedirectUri({
      scheme: 'taxiapp',
      path: 'oauth/google',
    }),
    scopes: ['profile', 'email'],
  },
  apple: {
    clientId: process.env.EXPO_PUBLIC_APPLE_CLIENT_ID || '',
    redirectUri: AuthSession.makeRedirectUri({
      scheme: 'taxiapp',
      path: 'oauth/apple',
    }),
    scopes: ['name', 'email'],
  },
};

// Google Sign-In (Web-based for Expo Go compatibility)
export async function signInWithGoogle(): Promise<OAuthUser | null> {
  try {
    return await signInWithGoogleWeb();
  } catch (error) {
    console.error('[OAuth] Google sign-in error:', error);
    return null;
  }
}

async function signInWithGoogleWeb(): Promise<OAuthUser | null> {
  try {
    const config = OAUTH_CONFIGS.google;
    if (!config.clientId) {
      throw new Error('Google Client ID not configured');
    }

    // Generate PKCE verifier
    const verifier = Crypto.randomUUID();
    const challenge = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      verifier
    );

    // Build authorization URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', config.redirectUri!);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', config.scopes!.join(' '));
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('prompt', 'select_account');

    // Start auth session
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl.toString(),
      config.redirectUri!
    );

    if (result.type === 'success') {
      // For demo purposes, we'll simulate getting user info
      // In production, you'd exchange the code for tokens on your backend
      const mockUserInfo = await mockGoogleUserInfo();
      
      return {
        id: mockUserInfo.id,
        email: mockUserInfo.email,
        name: mockUserInfo.name,
        picture: mockUserInfo.picture,
        provider: 'google',
        providerId: mockUserInfo.id,
      };
    }

    return null;
  } catch (error) {
    console.error('[OAuth] Web Google sign-in error:', error);
    return null;
  }
}

// Mock function for demo - replace with actual token exchange
async function mockGoogleUserInfo(): Promise<{
  id: string;
  email: string;
  name?: string;
  picture?: string;
}> {
  // In production, this would be an API call to Google with the access token
  // For now, return mock data to demonstrate the flow
  return {
    id: 'google_user_' + Date.now(),
    email: 'user@gmail.com',
    name: 'Demo User',
    picture: 'https://via.placeholder.com/150',
  };
}

// Apple Sign-In (simplified - would need additional setup for production)
export async function signInWithApple(): Promise<OAuthUser | null> {
  try {
    const config = OAUTH_CONFIGS.apple;
    if (!config.clientId) {
      throw new Error('Apple Client ID not configured');
    }

    // For web, use Apple's JS auth (simplified example)
    if (Platform.OS === 'web') {
      // This would require Apple Sign-In JS SDK setup
      console.warn('[OAuth] Apple Sign-In web requires additional setup');
      return null;
    }

    // For native, use expo-apple-authentication or similar
    console.warn('[OAuth] Apple Sign-In native requires expo-apple-authentication');
    return null;
  } catch (error) {
    console.error('[OAuth] Apple sign-in error:', error);
    return null;
  }
}

// Sign out function
export async function signOutOAuth(provider: OAuthProvider): Promise<void> {
  try {
    // Web-based OAuth doesn't require explicit sign-out
    // For native implementations, add sign-out logic here
    console.log(`[OAuth] Signed out from ${provider}`);
  } catch (error) {
    console.error('[OAuth] Sign-out error:', error);
  }
}

// Check if OAuth is configured
export function isOAuthConfigured(provider: OAuthProvider): boolean {
  const config = OAUTH_CONFIGS[provider];
  return !!config.clientId;
}

// For development - show OAuth setup instructions
export function getOAuthSetupInstructions(provider: OAuthProvider): string {
  switch (provider) {
    case 'google':
      return `
To set up Google OAuth:
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID
3. Add your app's redirect URI: ${OAUTH_CONFIGS.google.redirectUri}
4. Set EXPO_PUBLIC_GOOGLE_CLIENT_ID in your .env file
      `.trim();
    case 'apple':
      return `
To set up Apple OAuth:
1. Go to https://developer.apple.com/sign-in-with-apple/
2. Create App ID with Sign In with Apple capability
3. Create Service ID
4. Set EXPO_PUBLIC_APPLE_CLIENT_ID in your .env file
      `.trim();
    default:
      return 'Unknown OAuth provider';
  }
}
