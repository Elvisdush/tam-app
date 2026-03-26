import 'dart:async';
import 'dart:math' as math;

import 'package:firebase_database/firebase_database.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/ride_model.dart';
import '../models/user_model.dart';
import 'auth_notifier.dart';

class LastSearchParams {
  const LastSearchParams({
    required this.from,
    required this.to,
    this.price,
    required this.transportType,
  });

  final String from;
  final String to;
  final double? price;
  final String transportType;
}

class RideState {
  const RideState({
    this.rides = const [],
    this.searchResults = const [],
    this.lastSearchParams,
  });

  final List<RideModel> rides;
  final List<RideModel> searchResults;
  final LastSearchParams? lastSearchParams;

  RideState copyWith({
    List<RideModel>? rides,
    List<RideModel>? searchResults,
    LastSearchParams? lastSearchParams,
  }) {
    return RideState(
      rides: rides ?? this.rides,
      searchResults: searchResults ?? this.searchResults,
      lastSearchParams: lastSearchParams ?? this.lastSearchParams,
    );
  }
}

final rideProvider = NotifierProvider<RideNotifier, RideState>(RideNotifier.new);

class RideNotifier extends Notifier<RideState> {
  StreamSubscription<DatabaseEvent>? _sub;

  DatabaseReference get _ridesRef => FirebaseDatabase.instance.ref('rides');

  @override
  RideState build() {
    ref.onDispose(() => _sub?.cancel());
    _sub = _ridesRef.onValue.listen((event) {
      final val = event.snapshot.value;
      var ridesList = <RideModel>[];
      if (val != null) {
        final map = Map<dynamic, dynamic>.from(val as Map);
        ridesList = map.entries
            .map((e) => RideModel.fromEntry(e.key.toString(), Map<dynamic, dynamic>.from(e.value as Map)))
            .toList();
      }
      final last = state.lastSearchParams;
      if (last != null) {
        final results = _computeSearchResults(ridesList, last);
        state = RideState(rides: ridesList, searchResults: results, lastSearchParams: last);
      } else {
        state = RideState(rides: ridesList, searchResults: state.searchResults, lastSearchParams: last);
      }
    });
    return const RideState();
  }

  UserModel? get _currentUser => ref.read(authProvider).user;

  List<RideModel> _computeSearchResults(List<RideModel> rides, LastSearchParams params) {
    final from = params.from;
    final to = params.to;
    final price = params.price;
    final transportType = params.transportType;
    final currentUser = _currentUser;

    var results = rides.where((ride) {
      if (ride.from.isEmpty || ride.to.isEmpty) return false;
      final matchesLocation =
          ride.from.toLowerCase().contains(from.toLowerCase()) && ride.to.toLowerCase().contains(to.toLowerCase());
      final matchesTransport = ride.transportType == transportType;

      final now = DateTime.now().millisecondsSinceEpoch;
      final createdAt = DateTime.tryParse(ride.createdAt)?.millisecondsSinceEpoch ?? 0;
      const thirtyMinutes = 30 * 60 * 1000;
      var isExpired = now - createdAt > thirtyMinutes;
      if (ride.status == 'scheduled' && ride.scheduledPickupAt != null) {
        final pickup = DateTime.tryParse(ride.scheduledPickupAt!)?.millisecondsSinceEpoch ?? 0;
        isExpired = pickup < now - thirtyMinutes;
      }
      if (isExpired) return false;

      if (currentUser?.isDriver == true) {
        return matchesLocation && matchesTransport && ride.passengerId != null;
      }
      if (currentUser?.isPassenger == true) {
        return matchesLocation && matchesTransport && ride.driverId != null;
      }
      return matchesLocation && matchesTransport;
    }).toList();

    if (price != null) {
      results = [...results]..sort((a, b) => (a.price - price).abs().compareTo((b.price - price).abs()));
    }
    return results;
  }

  bool _paramsEqual(LastSearchParams? a, LastSearchParams b) {
    if (a == null) return false;
    return a.from == b.from && a.to == b.to && a.price == b.price && a.transportType == b.transportType;
  }

  void searchRides(String from, String to, double? price, {String transportType = 'motorbike'}) {
    final params = LastSearchParams(from: from, to: to, price: price, transportType: transportType);
    final results = _computeSearchResults(state.rides, params);
    final prev = state.lastSearchParams;
    if (_paramsEqual(prev, params)) {
      state = state.copyWith(searchResults: results);
    } else {
      state = RideState(rides: state.rides, searchResults: results, lastSearchParams: params);
    }
  }

  Future<String?> addRide(Map<String, dynamic> rideMap) async {
    try {
      final newRef = _ridesRef.push();
      await newRef.set(rideMap);
      return newRef.key;
    } catch (e) {
      return null;
    }
  }

  Future<void> acceptRide(Object rideId, {String? driverId}) async {
    final key = rideId is String ? rideId : '$rideId';
    final map = <String, dynamic>{'status': 'accepted'};
    if (driverId != null) map['driverId'] = driverId;
    await _ridesRef.child(key).update(map);
  }

  Future<void> updateDriverLocation(Object rideId, LiveLocation location) async {
    final key = rideId is String ? rideId : '$rideId';
    await _ridesRef.child(key).update({'driverLocation': location.toMap()});
  }

  Future<void> updatePassengerLocation(Object rideId, LiveLocation location) async {
    final key = rideId is String ? rideId : '$rideId';
    await _ridesRef.child(key).update({'passengerLocation': location.toMap()});
  }

  StreamSubscription<DatabaseEvent> subscribeToRide(Object rideId, void Function(RideModel) onData) {
    final key = rideId is String ? rideId : '$rideId';
    return _ridesRef.child(key).onValue.listen((event) {
      final val = event.snapshot.value;
      if (val == null) return;
      final data = Map<dynamic, dynamic>.from(val as Map);
      onData(RideModel.fromEntry(key, data));
    });
  }

  ({List<RideModel> moto, List<RideModel> car}) nearbyAvailableDrivers(
    double userLat,
    double userLng, {
    double radiusKm = 15,
  }) {
    final now = DateTime.now().millisecondsSinceEpoch;
    const thirtyMinutes = 30 * 60 * 1000;
    double distance(double lat1, double lon1, double lat2, double lon2) {
      const r = 6371.0;
      final dLat = (lat2 - lat1) * math.pi / 180;
      final dLon = (lon2 - lon1) * math.pi / 180;
      final a = math.pow(math.sin(dLat / 2), 2) +
          math.cos(lat1 * math.pi / 180) *
              math.cos(lat2 * math.pi / 180) *
              math.pow(math.sin(dLon / 2), 2);
      return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    }

    final available = state.rides.where((ride) {
      if (ride.driverId == null || ride.passengerId != null) return false;
      final createdAt = DateTime.tryParse(ride.createdAt)?.millisecondsSinceEpoch ?? 0;
      if (now - createdAt > thirtyMinutes) return false;
      final lat = ride.pickupLocation?.latitude ?? ride.driverLocation?.latitude;
      final lng = ride.pickupLocation?.longitude ?? ride.driverLocation?.longitude;
      if (lat == null || lng == null) return false;
      return distance(userLat, userLng, lat, lng) <= radiusKm;
    }).toList();

    final withDist = available.map((ride) {
      final lat = ride.pickupLocation?.latitude ?? ride.driverLocation?.latitude ?? 0.0;
      final lng = ride.pickupLocation?.longitude ?? ride.driverLocation?.longitude ?? 0.0;
      return (ride: ride, dist: distance(userLat, userLng, lat, lng));
    }).toList()
      ..sort((a, b) => a.dist.compareTo(b.dist));

    final moto = withDist.where((x) => x.ride.transportType == 'motorbike').map((x) => x.ride).toList();
    final car = withDist.where((x) => x.ride.transportType == 'car').map((x) => x.ride).toList();
    return (moto: moto, car: car);
  }
}
