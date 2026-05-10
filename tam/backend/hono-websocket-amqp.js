/**
 * Hono API Server with WebSocket and AMQP Integration
 * Enhanced version with real-time WebSocket broadcasting
 */

const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const AMQPService = require('./amqp/amqp-service');
const WebSocketServer = require('./websocket/websocket-server');

const app = new Hono();

// Initialize services
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

const wsServer = new WebSocketServer({
  port: process.env.WEBSOCKET_PORT || 3007,
  maxClients: 1000,
  heartbeatInterval: 30000,
  messageBufferSize: 1000
});

// Initialize AMQP service
amqpService.initialize().catch(error => {
  console.error('❌ Failed to initialize AMQP service:', error);
});

// Initialize WebSocket service
wsServer.initialize().catch(error => {
  console.error('❌ Failed to initialize WebSocket service:', error);
});

// CORS middleware
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
  c.header('X-WebSocket-Status', wsServer.wss ? 'running' : 'stopped');
  
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
  
  console.log(`[API] ${method} ${url} - ${status} (${duration}ms) - Origin: ${origin} - RateLimit: 999 - ${userAgent.substring(0, 50)} - AMQP: ${amqpService.getConnectionStatus().isConnected ? 'Connected' : 'Disconnected'} - WebSocket: ${wsServer.wss ? 'Running' : 'Stopped'}`);
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
  
  // Rate limiting headers
  c.header('X-RateLimit-Limit', RATE_LIMIT_MAX.toString());
  c.header('X-RateLimit-Remaining', (RATE_LIMIT_MAX - validRequests.length).toString());
  c.header('X-RateLimit-Reset', Math.ceil((validRequests[0] + RATE_LIMIT_WINDOW) / 1000).toString());
  
  await next();
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'tam-app-websocket-amqp',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    services: {
      amqp: amqpService.getConnectionStatus(),
      websocket: {
        running: !!wsServer.wss,
        connectedClients: wsServer.getStats().connectedClients,
        port: wsServer.port
      }
    }
  });
});

// API status endpoint
app.get('/api/status', (c) => {
  return c.json({
    status: 'healthy',
    service: 'tam-app-websocket-amqp',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    endpoints: {
      api: 'http://localhost:3006/api',
      websocket: 'ws://localhost:3007',
      amqp_management: 'http://localhost:15672'
    },
    services: {
      amqp: amqpService.getConnectionStatus(),
      websocket: wsServer.getStats(),
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      }
    }
  });
});

// WebSocket status endpoint
app.get('/api/websocket/status', (c) => {
  return c.json({
    status: 'healthy',
    service: 'websocket-server',
    timestamp: new Date().toISOString(),
    ...wsServer.getStats()
  });
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

// Enhanced AMQP message publishing endpoint
app.post('/api/messages/publish', async (c) => {
  const messageData = await c.req.json();
  
  try {
    const message = {
      id: require('uuid').v4(),
      type: messageData.type || 'general',
      data: messageData.data,
      timestamp: new Date().toISOString(),
      userId: c.req.header('X-User-ID') || 'anonymous',
      metadata: {
        source: 'tam-app',
        version: '1.0.0',
        priority: messageData.priority || 'normal',
        websocketBroadcast: messageData.websocketBroadcast !== false
      }
    };

    let publishResult;
    switch (message.type) {
      case 'location.update':
        publishResult = await amqpService.publishLocationUpdate(message.data, messageData.priority);
        break;
      case 'user.notification':
        publishResult = await amqpService.publishUserNotification(message.data, messageData.priority);
        break;
      case 'data.processing':
        publishResult = await amqpService.publishDataProcessing(message, messageData.priority);
        break;
      case 'analytics.event':
        publishResult = await amqpService.publishAnalyticsEvent(message.data, messageData.priority);
        break;
      case 'system.task':
        publishResult = await amqpService.publishSystemTask(message.data, messageData.priority);
        break;
      default:
        publishResult = await amqpService.publishDataProcessing(message, messageData.priority);
        break;
    }

    console.log(`📤 Published message: ${message.type} (${message.id})`);
    
    return c.json({
      status: 'published',
      message: 'Message published to queue',
      messageId: message.id,
      type: message.type,
      timestamp: new Date().toISOString(),
      websocketBroadcast: message.metadata.websocketBroadcast
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

// Real-time location updates endpoint
app.post('/api/location/updates', async (c) => {
  const locationData = await c.req.json();
  
  try {
    const message = {
      id: require('uuid').v4(),
      type: 'location.update',
      data: {
        ...locationData,
        timestamp: new Date().toISOString(),
        source: 'api'
      },
      metadata: {
        source: 'tam-app',
        version: '1.0.0',
        priority: locationData.priority || 'normal',
        websocketBroadcast: true
      }
    };

    await amqpService.publishLocationUpdate(message.data, message.metadata.priority);
    
    console.log(`📍 Location update published: ${message.id}`);
    
    return c.json({
      status: 'published',
      message: 'Location update published',
      messageId: message.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to publish location update:', error);
    return c.json({
      error: 'Failed to publish location update',
      message: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// User notifications endpoint
app.post('/api/notifications/send', async (c) => {
  const notificationData = await c.req.json();
  
  try {
    const message = {
      id: require('uuid').v4(),
      type: 'user.notification',
      data: {
        ...notificationData,
        timestamp: new Date().toISOString(),
        source: 'api'
      },
      metadata: {
        source: 'tam-app',
        version: '1.0.0',
        priority: notificationData.priority || 'normal',
        websocketBroadcast: true
      }
    };

    await amqpService.publishUserNotification(message.data, message.metadata.priority);
    
    console.log(`🔔 Notification published: ${message.id}`);
    
    return c.json({
      status: 'published',
      message: 'Notification published',
      messageId: message.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to publish notification:', error);
    return c.json({
      error: 'Failed to publish notification',
      message: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Search endpoint with AMQP queueing
app.post('/api/search', async (c) => {
  const searchData = await c.req.json();
  
  try {
    const searchMessage = {
      id: require('uuid').v4(),
      type: 'data.processing',
      data: {
        action: 'search',
        query: searchData.query,
        filters: searchData.filters || {},
        userId: c.req.header('X-User-ID') || 'anonymous',
        timestamp: new Date().toISOString()
      },
      metadata: {
        source: 'tam-app',
        version: '1.0.0',
        priority: searchData.priority || 'normal',
        websocketBroadcast: true
      }
    };

    await amqpService.publishDataProcessing(searchMessage, searchMessage.metadata.priority);

    console.log(`🔍 Search request queued: ${searchMessage.id}`);
    
    // Return immediate response with request ID
    return c.json({
      status: 'accepted',
      message: 'Search request queued for processing',
      requestId: searchMessage.id,
      estimatedProcessingTime: '5-10 seconds',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to queue search request:', error);
    return c.json({
      error: 'Failed to queue search request',
      message: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
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
  await wsServer.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down gracefully...');
  await amqpService.shutdown();
  await wsServer.shutdown();
  process.exit(0);
});

const port = process.env.PORT || 3006;
console.log(`🚀 Starting TAM App with WebSocket and AMQP integration on port ${port}`);
console.log(`🌐 WebSocket server will run on port ${wsServer.port}`);
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
