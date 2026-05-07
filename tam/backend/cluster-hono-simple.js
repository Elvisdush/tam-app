/**
 * Simple Cluster Hono API Server
 * Production-ready load balancing implementation
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const cluster = require('cluster');
const os = require('os');
const { serve } = require('@hono/node-server');
const { app } = require('./hono.js');

const numCPUs = os.cpus().length;
const PORT = process.env.PORT || 3006;

if (cluster.isMaster) {
  console.log(`🚀 Starting cluster with ${numCPUs} workers`);
  console.log(`🔒 CORS configuration: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💻 Available CPU cores: ${numCPUs}`);
  console.log(`📊 Using simple in-memory rate limiting`);

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
  // Worker process
  const workerId = cluster.worker.id;
  
  console.log(`🏃 Worker ${workerId} starting server on port ${PORT}`);

  try {
    const server = serve({
      fetch: app.fetch,
      port: PORT,
      hostname: 'localhost'
    }, (info) => {
      console.log(`✅ Worker ${workerId} serving on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔧 API endpoints: http://localhost:${PORT}/api/`);
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use (EADDRINUSE).`);
        console.error('   • Stop the other server, or use another port');
        console.error(`   • Set PORT environment variable: $env:PORT=3007&& npm run server:cluster:dev\n`);
      } else {
        console.error('❌ Server error:', err);
      }
    });

    // Handle master messages
    process.on('message', (msg) => {
      if (msg.type === 'SHUTDOWN') {
        console.log(`🛑 Worker ${workerId} shutting down gracefully...`);
        server.close(() => {
          process.exit(0);
        });
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}
