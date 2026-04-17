/**
 * Rate Limiting Test Suite
 * Tests various rate limiting scenarios and configurations
 */

const testCases = [
  {
    name: 'Global Rate Limit - Normal Usage',
    endpoint: '/cors-test',
    requests: 5,
    interval: 100,
    expected: 'all_success'
  },
  {
    name: 'Strict Rate Limit - Exceed Limit',
    endpoint: '/rate-limit-test',
    requests: 15,
    interval: 100,
    expected: 'rate_limited'
  },
  {
    name: 'Auth Rate Limit - Multiple Attempts',
    endpoint: '/cors-test', // Using auth-like endpoint
    requests: 10,
    interval: 100,
    expected: 'rate_limited'
  },
  {
    name: 'Burst Protection - Rapid Requests',
    endpoint: '/cors-test',
    requests: 50,
    interval: 10,
    expected: 'rate_limited'
  },
  {
    name: 'Window Reset - Wait and Retry',
    endpoint: '/rate-limit-test',
    requests: 15,
    interval: 100,
    waitTime: 20000, // Wait 20 seconds
    retryRequests: 5,
    expected: 'reset_success'
  }
];

async function makeRequest(baseUrl, endpoint, origin = 'http://localhost:8081') {
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Origin': origin,
        'User-Agent': 'Rate-Limit-Test/1.0'
      }
    });

    const headers = {
      'x-ratelimit-limit': response.headers.get('x-ratelimit-limit'),
      'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining'),
      'x-ratelimit-reset': response.headers.get('x-ratelimit-reset'),
      'x-ratelimit-window': response.headers.get('x-ratelimit-window'),
      'retry-after': response.headers.get('retry-after'),
    };

    const data = await response.json();

    return {
      status: response.status,
      headers,
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

async function runRateLimitTest(testCase) {
  console.log(`\n🧪 Test: ${testCase.name}`);
  console.log(`   Endpoint: ${testCase.endpoint}`);
  console.log(`   Requests: ${testCase.requests}`);
  console.log(`   Interval: ${testCase.interval}ms`);
  console.log(`   Expected: ${testCase.expected}`);

  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3005';
  const results = [];
  let rateLimitedCount = 0;
  let successCount = 0;

  // Initial burst of requests
  for (let i = 0; i < testCase.requests; i++) {
    const result = await makeRequest(baseUrl, testCase.endpoint);
    results.push(result);

    if (result.success) {
      successCount++;
    } else if (result.status === 429) {
      rateLimitedCount++;
    }

    console.log(`   Request ${i + 1}: ${result.status} - Remaining: ${result.headers['x-ratelimit-remaining'] || 'N/A'}`);

    // Wait between requests
    if (i < testCase.requests - 1 && testCase.interval > 0) {
      await new Promise(resolve => setTimeout(resolve, testCase.interval));
    }
  }

  // Wait for window reset if specified
  if (testCase.waitTime && testCase.retryRequests) {
    console.log(`   ⏳ Waiting ${testCase.waitTime / 1000} seconds for rate limit reset...`);
    await new Promise(resolve => setTimeout(resolve, testCase.waitTime));

    console.log(`   🔄 Retrying with ${testCase.retryRequests} requests...`);
    let retrySuccessCount = 0;

    for (let i = 0; i < testCase.retryRequests; i++) {
      const result = await makeRequest(baseUrl, testCase.endpoint);
      results.push(result);

      if (result.success) {
        retrySuccessCount++;
        successCount++;
      } else if (result.status === 429) {
        rateLimitedCount++;
      }

      console.log(`   Retry ${i + 1}: ${result.status} - Remaining: ${result.headers['x-ratelimit-remaining'] || 'N/A'}`);

      if (i < testCase.retryRequests - 1) {
        await new Promise(resolve => setTimeout(resolve, testCase.interval));
      }
    }
  }

  // Evaluate test results
  let status = '❌ UNKNOWN';
  if (testCase.expected === 'all_success' && rateLimitedCount === 0) {
    status = '✅ PASS';
  } else if (testCase.expected === 'rate_limited' && rateLimitedCount > 0) {
    status = '✅ PASS';
  } else if (testCase.expected === 'reset_success' && retrySuccessCount > 0) {
    status = '✅ PASS';
  } else {
    status = '❌ FAIL';
  }

  console.log(`   Results: ${successCount} success, ${rateLimitedCount} rate limited ${status}`);

  return {
    testCase: testCase.name,
    successCount,
    rateLimitedCount,
    status,
    results
  };
}

async function testRateLimitStats() {
  console.log('\n📊 Testing Rate Limit Statistics...');

  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3005';
  
  try {
    const response = await fetch(`${baseUrl}/admin/rate-limit-stats`);
    const stats = await response.json();

    console.log('   Rate Limit Statistics:');
    console.log(`   Total Entries: ${stats.totalEntries}`);
    console.log(`   Active Windows: ${stats.activeWindows}`);
    console.log(`   Top Consumers: ${stats.topConsumers.length}`);

    stats.topConsumers.slice(0, 5).forEach((consumer, index) => {
      console.log(`   ${index + 1}. ${consumer.key}: ${consumer.count} requests`);
    });

    return stats;
  } catch (error) {
    console.log(`   Error: ${error.message} ❌`);
    return null;
  }
}

async function testRateLimitReset() {
  console.log('\n🔄 Testing Rate Limit Reset...');

  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3005';
  
  try {
    // Get current stats
    const statsResponse = await fetch(`${baseUrl}/admin/rate-limit-stats`);
    const stats = await statsResponse.json();

    if (stats.topConsumers.length > 0) {
      const topConsumer = stats.topConsumers[0];
      
      // Reset specific rate limit
      const resetResponse = await fetch(`${baseUrl}/admin/reset-rate-limit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: topConsumer.key })
      });

      const resetResult = await resetResponse.json();
      console.log(`   Reset result: ${resetResult.message} ✅`);
      
      return resetResult;
    } else {
      console.log('   No active rate limits to reset');
      return null;
    }
  } catch (error) {
    console.log(`   Error: ${error.message} ❌`);
    return null;
  }
}

async function runAllRateLimitTests() {
  console.log('🚦 Rate Limiting Test Suite');
  console.log('================================');
  console.log('Testing comprehensive rate limiting functionality...\n');

  const results = [];

  // Run all test cases
  for (const testCase of testCases) {
    const result = await runRateLimitTest(testCase);
    results.push(result);
  }

  // Test statistics
  await testRateLimitStats();

  // Test reset functionality
  await testRateLimitReset();

  // Summary
  console.log('\n📋 Test Summary:');
  console.log('==================');
  
  const passedTests = results.filter(r => r.status === '✅ PASS').length;
  const totalTests = results.length;

  results.forEach(result => {
    console.log(`${result.status} ${result.testCase}`);
  });

  console.log(`\n🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log('🎉 All rate limiting tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check the configuration.');
  }

  console.log('\n💡 Rate Limiting Tips:');
  console.log('   - Monitor rate limit headers in production');
  console.log('   - Adjust limits based on traffic patterns');
  console.log('   - Use different limits for different user tiers');
  console.log('   - Implement proper authentication for admin endpoints');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllRateLimitTests().catch(console.error);
}

module.exports = { runRateLimitTest, testRateLimitStats, testRateLimitReset, runAllRateLimitTests };
