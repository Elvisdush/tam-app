import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../providers/location_notifier.dart';
import '../../services/osrm_service.dart';
import '../../services/polyline_codec.dart';
import '../../widgets/next_maneuver_bar.dart';

const _kigali = LatLng(-1.9441, 30.0619);

/// Navigation-style map with OSRM route and polyline — parity with [tam/app/(tabs)/map.tsx] (subset).
class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  GoogleMapController? _controller;
  LatLng? _dest;
  final _search = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _routeTo(LatLng dest) async {
    final cur = ref.read(locationProvider).current;
    if (cur == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Waiting for location…')),
      );
      return;
    }
    setState(() {
      _loading = true;
      _dest = dest;
    });
    final r = await fetchOsrmDrivingRoute(cur.latitude, cur.longitude, dest.latitude, dest.longitude);
    if (!mounted) return;
    setState(() => _loading = false);
    if (r == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not compute route')),
      );
      return;
    }
    final pts = decodePolyline(r.encodedPolyline);
    ref.read(locationProvider.notifier).setRoute(
          RouteData(
            distance: r.distanceLabel,
            duration: r.durationText,
            polyline: r.encodedPolyline,
            steps: r.steps,
          ),
        );
    _controller?.animateCamera(
      CameraUpdate.newLatLngBounds(
        _bounds(pts),
        48,
      ),
    );
  }

  LatLngBounds _bounds(List<LatLng> pts) {
    double minLat = pts.first.latitude;
    double maxLat = pts.first.latitude;
    double minLng = pts.first.longitude;
    double maxLng = pts.first.longitude;
    for (final p in pts) {
      minLat = minLat < p.latitude ? minLat : p.latitude;
      maxLat = maxLat > p.latitude ? maxLat : p.latitude;
      minLng = minLng < p.longitude ? minLng : p.longitude;
      maxLng = maxLng > p.longitude ? maxLng : p.longitude;
    }
    return LatLngBounds(southwest: LatLng(minLat, minLng), northeast: LatLng(maxLat, maxLng));
  }

  @override
  Widget build(BuildContext context) {
    final loc = ref.watch(locationProvider);
    final route = loc.currentRoute;
    final pos = loc.current;

    final polylines = <Polyline>{};
    if (route != null) {
      final pts = decodePolyline(route.polyline);
      polylines.add(
        Polyline(
          polylineId: const PolylineId('route'),
          points: pts,
          color: Colors.black87,
          width: 5,
        ),
      );
    }

    final initial = pos != null ? LatLng(pos.latitude, pos.longitude) : _kigali;
    final step = route?.steps.isNotEmpty == true ? route!.steps.first : null;

    return Scaffold(
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: CameraPosition(target: initial, zoom: 12),
            polylines: polylines,
            myLocationEnabled: false,
            markers: {
              if (pos != null)
                Marker(
                  markerId: const MarkerId('cur'),
                  position: LatLng(pos.latitude, pos.longitude),
                ),
              if (_dest != null)
                Marker(
                  markerId: const MarkerId('dest'),
                  position: _dest!,
                  icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
                ),
            },
            onMapCreated: (c) => _controller = c,
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Material(
                    elevation: 2,
                    borderRadius: BorderRadius.circular(12),
                    child: TextField(
                      controller: _search,
                      decoration: InputDecoration(
                        hintText: 'Try: Musanze, Huye…',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        suffixIcon: _loading
                            ? const Padding(
                                padding: EdgeInsets.all(12),
                                child: SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                ),
                              )
                            : IconButton(
                                icon: const Icon(Icons.search),
                                onPressed: () {
                                  // Demo: route to a fixed point near Kigali when searching "test"
                                  if (_search.text.trim().isEmpty) return;
                                  _routeTo(const LatLng(-1.95, 30.08));
                                },
                              ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (step != null)
            Positioned(
              left: 12,
              right: 12,
              bottom: 24,
              child: NextManeuverBar(
                instruction: step.instruction,
                distanceLabel: step.distance,
                durationLabel: step.duration,
                onClose: () => ref.read(locationProvider.notifier).clearRoute(),
              ),
            ),
        ],
      ),
    );
  }
}
