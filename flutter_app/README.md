# TAM Flutter (iOS + Android)

Flutter port of the Expo app in [`../tam/`](../tam/), using the same **Firebase Realtime Database** (`project-tam-58a24`).

## Prerequisites

- [Flutter](https://docs.flutter.dev/get-started/install) 3.24+ (Dart 3.3+)
- Xcode (iOS) / Android Studio (Android)

If `flutter doctor` fails with a missing `pubspec.yaml` under `dev/a11y_assessments` inside the SDK, your Flutter checkout is incomplete or corrupted — run `flutter upgrade` or reinstall the SDK from the official archive, then retry.

## One-time setup

1. **Create platform folders** (if this folder only has `lib/` and `pubspec.yaml`):

   ```bash
   cd flutter_app
   flutter create . --platforms=android,ios
   ```

2. **Dependencies**

   ```bash
   flutter pub get
   ```

3. **Firebase**

   ```bash
   dart pub global activate flutterfire_cli
   flutterfire configure
   ```

   Replace `lib/firebase_options.dart` with the generated file (or merge keys). The Realtime Database URL is:

   `https://project-tam-58a24-default-rtdb.firebaseio.com`

4. **Google Maps** (for `google_maps_flutter`)

   - Create API keys with Maps SDK for Android / iOS enabled.
   - **Android:** `android/app/src/main/AndroidManifest.xml` — add inside `<application>`:

     ```xml
     <meta-data
         android:name="com.google.android.geo.API_KEY"
         android:value="YOUR_KEY"/>
     ```

   - **iOS:** `ios/Runner/AppDelegate.swift` — set `GMSServices.provideAPIKey`, or use `AppDelegate` + `GoogleService-Info.plist` as per Maps Flutter docs.

   Prefer **not** committing production keys; use `--dart-define` or CI secrets.

5. **Run**

   ```bash
   flutter run
   ```

## Project layout

- `lib/main.dart` — `Firebase.initializeApp`, `ProviderScope`, `MaterialApp.router`
- `lib/core/router/app_router.dart` — `go_router`, shell bottom nav for Home / Map / Messages / Profile
- `lib/providers/` — Riverpod: auth, rides, chat, online drivers, location
- `lib/domain/` — Kigali bbox, Rwanda pricing, JSON destinations loader
- `lib/services/` — OSRM routes, encoded polyline decode, reverse geocode (BigDataCloud)
- `lib/features/` — screens
- `assets/data/rwanda_destinations.json` — generated from `tam/constants/rwanda-destinations.ts`

## QA / release

- Run on physical devices for GPS and Maps.
- Enable ProGuard/R8 rules for Firebase/Maps as needed for release builds.
- Store signing: follow Flutter [Android](https://docs.flutter.dev/deployment/android) and [iOS](https://docs.flutter.dev/deployment/ios) deployment guides.
