/**
 * Clustered Hono API with Redis Rate Limiting
 * Production-ready load balancing implementation
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const cluster = require('cluster');
const os = require('os');
const { serve } = require('@hono/node-server');
const app = require('./hono.ts').default;
const { createRateLimit, createTrustedRateLimit } = require('./middleware/rate-limit');

const numCPUs = os.cpus().length;
const PORT = process.env.PORT || 3005;

if (cluster.isMaster) {
  console.log(`🚀 Starting cluster with ${numCPUs} workers`);
  console.log(`🔒 CORS configuration: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💻 Available CPU cores: ${numCPUs}`);
  console.log(`📊 Using Redis for distributed rate limiting`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    console.log(`🔧 Forked worker ${i + 1}/${numCPUs} (PID: ${worker.process.pid})`);
  }

  // Handle worker deaths and restart
  cluster.on('exit', (worker, code, signal) => {
    console.log(`⚠️  Worker ${worker.process.pid} died (code: ${code}, signal: ${signal})`);
    console.log(`🔄 Restarting worker...`);
    
    // Fork a new worker to replace dead one
    cluster.fork();
  });

  // Handle worker online events
  cluster.on('online', (worker) => {
    console.log(`✅ Worker ${worker.process.pid} is online`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('🛑 Master received SIGINT, shutting down gracefully');
    for (const id in cluster.workers) {
      cluster.workers[id].process.kill('SIGTERM');
    }
    process.exit(0);
  });

} else {
  // Worker process - run actual server with Redis rate limiting
  console.log(`🏃 Worker ${process.pid} starting server on port ${PORT}`);
  
  const server = serve(
    {
      fetch: app.fetch,
      port: PORT,
    },
    (info) => {
      const p = info.port;
      console.log(`✅ Worker ${process.pid} serving on http://localhost:${p}`);
      console.log(`📊 Health check: http://localhost:${p}/health`);
      console.log(`🔥 Redis rate limiting enabled`);
    }
  );

  // Apply middleware
  app.use("*", createTrustedRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000, // Increased for production
  }));
  
  // Apply Redis-based rate limiting for sensitive endpoints
  app.use("/api/otp/*", createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // Strict OTP limits
    message: 'Too many OTP attempts, please try again later.',
  }));

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use (EADDRINUSE).`);
      console.error('   • Stop the other server, or use another port');
      console.error(`   • Set PORT environment variable: $env:PORT=3006&& npm run server\n`);
      process.exit(1);
    }
    throw err;
  });

  // Handle worker-specific signals
  process.on('SIGTERM', () => {
    console.log(`🛑 Worker ${process.pid} received SIGTERM, shutting down`);
    server.close(() => {
      process.exit(0);
    });
  });
}
