/**
 * Minimal test server to verify port binding
 */

const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Secure API Server is working!',
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method
  }));
});

const PORT = 3012;

server.listen(PORT, () => {
  console.log(`✅ Minimal test server running on http://localhost:${PORT}`);
  console.log('📊 Test: http://localhost:3012/health');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});

// Test the server after 1 second
setTimeout(() => {
  console.log('🧪 Testing server...');
  
  const testReq = http.request({
    hostname: 'localhost',
    port: PORT,
    path: '/health',
    method: 'GET'
  }, (res) => {
    console.log(`✅ Test successful! Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('✅ Response:', data);
      server.close();
    });
  });
  
  testReq.on('error', (err) => {
    console.error('❌ Test failed:', err.message);
    server.close();
  });
  
  testReq.end();
}, 1000);
