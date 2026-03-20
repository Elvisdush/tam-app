import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { useAuthStore } from "@/store/auth-store";
import { useChatStore } from "@/store/chat-store";
import { useRideStore } from "@/store/ride-store";



SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const loadUsers = useAuthStore(state => state.loadUsers);
  const loadMessages = useChatStore(state => state.loadMessages);
  const loadRides = useRideStore(state => state.loadRides);

  useEffect(() => {
    loadUsers();
    loadMessages();
    loadRides();
    (window as any).__authStore = { getState: () => ({ user: useAuthStore.getState().user }) };
    SplashScreen.hideAsync();
  }, [loadUsers, loadMessages, loadRides]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RootLayoutNav />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth/sign-in" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="auth/register/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="auth/register/driver" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="auth/register/passenger" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="nearby" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="profile/edit" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="rides/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="rides/post" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="rides/track" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}