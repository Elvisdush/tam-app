import '../models/online_driver_model.dart';

/// Optional demo markers — parity with [tam/lib/demo-nearby-drivers.ts]
bool includeDemoNearbyDrivers() {
  return const bool.fromEnvironment('DEMO_NEARBY_DRIVERS', defaultValue: true);
}

List<OnlineDriverModel> buildDemoNearbyDrivers(double centerLat, double centerLng) {
  if (!includeDemoNearbyDrivers()) return const [];
  const offsets = <({double lat, double lng, String type})>[
    (lat: 0.0042, lng: 0.0011, type: 'motorbike'),
    (lat: -0.0028, lng: 0.0035, type: 'motorbike'),
    (lat: 0.0015, lng: -0.0041, type: 'motorbike'),
    (lat: 0.0055, lng: -0.002, type: 'car'),
    (lat: -0.0045, lng: -0.0015, type: 'car'),
  ];
  return List.generate(offsets.length, (i) {
    final o = offsets[i];
    return OnlineDriverModel(
      userId: 'demo-$i',
      username: o.type == 'motorbike' ? 'Moto ${i + 1}' : 'Car ${i + 1}',
      latitude: centerLat + o.lat,
      longitude: centerLng + o.lng,
      transportType: o.type,
      updatedAt: DateTime.now().millisecondsSinceEpoch,
      isDemo: true,
      vehiclePlate: o.type == 'motorbike' ? 'RAA ${1000 + i}M' : 'RAA ${2000 + i}C',
      vehicleModel: o.type == 'motorbike' ? 'Honda CB' : 'Toyota Corolla',
    );
  });
}
