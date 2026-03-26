import 'dart:async';

import 'package:firebase_database/firebase_database.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/user_model.dart';
import 'online_drivers_notifier.dart';

class AuthState {
  const AuthState({
    this.user,
    this.isAuthenticated = false,
    this.users = const [],
  });

  final UserModel? user;
  final bool isAuthenticated;
  final List<UserModel> users;

  AuthState copyWith({
    UserModel? user,
    bool? isAuthenticated,
    List<UserModel>? users,
  }) {
    return AuthState(
      user: user ?? this.user,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      users: users ?? this.users,
    );
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

class AuthNotifier extends Notifier<AuthState> {
  StreamSubscription<DatabaseEvent>? _usersSub;

  DatabaseReference get _usersRef => FirebaseDatabase.instance.ref('users');

  @override
  AuthState build() {
    ref.onDispose(() {
      _usersSub?.cancel();
    });
    Future.microtask(_init);
    return const AuthState();
  }

  Future<void> _init() async {
    await _restoreSession();
    loadUsers();
  }

  Future<void> _restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final id = prefs.getString('auth_user_id');
    if (id == null) return;
    final snap = await _usersRef.child(id).get();
    if (!snap.exists || snap.value == null) {
      await prefs.remove('auth_user_id');
      return;
    }
    final u = UserModel.fromMap(id, Map<dynamic, dynamic>.from(snap.value! as Map));
    state = AuthState(user: u, isAuthenticated: true, users: state.users);
  }

  Future<void> _persistSession(UserModel? u) async {
    final prefs = await SharedPreferences.getInstance();
    if (u == null) {
      await prefs.remove('auth_user_id');
    } else {
      await prefs.setString('auth_user_id', u.id);
    }
  }

  void loadUsers() {
    _usersSub?.cancel();
    _usersSub = _usersRef.onValue.listen((event) {
      final val = event.snapshot.value;
      if (val == null) {
        state = state.copyWith(users: const []);
        return;
      }
      final map = Map<dynamic, dynamic>.from(val as Map);
      final list = map.entries
          .map((e) => UserModel.fromMap(e.key.toString(), Map<dynamic, dynamic>.from(e.value as Map)))
          .toList();
      state = state.copyWith(users: list);
    });
  }

  Future<bool> signIn(String email, String password) async {
    final snap = await _usersRef.get();
    if (!snap.exists || snap.value == null) return false;
    final map = Map<dynamic, dynamic>.from(snap.value! as Map);
    for (final e in map.entries) {
      final u = UserModel.fromMap(e.key.toString(), Map<dynamic, dynamic>.from(e.value as Map));
      if (u.email == email && u.password == password) {
        state = AuthState(user: u, isAuthenticated: true, users: state.users);
        await _persistSession(u);
        return true;
      }
    }
    return false;
  }

  Future<void> register(UserModel userWithoutId) async {
    final id = DateTime.now().millisecondsSinceEpoch.toString();
    final u = UserModel(
      id: id,
      username: userWithoutId.username,
      email: userWithoutId.email,
      phone: userWithoutId.phone,
      password: userWithoutId.password,
      profileImage: userWithoutId.profileImage,
      type: userWithoutId.type,
      vehicleImage: userWithoutId.vehicleImage,
      vehicleType: userWithoutId.vehicleType,
      vehiclePlate: userWithoutId.vehiclePlate,
      vehicleModel: userWithoutId.vehicleModel,
    );
    await _usersRef.child(id).set(u.toMap());
    state = AuthState(user: u, isAuthenticated: true, users: state.users);
    await _persistSession(u);
    loadUsers();
  }

  Future<void> updateUser(UserModel userData) async {
    final id = userData.id;
    final map = userData.toMap();
    await _usersRef.child(id).update(map);
    state = state.copyWith(user: userData);
  }

  Future<void> logout() async {
    final u = state.user;
    if (u?.isDriver == true) {
      await ref.read(onlineDriversProvider.notifier).clearMyPresence(u!.id);
    }
    state = const AuthState();
    await _persistSession(null);
  }
}
