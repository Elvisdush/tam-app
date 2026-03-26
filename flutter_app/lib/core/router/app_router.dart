import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/forgot_password_screen.dart';
import '../../features/auth/register_driver_screen.dart';
import '../../features/auth/register_passenger_screen.dart';
import '../../features/auth/register_shell_screen.dart';
import '../../features/auth/sign_in_screen.dart';
import '../../features/chat/chat_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/landing/landing_screen.dart';
import '../../features/map/map_screen.dart';
import '../../features/messages/messages_screen.dart';
import '../../features/nearby/nearby_screen.dart';
import '../../features/profile/profile_edit_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/rides/ride_post_screen.dart';
import '../../features/rides/ride_track_screen.dart';
import '../../features/rides/rides_list_screen.dart';
import '../../features/shell/main_shell.dart';
import '../../providers/auth_notifier.dart';

final _rootKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authProvider);
  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/',
    redirect: (context, state) {
      final path = state.uri.path;
      final loggedIn = auth.isAuthenticated;
      final public = path == '/' ||
          path == '/sign-in' ||
          path.startsWith('/register') ||
          path == '/forgot-password';
      if (!loggedIn && !public) {
        return '/sign-in';
      }
      if (loggedIn && (path == '/' || path == '/sign-in')) {
        return '/home';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const LandingScreen()),
      GoRoute(path: '/sign-in', builder: (_, __) => const SignInScreen()),
      GoRoute(
        path: '/register',
        builder: (_, __) => const RegisterShellScreen(),
        routes: [
          GoRoute(path: 'passenger', builder: (_, __) => const RegisterPassengerScreen()),
          GoRoute(path: 'driver', builder: (_, __) => const RegisterDriverScreen()),
        ],
      ),
      GoRoute(path: '/forgot-password', builder: (_, __) => const ForgotPasswordScreen()),
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
          GoRoute(path: '/map', builder: (_, __) => const MapScreen()),
          GoRoute(path: '/messages', builder: (_, __) => const MessagesScreen()),
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
        ],
      ),
      GoRoute(path: '/rides', builder: (_, __) => const RidesListScreen()),
      GoRoute(path: '/rides/post', builder: (_, __) => const RidePostScreen()),
      GoRoute(
        path: '/rides/track/:rideId',
        builder: (context, state) {
          final id = state.pathParameters['rideId'] ?? '';
          return RideTrackScreen(rideId: id);
        },
      ),
      GoRoute(path: '/nearby', builder: (_, __) => const NearbyScreen()),
      GoRoute(
        path: '/chat/:id',
        builder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return ChatScreen(peerUserId: id);
        },
      ),
      GoRoute(path: '/profile/edit', builder: (_, __) => const ProfileEditScreen()),
    ],
  );
});
