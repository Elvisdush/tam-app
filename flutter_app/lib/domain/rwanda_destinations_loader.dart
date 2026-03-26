import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

import 'rwanda_pricing.dart';

/// Loads [assets/data/rwanda_destinations.json] (generated from tam TS).
Future<List<RwandaDestination>> loadRwandaDestinations() async {
  final raw = await rootBundle.loadString('assets/data/rwanda_destinations.json');
  final list = jsonDecode(raw) as List<dynamic>;
  return list
      .map((e) => e as Map<String, dynamic>)
      .map(
        (m) => RwandaDestination(
          id: '${m['id']}',
          name: '${m['name']}',
          subtitle: '${m['subtitle']}',
          latitude: (m['latitude'] as num).toDouble(),
          longitude: (m['longitude'] as num).toDouble(),
          search: '${m['search']}',
        ),
      )
      .toList();
}
