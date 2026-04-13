import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { useAuthStore } from "@/store/auth-store";
import { useChatStore } from "@/store/chat-store";
import { useRideStore } from "@/store/ride-store";
import { useRoadHazardsStore } from "@/store/road-hazards-store";

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
      loadUsers();
      loadMessages();
      loadRides();
      try {
        const g = globalThis as typeof globalThis & { __authStore?: { getState: () => { user: unknown } } };
        g.__authStore = { getState: () => ({ user: useAuthStore.getState().user }) };
      } catch {
        /* dev helpers only — must not break native */
      }
      // Keep native splash visible long enough to read logo (see app.json splash.image)
      await new Promise((r) => setTimeout(r, 1000));
      if (!cancelled) {
        await SplashScreen.hideAsync().catch(() => {});
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