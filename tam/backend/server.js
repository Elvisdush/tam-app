/**
 * Hono API entry for Node.js.
 * Run from repo root: npm run server  (uses tsx to load TypeScript)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { serve } = require('@hono/node-server');
const app = require('./hono.ts').default;
const PORT = process.env.PORT || 3005;

console.log(`🚀 Starting server on port ${PORT}`);
console.log(`🔒 CORS configuration: ${process.env.NODE_ENV || 'development'}`);
console.log(`🌐 Server will be available at: http://localhost:${PORT}`);
console.log(`🧪 Test CORS with: npm run cors:test`);

const server = serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    const p = info.port;
    console.log(`✅ Server running on http://localhost:${p}`);
    console.log(`📊 Health check: http://localhost:${p}/health`);
    console.log(`🔍 CORS test: http://localhost:${p}/cors-test`);
  }
);

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${port} is already in use (EADDRINUSE).`);
    console.error('   • Stop the other server (Ctrl+C in its terminal), or close the app using that port.');
    console.error('   • Or use another port, e.g. PowerShell:  $env:PORT=3001; npm run server');
    console.error('                            cmd.exe:       set PORT=3001&& npm run server\n');
    process.exit(1);
  }
  throw err;
});
