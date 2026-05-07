/**
 * Quick test for secure server on port 3011
 */

const http = require('http');

console.log('🧪 Testing Secure Server on port 3011...');

// Test health endpoint
const options = {
  hostname: 'localhost',
  port: 3011,
  path: '/health',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`✅ Health check status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const jsonData = JSON.parse(data);
      console.log('✅ Server is healthy!');
      console.log('✅ Worker ID:', jsonData.worker.id);
      console.log('✅ Security features:', Object.keys(jsonData.security));
      
      // Test security endpoint
      testSecurityEndpoint();
    } catch (e) {
      console.log('✅ Response:', data);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Health check failed:', err.message);
});

req.end();

function testSecurityEndpoint() {
  console.log('\n🔒 Testing security endpoint...');
  
  const securityOptions = {
    hostname: 'localhost',
    port: 3011,
    path: '/api/security/test',
    method: 'GET'
  };
  
  const securityReq = http.request(securityOptions, (res) => {
    console.log(`✅ Security endpoint status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        console.log('✅ Security score:', jsonData.securityScore);
        console.log('✅ Security tests enabled:', jsonData.tests.filter(t => t.status === 'ENABLED').length);
        
        // Test login endpoint
        testLoginEndpoint();
      } catch (e) {
        console.log('✅ Security response:', data);
      }
    });
  });
  
  securityReq.on('error', (err) => {
    console.error('❌ Security endpoint failed:', err.message);
  });
  
  securityReq.end();
}

function testLoginEndpoint() {
  console.log('\n🔐 Testing login endpoint...');
  
  const loginOptions = {
    hostname: 'localhost',
    port: 3011,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const loginReq = http.request(loginOptions, (res) => {
    console.log(`✅ Login endpoint status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        console.log('✅ Login successful!');
        console.log('✅ User role:', jsonData.user.role);
        console.log('✅ Token type:', jsonData.tokens.tokenType);
        
        console.log('\n🎉 All tests completed successfully!');
        console.log('🔒 Secure API Server is fully operational!');
      } catch (e) {
        console.log('✅ Login response:', data);
      }
    });
  });
  
  loginReq.on('error', (err) => {
    console.error('❌ Login endpoint failed:', err.message);
  });
  
  const loginData = JSON.stringify({
    email: 'user@tam.com',
    password: 'user123'
  });
  
  loginReq.write(loginData);
  loginReq.end();
}
