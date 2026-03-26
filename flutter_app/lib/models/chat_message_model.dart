class ChatMessageModel {
  const ChatMessageModel({
    required this.id,
    required this.senderId,
    required this.receiverId,
    required this.content,
    required this.timestamp,
    required this.type,
    this.duration,
    this.read,
    this.latitude,
    this.longitude,
    this.address,
  });

  final String id;
  final String senderId;
  final String receiverId;
  final String content;
  final String timestamp;
  final String type;
  final int? duration;
  final bool? read;
  final double? latitude;
  final double? longitude;
  final String? address;

  factory ChatMessageModel.fromEntry(String key, Map<dynamic, dynamic> m) {
    final loc = m['location'] as Map<dynamic, dynamic>?;
    return ChatMessageModel(
      id: key,
      senderId: '${m['senderId'] ?? ''}',
      receiverId: '${m['receiverId'] ?? ''}',
      content: '${m['content'] ?? ''}',
      timestamp: '${m['timestamp'] ?? ''}',
      type: '${m['type'] ?? 'text'}',
      duration: (m['duration'] as num?)?.toInt(),
      read: m['read'] as bool?,
      latitude: loc != null ? (loc['latitude'] as num?)?.toDouble() : null,
      longitude: loc != null ? (loc['longitude'] as num?)?.toDouble() : null,
      address: loc != null ? loc['address'] as String? : null,
    );
  }

  Map<String, dynamic> toWriteMap() => {
        'senderId': senderId,
        'receiverId': receiverId,
        'content': content,
        'timestamp': timestamp,
        'type': type,
        if (duration != null) 'duration': duration,
        'read': read ?? false,
        if (latitude != null && longitude != null)
          'location': {
            'latitude': latitude,
            'longitude': longitude,
            if (address != null) 'address': address,
          },
      };
}
