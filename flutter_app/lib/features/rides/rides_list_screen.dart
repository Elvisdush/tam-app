import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../providers/ride_notifier.dart';

class RidesListScreen extends ConsumerWidget {
  const RidesListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final st = ref.watch(rideProvider);
    final list = st.searchResults.isNotEmpty ? st.searchResults : st.rides;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: const Text('Rides'),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/rides/post'),
        child: const Icon(Icons.add),
      ),
      body: list.isEmpty
          ? const Center(child: Text('No rides yet. Post or search from Home.'))
          : ListView.builder(
              itemCount: list.length,
              itemBuilder: (context, i) {
                final r = list[i];
                final key = r.firebaseKey ?? '${r.id}';
                return ListTile(
                  title: Text('${r.from} → ${r.to}'),
                  subtitle: Text('${r.price.toStringAsFixed(0)} RWF · ${r.transportType}'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/rides/track/$key'),
                );
              },
            ),
    );
  }
}
