import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../domain/kigali_destinations.dart';
import '../../models/online_driver_model.dart';
import '../../providers/auth_notifier.dart';
import '../../providers/location_notifier.dart';
import '../../providers/online_drivers_notifier.dart';

const _kigali = LatLng(-1.9441, 30.0619);

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  GoogleMapController? _map;
  Timer? _presenceTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(onlineDriversProvider.notifier).startListening();
      ref.read(locationProvider.notifier).startTracking();
      _presenceTimer?.cancel();
      _presenceTimer = Timer.periodic(const Duration(seconds: 22), (_) => _syncDriverPresence());
    });
  }

  @override
  void dispose() {
    _presenceTimer?.cancel();
    super.dispose();
  }

  void _syncDriverPresence() {
    final auth = ref.read(authProvider);
    final loc = ref.read(locationProvider).current;
    if (auth.user?.isDriver != true || loc == null) return;
    ref.read(onlineDriversProvider.notifier).setMyPresence(auth.user!, loc.latitude, loc.longitude);
  }

  Set<Marker> _markersFor(
    LocationState locState,
    AuthState auth,
  ) {
    final loc = locState.current;
    final exclude = auth.user?.isDriver == true ? auth.user!.id : null;
    final nearby = loc != null
        ? ref.read(onlineDriversProvider.notifier).nearbyMarkers(
              loc.latitude,
              loc.longitude,
              excludeUserId: exclude,
            )
        : <OnlineDriverModel>[];

    final markers = <Marker>{};
    if (loc != null) {
      final n = nearby.length;
      markers.add(
        Marker(
          markerId: const MarkerId('me'),
          position: LatLng(loc.latitude, loc.longitude),
          infoWindow: InfoWindow(title: n > 0 ? '$n nearby' : 'You'),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
        ),
      );
    }
    for (final d in nearby) {
      markers.add(
        Marker(
          markerId: MarkerId(d.userId),
          position: LatLng(d.latitude, d.longitude),
          infoWindow: InfoWindow(title: d.username ?? 'Driver'),
          icon: BitmapDescriptor.defaultMarkerWithHue(
            d.transportType == 'car' ? BitmapDescriptor.hueGreen : BitmapDescriptor.hueOrange,
          ),
        ),
      );
    }
    return markers;
  }

  @override
  Widget build(BuildContext context) {
    final locState = ref.watch(locationProvider);
    final auth = ref.watch(authProvider);
    ref.watch(onlineDriversProvider);

    final pos = locState.current;
    final initial = pos != null ? LatLng(pos.latitude, pos.longitude) : _kigali;
    final canMoto = pos != null && isCoordinateInKigaliCity(pos.latitude, pos.longitude);

    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: GoogleMap(
              initialCameraPosition: CameraPosition(target: initial, zoom: 13),
              myLocationEnabled: false,
              markers: _markersFor(locState, auth),
              onMapCreated: (c) {
                _map = c;
                if (pos != null) {
                  c.animateCamera(CameraUpdate.newLatLngZoom(LatLng(pos.latitude, pos.longitude), 13));
                }
              },
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  IconButton.filled(
                    style: IconButton.styleFrom(backgroundColor: Colors.white),
                    onPressed: () => context.push('/profile'),
                    icon: const Icon(Icons.menu),
                  ),
                  if (auth.user?.isPassenger == true) ...[
                    const SizedBox(width: 8),
                    Expanded(
                      child: Material(
                        color: Colors.black,
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          onTap: () => context.push('/rides/post'),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(vertical: 14, horizontal: 12),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    'Meet at pickup · plan trip',
                                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                                  ),
                                ),
                                Text('EDIT', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (auth.user?.isPassenger == true)
            Positioned(
              right: 12,
              top: 100,
              child: _fab(Icons.my_location, () {
                final p = ref.read(locationProvider).current;
                if (p != null) {
                  _map?.animateCamera(
                    CameraUpdate.newLatLngZoom(LatLng(p.latitude, p.longitude), 14),
                  );
                }
              }),
            ),
          if (auth.user != null)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _HomeSheet(
                isPassenger: auth.user!.isPassenger,
                canMoto: canMoto,
              ),
            ),
        ],
      ),
    );
  }

  Widget _fab(IconData icon, VoidCallback onTap) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 2,
      child: IconButton(icon: Icon(icon), onPressed: onTap),
    );
  }
}

class _HomeSheet extends StatelessWidget {
  const _HomeSheet({required this.isPassenger, required this.canMoto});

  final bool isPassenger;
  final bool canMoto;

  @override
  Widget build(BuildContext context) {
    if (!isPassenger) {
      return Card(
        margin: EdgeInsets.zero,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Driver — you appear on the map when location is on.'),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => context.push('/nearby'),
                child: const Text('Nearby requests'),
              ),
            ],
          ),
        ),
      );
    }
    return Card(
      margin: EdgeInsets.zero,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF276EF1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'All drivers are screened',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: canMoto ? () => context.push('/rides/post') : null,
                    child: Column(
                      children: [
                        const Text('Taxi Moto'),
                        Text(
                          canMoto ? 'Kigali only' : 'Not available here',
                          style: TextStyle(fontSize: 11, color: canMoto ? null : Colors.red),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: () => context.push('/rides/post'),
                    child: const Text('Taxi Car'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => context.push('/rides'),
              child: const Text('Search posted rides'),
            ),
          ],
        ),
      ),
    );
  }
}
