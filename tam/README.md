# 🚖 TAM App - Taxi & Ride Management System

A comprehensive taxi and ride management application built with Expo (React Native) for mobile clients and Hono for backend services. Features include driver/passenger management, real-time navigation, OTP authentication, and advanced security middleware.

## 🏗️ System Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile Client  │    │   Web Client    │    │   Admin Panel   │
│   (Expo App)     │    │   (React Web)   │    │   (Dashboard)   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │      API Gateway          │
                    │   (Hono Server:3005)     │
                    └─────────────┬─────────────┘
                                 │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
    ┌─────┴─────┐          ┌─────┴─────┐          ┌─────┴─────┐
    │   Auth    │          │   Maps    │          │  Payment  │
    │ Service   │          │ Service   │          │ Service   │
    └─────┬─────┘          └─────┬─────┘          └─────┬─────┘
          │                        │                        │
    ┌─────┴─────┐          ┌─────┴─────┐          ┌─────┴─────┐
    │   OTP     │          │  Google   │          │  Stripe   │
    │  (Twilio) │          │   Maps    │          │   API    │
    └───────────┘          └───────────┘          └───────────┘
```

## 🔧 Core Components

### 📱 Frontend (Expo React Native)
- **Navigation**: React Navigation with expo-router
- **State Management**: Zustand stores
- **Maps**: React Native Maps with Google Maps integration
- **Authentication**: OTP-based sign-in with Twilio SMS
- **UI Components**: Custom components with Expo Vector Icons

### 🖥️ Backend (Hono + TypeScript)
- **API Framework**: Hono with TypeScript
- **Authentication**: JWT + OTP verification
- **Rate Limiting**: Configurable per-endpoint limits
- **CORS**: Environment-based CORS configuration
- **DNS Security**: Advanced DNS monitoring and validation
- **tRPC**: Type-safe API communication

### 🛡️ Security Middleware
- **Rate Limiting**: Multi-tier rate limiting with Redis fallback
- **CORS Protection**: Environment-specific CORS policies
- **DNS Security**: DNS record validation and monitoring
- **Request Validation**: Input sanitization and validation

## Repository layout

| Folder | Contents |
|--------|----------|
| **`frontend/`** | Expo app: Router screens (`app/`), UI (`components/`), Zustand stores, `lib/`, assets, `app.json`, Metro/Babel/TS config |
| **`backend/`** | Hono HTTP server (`server.js`, `hono.ts`), tRPC router, rate limits, CORS, OTP SMS proxy for web |
| **Root** | `package.json`, `node_modules`, `.env` (not committed), shared install for both sides |

Run all npm scripts from the **repository root** (the folder that contains `frontend/` and `backend/`).

## 🔄 Data Flow & System Interactions

```
📱 Mobile App Request Flow:

1. User Action → Frontend Component
2. Component → Zustand Store Update
3. Store → API Call (tRPC/HTTP)
4. API Call → Rate Limiting Middleware
5. Rate Limit → CORS Validation
6. CORS → Authentication Check
7. Auth → Business Logic
8. Logic → Database/External API
9. Response → Security Headers
10. Headers → Frontend Update
11. Update → UI Re-render

🔐 Authentication Flow:

Mobile App → OTP Request → Twilio SMS → User Receives Code
→ User Enters Code → Backend Validation → JWT Token
→ Token Storage → Authenticated Requests

🗺️ Real-time Location Flow:

Driver App → Location Updates → WebSocket/API
→ Backend Processing → Passenger App Updates
→ Map Display → Route Calculation
```

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: 20+ (22 works)
- **npm**: Use `--legacy-peer-deps` for peer conflicts
- **Expo Go**: SDK 52 compatible version
- **Twilio Account**: For SMS OTP (optional for development)

### Environment Setup
```bash
# Clone and install
git clone <repository-url>
cd tam-app
npm install --legacy-peer-deps

# Environment variables
cp .env.example .env
# Edit .env with your API keys
```

### Development Servers
```bash
# Terminal 1: Backend API Server
npm run server
# → http://localhost:3005

# Terminal 2: Frontend Development
cd frontend
npx expo start --offline
# → http://localhost:8081 (Web)
# → Scan QR code for mobile
```

## �️ Development Workflow

### Project Structure Deep Dive
```
tam-app/tam/
├── frontend/                    # Expo React Native App
│   ├── app/                     # Expo Router screens
│   │   ├── (tabs)/             # Tab navigation
│   │   ├── auth/               # Authentication screens
│   │   └── _layout.tsx         # Root layout
│   ├── components/             # Reusable UI components
│   ├── lib/                    # Utility functions
│   │   ├── otp-sms.ts         # SMS OTP handling
│   │   └── api.ts             # API client
│   ├── store/                  # Zustand state management
│   └── assets/                 # Images, fonts, icons
├── backend/                    # Hono API Server
│   ├── middleware/             # Security middleware
│   │   ├── rate-limit.ts      # Rate limiting
│   │   └── cors.ts            # CORS handling
│   ├── config/                 # Configuration files
│   │   └── dns-security.ts    # DNS security config
│   ├── test-*.js              # Test scripts
│   ├── server.js              # Node.js entry point
│   └── hono.ts                # Main Hono app
├── package.json               # Dependencies and scripts
└── .env.example               # Environment variables template
```

### Security Architecture
```
🔒 Security Layers:

1. Rate Limiting (backend/middleware/rate-limit.ts)
   ├── Per-endpoint limits
   ├── User tier based limits
   ├── Trusted origin bypass
   └── Redis/In-memory storage

2. CORS Protection (backend/middleware/cors.ts)
   ├── Environment-specific policies
   ├── Allowed origins whitelist
   └── Preflight request handling

3. DNS Security (backend/config/dns-security.ts)
   ├── DNS record validation
   ├── SSL certificate monitoring
   ├── Security scoring system
   └── Health check endpoints

4. Authentication
   ├── OTP-based sign-in
   ├── JWT token management
   ├── Session validation
   └── Rate-limited auth attempts
```

### API Endpoints Overview
```
🌐 Available Endpoints (http://localhost:3005):

Authentication:
├── POST /api/otp/send-sign-in     # Send OTP SMS
├── POST /api/otp/verify-sign-in    # Verify OTP
└── POST /api/auth/refresh          # Refresh JWT

User Management:
├── GET  /api/user/profile          # Get user profile
├── PUT  /api/user/profile          # Update profile
└── DELETE /api/user/account        # Delete account

Ride Management:
├── POST /api/rides/request         # Request ride
├── GET  /api/rides/active          # Active rides
├── PUT  /api/rides/:id/status      # Update ride status
└── GET  /api/rides/history         # Ride history

Maps & Location:
├── GET  /api/maps/nearby-drivers   # Find nearby drivers
├── POST /api/maps/route            # Calculate route
└── PUT  /api/location/update       # Update location

Admin & Monitoring:
├── GET  /admin/stats               # System statistics
├── GET  /admin/health              # Health check
├── GET  /admin/dns-security        # DNS security info
└── POST /admin/reset-rate-limit    # Reset rate limits
```

## 📋 Requirements

1. Clone the repo and open the project root (`tam-app/tam`).

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

5. Restart the dev server after any `.env` change (`npm run expo:start:clear`).

## 🧪 Testing & Security

### Automated Testing
```bash
# Test CORS configuration
npm run cors:test

# Test rate limiting
npm run rate-limit:test

# Test DNS security
npm run dns:test

# Run all security tests
npm run security:test
```

### Security Testing
- **Rate Limiting**: Automated tests for different user tiers
- **CORS**: Tests for allowed/blocked origins
- **DNS Security**: DNS record validation and SSL checks
- **Authentication**: OTP flow testing

## 🚀 Deployment

### Development Environment
```bash
# Backend server (port 3005)
npm run server

# Frontend development (port 8081)
npm run expo:start

# Web version
npm run expo:start:web
```

### Production Environment
```bash
# Production backend
npm run server:prod

# Production frontend
npm run expo:start:prod

# Security testing in production
npm run security:test:prod
```

## 📊 Monitoring & Analytics

### Health Checks
- **Backend Health**: `GET /health`
- **DNS Security**: `GET /admin/dns-security`
- **Rate Limit Stats**: `GET /admin/stats`
- **System Metrics**: Available via admin endpoints

### Logging
- Request/response logging
- Security event tracking
- Rate limit violations
- DNS security alerts

## 🔧 Troubleshooting

### Common Issues

1. **"Body is unusable: Body has already been read"**
   ```bash
   npx expo start --offline
   ```

2. **Metro dependency errors**
   ```bash
   cd frontend
   rm -rf node_modules
   npm install --legacy-peer-deps
   ```

3. **Port conflicts**
   ```bash
   # Check what's using the port
   netstat -ano | findstr :3005
   # Kill the process
   taskkill /PID <PID> /F
   ```

4. **Expo Go compatibility**
   - Use SDK 52 compatible version
   - Or upgrade project to SDK 54

### Development Tips
- Always use `--offline` flag for Expo to avoid network issues
- Use `--legacy-peer-deps` for npm install
- Check backend server is running before testing frontend
- Monitor rate limits during development

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with proper testing
4. Run security tests before committing
5. Submit pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
- Check troubleshooting section
- Review security testing logs
- Verify environment configuration
- Check API health endpoints

---

**🎉 Your TAM App development environment is now fully configured and documented!**

## Run the app

| Command | Purpose |
|--------|---------|
| `npm run expo:start` | Start Expo from `frontend/` (QR / device / simulator) |
| `npm run expo:start:web` | Start with web |
| `npm run expo:start:web:clear` | Web + clear Metro cache |
| `npm run expo:start:web:offline` | Web + skip Expo registry fetch (useful if `fetch failed` on start) |
| `npm run server` | Hono API on port 3000 (loads root `.env` via dotenv) |

From scratch after env changes:

```bash
npm run expo:start:clear
```

TypeScript check (from root):

```bash
npx tsc --noEmit -p frontend/tsconfig.json
```

## Web vs native notes

- **OTP SMS:** Twilio cannot be called from the browser (CORS). On web, set `EXPO_PUBLIC_API_BASE_URL` (e.g. `http://localhost:3000`) and run `npm run server` so sign-in SMS goes through `POST /api/otp/send-sign-in`. Native can use `EXPO_PUBLIC_TWILIO_*` directly.

- **`import.meta` on web:** `frontend/babel.config.js` enables `unstable_transformImportMeta` in `babel-preset-expo` so the web bundle runs in a non-module script context.

- **Expo CLI network errors:** If startup fails on `getNativeModuleVersions`, use `npm run expo:start:web:offline` or set `EXPO_NO_DEPENDENCY_VALIDATION=1`.

- **Windows + Metro:** `frontend/metro.config.js` excludes other platforms’ `@expo/ngrok-bin-*` packages from the file map to avoid `ENOENT` watch errors on optional darwin/linux folders.

## Google OAuth (web)

Use a **Web application** OAuth client in Google Cloud. Add **Authorized JavaScript origins** and **Authorized redirect URIs** for your exact dev URL (e.g. `http://localhost:8082` and `http://localhost:8082/oauth/google`). Put the client ID in `EXPO_PUBLIC_GOOGLE_CLIENT_ID`. The app scheme for redirects is **`myapp`** (see `frontend/app.json` and `frontend/lib/oauth.ts`).

## Backend ↔ frontend

- The tRPC route `places.searchSuggestions` imports shared place logic from `frontend/lib/places-search.ts` via a relative path.
- Keep that file in **`frontend/lib`** unless you extract a shared package.

## Scripts (API / security)

See root `package.json` for `cors:test`, `rate-limit:test`, `dns:test`, and `security:full` if you use the bundled backend hardening checks.

## License

Private project unless otherwise noted in the repository.
