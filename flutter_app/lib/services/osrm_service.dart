import 'package:dio/dio.dart';

/// Parity with [tam/lib/osrm-route.ts]
class OsrmRouteResult {
  OsrmRouteResult({
    required this.distanceLabel,
    required this.durationText,
    required this.encodedPolyline,
    required this.steps,
  });

  final String distanceLabel;
  final String durationText;
  final String encodedPolyline;
  final List<({String instruction, String distance, String duration})> steps;
}

final _dio = Dio();

Future<OsrmRouteResult?> fetchOsrmDrivingRoute(
  double originLat,
  double originLng,
  double destLat,
  double destLng,
) async {
  try {
    final url =
        'https://router.project-osrm.org/route/v1/driving/$originLng,$originLat;$destLng,$destLat'
        '?overview=full&geometries=polyline&steps=true';
    final res = await _dio.get<Map<String, dynamic>>(url);
    final data = res.data;
    if (data == null || data['code'] != 'Ok') return null;
    final routes = data['routes'] as List<dynamic>?;
    if (routes == null || routes.isEmpty) return null;
    final r = routes[0] as Map<String, dynamic>;
    final geometry = r['geometry'] as String?;
    if (geometry == null) return null;
    final distanceM = (r['distance'] as num?)?.toDouble() ?? 0;
    final durationS = (r['duration'] as num?)?.toDouble() ?? 0;
    final distanceKm = (distanceM / 1000).toStringAsFixed(1);
    final durationMinutes = (durationS / 60).ceil();
    final durationText = durationMinutes >= 60
        ? '${durationMinutes ~/ 60} hr ${durationMinutes % 60} min'
        : '$durationMinutes min';

    final legs = (r['legs'] as List<dynamic>?) ?? const [];
    final leg0 = legs.isNotEmpty ? legs[0] as Map<String, dynamic> : null;
    final legSteps = (leg0?['steps'] as List<dynamic>?) ?? const [];
    final steps = <({String instruction, String distance, String duration})>[];
    for (var i = 0; i < legSteps.length; i++) {
      final s = legSteps[i] as Map<String, dynamic>;
      final name = s['name'] as String? ?? '';
      final maneuver = s['maneuver'] as Map<String, dynamic>?;
      final instr = name.isNotEmpty
          ? name
          : (maneuver?['type'] as String? ?? 'Step ${i + 1}');
      final distKm = ((s['distance'] as num?)?.toDouble() ?? 0) / 1000;
      final durMin = ((s['duration'] as num?)?.toDouble() ?? 0) / 60;
      steps.add((
        instruction: instr,
        distance: '${distKm.toStringAsFixed(1)} km',
        duration: '${durMin.ceil()} min',
      ));
    }
    if (steps.isEmpty) {
      steps.add((
        instruction: 'Follow the route',
        distance: '$distanceKm km',
        duration: durationText,
      ));
    }

    return OsrmRouteResult(
      distanceLabel: '$distanceKm km',
      durationText: durationText,
      encodedPolyline: geometry,
      steps: steps,
    );
  } catch (_) {
    return null;
  }
}
