# tam-app

Expo (React Native) ride and navigation app: drivers, passengers, maps, OTP sign-in, and a small Hono API for web-only features.

## Requirements

- Node.js 20+ (22 works)
- npm (use `--legacy-peer-deps` if install fails on peer conflicts)

## Setup

1. Clone the repo and open this folder (`tam-app/tam` is the app root).

2. Install dependencies:

   ```bash
   npm install --legacy-peer-deps
   ```

3. Environment variables are **not** committed. Copy the example file and edit values:

   ```bash
   copy .env.example .env
   ```

   On macOS/Linux: `cp .env.example .env`

4. Fill `.env` using comments in `.env.example` (Twilio, Firebase if applicable, Google Maps / Routes, OAuth client IDs, etc.).

5. Restart the dev server after any `.env` change (`npx expo start -c`).

## Run the app

| Command | Purpose |
|--------|---------|
| `npm run expo:start` | Start Expo (QR / device / simulator) |
| `npm run expo:start:web` | Start with web |
| `npm run expo:start:web:clear` | Web + clear Metro cache |
| `npm run expo:start:web:offline` | Web + skip Expo registry fetch (useful if `fetch failed` on start) |
| `npm run server` | Hono API on port 3000 (loads `.env` via dotenv) |

From scratch after env changes:

```bash
npx expo start -c
```

## Web vs native notes

- **OTP SMS:** Twilio cannot be called from the browser (CORS). On web, set `EXPO_PUBLIC_API_BASE_URL` (e.g. `http://localhost:3000`) and run `npm run server` so sign-in SMS goes through `POST /api/otp/send-sign-in`. Native can use `EXPO_PUBLIC_TWILIO_*` directly.

- **`import.meta` on web:** `babel.config.js` enables `unstable_transformImportMeta` in `babel-preset-expo` so the web bundle runs in a non-module script context.

- **Expo CLI network errors:** If startup fails on `getNativeModuleVersions`, use `npm run expo:start:web:offline` or set `EXPO_NO_DEPENDENCY_VALIDATION=1`.

- **Windows + Metro:** `metro.config.js` excludes other platforms’ `@expo/ngrok-bin-*` packages from the file map to avoid `ENOENT` watch errors on optional darwin/linux folders.

## Google OAuth (web)

Use a **Web application** OAuth client in Google Cloud. Add **Authorized JavaScript origins** and **Authorized redirect URIs** for your exact dev URL (e.g. `http://localhost:8082` and `http://localhost:8082/oauth/google`). Put the client ID in `EXPO_PUBLIC_GOOGLE_CLIENT_ID`. The app scheme for redirects is **`myapp`** (see `app.json` and `lib/oauth.ts`).

## Project layout (high level)

- `app/` — Expo Router screens (tabs, auth, rides, …)
- `components/` — UI including map and navigation helpers
- `store/` — Zustand stores (auth, location, rides, …)
- `lib/` — Routing, OTP, OAuth, Rwanda search helpers, etc.
- `backend/` — Hono server (`server.js`, `hono.ts`, tRPC, rate limits)

## Scripts (API / security)

See `package.json` for `cors:test`, `rate-limit:test`, `dns:test`, and `security:full` if you use the bundled backend hardening checks.

## License

Private project unless otherwise noted in the repository.
