import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../providers/auth_notifier.dart';
import '../../providers/chat_notifier.dart';

class MessagesScreen extends ConsumerWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final messages = ref.watch(chatProvider);
    final uid = auth.user?.id ?? '';
    final peers = <String>{};
    for (final m in messages) {
      if (m.senderId == uid) peers.add(m.receiverId);
      if (m.receiverId == uid) peers.add(m.senderId);
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: peers.isEmpty
          ? const Center(child: Text('No conversations yet.'))
          : ListView(
              children: peers
                  .map(
                    (id) => ListTile(
                      title: Text('User $id'),
                      onTap: () => context.push('/chat/$id'),
                    ),
                  )
                  .toList(),
            ),
    );
  }
}
