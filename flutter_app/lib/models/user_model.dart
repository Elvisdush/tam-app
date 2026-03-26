class UserModel {
  const UserModel({
    required this.id,
    required this.username,
    required this.email,
    required this.phone,
    required this.password,
    required this.profileImage,
    required this.type,
    this.vehicleImage,
    this.vehicleType,
    this.vehiclePlate,
    this.vehicleModel,
  });

  final String id;
  final String username;
  final String email;
  final String phone;
  final String password;
  final String profileImage;
  final String type; // driver | passenger
  final String? vehicleImage;
  final String? vehicleType; // car | motorbike
  final String? vehiclePlate;
  final String? vehicleModel;

  bool get isDriver => type == 'driver';
  bool get isPassenger => type == 'passenger';

  factory UserModel.fromMap(String id, Map<dynamic, dynamic> m) {
    return UserModel(
      id: id,
      username: '${m['username'] ?? ''}',
      email: '${m['email'] ?? ''}',
      phone: '${m['phone'] ?? ''}',
      password: '${m['password'] ?? ''}',
      profileImage: '${m['profileImage'] ?? ''}',
      type: '${m['type'] ?? 'passenger'}',
      vehicleImage: m['vehicleImage'] as String?,
      vehicleType: m['vehicleType'] as String?,
      vehiclePlate: m['vehiclePlate'] as String?,
      vehicleModel: m['vehicleModel'] as String?,
    );
  }

  Map<String, dynamic> toMap() => {
        'username': username,
        'email': email,
        'phone': phone,
        'password': password,
        'profileImage': profileImage,
        'type': type,
        if (vehicleImage != null) 'vehicleImage': vehicleImage,
        if (vehicleType != null) 'vehicleType': vehicleType,
        if (vehiclePlate != null) 'vehiclePlate': vehiclePlate,
        if (vehicleModel != null) 'vehicleModel': vehicleModel,
      };

  UserModel copyWith({
    String? username,
    String? email,
    String? phone,
    String? password,
    String? profileImage,
    String? type,
    String? vehicleImage,
    String? vehicleType,
    String? vehiclePlate,
    String? vehicleModel,
  }) {
    return UserModel(
      id: id,
      username: username ?? this.username,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      password: password ?? this.password,
      profileImage: profileImage ?? this.profileImage,
      type: type ?? this.type,
      vehicleImage: vehicleImage ?? this.vehicleImage,
      vehicleType: vehicleType ?? this.vehicleType,
      vehiclePlate: vehiclePlate ?? this.vehiclePlate,
      vehicleModel: vehicleModel ?? this.vehicleModel,
    );
  }
}
