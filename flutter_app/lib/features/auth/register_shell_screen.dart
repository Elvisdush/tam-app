import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class RegisterShellScreen extends StatelessWidget {
  const RegisterShellScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create account')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => context.push('/register/passenger'),
                child: const Text('Passenger'),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => context.push('/register/driver'),
                child: const Text('Driver'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
