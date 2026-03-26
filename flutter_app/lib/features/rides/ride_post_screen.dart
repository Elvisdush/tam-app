import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../domain/kigali_destinations.dart';
import '../../domain/rwanda_pricing.dart';
import '../../providers/auth_notifier.dart';
import '../../providers/destinations_provider.dart';
import '../../providers/location_notifier.dart';
import '../../providers/ride_notifier.dart';

class RidePostScreen extends ConsumerStatefulWidget {
  const RidePostScreen({super.key});

  @override
  ConsumerState<RidePostScreen> createState() => _RidePostScreenState();
}

class _RidePostScreenState extends ConsumerState<RidePostScreen> {
  final _from = TextEditingController();
  final _price = TextEditingController();
  RwandaDestination? _selected;
  String _transport = 'motorbike';
  var _fromManual = false;

  RwandaDestination? _destinationInList(List<RwandaDestination> list) {
    if (_selected == null) return null;
    for (final d in list) {
      if (d.id == _selected!.id) return d;
    }
    return null;
  }

  @override
  void dispose() {
    _from.dispose();
    _price.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final destAsync = ref.watch(rwandaDestinationsProvider);
    final auth = ref.watch(authProvider);
    final loc = ref.watch(locationProvider).current;

    if (!_fromManual && loc != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final line = loc.address ??
            '${loc.latitude.toStringAsFixed(4)}, ${loc.longitude.toStringAsFixed(4)}';
        if (_from.text != line) {
          _from.text = line;
        }
      });
    }

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
        title: const Text('Your trip'),
      ),
      body: destAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (all) {
          final list = destinationsForTransport(all, _transport);
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'motorbike', label: Text('Taxi Moto')),
                  ButtonSegment(value: 'car', label: Text('Taxi Car')),
                ],
                selected: {_transport},
                onSelectionChanged: (s) {
                  setState(() {
                    _transport = s.first;
                    if (_transport == 'motorbike' &&
                        _selected != null &&
                        !isKigaliDestination(_selected!.id)) {
                      _selected = null;
                    }
                  });
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _from,
                decoration: const InputDecoration(labelText: 'From'),
                onChanged: (_) => setState(() => _fromManual = true),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<RwandaDestination>(
                value: _destinationInList(list),
                decoration: const InputDecoration(labelText: 'Destination'),
                items: list
                    .map((d) => DropdownMenuItem(value: d, child: Text(d.name)))
                    .toList(),
                onChanged: (v) {
                  setState(() => _selected = v);
                  final min = minPriceRwfForDestination(_transport, v?.id);
                  if (min != null) _price.text = '$min';
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _price,
                decoration: const InputDecoration(labelText: 'Offer (RWF)'),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: auth.user == null
                    ? null
                    : () async {
                        if (_transport == 'motorbike' && loc != null) {
                          if (!isCoordinateInKigaliCity(loc.latitude, loc.longitude)) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Taxi moto only in Kigali')),
                            );
                            return;
                          }
                        }
                        final dest = _selected;
                        if (dest == null) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Choose destination')),
                          );
                          return;
                        }
                        final min = minPriceRwfForDestination(_transport, dest.id);
                        final p = double.tryParse(_price.text.replaceAll(' ', '')) ?? 0;
                        if (min != null && p < min) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Minimum is $min RWF')),
                          );
                          return;
                        }
                        final uid = auth.user!.id;
                        final isDriver = auth.user!.isDriver;
                        final ride = {
                          'from': _from.text.trim(),
                          'to': dest.name,
                          'price': p,
                          'transportType': _transport,
                          'driverId': isDriver ? uid : null,
                          'passengerId': isDriver ? null : uid,
                          'status': 'pending',
                          'createdAt': DateTime.now().toIso8601String(),
                          if (loc != null)
                            'pickupLocation': {
                              'latitude': loc.latitude,
                              'longitude': loc.longitude,
                              'address': _from.text.trim(),
                            },
                        };
                        final key = await ref.read(rideProvider.notifier).addRide(ride);
                        if (context.mounted && key != null) {
                          context.go('/rides/track/$key');
                        }
                      },
                child: const Text('Post ride'),
              ),
            ],
          );
        },
      ),
    );
  }
}
