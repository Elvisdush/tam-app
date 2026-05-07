/**
 * Hono API Server (JavaScript)
 * Main API application with all endpoints
 */

const { Hono } = require('hono');
const { serve } = require('@hono/node-server');

const app = new Hono();

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
  
  console.log(`[API] ${method} ${url} - ${status} (${duration}ms) - Origin: ${origin} - RateLimit: 999 - ${userAgent.substring(0, 50)}`);
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
    message: 'API is running',
    cors: 'enabled',
    security: 'hardened',
    rateLimit: 'enabled',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
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
    rateLimitStats: {
      activeWindows: rateLimitMap.size,
      totalEntries: Array.from(rateLimitMap.values()).reduce((sum, requests) => sum + requests.length, 0)
    }
  });
});

// API endpoints
app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'backend-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Places search endpoint
app.get('/api/places/search', (c) => {
  const { query, lat, lng, radius = '1000' } = c.req.query();
  
  // Mock search results
  const results = [
    {
      id: 'place-1',
      name: 'Sample Restaurant',
      address: '123 Main St',
      rating: 4.5,
      distance: 0.5,
      coordinates: { lat: parseFloat(lat) || 40.7128, lng: parseFloat(lng) || -74.0060 }
    },
    {
      id: 'place-2',
      name: 'Sample Cafe',
      address: '456 Oak Ave',
      rating: 4.2,
      distance: 0.8,
      coordinates: { lat: parseFloat(lat) || 40.7128, lng: parseFloat(lng) || -74.0060 }
    },
    {
      id: 'place-3',
      name: 'Sample Park',
      address: '789 Pine St',
      rating: 4.7,
      distance: 1.2,
      coordinates: { lat: parseFloat(lat) || 40.7128, lng: parseFloat(lng) || -74.0060 }
    }
  ];
  
  return c.json({
    success: true,
    results,
    query: { query, lat: parseFloat(lat) || 40.7128, lng: parseFloat(lng) || -74.0060, radius: parseFloat(radius) },
    total: results.length,
    timestamp: new Date().toISOString()
  });
});

// Places details endpoint
app.get('/api/places/:id', (c) => {
  const { id } = c.req.param();
  
  // Mock place details
  const place = {
    id: id,
    name: 'Sample Restaurant',
    address: '123 Main St',
    rating: 4.5,
    distance: 0.5,
    coordinates: { lat: 40.7128, lng: -74.0060 },
    phone: '+1-555-0123',
    website: 'https://example.com',
    hours: {
      monday: '9:00 AM - 10:00 PM',
      tuesday: '9:00 AM - 10:00 PM',
      wednesday: '9:00 AM - 10:00 PM',
      thursday: '9:00 AM - 10:00 PM',
      friday: '9:00 AM - 11:00 PM',
      saturday: '9:00 AM - 11:00 PM',
      sunday: '10:00 AM - 9:00 PM'
    },
    photos: [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
      'https://example.com/photo3.jpg'
    ],
    reviews: [
      {
        id: 'review-1',
        user: 'John Doe',
        rating: 5,
        comment: 'Great place!',
        date: '2024-01-15'
      },
      {
        id: 'review-2',
        user: 'Jane Smith',
        rating: 4,
        comment: 'Good food, friendly staff',
        date: '2024-01-10'
      }
    ],
    categories: ['Restaurant', 'Food', 'American'],
    priceRange: '$$',
    timestamp: new Date().toISOString()
  };
  
  return c.json({
    success: true,
    place
  });
});

// User profile endpoint
app.get('/api/user/profile', (c) => {
  // Mock user profile
  const user = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-0123',
    avatar: 'https://example.com/avatar.jpg',
    preferences: {
      language: 'en',
      currency: 'USD',
      notifications: true
    },
    stats: {
      trips: 25,
      reviews: 12,
      favorites: 8
    },
    timestamp: new Date().toISOString()
  };
  
  return c.json({
    success: true,
    user
  });
});

// Trip endpoints
app.get('/api/trips', (c) => {
  // Mock trips
  const trips = [
    {
      id: 'trip-1',
      name: 'Weekend Getaway',
      destination: 'New York City',
      startDate: '2024-02-15',
      endDate: '2024-02-17',
      status: 'completed',
      places: [
        { id: 'place-1', name: 'Central Park' },
        { id: 'place-2', name: 'Times Square' }
      ]
    },
    {
      id: 'trip-2',
      name: 'Business Trip',
      destination: 'San Francisco',
      startDate: '2024-03-01',
      endDate: '2024-03-03',
      status: 'upcoming',
      places: [
        { id: 'place-3', name: 'Golden Gate Bridge' }
      ]
    }
  ];
  
  return c.json({
    success: true,
    trips,
    total: trips.length
  });
});

app.post('/api/trips', async (c) => {
  const body = await c.req.json();
  
  // Mock trip creation
  const trip = {
    id: 'trip-new',
    name: body.name,
    destination: body.destination,
    startDate: body.startDate,
    endDate: body.endDate,
    status: 'planned',
    places: body.places || [],
    createdAt: new Date().toISOString()
  };
  
  return c.json({
    success: true,
    trip,
    message: 'Trip created successfully'
  });
});

// Admin endpoints
app.get('/admin/stats', (c) => {
  // Mock admin stats
  const stats = {
    users: 1250,
    trips: 3420,
    places: 856,
    reviews: 1234,
    activeConnections: rateLimitMap.size,
    rateLimitStats: {
      activeWindows: rateLimitMap.size,
      totalEntries: Array.from(rateLimitMap.values()).reduce((sum, requests) => sum + requests.length, 0)
    },
    timestamp: new Date().toISOString()
  };
  
  return c.json({
    success: true,
    stats
  });
});

app.get('/admin/rate-limit-stats', (c) => {
  const stats = {
    activeWindows: rateLimitMap.size,
    totalEntries: Array.from(rateLimitMap.values()).reduce((sum, requests) => sum + requests.length, 0),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  };
  
  return c.json(stats);
});

// Test endpoints
app.get('/cors-test', (c) => {
  const origin = c.req.header('Origin');
  return c.json({
    message: 'CORS test successful',
    origin: origin,
    allowed: true,
    timestamp: new Date().toISOString(),
    rateLimit: c.res.headers.get('X-RateLimit-Remaining')
  });
});

app.get('/rate-limit-test', (c) => {
  return c.json({
    message: 'Rate limit test endpoint',
    timestamp: new Date().toISOString(),
    rateLimit: {
      limit: c.res.headers.get('X-RateLimit-Limit'),
      remaining: c.res.headers.get('X-RateLimit-Remaining'),
      reset: c.res.headers.get('X-RateLimit-Reset')
    }
  });
});

// Error handling
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: c.req.path,
    method: c.req.method,
    timestamp: new Date().toISOString()
  }, 404);
});

app.onError((err, c) => {
  console.error('🚨 Server Error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  }, 500);
});

// Export for use in cluster server
module.exports = { app };

// For direct running
if (require.main === module) {
  const port = process.env.PORT || 3006;
  console.log(`🚀 Starting server on port ${port}`);
  
  serve({
    fetch: app.fetch,
    port: port,
  }, (info) => {
    console.log(`✅ Server serving on http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`🔧 API endpoints: http://localhost:${port}/api/`);
  });
}
