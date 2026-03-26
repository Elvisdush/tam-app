import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../providers/auth_notifier.dart';
import '../../providers/location_notifier.dart';
import '../../providers/ride_notifier.dart';

/// Driver: nearby passenger requests — parity with [tam/app/nearby.tsx] (subset).
class NearbyScreen extends ConsumerWidget {
  const NearbyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loc = ref.watch(locationProvider).current;
    final auth = ref.watch(authProvider);
    final rides = ref.watch(rideProvider).rides;

    if (loc == null) {
      return Scaffold(
        appBar: AppBar(
          leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
          title: const Text('Nearby'),
        ),
        body: const Center(child: Text('Turn on location')),
      );
    }

    final nearby = rides.where((r) {
      if (r.status != 'pending') return false;
      if (r.passengerId == null) return false;
      final lat = r.pickupLocation?.latitude;
      final lng = r.pickupLocation?.longitude;
      return lat != null && lng != null;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
        title: const Text('Nearby'),
      ),
      body: nearby.isEmpty
          ? const Center(child: Text('No nearby rides'))
          : ListView.builder(
              itemCount: nearby.length,
              itemBuilder: (context, i) {
                final r = nearby[i];
                final key = r.firebaseKey ?? '${r.id}';
                return ListTile(
                  title: Text('${r.from} → ${r.to}'),
                  subtitle: Text('${r.price} RWF'),
                  trailing: auth.user?.isDriver == true
                      ? FilledButton(
                          onPressed: () {
                            ref.read(rideProvider.notifier).acceptRide(
                                  r.id,
                                  driverId: auth.user!.id,
                                );
                          },
                          child: const Text('Accept'),
                        )
                      : null,
                  onTap: () => context.push('/rides/track/$key'),
                );
              },
            ),
    );
  }
}
