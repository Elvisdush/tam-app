/**
 * Simple API Lifecycle Server
 * Basic implementation for testing lifecycle management
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const cluster = require('cluster');
const os = require('os');
const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const { cors } = require('hono/cors');

const numCPUs = os.cpus().length;
const PORT = process.env.PORT || 3009;

if (cluster.isMaster) {
  console.log('🚀 Starting TAM App with Simple API Lifecycle Management');
  console.log(`💻 Available CPU cores: ${numCPUs}`);
  console.log(`🔗 API Lifecycle Management: Enabled`);
  console.log(`📊 Version Management: Active`);
  console.log(`🔄 Migration Framework: Ready`);
  console.log(`⚠️ Deprecation Management: Monitoring`);

  // Fork workers
  const workers = [];
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    
    worker.on('online', () => {
      console.log(`✅ Worker ${i} is online (PID: ${worker.process.pid})`);
    });

    worker.on('message', (msg) => {
      if (msg.type === 'LIFECYCLE_EVENT') {
        console.log(`📡 Worker ${i} lifecycle event:`, msg.event);
      }
    });

    worker.on('exit', (code, signal) => {
      console.log(`⚠️  Worker ${i} died (code: ${code}, signal: ${signal})`);
      
      // Restart worker
      console.log(`🔄 Restarting worker...`);
      const newWorker = cluster.fork();
      
      newWorker.on('online', () => {
        console.log(`✅ Worker ${newWorker.id} is online (PID: ${newWorker.process.pid})`);
      });
    });

    workers.push(worker);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Master received SIGINT, shutting down gracefully...');
    
    workers.forEach(worker => {
      worker.send({ type: 'SHUTDOWN' });
    });
    
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  });

} else {
  // Worker process
  const workerId = cluster.worker.id;
  
  console.log(`🏃 Worker ${workerId} starting with Simple API Lifecycle on port ${PORT}`);

  const app = new Hono();

  // Apply CORS middleware
  app.use("*", cors({
    origin: ['http://localhost:3000', 'http://localhost:19006', 'exp://192.168.1.100:8081'],
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Version']
  }));

  // API lifecycle middleware
  app.use("*", async (c, next) => {
    // Add lifecycle headers
    c.header('X-API-Lifecycle-Version', '2.0.0');
    c.header('X-API-Version-Supported', 'v1,v2');
    c.header('X-API-Default-Version', 'v2');
    
    // Track API usage for analytics
    const startTime = Date.now();
    await next();
    const duration = Date.now() - startTime;
    
    // Log request for monitoring
    console.log(`📊 Request: ${c.req.method} ${c.req.url} - ${duration}ms`);
  });

  // Version routing middleware
  app.use('/api/*', async (c, next) => {
    const path = c.req.path;
    const version = extractVersionFromPath(path);
    
    if (version && !isVersionSupported(version)) {
      return c.json({
        error: 'Unsupported API version',
        supportedVersions: ['v1', 'v2'],
        defaultVersion: 'v2'
      }, 400);
    }
    
    // Add version-specific headers
    if (version) {
      c.header('X-API-Version', version);
      c.header('X-API-Version-Status', getVersionStatus(version));
      
      if (getVersionStatus(version) === 'deprecated') {
        c.header('X-API-Deprecation-Warning', 'true');
        c.header('X-API-Sunset-Date', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString());
      }
    }
    
    await next();
  });

  function extractVersionFromPath(path) {
    const match = path.match(/^\/api\/(v\d+)\//);
    return match ? match[1] : null;
  }

  function isVersionSupported(version) {
    return ['v1', 'v2'].includes(version);
  }

  function getVersionStatus(version) {
    if (version === 'v1') return 'deprecated';
    if (version === 'v2') return 'active';
    return 'unknown';
  }

  // Health check with lifecycle info
  app.get('/health', async (c) => {
    return c.json({
      status: 'healthy',
      worker: {
        id: workerId,
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      lifecycle: {
        hooks: 6, // Number of lifecycle hooks
        migrations: 0, // No migrations executed yet
        deprecationSchedules: 1 // V1 deprecation schedule
      },
      api: {
        versions: {
          active: 1, // V2
          deprecated: 1, // V1
          default: 'v2'
        }
      },
      timestamp: new Date().toISOString()
    });
  });

  // API lifecycle dashboard
  app.get('/api/lifecycle/dashboard', async (c) => {
    return c.json({
      versions: {
        active: [{ version: 'v2', status: 'active', features: ['advanced_search', 'real_time_updates', 'analytics'] }],
        deprecated: [{ version: 'v1', status: 'deprecated', features: ['basic_search', 'user_auth'] }],
        default: 'v2'
      },
      migration: {
        isMigrating: false,
        executedMigrations: [],
        availableMigrations: {
          'v1': ['migrate_user_preferences', 'migrate_location_data', 'migrate_search_history']
        }
      },
      deprecation: {
        schedules: [{
          version: 'v1',
          deprecationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          sunsetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          retirementDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000)
        }],
        clients: 0
      },
      worker: {
        id: workerId,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      timestamp: new Date().toISOString()
    });
  });

  // Version Management Endpoints
  app.get('/api/lifecycle/versions', async (c) => {
    return c.json({
      active: [{ version: 'v2', status: 'active', features: ['advanced_search', 'real_time_updates', 'analytics'] }],
      deprecated: [{ version: 'v1', status: 'deprecated', features: ['basic_search', 'user_auth'] }],
      default: 'v2',
      supported: ['v1', 'v2']
    });
  });

  app.get('/api/lifecycle/versions/:version', async (c) => {
    const version = c.req.param('version');
    const versionInfo = getVersionInfo(version);
    
    if (!versionInfo) {
      return c.json({
        error: `Version ${version} not found`
      }, 404);
    }
    
    return c.json(versionInfo);
  });

  // Migration Management Endpoints
  app.get('/api/lifecycle/migrations/status', async (c) => {
    return c.json({
      isMigrating: false,
      executedMigrations: [],
      availableMigrations: {
        'v1': ['migrate_user_preferences', 'migrate_location_data', 'migrate_search_history']
      }
    });
  });

  app.get('/api/lifecycle/migrations/plan', async (c) => {
    const fromVersion = c.req.query('fromVersion') || 'v1';
    const toVersion = c.req.query('toVersion') || 'v2';
    
    return c.json({
      fromVersion,
      toVersion,
      steps: [
        {
          name: 'migrate_user_preferences',
          description: 'Migrate user preferences to new schema',
          estimatedTime: 30
        },
        {
          name: 'migrate_location_data',
          description: 'Migrate location data to new format',
          estimatedTime: 60
        },
        {
          name: 'migrate_search_history',
          description: 'Migrate search history to analytics format',
          estimatedTime: 45
        }
      ],
      estimatedTotalTime: 135,
      rollbackEnabled: true
    });
  });

  // Deprecation Management Endpoints
  app.get('/api/lifecycle/deprecation/schedules', async (c) => {
    return c.json([{
      version: 'v1',
      deprecationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sunsetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      retirementDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
      migrationGuide: '/docs/migration/v1-to-v2',
      affectedEndpoints: ['/api/v1/places/search', '/api/v1/users/profile', '/api/v1/locations/nearby'],
      alternativeEndpoints: {
        '/api/v1/places/search': '/api/v2/places/search',
        '/api/v1/users/profile': '/api/v2/users/profile',
        '/api/v1/locations/nearby': '/api/v2/locations/nearby'
      }
    }]);
  });

  app.post('/api/lifecycle/deprecation/register-client', async (c) => {
    const clientData = await c.req.json();
    
    console.log(`👤 Registered client: ${clientData.name} (${clientData.versions.join(', ')})`);
    
    return c.json({
      success: true,
      message: `Client ${clientData.name} registered successfully`
    });
  });

  // Version-specific API routes
  app.get('/api/v1/places/search', async (c) => {
    const { query, lat, lng } = c.req.query();
    
    // Legacy v1 implementation
    return c.json({
      version: 'v1',
      results: [],
      query: { query, lat, lng },
      deprecated: true,
      migrateTo: '/api/v2/places/search',
      warning: 'This API version is deprecated. Please migrate to v2.'
    });
  });

  app.get('/api/v2/places/search', async (c) => {
    const { query, lat, lng, radius = 1000 } = c.req.query();
    
    // Enhanced v2 implementation with caching
    return c.json({
      version: 'v2',
      results: [],
      query: { query, lat, lng, radius },
      enhanced: true,
      cached: false,
      features: ['advanced_search', 'real_time_updates', 'analytics']
    });
  });

  // Analytics endpoint
  app.get('/api/lifecycle/analytics/usage', async (c) => {
    return c.json({
      totalRequests: 0,
      requestsByVersion: {
        'v1': 0,
        'v2': 0
      },
      requestsByEndpoint: {},
      averageResponseTime: 0,
      errorRate: 0,
      timeRange: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      }
    });
  });

  // Start server
  const server = serve({
    fetch: app.fetch,
    port: PORT,
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use (EADDRINUSE).`);
      console.error('   • Stop other server, or use another port');
      console.error(`   • Set PORT environment variable: $env:PORT=3010&& npm run server\n`);
    } else {
      console.error('❌ Server error:', err);
    }
  });

  console.log(`✅ Worker ${workerId} serving on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎛️ Lifecycle dashboard: http://localhost:${PORT}/api/lifecycle/dashboard`);
  console.log(`🔥 API Lifecycle Management: Active`);

  // Handle master messages
  process.on('message', (msg) => {
    if (msg.type === 'SHUTDOWN') {
      console.log(`🛑 Worker ${workerId} shutting down gracefully...`);
      server.close(() => {
        process.exit(0);
      });
    }
  });
}

function getVersionInfo(version) {
  if (version === 'v1') {
    return {
      version: 'v1',
      status: 'deprecated',
      features: ['basic_search', 'user_auth', 'place_details'],
      deprecationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sunsetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    };
  }
  
  if (version === 'v2') {
    return {
      version: 'v2',
      status: 'active',
      features: ['advanced_search', 'real_time_updates', 'analytics', 'enhanced_location']
    };
  }
  
  return null;
}
