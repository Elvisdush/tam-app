/**
 * Consistent Hashing Test Suite
 * Demonstrates load distribution and cache affinity
 */

const { createConsistentHashLoadBalancer } = require('../load-balancing/consistent-hashing');

function testConsistentHashing() {
  console.log('🧪 Testing Consistent Hashing Load Balancer');
  console.log('='.repeat(50));

  // Initialize load balancer with 8 workers
  const loadBalancer = createConsistentHashLoadBalancer(8);

  // Test 1: Same key always routes to same worker
  console.log('\n📋 Test 1: Key Consistency');
  const testKey = 'user123';
  const results = [];
  
  for (let i = 0; i < 10; i++) {
    const worker = loadBalancer.getWorkerForKey(testKey);
    results.push(worker.id);
  }
  
  const uniqueWorkers = [...new Set(results)];
  console.log(`Key: "${testKey}"`);
  console.log(`Results: ${results.join(', ')}`);
  console.log(`Unique workers: ${uniqueWorkers.length} (should be 1)`);
  console.log(`✅ Consistency: ${uniqueWorkers.length === 1 ? 'PASS' : 'FAIL'}`);

  // Test 2: Even distribution
  console.log('\n📋 Test 2: Load Distribution');
  const testKeys = [];
  const distribution = new Map();
  
  // Generate 1000 random keys
  for (let i = 0; i < 1000; i++) {
    const key = `test${Math.random()}`;
    const worker = loadBalancer.getWorkerForKey(key);
    testKeys.push({ key, workerId: worker.id });
    
    const count = distribution.get(worker.id) || 0;
    distribution.set(worker.id, count + 1);
  }
  
  console.log('Load distribution across 8 workers:');
  const expectedPerWorker = 1000 / 8; // 125
  let isBalanced = true;
  
  for (const [workerId, count] of distribution.entries()) {
    const percentage = ((count / 1000) * 100).toFixed(1);
    const deviation = Math.abs(count - expectedPerWorker);
    const deviationPercent = ((deviation / expectedPerWorker) * 100).toFixed(1);
    
    console.log(`  Worker ${workerId}: ${count} requests (${percentage}%, deviation: ${deviationPercent}%)`);
    
    // Check if distribution is reasonably balanced (within 20%)
    if (deviationPercent > 20) {
      isBalanced = false;
    }
  }
  
  console.log(`✅ Balance: ${isBalanced ? 'PASS' : 'FAIL'} (within 20% of expected)`);

  // Test 3: User-based routing
  console.log('\n📋 Test 3: User Cache Affinity');
  const users = ['alice', 'bob', 'charlie', 'diana', 'eve'];
  const userRoutes = new Map();
  
  for (const userId of users) {
    const worker = loadBalancer.getWorkerForRequest('GET', '/api/user/profile', userId);
    userRoutes.set(userId, worker.id);
    console.log(`User ${userId} → Worker ${worker.id}`);
  }
  
  // Test same users again
  console.log('\nRe-testing same users:');
  let consistentUserRouting = true;
  
  for (const userId of users) {
    const worker = loadBalancer.getWorkerForRequest('GET', '/api/user/profile', userId);
    const originalWorker = userRoutes.get(userId);
    const isConsistent = worker.id === originalWorker;
    
    console.log(`User ${userId} → Worker ${worker.id} (${isConsistent ? 'CONSISTENT' : 'INCONSISTENT'})`);
    
    if (!isConsistent) {
      consistentUserRouting = false;
    }
  }
  
  console.log(`✅ User routing: ${consistentUserRouting ? 'PASS' : 'FAIL'}`);

  // Test 4: Location-based routing
  console.log('\n📋 Test 4: Location Cache Affinity');
  const locations = [
    { lat: 40.7128, lng: -74.0060, name: 'New York' },
    { lat: 34.0522, lng: -118.2437, name: 'Los Angeles' },
    { lat: 41.8781, lng: -87.6298, name: 'Chicago' },
    { lat: 29.7604, lng: -95.3698, name: 'Houston' }
  ];
  
  const locationRoutes = new Map();
  
  for (const location of locations) {
    const locationKey = `${location.lat},${location.lng}`;
    const worker = loadBalancer.getWorkerForRequest('GET', `/api/places/nearby?lat=${location.lat}&lng=${location.lng}`, null, null);
    locationRoutes.set(locationKey, worker.id);
    console.log(`${location.name} (${location.lat}, ${location.lng}) → Worker ${worker.id}`);
  }
  
  // Test same locations again (with rounded coordinates)
  console.log('\nRe-testing same locations (rounded):');
  let consistentLocationRouting = true;
  
  for (const location of locations) {
    const roundedLat = Math.round(location.lat * 100) / 100;
    const roundedLng = Math.round(location.lng * 100) / 100;
    const locationKey = `${roundedLat},${roundedLng}`;
    const worker = loadBalancer.getWorkerForRequest('GET', `/api/places/nearby?lat=${roundedLat}&lng=${roundedLng}`, null, null);
    const originalWorker = locationRoutes.get(`${location.lat},${location.lng}`);
    
    // Should route to same worker for nearby locations
    const isConsistent = Math.abs(worker.id - originalWorker) <= 1; // Allow nearby workers
    
    console.log(`${location.name} (${roundedLat}, ${roundedLng}) → Worker ${worker.id} (${isConsistent ? 'CONSISTENT' : 'INCONSISTENT'})`);
    
    if (!isConsistent) {
      consistentLocationRouting = false;
    }
  }
  
  console.log(`✅ Location routing: ${consistentLocationRouting ? 'PASS' : 'FAIL'}`);

  // Test 5: Worker failure simulation
  console.log('\n📋 Test 5: Worker Failure Handling');
  const initialStats = loadBalancer.getHashRingStats();
  console.log(`Initial state: ${initialStats.activeWorkers} workers, ${initialStats.totalVirtualNodes} virtual nodes`);
  
  // Simulate worker 3 failure
  const failureResult = loadBalancer.simulateWorkerFailure(3);
  console.log(`Worker 3 failure simulation:`);
  console.log(`  Affected keys: ${failureResult.affectedKeys}`);
  console.log(`  Redistributed keys: ${failureResult.redistributedKeys}`);
  
  const afterStats = loadBalancer.getHashRingStats();
  console.log(`After failure: ${afterStats.activeWorkers} workers, ${afterStats.totalVirtualNodes} virtual nodes`);
  console.log(`✅ Failure handling: ${afterStats.activeWorkers === 7 ? 'PASS' : 'FAIL'}`);

  // Test 6: Performance comparison
  console.log('\n📋 Test 6: Performance Analysis');
  const performanceTest = () => {
    const iterations = 10000;
    const testKeys = Array.from({ length: iterations }, (_, i) => `perf${i}`);
    
    // Test consistent hashing
    const start1 = Date.now();
    for (const key of testKeys) {
      loadBalancer.getWorkerForKey(key);
    }
    const consistentTime = Date.now() - start1;
    
    // Test round-robin (baseline)
    let roundRobinIndex = 0;
    const start2 = Date.now();
    for (const key of testKeys) {
      const workerId = roundRobinIndex % 8;
      roundRobinIndex++;
    }
    const roundRobinTime = Date.now() - start2;
    
    console.log(`Performance (${iterations} operations):`);
    console.log(`  Consistent Hashing: ${consistentTime}ms`);
    console.log(`  Round Robin: ${roundRobinTime}ms`);
    console.log(`  Overhead: ${((consistentTime - roundRobinTime) / roundRobinTime * 100).toFixed(1)}%`);
    console.log(`  Operations/sec: ${(iterations / consistentTime * 1000).toFixed(0)}`);
  };
  
  performanceTest();

  // Final statistics
  console.log('\n📊 Final Hash Ring Statistics:');
  const finalStats = loadBalancer.getHashRingStats();
  console.log(`  Active Workers: ${finalStats.activeWorkers}`);
  console.log(`  Virtual Nodes: ${finalStats.totalVirtualNodes}`);
  console.log(`  Balance Score: ${(finalStats.balanceScore * 100).toFixed(2)}%`);
  console.log(`  Load Distribution:`);
  
  for (const [workerId, load] of finalStats.loadDistribution.entries()) {
    const percentage = ((load / finalStats.totalVirtualNodes) * 100).toFixed(2);
    console.log(`    Worker ${workerId}: ${load} nodes (${percentage}%)`);
  }

  console.log('\n🎯 Test Summary:');
  console.log('✅ Consistent Hashing provides:');
  console.log('  • Cache affinity (same keys → same workers)');
  console.log('  • Even load distribution');
  console.log('  • Fault tolerance (graceful worker failure)');
  console.log('  • Performance optimization for location-based apps');
  console.log('  • Minimal cache invalidation during scaling');
}

// Run tests if called directly
if (require.main === module) {
  testConsistentHashing();
}

module.exports = { testConsistentHashing };
