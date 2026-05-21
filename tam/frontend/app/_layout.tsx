import { Stack, usePathname, router } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { useAuthStore } from "@/store/auth-store";
import { useChatStore } from "@/store/chat-store";
import { useRideStore } from "@/store/ride-store";
import { useRoadHazardsStore } from "@/store/road-hazards-store";
import { isAuthRoute, isPublicRoute } from "@/constants/auth-public-routes";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const loadUsers = useAuthStore(state => state.loadUsers);
  const loadMessages = useChatStore(state => state.loadMessages);
  const loadRides = useRideStore(state => state.loadRides);

  useEffect(() => {
    let cancelled = false;
    const unsubHazards = useRoadHazardsStore.getState().subscribeRoadHazards();

    async function prepare() {
      try {
        await Promise.all([
          Promise.race([loadUsers(), new Promise(resolve => setTimeout(resolve, 2000))]),
          Promise.race([loadMessages(), new Promise(resolve => setTimeout(resolve, 2000))]),
          Promise.race([loadRides(), new Promise(resolve => setTimeout(resolve, 2000))])
        ]);
      } catch (error) {
        console.warn('Store loading timeout or error:', error);
      }

      try {
        const g = globalThis as typeof globalThis & { __authStore?: { getState: () => { user: unknown } } };
        g.__authStore = { getState: () => ({ user: useAuthStore.getState().user }) };
      } catch {
        /* dev helpers only — must not break native */
      }
    }

    void prepare();
    return () => {
      cancelled = true;
      unsubHazards();
    };
  }, [loadUsers, loadMessages, loadRides]);

  return (
    <SafeAreaProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <RootLayoutNav />
        </QueryClientProvider>
      </trpc.Provider>
    </SafeAreaProvider>
  );
}

function RootLayoutNav() {
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const [authHydrated, setAuthHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setAuthHydrated(true);
      return;
    }
    return useAuthStore.persist.onFinishHydration(() => {
      setAuthHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!authHydrated) return;

    let cancelled = false;
    async function hideSplash() {
      await new Promise((r) => setTimeout(r, 500));
      if (!cancelled) {
        await SplashScreen.hideAsync().catch(() => {});
      }
    }

    void hideSplash();
    return () => {
      cancelled = true;
    };
  }, [authHydrated]);

  useEffect(() => {
    if (!authHydrated) return;

    const signedIn = isAuthenticated && !!user;

    if (signedIn && isAuthRoute(pathname)) {
      router.replace('/home');
      return;
    }

    if (!signedIn && !isPublicRoute(pathname)) {
      router.replace('/');
    }
  }, [authHydrated, pathname, isAuthenticated, user]);

  if (!authHydrated) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth/sign-in" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="auth/otp-verify" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="auth/register/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="auth/register/driver" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="auth/register/passenger" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="nearby" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="profile/edit" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="driver-contact" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="rides/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="rides/post" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="rides/track" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
