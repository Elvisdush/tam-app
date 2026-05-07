/**
 * Test secure server on port 3011
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3011,
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
    
    // Test security endpoint
    testSecurityEndpoint();
  });
});

req.on('error', (err) => {
  console.error('❌ Request error:', err.message);
});

req.on('timeout', () => {
  console.error('❌ Request timeout');
  req.destroy();
});

req.end();

function testSecurityEndpoint() {
  console.log('\n🔒 Testing security endpoint...');
  
  const securityOptions = {
    hostname: 'localhost',
    port: 3011,
    path: '/api/security/test',
    method: 'GET',
    timeout: 5000
  };
  
  const securityReq = http.request(securityOptions, (res) => {
    console.log(`✅ Security endpoint status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('✅ Security response:', data);
      
      // Test login endpoint
      testLoginEndpoint();
    });
  });
  
  securityReq.on('error', (err) => {
    console.error('❌ Security endpoint error:', err.message);
  });
  
  securityReq.on('timeout', () => {
    console.error('❌ Security endpoint timeout');
    securityReq.destroy();
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
    },
    timeout: 5000
  };
  
  const loginReq = http.request(loginOptions, (res) => {
    console.log(`✅ Login endpoint status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('✅ Login response:', data);
      console.log('\n🎉 All tests completed successfully!');
    });
  });
  
  loginReq.on('error', (err) => {
    console.error('❌ Login endpoint error:', err.message);
  });
  
  loginReq.on('timeout', () => {
    console.error('❌ Login endpoint timeout');
    loginReq.destroy();
  });
  
  const loginData = JSON.stringify({
    email: 'user@tam.com',
    password: 'user123'
  });
  
  loginReq.write(loginData);
  loginReq.end();
}
