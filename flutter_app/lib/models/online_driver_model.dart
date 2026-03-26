class OnlineDriverModel {
  const OnlineDriverModel({
    required this.userId,
    required this.latitude,
    required this.longitude,
    required this.transportType,
    required this.updatedAt,
    this.username,
    this.isDemo,
    this.vehiclePlate,
    this.vehicleModel,
  });

  final String userId;
  final double latitude;
  final double longitude;
  final String transportType;
  final int updatedAt;
  final String? username;
  final bool? isDemo;
  final String? vehiclePlate;
  final String? vehicleModel;

  factory OnlineDriverModel.fromEntry(String key, Map<dynamic, dynamic> row) {
    return OnlineDriverModel(
      userId: key,
      latitude: (row['latitude'] as num?)?.toDouble() ?? 0,
      longitude: (row['longitude'] as num?)?.toDouble() ?? 0,
      transportType: row['transportType'] == 'car' ? 'car' : 'motorbike',
      updatedAt: (row['updatedAt'] as num?)?.toInt() ?? DateTime.now().millisecondsSinceEpoch,
      username: row['username'] as String?,
      isDemo: row['isDemo'] as bool?,
      vehiclePlate: row['vehiclePlate'] as String?,
      vehicleModel: row['vehicleModel'] as String?,
    );
  }
}
