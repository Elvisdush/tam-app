import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../providers/auth_notifier.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = ref.watch(authProvider).user;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: u == null
          ? const Center(child: Text('Not signed in'))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(u.username, style: Theme.of(context).textTheme.headlineSmall),
                Text('${u.type} · ${u.email}'),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () => context.push('/profile/edit'),
                  child: const Text('Edit profile'),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () async {
                    await ref.read(authProvider.notifier).logout();
                    if (context.mounted) context.go('/sign-in');
                  },
                  child: const Text('Log out'),
                ),
              ],
            ),
    );
  }
}
