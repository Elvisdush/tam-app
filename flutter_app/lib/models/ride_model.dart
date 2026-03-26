class LiveLocation {
  const LiveLocation({
    required this.latitude,
    required this.longitude,
    required this.timestamp,
    this.address,
  });

  final double latitude;
  final double longitude;
  final String timestamp;
  final String? address;

  factory LiveLocation.fromMap(Map<dynamic, dynamic> m) {
    return LiveLocation(
      latitude: (m['latitude'] as num?)?.toDouble() ?? 0,
      longitude: (m['longitude'] as num?)?.toDouble() ?? 0,
      timestamp: '${m['timestamp'] ?? ''}',
      address: m['address'] as String?,
    );
  }

  Map<String, dynamic> toMap() => {
        'latitude': latitude,
        'longitude': longitude,
        'timestamp': timestamp,
        if (address != null) 'address': address,
      };
}

class RideLocation {
  const RideLocation({
    required this.latitude,
    required this.longitude,
    this.address,
  });

  final double latitude;
  final double longitude;
  final String? address;

  factory RideLocation.fromMap(Map<dynamic, dynamic> m) {
    return RideLocation(
      latitude: (m['latitude'] as num?)?.toDouble() ?? 0,
      longitude: (m['longitude'] as num?)?.toDouble() ?? 0,
      address: m['address'] as String?,
    );
  }

  Map<String, dynamic> toMap() => {
        'latitude': latitude,
        'longitude': longitude,
        if (address != null) 'address': address,
      };
}

class RideModel {
  const RideModel({
    required this.id,
    required this.from,
    required this.to,
    required this.price,
    required this.transportType,
    required this.driverId,
    required this.passengerId,
    required this.status,
    required this.createdAt,
    this.firebaseKey,
    this.scheduledPickupAt,
    this.pickupLocation,
    this.dropoffLocation,
    this.driverLocation,
    this.passengerLocation,
  });

  final Object id;
  final String from;
  final String to;
  final double price;
  final String transportType;
  final String? driverId;
  final String? passengerId;
  final String status;
  final String createdAt;
  final String? firebaseKey;
  final String? scheduledPickupAt;
  final RideLocation? pickupLocation;
  final RideLocation? dropoffLocation;
  final LiveLocation? driverLocation;
  final LiveLocation? passengerLocation;

  factory RideModel.fromEntry(String key, Map<dynamic, dynamic> data) {
    final idParsed = RegExp(r'^-?\d+$').hasMatch(key) ? int.tryParse(key) ?? key : key;
    Map<dynamic, dynamic>? asMap(dynamic v) =>
        v == null ? null : Map<dynamic, dynamic>.from(v as Map);
    return RideModel(
      id: idParsed,
      from: '${data['from'] ?? ''}',
      to: '${data['to'] ?? ''}',
      price: (data['price'] as num?)?.toDouble() ?? 0,
      transportType: '${data['transportType'] ?? 'motorbike'}',
      driverId: data['driverId'] as String?,
      passengerId: data['passengerId'] as String?,
      status: '${data['status'] ?? 'pending'}',
      createdAt: '${data['createdAt'] ?? ''}',
      firebaseKey: key,
      scheduledPickupAt: data['scheduledPickupAt'] as String?,
      pickupLocation: asMap(data['pickupLocation']) != null
          ? RideLocation.fromMap(asMap(data['pickupLocation'])!)
          : null,
      dropoffLocation: asMap(data['dropoffLocation']) != null
          ? RideLocation.fromMap(asMap(data['dropoffLocation'])!)
          : null,
      driverLocation: asMap(data['driverLocation']) != null
          ? LiveLocation.fromMap(asMap(data['driverLocation'])!)
          : null,
      passengerLocation: asMap(data['passengerLocation']) != null
          ? LiveLocation.fromMap(asMap(data['passengerLocation'])!)
          : null,
    );
  }

  Map<String, dynamic> toWriteMap() => {
        'from': from,
        'to': to,
        'price': price,
        'transportType': transportType,
        'driverId': driverId,
        'passengerId': passengerId,
        'status': status,
        'createdAt': createdAt,
        if (scheduledPickupAt != null) 'scheduledPickupAt': scheduledPickupAt,
        if (pickupLocation != null) 'pickupLocation': pickupLocation!.toMap(),
        if (dropoffLocation != null) 'dropoffLocation': dropoffLocation!.toMap(),
      };
}
