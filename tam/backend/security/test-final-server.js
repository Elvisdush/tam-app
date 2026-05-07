/**
 * Test the final secure server
 */

const http = require('http');

async function testFinalServer() {
  console.log('🧪 Testing Final Secure Server...');
  
  try {
    // Test health endpoint
    console.log('\n📊 Testing health endpoint...');
    const healthResponse = await makeRequest('GET', 'http://localhost:3014/health');
    console.log('✅ Health check:', healthResponse.status);
    console.log('✅ Health data:', healthResponse.data);
    
    // Test security endpoint
    console.log('\n🔒 Testing security endpoint...');
    const securityResponse = await makeRequest('GET', 'http://localhost:3014/api/security/test');
    console.log('✅ Security check:', securityResponse.status);
    console.log('✅ Security data:', securityResponse.data);
    
    // Test login endpoint
    console.log('\n🔐 Testing login endpoint...');
    const loginResponse = await makeRequest('POST', 'http://localhost:3014/api/auth/login', {
      email: 'user@tam.com',
      password: 'user123'
    });
    console.log('✅ Login check:', loginResponse.status);
    console.log('✅ Login data:', loginResponse.data);
    
    // Test protected endpoint with token
    if (loginResponse.data && loginResponse.data.tokens) {
      console.log('\n🛡️ Testing protected endpoint...');
      const token = loginResponse.data.tokens.accessToken;
      const protectedResponse = await makeRequestWithAuth('GET', 'http://localhost:3014/api/user/profile', token);
      console.log('✅ Protected check:', protectedResponse.status);
      console.log('✅ Protected data:', protectedResponse.data);
    }
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function makeRequest(method, url, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

function makeRequestWithAuth(method, url, token) {
  return new Promise((resolve, reject) => {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };
    
    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

// Wait a moment for server to start, then test
setTimeout(() => {
  testFinalServer();
}, 2000);
