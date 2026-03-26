import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/ride_model.dart';
import '../../providers/ride_notifier.dart';
import '../../widgets/ride_tracking_map.dart';

class RideTrackScreen extends ConsumerStatefulWidget {
  const RideTrackScreen({super.key, required this.rideId});

  final String rideId;

  @override
  ConsumerState<RideTrackScreen> createState() => _RideTrackScreenState();
}

class _RideTrackScreenState extends ConsumerState<RideTrackScreen> {
  StreamSubscription? _sub;
  RideModel? _ride;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _sub = ref.read(rideProvider.notifier).subscribeToRide(widget.rideId, (r) {
        if (mounted) setState(() => _ride = r);
      });
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ride = _ride;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: Text(ride == null ? 'Track ride' : '${ride.from} → ${ride.to}'),
      ),
      body: ride == null
          ? const Center(child: CircularProgressIndicator())
          : RideTrackingMap(
              ride: ride,
              driverLocation: ride.driverLocation,
              passengerLocation: ride.passengerLocation,
            ),
    );
  }
}
