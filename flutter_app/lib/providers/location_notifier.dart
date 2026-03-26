import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

import '../services/reverse_geocode_service.dart';

class LocationData {
  const LocationData({
    required this.latitude,
    required this.longitude,
    required this.timestamp,
    this.address,
  });

  final double latitude;
  final double longitude;
  final String timestamp;
  final String? address;

  LocationData copyWith({String? address}) => LocationData(
        latitude: latitude,
        longitude: longitude,
        timestamp: timestamp,
        address: address ?? this.address,
      );
}

class RouteData {
  RouteData({
    required this.distance,
    required this.duration,
    required this.polyline,
    required this.steps,
  });

  final String distance;
  final String duration;
  final String polyline;
  final List<({String instruction, String distance, String duration})> steps;
}

final locationProvider = NotifierProvider<LocationNotifier, LocationState>(LocationNotifier.new);

class LocationState {
  const LocationState({
    this.current,
    this.isTracking = false,
    this.permissionGranted = false,
    this.currentRoute,
    this.isCalculatingRoute = false,
  });

  final LocationData? current;
  final bool isTracking;
  final bool permissionGranted;
  final RouteData? currentRoute;
  final bool isCalculatingRoute;

  LocationState copyWith({
    LocationData? current,
    bool? isTracking,
    bool? permissionGranted,
    RouteData? currentRoute,
    bool clearCurrentRoute = false,
    bool? isCalculatingRoute,
  }) {
    return LocationState(
      current: current ?? this.current,
      isTracking: isTracking ?? this.isTracking,
      permissionGranted: permissionGranted ?? this.permissionGranted,
      currentRoute: clearCurrentRoute ? null : (currentRoute ?? this.currentRoute),
      isCalculatingRoute: isCalculatingRoute ?? this.isCalculatingRoute,
    );
  }
}

class LocationNotifier extends Notifier<LocationState> {
  StreamSubscription<Position>? _posSub;

  @override
  LocationState build() {
    ref.onDispose(() {
      _posSub?.cancel();
    });
    return const LocationState();
  }

  Future<bool> requestPermission() async {
    final s = await Permission.location.request();
    final ok = s.isGranted;
    state = state.copyWith(permissionGranted: ok);
    return ok;
  }

  Future<void> startTracking() async {
    final granted = await requestPermission();
    if (!granted) return;

    state = state.copyWith(isTracking: true);

    _posSub?.cancel();
    _posSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 10),
    ).listen((pos) async {
      var addr = await reverseGeocodeLine(pos.latitude, pos.longitude);
      addr ??= '${pos.latitude.toStringAsFixed(4)}, ${pos.longitude.toStringAsFixed(4)}';
      state = state.copyWith(
        current: LocationData(
          latitude: pos.latitude,
          longitude: pos.longitude,
          timestamp: DateTime.now().toIso8601String(),
          address: addr,
        ),
      );
    });
  }

  void stopTracking() {
    _posSub?.cancel();
    _posSub = null;
    state = state.copyWith(isTracking: false);
  }

  void clearRoute() {
    state = state.copyWith(clearCurrentRoute: true);
  }

  Future<void> setRoute(RouteData route) async {
    state = state.copyWith(currentRoute: route, isCalculatingRoute: false);
  }

  void setCalculating(bool v) {
    state = state.copyWith(isCalculatingRoute: v);
  }
}
