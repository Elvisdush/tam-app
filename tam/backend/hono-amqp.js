/**
 * Hono API Server with AMQP Integration
 * Enhanced version of the original Hono server with message queuing capabilities
 */

const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const AMQPService = require('./amqp/amqp-service');

const app = new Hono();

// Initialize AMQP service
const amqpService = new AMQPService({
  hostname: process.env.AMQP_HOSTNAME || 'localhost',
  port: parseInt(process.env.AMQP_PORT) || 5672,
  username: process.env.AMQP_USERNAME || 'guest',
  password: process.env.AMQP_PASSWORD || 'guest',
  vhost: process.env.AMQP_VHOST || '/',
  heartbeat: parseInt(process.env.AMQP_HEARTBEAT) || 60,
  reconnect: process.env.AMQP_RECONNECT !== 'false',
  reconnectBackoffStrategy: process.env.AMQP_RECONNECT_STRATEGY || 'linear',
  reconnectBackoffTime: parseInt(process.env.AMQP_RECONNECT_BACKOFF) || 1000,
  maxReconnectAttempts: parseInt(process.env.AMQP_MAX_RECONNECT_ATTEMPTS) || 10
});

// Initialize AMQP service
amqpService.initialize().catch(error => {
  console.error('❌ Failed to initialize AMQP service:', error);
});

// AMQP event handlers
amqpService.on('initialized', () => {
  console.log('🔗 AMQP service initialized');
});

amqpService.on('connected', () => {
  console.log('🔗 AMQP connected - ready to process messages');
});

amqpService.on('error', (error) => {
  console.error('❌ AMQP error:', error);
});

amqpService.on('disconnected', () => {
  console.warn('⚠️ AMQP disconnected');
});

// CORS middleware
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Max-Age', '86400');
  
  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }
  
  await next();
});

// Security headers middleware
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

// Request logging middleware
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

// Rate limiting middleware (simple in-memory)
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
  
  c.header('X-RateLimit-Limit', RATE_LIMIT_MAX.toString());
  c.header('X-RateLimit-Remaining', (RATE_LIMIT_MAX - validRequests.length).toString());
  c.header('X-RateLimit-Reset', Math.ceil((validRequests[0] + RATE_LIMIT_WINDOW) / 1000).toString());
  
  await next();
});

// Main endpoints
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    message: 'API is running with AMQP integration',
    cors: 'enabled',
    security: 'hardened',
    rateLimit: 'enabled',
    amqp: amqpService.getConnectionStatus(),
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    features: ['message-queuing', 'async-processing', 'event-driven']
  });
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cors: 'enabled',
    security: 'hardened',
    rateLimit: 'enabled',
    amqp: amqpService.getConnectionStatus(),
    rateLimitStats: {
      activeWindows: rateLimitMap.size,
      totalEntries: Array.from(rateLimitMap.values()).reduce((sum, requests) => sum + requests.length, 0)
    }
  });
});

// API health endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'backend-api-with-amqp',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    amqp: amqpService.getConnectionStatus(),
    rateLimitStats: {
      activeWindows: rateLimitMap.size,
      totalEntries: Array.from(rateLimitMap.values()).reduce((sum, requests) => sum + requests.length, 0)
    }
  });
});

// AMQP-enabled places search endpoint
app.get('/api/places/search', async (c) => {
  const { query, lat, lng, radius = '1000' } = c.req.query();
  
  // Publish search request to queue for async processing
  const searchMessage = {
    type: 'places.search.request',
    data: {
      query,
      lat: parseFloat(lat) || 40.7128,
      lng: parseFloat(lng) || -74.0060,
      radius: parseFloat(radius) || 1000,
      requestId: `search_${Date.now()}`,
      userId: c.req.header('X-User-ID') || 'anonymous'
    }
  };

  try {
    await amqpService.publishDataProcessing(searchMessage);
    console.log(`📤 Published search request to queue: ${searchMessage.requestId}`);
  } catch (error) {
    console.error('❌ Failed to publish search request:', error);
  }

  // Return immediate response with request ID
  return c.json({
    status: 'accepted',
    message: 'Search request queued for processing',
    requestId: searchMessage.requestId,
    estimatedProcessingTime: '5-10 seconds',
    timestamp: new Date().toISOString()
  });
});

// AMQP message publishing endpoint
app.post('/api/messages/publish', async (c) => {
  const messageData = await c.req.json();
  
  try {
    const message = {
      type: messageData.type || 'general',
      data: messageData.data,
      timestamp: new Date().toISOString(),
      userId: c.req.header('X-User-ID') || 'anonymous',
      metadata: {
        source: 'tam-app',
        version: '1.0.0',
        priority: messageData.priority || 'normal'
      }
    };

    switch (message.type) {
      case 'location.update':
        await amqpService.publishLocationUpdate(message.data, messageData.priority);
        break;
      case 'user.notification':
        await amqpService.publishUserNotification(message.data, messageData.priority);
        break;
      case 'data.processing':
        await amqpService.publishDataProcessing(message.data, messageData.priority);
        break;
      case 'analytics.event':
        await amqpService.publishAnalyticsEvent(message.data, messageData.priority);
        break;
      case 'system.task':
        await amqpService.publishSystemTask(message.data, messageData.priority);
        break;
      default:
        await amqpService.publishDataProcessing(message, messageData.priority);
        break;
    }

    console.log(`📤 Published message: ${message.type} (${message.id})`);
    
    return c.json({
      status: 'published',
      message: 'Message published to queue',
      messageId: message.id,
      type: message.type,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to publish message:', error);
    return c.json({
      error: 'Failed to publish message',
      message: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// AMQP queue status endpoint
app.get('/api/amqp/status', (c) => {
  return c.json({
    status: 'healthy',
    service: 'amqp-message-service',
    timestamp: new Date().toISOString(),
    connection: amqpService.getConnectionStatus(),
    queues: amqpService.getQueueStats(),
    uptime: process.uptime()
  });
});

// AMQP queue stats endpoint
app.get('/api/amqp/stats', (c) => {
  const stats = amqpService.getQueueStats();
  return c.json({
    status: 'healthy',
    service: 'amqp-message-service',
    timestamp: new Date().toISOString(),
    stats,
    uptime: process.uptime()
  });
});

// Error handling middleware
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
      userAgent: c.req.header('User-Agent') || 'Unknown'
    };

    // Publish error to dead letter queue
    try {
      await amqpService.publishSystemTask(errorData, 'high');
    } catch (publishError) {
      console.error('❌ Failed to publish error to dead letter queue:', publishError);
    }
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  await amqpService.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down gracefully...');
  await amqpService.shutdown();
  process.exit(0);
});

const port = process.env.PORT || 3006;
console.log(`🚀 Starting TAM App with AMQP integration on port ${port}`);
console.log('🔗 AMQP Configuration:', {
  hostname: process.env.AMQP_HOSTNAME || 'localhost',
  port: parseInt(process.env.AMQP_PORT) || 5672,
  username: process.env.AMQP_USERNAME || 'guest',
  reconnect: process.env.AMQP_RECONNECT !== 'false'
});

serve({
  fetch: app.fetch,
  port
});
