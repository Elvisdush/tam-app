import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/user_model.dart';
import '../../providers/auth_notifier.dart';

class RegisterDriverScreen extends ConsumerStatefulWidget {
  const RegisterDriverScreen({super.key});

  @override
  ConsumerState<RegisterDriverScreen> createState() => _RegisterDriverScreenState();
}

class _RegisterDriverScreenState extends ConsumerState<RegisterDriverScreen> {
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _plate = TextEditingController();
  final _model = TextEditingController();
  String _vehicle = 'motorbike';
  var _loading = false;

  @override
  void dispose() {
    _username.dispose();
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    _plate.dispose();
    _model.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _loading = true);
    await ref.read(authProvider.notifier).register(
          UserModel(
            id: '',
            username: _username.text.trim(),
            email: _email.text.trim(),
            phone: _phone.text.trim(),
            password: _password.text,
            profileImage: '',
            type: 'driver',
            vehicleType: _vehicle,
            vehiclePlate: _plate.text.trim(),
            vehicleModel: _model.text.trim(),
          ),
        );
    if (!mounted) return;
    setState(() => _loading = false);
    context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Register — Driver')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          TextField(controller: _username, decoration: const InputDecoration(labelText: 'Username')),
          const SizedBox(height: 12),
          TextField(
            controller: _email,
            decoration: const InputDecoration(labelText: 'Email'),
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 12),
          TextField(controller: _phone, decoration: const InputDecoration(labelText: 'Phone')),
          const SizedBox(height: 12),
          TextField(
            controller: _password,
            decoration: const InputDecoration(labelText: 'Password'),
            obscureText: true,
          ),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'motorbike', label: Text('Moto')),
              ButtonSegment(value: 'car', label: Text('Car')),
            ],
            selected: {_vehicle},
            onSelectionChanged: (s) => setState(() => _vehicle = s.first),
          ),
          const SizedBox(height: 12),
          TextField(controller: _plate, decoration: const InputDecoration(labelText: 'Vehicle plate')),
          const SizedBox(height: 12),
          TextField(controller: _model, decoration: const InputDecoration(labelText: 'Vehicle model')),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _loading ? null : _submit,
            child: _loading ? const CircularProgressIndicator() : const Text('Register'),
          ),
        ],
      ),
    );
  }
}
