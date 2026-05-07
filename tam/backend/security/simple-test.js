/**
 * Simple test to check if server is running
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3010,
  path: '/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  console.log(`✅ Server responded with status: ${res.statusCode}`);
  console.log('✅ Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('✅ Response body:', data);
  });
});

req.on('error', (err) => {
  console.error('❌ Request error:', err.message);
  console.log('💡 Server might not be running on port 3010');
});

req.on('timeout', () => {
  console.error('❌ Request timeout');
  req.destroy();
});

req.end();
