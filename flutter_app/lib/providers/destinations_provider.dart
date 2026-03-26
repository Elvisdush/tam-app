import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/rwanda_destinations_loader.dart';
import '../domain/rwanda_pricing.dart';

final rwandaDestinationsProvider = FutureProvider<List<RwandaDestination>>((ref) async {
  return loadRwandaDestinations();
});
