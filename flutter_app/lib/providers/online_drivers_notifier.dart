import 'dart:async';
import 'dart:math' as math;

import 'package:firebase_database/firebase_database.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/demo_nearby_drivers.dart';
import '../models/online_driver_model.dart';
import '../models/user_model.dart';

const _presenceMaxAgeMs = 5 * 60 * 1000;
const _defaultRadiusKm = 12.0;

final onlineDriversProvider =
    NotifierProvider<OnlineDriversNotifier, List<OnlineDriverModel>>(OnlineDriversNotifier.new);

class OnlineDriversNotifier extends Notifier<List<OnlineDriverModel>> {
  StreamSubscription<DatabaseEvent>? _sub;

  DatabaseReference get _ref => FirebaseDatabase.instance.ref('onlineDrivers');

  @override
  List<OnlineDriverModel> build() {
    ref.onDispose(() => _sub?.cancel());
    return const [];
  }

  void startListening() {
    _sub?.cancel();
    _sub = _ref.onValue.listen((event) {
      final val = event.snapshot.value;
      if (val == null) {
        state = const [];
        return;
      }
      final map = Map<dynamic, dynamic>.from(val as Map);
      final list = map.entries
          .map((e) => OnlineDriverModel.fromEntry(e.key.toString(), Map<dynamic, dynamic>.from(e.value as Map)))
          .toList();
      state = list;
    });
  }

  Future<void> setMyPresence(UserModel user, double latitude, double longitude) async {
    if (!user.isDriver) return;
    final transport = user.vehicleType ?? 'motorbike';
    final data = <String, dynamic>{
      'latitude': latitude,
      'longitude': longitude,
      'transportType': transport,
      'username': user.username,
      'updatedAt': DateTime.now().millisecondsSinceEpoch,
    };
    if (user.vehiclePlate != null && user.vehiclePlate!.trim().isNotEmpty) {
      data['vehiclePlate'] = user.vehiclePlate!.trim();
    }
    if (user.vehicleModel != null && user.vehicleModel!.trim().isNotEmpty) {
      data['vehicleModel'] = user.vehicleModel!.trim();
    }
    await _ref.child(user.id).set(data);
  }

  Future<void> clearMyPresence(String userId) async {
    try {
      await _ref.child(userId).remove();
    } catch (_) {}
  }

  static double _haversineKm(double lat1, double lon1, double lat2, double lon2) {
    const r = 6371.0;
    final dLat = (lat2 - lat1) * math.pi / 180;
    final dLon = (lon2 - lon1) * math.pi / 180;
    final a = math.pow(math.sin(dLat / 2), 2) +
        math.cos(lat1 * math.pi / 180) *
            math.cos(lat2 * math.pi / 180) *
            math.pow(math.sin(dLon / 2), 2);
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }

  static bool _validLatLng(double lat, double lng) {
    return lat.isFinite && lng.isFinite && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  List<OnlineDriverModel> nearbyMarkers(
    double viewerLat,
    double viewerLng, {
    double radiusKm = _defaultRadiusKm,
    String? excludeUserId,
  }) {
    final now = DateTime.now().millisecondsSinceEpoch;
    final real = state.where((d) {
      if (excludeUserId != null && d.userId == excludeUserId) return false;
      if (now - d.updatedAt > _presenceMaxAgeMs) return false;
      if (!_validLatLng(d.latitude, d.longitude)) return false;
      return _haversineKm(viewerLat, viewerLng, d.latitude, d.longitude) <= radiusKm;
    }).toList();

    final demo = includeDemoNearbyDrivers(viewerLat, viewerLng);
    return [...real, ...demo];
  }

  ({int moto, int car}) nearbyCounts(
    double viewerLat,
    double viewerLng, {
    double radiusKm = _defaultRadiusKm,
    String? excludeUserId,
  }) {
    final m = nearbyMarkers(viewerLat, viewerLng, radiusKm: radiusKm, excludeUserId: excludeUserId);
    var moto = 0;
    var car = 0;
    for (final d in m) {
      if (d.transportType == 'car') {
        car++;
      } else {
        moto++;
      }
    }
    return (moto: moto, car: car);
  }
}
