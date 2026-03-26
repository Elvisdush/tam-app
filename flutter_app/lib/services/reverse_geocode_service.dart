import 'package:dio/dio.dart';

/// BigDataCloud client API — parity with RN web / Android path in [tam/store/location-store.ts]
final _dio = Dio();

Future<String?> reverseGeocodeLine(double latitude, double longitude) async {
  try {
    final url =
        'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=$latitude&longitude=$longitude&localityLanguage=en';
    final res = await _dio.get<Map<String, dynamic>>(url);
    final data = res.data;
    if (data == null) return null;
    final locality = '${data['locality'] ?? data['city'] ?? ''}'.trim();
    final subdivision = '${data['principalSubdivision'] ?? ''}'.trim();
    final line = '$locality $subdivision'.trim();
    if (line.isEmpty) {
      return '${latitude.toStringAsFixed(4)}, ${longitude.toStringAsFixed(4)}';
    }
    return line;
  } catch (_) {
    return '${latitude.toStringAsFixed(4)}, ${longitude.toStringAsFixed(4)}';
  }
}
