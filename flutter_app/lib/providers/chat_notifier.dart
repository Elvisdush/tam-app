import 'dart:async';

import 'package:firebase_database/firebase_database.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/chat_message_model.dart';

final chatProvider = NotifierProvider<ChatNotifier, List<ChatMessageModel>>(ChatNotifier.new);

class ChatNotifier extends Notifier<List<ChatMessageModel>> {
  StreamSubscription<DatabaseEvent>? _sub;

  DatabaseReference get _ref => FirebaseDatabase.instance.ref('messages');

  @override
  List<ChatMessageModel> build() {
    ref.onDispose(() => _sub?.cancel());
    _sub = _ref.onValue.listen((event) {
      final val = event.snapshot.value;
      if (val == null) {
        state = const [];
        return;
      }
      final map = Map<dynamic, dynamic>.from(val as Map);
      state = map.entries
          .map((e) => ChatMessageModel.fromEntry(e.key.toString(), Map<dynamic, dynamic>.from(e.value as Map)))
          .toList();
    });
    return const [];
  }

  Future<void> sendMessage(ChatMessageModel msg) async {
    final newRef = _ref.push();
    await newRef.set(msg.toWriteMap());
  }

  Future<void> deleteMessage(String messageId) async {
    await _ref.child(messageId).remove();
  }

  void markAsRead(String userId, String currentUserId) {
    state = state
        .map((m) => m.senderId == userId && m.receiverId == currentUserId ? _copyRead(m, true) : m)
        .toList();
  }

  ChatMessageModel _copyRead(ChatMessageModel m, bool read) {
    return ChatMessageModel(
      id: m.id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      content: m.content,
      timestamp: m.timestamp,
      type: m.type,
      duration: m.duration,
      read: read,
      latitude: m.latitude,
      longitude: m.longitude,
      address: m.address,
    );
  }

  int unreadCount(String currentUserId) {
    return state.where((m) => m.receiverId == currentUserId && m.read != true).length;
  }
}
