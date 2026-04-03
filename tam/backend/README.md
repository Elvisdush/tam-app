# Backend API with CORS Security & Rate Limiting

## 🛡️ Security Features

This backend implements comprehensive security measures including CORS policies and rate limiting to protect your API from abuse while ensuring fair usage.

## 🚀 Quick Start

### Start Development Server
```bash
npm run server:dev
```

### Start Production Server
```bash
npm run server:prod
```

### Test Security Configuration
```bash
npm run security:test
```

### Test Individual Components
```bash
npm run cors:test        # Test CORS configuration
npm run rate-limit:test  # Test rate limiting
```

## 🚦 Rate Limiting

### Overview
Rate limiting protects your API from abuse by restricting the number of requests clients can make within specified time windows.

### Rate Limit Configurations

| Endpoint Type | Window | Max Requests | Purpose |
|---------------|--------|--------------|---------|
| **Default** | 15 minutes | 1000 | General API usage |
| **Strict** | 15 minutes | 10 | Sensitive operations |
| **Auth** | 15 minutes | 5 | Authentication endpoints |
| **OTP** | 1 hour | 3 | OTP requests (very strict) |
| **Location** | 1 minute | 60 | Real-time location updates |
| **Search** | 1 minute | 20 | Search functionality |
| **Upload** | 1 hour | 10 | File uploads |

### Rate Limit Headers
All responses include rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 2024-01-01T12:00:00.000Z
X-RateLimit-Window: 900
```

### Rate Limit Response
When rate limited (HTTP 429):
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests, please try again later.",
  "retryAfter": 300,
  "limit": 1000,
  "windowMs": 900000
}
```

## 🌐 API Endpoints

### Health & Monitoring
```
GET /health                    # Server health with rate limit stats
GET /admin/rate-limit-stats    # Rate limit statistics (admin)
POST /admin/reset-rate-limit   # Reset rate limits (admin)
GET /rate-limit-test          # Test rate limiting
```

### CORS Testing
```
GET /cors-test                 # Test CORS configuration
```

## � Rate Limit Configuration

### Custom Rate Limits
Create custom rate limiters in `middleware/rate-limit.ts`:

```typescript
export const customRateLimit = createRateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 50,
  message: 'Custom rate limit exceeded',
});
```

### User-Based Rate Limiting
Different limits for user tiers:

```typescript
app.use("/api/premium/*", createUserBasedRateLimit({
  free: { windowMs: 15 * 60 * 1000, maxRequests: 100 },
  premium: { windowMs: 15 * 60 * 1000, maxRequests: 500 },
  enterprise: { windowMs: 15 * 60 * 1000, maxRequests: 2000 },
}));
```

### Trusted Origin Bypass
Trusted origins bypass rate limiting:

```typescript
app.use("*", createTrustedRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 1000,
}));
```

## 🧪 Testing Rate Limiting

### Automated Testing
```bash
# Test rate limiting scenarios
npm run rate-limit:test

# Test production rate limits
npm run rate-limit:test:prod

# Test with custom API URL
API_BASE_URL=https://your-api.com npm run rate-limit:test
```

### Test Scenarios
The test suite covers:
- Normal usage within limits
- Exceeding rate limits
- Burst protection
- Window reset behavior
- Different endpoint types

### Manual Testing
```bash
# Start server
npm run server:dev

# Test rate limiting
curl -i http://localhost:3000/rate-limit-test
curl -i http://localhost:3000/rate-limit-test
# ... repeat until rate limited
```

## 📊 Monitoring

### Rate Limit Statistics
```bash
curl http://localhost:3000/admin/rate-limit-stats
```

Response:
```json
{
  "totalEntries": 150,
  "activeWindows": 45,
  "topConsumers": [
    {
      "key": "192.168.1.100:anonymous:/rate-limit-test",
      "count": 15,
      "resetTime": 1640995200000
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z",
  "environment": "development"
}
```

### Request Logging
All requests are logged with rate limit information:
```
[API] GET /api/test - 200 (15ms) - Origin: http://localhost:8081 - RateLimit: 95 - Mozilla/5.0...
```

## 🔒 Security Features

### CORS Policy
- **Development**: Allows local origins with wildcard patterns
- **Production**: Restricts to specific whitelisted domains
- **Credentials**: Supports cookies and authentication headers

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Rate Limiting Strategies
1. **Global Rate Limiting**: Applied to all requests
2. **Endpoint-Specific**: Different limits per endpoint type
3. **User-Based**: Different limits per user tier
4. **Trusted Origin Bypass**: Skip limits for trusted origins

## 🚀 Production Deployment

### Environment Configuration
```bash
export NODE_ENV=production
export PORT=3000
```

### Production Rate Limits
Update `middleware/rate-limit.ts` for production:
```typescript
export const RATE_LIMIT_CONFIGS = {
  default: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 500, // Lower for production
  },
  // ... other configs
};
```

### Monitoring Setup
1. Monitor rate limit headers in your frontend
2. Set up alerts for high rate limit hits
3. Track top consumers for abuse detection
4. Log rate limit violations for security analysis

## 🛠️ Troubleshooting

### Rate Limit Issues
1. **429 Errors**: Check `Retry-After` header
2. **Unexpected Limits**: Verify endpoint configuration
3. **Memory Usage**: Monitor rate limit store size

### CORS Issues
1. **Blocked Origins**: Check CORS configuration
2. **Missing Headers**: Verify CORS middleware order
3. **Credentials**: Ensure `credentials: true` for auth

### Performance Issues
1. **High Memory**: Consider Redis for rate limit storage
2. **Slow Response**: Monitor rate limit calculation time
3. **Database Load**: Optimize rate limit key generation

## 📚 Advanced Configuration

### Redis Storage (Production)
Replace in-memory storage with Redis:

```typescript
// In production, use Redis instead of Map
const redis = new Redis(process.env.REDIS_URL);

async function getRateLimitData(key: string): Promise<RateLimitData> {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}
```

### Distributed Rate Limiting
For multiple server instances:

```typescript
// Use consistent hashing or centralized storage
const clusterKey = `cluster:${process.env.CLUSTER_ID}:${key}`;
```

### Custom Key Generation
```typescript
function customKeyGenerator(c: Context): string {
  const userId = c.get('userId');
  const ip = c.req.header('x-forwarded-for');
  const endpoint = c.req.path;
  return `${userId}:${ip}:${endpoint}`;
}
```

## � Best Practices

1. **Start Conservative**: Begin with lower limits and increase as needed
2. **Monitor Usage**: Track rate limit statistics regularly
3. **User Communication**: Clearly communicate rate limits to users
4. **Graceful Degradation**: Handle rate limits gracefully in frontend
5. **Security Logging**: Log rate limit violations for security analysis
6. **Testing**: Test rate limits in staging before production

## 📈 Scaling Considerations

- **Memory Usage**: Monitor rate limit store size
- **Database Load**: Optimize key generation and storage
- **Distributed Systems**: Use Redis for multi-server deployments
- **Geographic Distribution**: Consider CDN-based rate limiting
- **Analytics**: Use rate limit data for traffic analysis
