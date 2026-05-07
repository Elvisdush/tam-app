/**
 * Test script for secure server
 */

const http = require('http');

async function testSecureServer() {
  console.log('🧪 Testing Secure API Server...');
  
  try {
    // Test health endpoint
    const healthResponse = await makeRequest('GET', 'http://localhost:3010/health');
    console.log('✅ Health check:', healthResponse);
    
    // Test security endpoint
    const securityResponse = await makeRequest('GET', 'http://localhost:3010/api/security/test');
    console.log('✅ Security test:', securityResponse);
    
    // Test login endpoint
    const loginResponse = await makeRequest('POST', 'http://localhost:3010/api/auth/login', {
      email: 'user@tam.com',
      password: 'user123'
    });
    console.log('✅ Login test:', loginResponse);
    
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

testSecureServer();
