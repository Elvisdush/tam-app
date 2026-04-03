# Backend API with CORS Security

## 🛡️ CORS Configuration

This backend implements secure CORS (Cross-Origin Resource Sharing) policies to protect your API while allowing legitimate requests from your mobile app and web frontend.

## 🚀 Quick Start

### Start Development Server
```bash
npm run server:dev
```

### Start Production Server
```bash
npm run server:prod
```

### Test CORS Configuration
```bash
npm run cors:test
```

## 🔒 Security Features

### CORS Policy
- **Development**: Allows local origins with wildcard patterns
- **Production**: Restricts to specific whitelisted domains
- **Credentials**: Supports cookies and authentication headers
- **Methods**: GET, POST, PUT, DELETE, OPTIONS, PATCH
- **Headers**: Authorization, Content-Type, and custom headers

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Rate Limiting Headers
- `X-RateLimit-Limit`: Request limit per hour
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time

## 📁 Configuration

### Environment-Specific Origins

#### Development (`backend/config/cors.ts`)
```typescript
export const developmentCors = {
  origins: [
    'http://localhost:3000',
    'http://localhost:8081',
    'exp://192.168.*:8081', // Wildcard for local network
    // ... more origins
  ],
  // ... other config
};
```

#### Production
```typescript
export const productionCors = {
  origins: [
    'https://your-production-domain.com',
    'https://app.your-production-domain.com',
    'exp://exp.host/@your-username/your-app',
    // Add your production domains here
  ],
  // ... other config
};
```

## 🧪 Testing

### Automated CORS Testing
```bash
# Test development CORS
npm run cors:test:dev

# Test production CORS
npm run cors:test:prod

# Test with custom API URL
API_BASE_URL=https://your-api.com npm run cors:test
```

### Manual Testing
```bash
# Start server
npm run server:dev

# Test endpoints
curl -H "Origin: http://localhost:8081" http://localhost:3000/cors-test
curl -H "Origin: https://malicious-site.com" http://localhost:3000/cors-test
```

## 🌐 API Endpoints

### Health Check
```
GET /health
```
Returns server status, uptime, memory usage, and security info.

### CORS Test
```
GET /cors-test
```
Returns CORS information for testing purposes.

### Root
```
GET /
```
Returns basic API status and configuration.

## 🔧 Configuration for Production

### 1. Update Production Origins
Edit `backend/config/cors.ts`:

```typescript
export const productionCors = {
  origins: [
    'https://your-app.com',
    'https://www.your-app.com',
    // Add your Expo production URL
    'exp://exp.host/@your-username/your-app',
  ],
  // ... rest of config
};
```

### 2. Set Environment Variables
```bash
export NODE_ENV=production
export PORT=3000
```

### 3. Deploy and Test
```bash
npm run server:prod
npm run cors:test:prod
```

## 📱 Mobile App Integration

### Expo Development
Your Expo app will work automatically with the development CORS configuration:

```typescript
// No additional configuration needed
const response = await fetch('http://localhost:3000/api/your-endpoint');
```

### Expo Production
For production builds, ensure your production domain is in the CORS origins list:

```typescript
const API_BASE_URL = 'https://your-production-domain.com';
const response = await fetch(`${API_BASE_URL}/api/your-endpoint`);
```

## 🔍 Monitoring

### CORS Logs
The server logs all CORS decisions:
```
[API] GET /api/test - 200 (15ms) - Origin: http://localhost:8081
[CORS] Blocked origin: https://malicious-site.com
```

### Security Headers
All responses include security headers for additional protection.

## 🚨 Security Considerations

1. **Never use wildcard origins in production**
2. **Always validate origins on the server side**
3. **Use HTTPS in production**
4. **Monitor CORS logs for blocked requests**
5. **Keep CORS configuration up to date**

## 🛠️ Troubleshooting

### CORS Errors
1. Check if your origin is in the allowed list
2. Verify the environment (dev/prod)
3. Check server logs for CORS decisions

### Network Issues
1. Ensure the server is running on the correct port
2. Check firewall settings
3. Verify API base URL configuration

### Mobile App Issues
1. Update Expo Go URL in CORS config
2. Check network connectivity
3. Verify API endpoints are accessible

## 📚 Additional Resources

- [MDN CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Hono CORS Documentation](https://hono.dev/api/middleware/cors)
- [Expo Networking](https://docs.expo.dev/guides/networking/)
