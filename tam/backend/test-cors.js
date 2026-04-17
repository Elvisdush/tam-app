/**
 * CORS Testing Script
 * Test various CORS scenarios to verify security configuration
 */

const testCases = [
  {
    name: 'Allowed Origin - Localhost',
    origin: 'http://localhost:8081',
    expected: 'allowed'
  },
  {
    name: 'Allowed Origin - 127.0.0.1',
    origin: 'http://127.0.0.1:8081',
    expected: 'allowed'
  },
  {
    name: 'Allowed Origin - Expo Go',
    origin: 'exp://192.168.1.74:8081',
    expected: 'allowed'
  },
  {
    name: 'Blocked Origin - Malicious Site',
    origin: 'https://malicious-site.com',
    expected: 'blocked'
  },
  {
    name: 'Blocked Origin - Unknown Domain',
    origin: 'https://unknown-domain.com',
    expected: 'blocked'
  },
  {
    name: 'No Origin - Mobile App',
    origin: null,
    expected: 'allowed'
  }
];

async function testCorsOrigin(origin) {
  try {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3005';
    const response = await fetch(`${baseUrl}/cors-test`, {
      method: 'GET',
      headers: origin ? { 'Origin': origin } : {}
    });

    const corsHeaders = {
      'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
      'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
      'access-control-allow-headers': response.headers.get('access-control-allow-headers'),
      'access-control-allow-credentials': response.headers.get('access-control-allow-credentials'),
    };

    const data = await response.json();

    return {
      status: response.status,
      corsHeaders,
      data,
      success: response.ok
    };
  } catch (error) {
    return {
      error: error.message,
      success: false
    };
  }
}

async function runCorsTests() {
  console.log('🔒 CORS Security Testing\n');
  console.log('Testing CORS configuration...\n');

  for (const test of testCases) {
    console.log(`📋 Test: ${test.name}`);
    console.log(`   Origin: ${test.origin || 'No-Origin'}`);
    console.log(`   Expected: ${test.expected}`);
    
    const result = await testCorsOrigin(test.origin);
    
    if (result.success) {
      const actualResult = result.corsHeaders['access-control-allow-origin'] ? 'allowed' : 'blocked';
      const status = actualResult === test.expected ? '✅ PASS' : '❌ FAIL';
      
      console.log(`   Actual: ${actualResult} ${status}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   CORS Headers:`, result.corsHeaders);
    } else {
      console.log(`   Error: ${result.error} ❌ FAIL`);
    }
    
    console.log('');
  }

  console.log('🛡️  Security Headers Test:');
  try {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3005';
    const response = await fetch(`${baseUrl}/health`);
    
    const securityHeaders = {
      'x-content-type-options': response.headers.get('x-content-type-options'),
      'x-frame-options': response.headers.get('x-frame-options'),
      'x-xss-protection': response.headers.get('x-xss-protection'),
      'referrer-policy': response.headers.get('referrer-policy'),
      'permissions-policy': response.headers.get('permissions-policy'),
      'x-api-version': response.headers.get('x-api-version'),
      'x-environment': response.headers.get('x-environment'),
    };

    console.log('   Security Headers:', securityHeaders);
    
    const securityChecks = [
      { header: 'x-content-type-options', expected: 'nosniff' },
      { header: 'x-frame-options', expected: 'DENY' },
      { header: 'x-xss-protection', expected: '1; mode=block' },
    ];

    securityChecks.forEach(check => {
      const actual = securityHeaders[check.header];
      const status = actual === check.expected ? '✅' : '❌';
      console.log(`   ${check.header}: ${actual} ${status}`);
    });
    
  } catch (error) {
    console.log(`   Error testing security headers: ${error.message}`);
  }

  console.log('\n🎯 CORS Testing Complete!');
  console.log('💡 Tips:');
  console.log('   - Update production origins in backend/config/cors.ts');
  console.log('   - Test with your actual Expo Go URL');
  console.log('   - Monitor logs for blocked origins in production');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runCorsTests().catch(console.error);
}

module.exports = { testCorsOrigin, runCorsTests, testCases };
