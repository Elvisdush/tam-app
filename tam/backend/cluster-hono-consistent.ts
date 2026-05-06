/**
 * Clustered Hono API with Consistent Hashing
 * Advanced load balancing with cache affinity
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const cluster = require('cluster');
const os = require('os');
const { serve } = require('@hono/node-server');
const app = require('./hono.ts').default;
const { createRateLimit, createTrustedRateLimit } = require('./middleware/rate-limit');
const { createConsistentHashLoadBalancer } = require('./load-balancing/consistent-hashing');

const numCPUs = os.cpus().length;
const PORT = process.env.PORT || 3007;

// Initialize consistent hashing load balancer
const loadBalancer = createConsistentHashLoadBalancer(numCPUs);

if (cluster.isMaster) {
  console.log(`🚀 Starting cluster with ${numCPUs} workers (Consistent Hashing)`);
  console.log(`🔒 CORS configuration: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💻 Available CPU cores: ${numCPUs}`);
  console.log(`🔗 Using consistent hashing for load distribution`);
  console.log(`📊 Using Redis for distributed rate limiting`);

  // Fork workers with consistent hashing
  const workers = [];
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    
    worker.on('online', () => {
      console.log(`✅ Worker ${i} is online (PID: ${worker.process.pid})`);
      
      // Add worker to load balancer
      loadBalancer.addWorker(i, worker.process.pid);
    });

    worker.on('message', (msg: any) => {
      if (msg.type === 'REQUEST_STATS') {
        // Handle worker statistics
        handleWorkerStats(i, msg.data);
      }
    });

    worker.on('exit', (code, signal) => {
      console.log(`⚠️  Worker ${i} died (code: ${code}, signal: ${signal})`);
      
      // Remove from load balancer
      loadBalancer.removeWorker(i);
      
      // Restart worker
      console.log(`🔄 Restarting worker...`);
      const newWorker = cluster.fork();
      
      newWorker.on('online', () => {
        console.log(`✅ Worker ${newWorker.id} is online (PID: ${newWorker.process.pid})`);
        loadBalancer.addWorker(newWorker.id, newWorker.process.pid);
      });
    });

    workers.push(worker);
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Master received SIGINT, shutting down gracefully...');
    
    workers.forEach(worker => {
      worker.send({ type: 'SHUTDOWN' });
    });
    
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  });

  // Load balancer statistics monitoring
  setInterval(() => {
    const stats = loadBalancer.getHashRingStats();
    console.log(`📊 Load Balancer Stats:`, {
      activeWorkers: stats.activeWorkers,
      virtualNodes: stats.totalVirtualNodes,
      balanceScore: (stats.balanceScore * 100).toFixed(2) + '%'
    });
  }, 30000); // Every 30 seconds

} else {
  // Worker process
  const workerId = cluster.worker.id;
  
  console.log(`🏃 Worker ${workerId} starting server on port ${PORT}`);
  console.log(`🔗 Worker ${workerId} assigned to hash ring position`);

  // Enhanced middleware with consistent hashing
  const consistentHashMiddleware = async (c, next) => {
    // Extract request information
    const method = c.req.method;
    const url = c.req.url;
    const userId = c.get('userId');
    const ip = c.req.header('x-forwarded-for') || 
           c.req.header('x-real-ip') || 
           c.env?.CF_CONNECTING_IP || 
           c.env?.VERCEL_IP || 
           'unknown';

    // Get optimal worker for this request
    const optimalWorker = loadBalancer.getOptimalWorker(
      method, 
      url, 
      userId, 
      ip, 
      true // Prefer cached routes
    );

    // Add routing headers for debugging
    c.header('X-Worker-Id', workerId.toString());
    c.header('X-Hash-Method', 'consistent');
    
    if (optimalWorker) {
      c.header('X-Optimal-Worker', optimalWorker.id.toString());
      c.header('X-Cache-Affinity', optimalWorker.id === workerId ? 'true' : 'false');
    }

    // Track request statistics
    trackRequest(workerId, method, url, userId, ip);

    await next();
  };

  // Apply middleware
  app.use("*", consistentHashMiddleware);
  app.use("*", createTrustedRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000, // Increased for production
  }));
  
  // Apply consistent hashing for sensitive endpoints
  app.use("/api/otp/*", createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // Strict OTP limits
    message: 'Too many OTP attempts, please try again later.',
    keyGenerator: (c) => {
      const userId = c.get('userId') || c.req.header('x-forwarded-for');
      return `otp:${userId}`;
    }
  }));

  app.use("/api/user/*", createRateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    maxRequests: 50, // User endpoints
    message: 'Too many user requests, please try again later.',
    keyGenerator: (c) => {
      const userId = c.get('userId');
      return `user:${userId}`;
    }
  }));

  app.use("/api/places/*", createRateLimit({
    windowMs: 2 * 60 * 1000, // 2 minutes
    maxRequests: 100, // Place queries
    message: 'Too many place requests, please try again later.',
    keyGenerator: (c) => {
      const { lat, lng } = c.req.query();
      // Round coordinates for better cache hits
      const roundedLat = Math.round(parseFloat(lat) * 100) / 100;
      const roundedLng = Math.round(parseFloat(lng) * 100) / 100;
      return `places:${roundedLat}:${roundedLng}`;
    }
  }));

  const server = serve({
    fetch: app.fetch,
    port: PORT,
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use (EADDRINUSE).`);
      console.error('   • Stop other server, or use another port');
      console.error(`   • Set PORT environment variable: $env:PORT=3008&& npm run server\n`);
    } else {
      console.error('❌ Server error:', err);
    }
  });

  console.log(`✅ Worker ${workerId} serving on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔥 Consistent hashing enabled with cache affinity`);

  // Health check endpoint with load balancer info
  app.get('/health', (c) => {
    const stats = loadBalancer.getHashRingStats();
    
    return c.json({
      status: 'healthy',
      worker: {
        id: workerId,
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        loadBalancing: {
          method: 'consistent-hashing',
          hashRingSize: stats.totalVirtualNodes,
          activeWorkers: stats.activeWorkers,
          balanceScore: stats.balanceScore,
          optimalWorker: loadBalancer.getOptimalWorker('GET', '/health')?.id
        }
      },
      timestamp: new Date().toISOString()
    });
  });

  // Load balancer statistics endpoint
  app.get('/load-balancer-stats', (c) => {
    const stats = loadBalancer.getHashRingStats();
    const distribution = loadBalancer.getLoadDistribution();
    
    return c.json({
      loadBalancing: {
        method: 'consistent-hashing',
        virtualNodes: stats.totalVirtualNodes,
        activeWorkers: stats.activeWorkers,
        balanceScore: stats.balanceScore,
        distribution: Object.fromEntries(distribution)
      },
      workers: Array.from(loadBalancer.getLoadDistribution().entries()).map(([id, load]) => ({
        id,
        load,
        percentage: ((load / stats.totalVirtualNodes) * 100).toFixed(2)
      })),
      timestamp: new Date().toISOString()
    });
  });

  // Test endpoint to demonstrate consistent hashing
  app.get('/test-consistent-hashing', (c) => {
    const { key = 'test', count = 10 } = c.req.query();
    
    const results = [];
    for (let i = 0; i < parseInt(count); i++) {
      const testKey = `${key}-${i}`;
      const worker = loadBalancer.getWorkerForKey(testKey);
      results.push({
        key: testKey,
        workerId: worker?.id,
        workerHash: worker?.hash
      });
    }
    
    return c.json({
      test: 'consistent-hashing',
      results,
      distribution: loadBalancer.getLoadDistribution(),
      hashRingStats: loadBalancer.getHashRingStats()
    });
  });

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

// Request tracking for statistics
const requestStats = new Map();

function trackRequest(workerId, method, url, userId, ip) {
  const key = `${workerId}:${method}:${url.split('?')[0]}`;
  const current = requestStats.get(key) || { count: 0, lastSeen: Date.now() };
  
  current.count++;
  current.lastSeen = Date.now();
  
  requestStats.set(key, current);
  
  // Send stats to master periodically
  if (current.count % 100 === 0) {
    process.send?.({
      type: 'REQUEST_STATS',
      data: {
        workerId,
        method,
        url,
        userId,
        ip,
        count: current.count,
        timestamp: current.lastSeen
      }
    });
  }
}

function handleWorkerStats(workerId, stats) {
  // Log worker statistics for monitoring
  console.log(`📈 Worker ${workerId} stats:`, {
    method: stats.method,
    url: stats.url,
    count: stats.count,
    userId: stats.userId
  });
}
