/**
 * Simple Server for CORS Testing
 * Runs the Hono app with CORS configuration
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const app = require('./hono.ts').default;
const port = process.env.PORT || 3000;

console.log(`🚀 Starting server on port ${port}`);
console.log(`🔒 CORS configuration: ${process.env.NODE_ENV || 'development'}`);
console.log(`🌐 Server will be available at: http://localhost:${port}`);
console.log(`🧪 Test CORS with: npm run cors:test`);

app.listen({ port }, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🔍 CORS test: http://localhost:${port}/cors-test`);
});
