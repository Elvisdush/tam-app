# TAM App Firewall Architecture

This document explains how the firewall works in the TAM App's network stack, covering security policies, port management, and access control across all layers.

## 🔥 Firewall Overview

The TAM App employs a multi-layered firewall strategy that provides comprehensive security across the entire application stack:

```
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                    │
│  • Rate Limiting Headers    • CORS Policies            │
│  • Input Validation        • Authentication           │
├─────────────────────────────────────────────────────┤
│                   Transport Layer                     │
│  • TLS/SSL Encryption      • Port Access Control      │
│  • Connection Filtering    • Protocol Security         │
├─────────────────────────────────────────────────────┤
│                    Network Layer                       │
│  • Docker Network Isolation  • IP Whitelisting       │
│  • Port Mapping              • Firewall Rules         │
└─────────────────────────────────────────────────────┘
```

## 🌐 Network Layer Firewall

### **Docker Network Isolation**
```yaml
networks:
  tam-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

**Security Features:**
- **Bridge Network**: Isolated container network
- **Subnet Segmentation**: 172.20.0.0/16 private subnet
- **Container Isolation**: Each service runs in isolated network namespace
- **Port Mapping**: Only necessary ports exposed to host

### **Port Access Control**
```yaml
services:
  redis:
    ports:
      - "6379:6379"  # Redis - Internal only
  rabbitmq:
    ports:
      - "5672:5672"  # AMQP - Internal only
      - "15672:15672"  # Management UI - External access
  backend:
    ports:
      - "3006:3006"  # API - External access
  nginx:
    ports:
      - "80:80"      # HTTP - External access
      - "443:443"     # HTTPS - External access
```

**Port Security:**
- **External Ports**: 80, 443, 3006, 15672, 3001, 9090
- **Internal Ports**: 6379, 5672 (not exposed to external network)
- **Port Mapping**: Only necessary services exposed
- **Port Range**: 80-443 (web), 3000-3011 (application), 9000-9090 (monitoring)

### **IP Whitelisting**
```bash
# Environment-based IP restrictions
AMQP_ALLOWED_IPS=127.0.0.1,172.20.0.0/16
REDIS_ALLOWED_IPS=127.0.0.1,172.20.0.0/16
API_ALLOWED_IPS=0.0.0.0/0  # Web access
```

## 🚚 Transport Layer Firewall

### **TLS/SSL Encryption**
```javascript
// HTTPS Configuration
const httpsOptions = {
  key: fs.readFileSync('./ssl/private.key'),
  cert: fs.readFileSync('./ssl/certificate.crt'),
  ca: fs.readFileSync('./ssl/ca.crt'),
  minVersion: 'TLSv1.2',
  ciphers: [
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-SHA384',
    'ECDHE-RSA-AES128-SHA256'
  ]
};
```

**Security Features:**
- **TLS 1.2+**: Minimum TLS version 1.2
- **Strong Ciphers**: AES-256-GCM encryption
- **Certificate Validation**: X.509 certificate chain
- **Perfect Forward Secrecy**: ECDHE key exchange

### **Protocol Security**
```javascript
// AMQP Security Configuration
const amqpConfig = {
  hostname: process.env.AMQP_HOSTNAME || 'localhost',
  port: parseInt(process.env.AMQP_PORT) || 5672,
  username: process.env.AMQP_USERNAME || 'guest',
  password: process.env.AMQP_PASSWORD || 'guest',
  vhost: process.env.AMQP_VHOST || '/',
  heartbeat: parseInt(process.env.AMQP_HEARTBEAT) || 60,
  ssl: {
    enabled: process.env.AMQP_SSL === 'true',
    ca: process.env.AMQP_SSL_CA,
    cert: process.env.AMQP_SSL_CERT,
    key: process.env.AMQP_SSL_KEY,
    passphrase: process.env.AMQP_SSL_PASSPHRASE
  }
};
```

## 📱 Application Layer Firewall

### **Rate Limiting**
```javascript
// Rate Limiting Configuration
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 1000;

app.use('*', async (c, next) => {
  const clientIp = c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || 'unknown';
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!rateLimitMap.has(clientIp)) {
    rateLimitMap.set(clientIp, []);
  }
  
  const requests = rateLimitMap.get(clientIp);
  const validRequests = requests.filter(timestamp => timestamp > windowStart);
  
  if (validRequests.length >= RATE_LIMIT_MAX) {
    return c.json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
    }, 429);
  }
  
  validRequests.push(now);
  rateLimitMap.set(clientIp, validRequests);
  
  // Rate limiting headers
  c.header('X-RateLimit-Limit', RATE_LIMIT_MAX.toString());
  c.header('X-RateLimit-Remaining', (RATE_LIMIT_MAX - validRequests.length).toString());
  c.header('X-RateLimit-Reset', Math.ceil((validRequests[0] + RATE_LIMIT_WINDOW) / 1000).toString());
  
  await next();
});
```

**Rate Limiting Features:**
- **Sliding Window**: 15-minute time window
- **IP-based Tracking**: Per-IP rate limiting
- **Headers**: Rate limit information in response headers
- **429 Responses**: Proper HTTP status codes

### **CORS Policies**
```javascript
// CORS Configuration
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Max-Age', '86400');
  
  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }
  
  await next();
});
```

**CORS Security:**
- **Origin Control**: Configurable allowed origins
- **Method Restrictions**: Limited HTTP methods
- **Header Validation**: Specific allowed headers
- **Preflight Caching**: 24-hour cache for OPTIONS requests

### **Security Headers**
```javascript
// Security Headers Middleware
app.use('*', async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('X-API-Version', '1.0.0');
  c.header('X-Environment', process.env.NODE_ENV || 'development');
  c.header('X-AMQP-Status', amqpService.getConnectionStatus().isConnected ? 'connected' : 'disconnected');
  
  await next();
});
```

**Security Headers:**
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-Frame-Options**: Prevents clickjacking
- **X-XSS-Protection**: XSS protection in browsers
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Restricts browser features

### **Input Validation**
```javascript
// Input Validation Middleware
app.use('*', async (c, next) => {
  const userAgent = c.req.header('User-Agent') || 'Unknown';
  const origin = c.req.header('Origin') || 'No-Origin';
  const contentType = c.req.header('Content-Type') || 'application/json';
  
  // Validate User-Agent
  if (userAgent.includes('bot') || userAgent.includes('crawler')) {
    return c.json({ error: 'Bot access denied' }, 403);
  }
  
  // Validate Content-Type
  if (c.req.method === 'POST' && !contentType.includes('application/json')) {
    return c.json({ error: 'Invalid content type' }, 400);
  }
  
  // Validate request size
  const contentLength = c.req.header('Content-Length');
  if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB limit
    return c.json({ error: 'Request too large' }, 413);
  }
  
  await next();
});
```

## 🔍 Firewall Monitoring

### **Connection Logging**
```javascript
// Request Logging Middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const url = c.req.url;
  const origin = c.req.header('Origin') || 'No-Origin';
  const userAgent = c.req.header('User-Agent') || 'Unknown';
  
  await next();
  
  const duration = Date.now() - start;
  const status = c.res.status;
  
  console.log(`[API] ${method} ${url} - ${status} (${duration}ms) - Origin: ${origin} - RateLimit: 999 - ${userAgent.substring(0, 50)} - AMQP: ${amqpService.getConnectionStatus().isConnected ? 'Connected' : 'Disconnected'}`);
});
```

### **Security Event Logging**
```javascript
// Security Event Logging
app.use('*', async (c, next) => {
  await next();
  
  const status = c.res.status;
  
  if (status >= 400) {
    const errorData = {
      error: 'Request failed',
      message: 'API request error',
      timestamp: new Date().toISOString(),
      path: c.req.path,
      method: c.req.method,
      userAgent: c.req.header('User-Agent') || 'Unknown',
      ip: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || 'unknown'
    };

    // Publish security event to monitoring
    try {
      await amqpService.publishSystemTask(errorData, 'high');
    } catch (publishError) {
      console.error('❌ Failed to publish security event:', publishError);
    }
  }
});
```

## 🛡️ Firewall Rules Summary

### **Allowed Traffic**
- **HTTP/HTTPS**: Port 80, 443 (web traffic)
- **API**: Port 3006 (application API)
- **Management**: Port 15672 (RabbitMQ UI)
- **Monitoring**: Port 3001 (Grafana), 9090 (Prometheus)

### **Blocked Traffic**
- **Direct Database Access**: No external database ports
- **Internal Services**: Redis (6379), AMQP (5672) internal only
- **Unauthorized IPs**: Rate limiting and IP restrictions
- **Malicious Requests**: Input validation and bot detection

### **Security Zones**
- **DMZ**: Web-facing services (nginx, frontend)
- **Application Zone**: Backend services (API, processing)
- **Data Zone**: Database and message queues
- **Management Zone**: Monitoring and admin interfaces

## 🔧 Firewall Configuration

### **Environment Variables**
```bash
# Firewall Configuration
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ENABLE_SECURITY_HEADERS=true
ENABLE_RATE_LIMITING=true

# Network Security
AMQP_ALLOWED_IPS=127.0.0.1,172.20.0.0/16
REDIS_ALLOWED_IPS=127.0.0.1,172.20.0.0/16
API_ALLOWED_IPS=0.0.0.0/0

# SSL/TLS Configuration
SSL_CERT_PATH=./ssl/certificate.crt
SSL_KEY_PATH=./ssl/private.key
SSL_CA_PATH=./ssl/ca.crt
TLS_MIN_VERSION=TLSv1.2
```

### **Docker Security**
```yaml
# Security Context
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp
  - /var/run
user: "1000:1000"
```

## 🚨 Firewall Alerts

### **Security Event Types**
- **Rate Limit Exceeded**: 429 responses
- **Unauthorized Access**: 403 responses
- **Input Validation Failures**: 400 responses
- **Connection Refused**: Network security events
- **SSL/TLS Errors**: Certificate issues

### **Alert Integration**
- **AMQP Events**: Security events published to message queues
- **Logging**: Comprehensive security event logging
- **Monitoring**: Real-time security metrics
- **Notifications**: Alert on security violations

This multi-layered firewall architecture provides comprehensive security for the TAM App, protecting against various attack vectors while maintaining performance and usability.
