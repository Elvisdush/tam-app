import 'kigali_destinations.dart';

/// Parity with [tam/lib/rwanda-passenger-pricing.ts]
const minPriceCarKigaliRwf = 6000;
const minPriceCarOutsideKigaliRwf = 20000;
const minPriceMotoKigaliRwf = 700;

class RwandaDestination {
  const RwandaDestination({
    required this.id,
    required this.name,
    required this.subtitle,
    required this.latitude,
    required this.longitude,
    required this.search,
  });

  final String id;
  final String name;
  final String subtitle;
  final double latitude;
  final double longitude;
  final String search;
}

List<RwandaDestination> destinationsForTransport(
  List<RwandaDestination> all,
  String transportType,
) {
  if (transportType == 'motorbike') {
    return all.where((d) => isKigaliDestination(d.id)).toList();
  }
  return List<RwandaDestination>.from(all);
}

int? minPriceRwfForDestination(String transportType, String? destinationId) {
  if (destinationId == null || destinationId.isEmpty) return null;
  if (transportType == 'motorbike') {
    if (!isKigaliDestination(destinationId)) return null;
    return minPriceMotoKigaliRwf;
  }
  return isKigaliDestination(destinationId)
      ? minPriceCarKigaliRwf
      : minPriceCarOutsideKigaliRwf;
}

List<RwandaDestination> filterDestinationsByQuery(
  List<RwandaDestination> list,
  String query,
) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return list;
  return list.where((d) {
    final hay = '${d.name} ${d.subtitle} ${d.search}'.toLowerCase();
    return hay.contains(q);
  }).toList();
}
