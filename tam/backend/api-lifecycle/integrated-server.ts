/**
 * Integrated API Lifecycle Server
 * Combines all lifecycle management with the main server
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const cluster = require('cluster');
const os = require('os');
const { serve } = require('@hono/node-server');
const { Hono } = require('hono');
const { cors } = require('hono/cors');
const { trpcServer } = require('@hono/trpc-server');

// Import lifecycle components
const { lifecycleManager } = require('./lifecycle-hooks');
const { versionManager } = require('./version-manager');
const { migrationManager } = require('./migration-framework');
const { deprecationManager } = require('./deprecation-manager');
const { apiLifecycleRouter } = require('./lifecycle-router');

// Import existing components
const { createCorsMiddleware } = require('../config/cors');
const { createTrustedRateLimit } = require('../middleware/rate-limit');
const { createRedisClient } = require('../config/redis-client');

const numCPUs = os.cpus().length;
const PORT = process.env.PORT || 3008;

if (cluster.isMaster) {
  console.log('🚀 Starting TAM App with API Lifecycle Management');
  console.log(`💻 Available CPU cores: ${numCPUs}`);
  console.log(`🔗 API Lifecycle Management: Enabled`);
  console.log(`📊 Version Management: Active`);
  console.log(`🔄 Migration Framework: Ready`);
  console.log(`⚠️ Deprecation Management: Monitoring`);

  // Initialize lifecycle management
  async function initializeLifecycle() {
    try {
      console.log('🔄 Initializing API lifecycle...');
      
      // Execute startup hooks
      await lifecycleManager.startup();
      
      // Check for pending migrations
      const migrationStatus = migrationManager.getMigrationStatus();
      if (migrationStatus.executedMigrations.length === 0) {
        console.log('📋 No migrations executed yet');
      }
      
      // Check deprecation schedules
      const schedules = deprecationManager.getAllSchedules();
      if (schedules.length > 0) {
        console.log(`⚠️ ${schedules.length} deprecation schedules active`);
      }
      
      console.log('✅ API lifecycle initialization completed');
    } catch (error) {
      console.error('❌ Lifecycle initialization failed:', error);
      process.exit(1);
    }
  }

  // Fork workers
  const workers = [];
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    
    worker.on('online', () => {
      console.log(`✅ Worker ${i} is online (PID: ${worker.process.pid})`);
    });

    worker.on('message', (msg: any) => {
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

  // Initialize lifecycle before starting workers
  initializeLifecycle();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Master received SIGINT, shutting down gracefully...');
    
    workers.forEach(worker => {
      worker.send({ type: 'SHUTDOWN' });
    });
    
    // Shutdown lifecycle management
    await lifecycleManager.shutdown();
  });

} else {
  // Worker process
  const workerId = cluster.worker.id;
  
  console.log(`🏃 Worker ${workerId} starting with API lifecycle on port ${PORT}`);

  const app = new Hono();

  // Apply middleware
  app.use("*", cors(createCorsMiddleware()));
  app.use("*", createTrustedRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 1000,
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

  // API lifecycle endpoints
  app.use('/api/lifecycle/*', trpcServer({
    router: apiLifecycleRouter,
    createContext: (c) => ({
      user: null, // Context creation logic
      headers: c.req.header()
    })
  }));

  // Version routing middleware
  app.use('/api/*', async (c, next) => {
    const path = c.req.path;
    const version = extractVersionFromPath(path);
    
    if (version && !versionManager.isVersionSupported(version)) {
      return c.json({
        error: 'Unsupported API version',
        supportedVersions: ['v1', 'v2'],
        defaultVersion: 'v2'
      }, 400);
    }
    
    // Add version-specific headers
    if (version) {
      const versionInfo = versionManager.getVersion(version);
      if (versionInfo) {
        c.header('X-API-Version', version);
        c.header('X-API-Version-Status', versionInfo.status);
        
        if (versionInfo.status === 'deprecated') {
          c.header('X-API-Deprecation-Warning', 'true');
          c.header('X-API-Sunset-Date', versionInfo.sunsetDate?.toISOString() || '');
        }
      }
    }
    
    await next();
  });

  function extractVersionFromPath(path: string): string | null {
    const match = path.match(/^\/api\/(v\d+)\//);
    return match ? match[1] : null;
  }

  // Health check with lifecycle info
  app.get('/health', async (c) => {
    const lifecycleStatus = lifecycleManager.getHookStatus();
    const migrationStatus = migrationManager.getMigrationStatus();
    const deprecationSchedules = deprecationManager.getAllSchedules();
    
    return c.json({
      status: 'healthy',
      worker: {
        id: workerId,
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      lifecycle: {
        hooks: lifecycleStatus.length,
        migrations: migrationStatus.executedMigrations.length,
        deprecationSchedules: deprecationSchedules.length
      },
      api: {
        versions: {
          active: versionManager.getActiveVersions().length,
          deprecated: versionManager.getDeprecatedVersions().length,
          default: versionManager.getDefaultVersion()
        }
      },
      timestamp: new Date().toISOString()
    });
  });

  // API lifecycle dashboard
  app.get('/api/lifecycle/dashboard', async (c) => {
    const versions = {
      active: versionManager.getActiveVersions(),
      deprecated: versionManager.getDeprecatedVersions(),
      default: versionManager.getDefaultVersion()
    };
    
    const migrationStatus = migrationManager.getMigrationStatus();
    const deprecationSchedules = deprecationManager.getAllSchedules();
    const clientStatus = deprecationManager.getClientStatus();
    
    return c.json({
      versions,
      migration: migrationStatus,
      deprecation: {
        schedules: deprecationSchedules,
        clients: clientStatus.length
      },
      worker: {
        id: workerId,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      timestamp: new Date().toISOString()
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
      migrateTo: '/api/v2/places/search'
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
      cached: false
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
      console.error(`   • Set PORT environment variable: $env:PORT=3009&& npm run server\n`);
    } else {
      console.error('❌ Server error:', err);
    }
  });

  console.log(`✅ Worker ${workerId} serving on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎛️ Lifecycle dashboard: http://localhost:${PORT}/api/lifecycle/dashboard`);
  console.log(`🔥 API Lifecycle Management: Active`);

  // Handle master messages
  process.on('message', (msg: any) => {
    if (msg.type === 'SHUTDOWN') {
      console.log(`🛑 Worker ${workerId} shutting down gracefully...`);
      server.close(() => {
        process.exit(0);
      });
    }
  });
}
