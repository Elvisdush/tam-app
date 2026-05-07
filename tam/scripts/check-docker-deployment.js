/**
 * Docker Deployment Health Check Script
 * Comprehensive testing of all deployed services
 */

const http = require('http');
const https = require('https');

// Configuration
const SERVICES = [
  {
    name: 'Frontend',
    url: 'http://localhost',
    port: 3000,
    path: '/health',
    expectedStatus: 200
  },
  {
    name: 'Backend API',
    url: 'http://localhost',
    port: 3006,
    path: '/api/health',
    expectedStatus: 200
  },
  {
    name: 'Secure Backend',
    url: 'http://localhost',
    port: 3011,
    path: '/secure-api/health',
    expectedStatus: 200
  },
  {
    name: 'Lifecycle Backend',
    url: 'http://localhost',
    port: 3009,
    path: '/lifecycle-api/health',
    expectedStatus: 200
  },
  {
    name: 'Prometheus',
    url: 'http://localhost',
    port: 9090,
    path: '/',
    expectedStatus: 200
  },
  {
    name: 'Grafana',
    url: 'http://localhost',
    port: 3001,
    path: '/api/health',
    expectedStatus: 200
  }
];

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorLog(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  colorLog(`✅ ${message}`, 'green');
}

function logError(message) {
  colorLog(`❌ ${message}`, 'red');
}

function logWarning(message) {
  colorLog(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  colorLog(`ℹ️  ${message}`, 'blue');
}

// HTTP request function
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Check individual service
async function checkService(service) {
  try {
    const fullUrl = `${service.url}:${service.port}${service.path}`;
    logInfo(`Checking ${service.name} at ${fullUrl}...`);
    
    const response = await makeRequest(fullUrl);
    
    if (response.status === service.expectedStatus) {
      logSuccess(`${service.name} is healthy (${response.status})`);
      
      // Try to parse response data
      try {
        const data = JSON.parse(response.data);
        if (data.status) {
          logInfo(`  Status: ${data.status}`);
        }
        if (data.timestamp) {
          logInfo(`  Timestamp: ${data.timestamp}`);
        }
        if (data.worker) {
          logInfo(`  Worker ID: ${data.worker.id}`);
        }
      } catch (e) {
        // Not JSON, just show status
      }
      
      return { success: true, service: service.name, status: response.status };
    } else {
      logError(`${service.name} returned status ${response.status} (expected ${service.expectedStatus})`);
      return { success: false, service: service.name, status: response.status };
    }
  } catch (error) {
    logError(`${service.name} is not responding: ${error.message}`);
    return { success: false, service: service.name, error: error.message };
  }
}

// Check Docker containers
async function checkDockerContainers() {
  logInfo('Checking Docker containers...');
  
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    const { stdout } = await execAsync('docker-compose ps');
    const lines = stdout.split('\n');
    
    let runningCount = 0;
    let totalCount = 0;
    
    lines.forEach(line => {
      if (line.includes('Up')) {
        runningCount++;
        totalCount++;
        const parts = line.trim().split(/\s+/);
        if (parts.length > 2) {
          logSuccess(`Container ${parts[1]} is running`);
        }
      } else if (line.includes('tam-') && line.trim() !== '') {
        totalCount++;
        const parts = line.trim().split(/\s+/);
        if (parts.length > 2) {
          logWarning(`Container ${parts[1]} is not running`);
        }
      }
    });
    
    logInfo(`Docker containers: ${runningCount}/${totalCount} running`);
    return { running: runningCount, total: totalCount };
    
  } catch (error) {
    logError(`Failed to check Docker containers: ${error.message}`);
    return { running: 0, total: 0 };
  }
}

// Check Redis connection
async function checkRedis() {
  logInfo('Checking Redis connection...');
  
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    const { stdout } = await execAsync('docker-compose exec -T redis redis-cli ping');
    
    if (stdout.trim() === 'PONG') {
      logSuccess('Redis is responding');
      return true;
    } else {
      logError(`Redis unexpected response: ${stdout}`);
      return false;
    }
  } catch (error) {
    logError(`Redis connection failed: ${error.message}`);
    return false;
  }
}

// Check API endpoints
async function checkAPIEndpoints() {
  logInfo('Testing API endpoints...');
  
  const apiTests = [
    {
      name: 'Backend API Test',
      url: 'http://localhost:3006/api/places/search',
      method: 'GET',
      expectedStatus: 200
    },
    {
      name: 'Secure API Login Test',
      url: 'http://localhost:3011/api/auth/login',
      method: 'POST',
      body: JSON.stringify({ email: 'user@tam.com', password: 'user123' }),
      expectedStatus: 200
    },
    {
      name: 'Lifecycle API Test',
      url: 'http://localhost:3009/api/lifecycle/dashboard',
      method: 'GET',
      expectedStatus: 200
    }
  ];
  
  const results = [];
  
  for (const test of apiTests) {
    try {
      logInfo(`Testing ${test.name}...`);
      
      const options = {
        method: test.method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      if (test.body) {
        const req = require('http').request(`${test.url}`, options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            if (res.statusCode === test.expectedStatus) {
              logSuccess(`${test.name} passed (${res.statusCode})`);
              results.push({ success: true, test: test.name });
            } else {
              logError(`${test.name} failed (${res.statusCode})`);
              results.push({ success: false, test: test.name, status: res.statusCode });
            }
          });
        });
        
        req.on('error', (error) => {
          logError(`${test.name} failed: ${error.message}`);
          results.push({ success: false, test: test.name, error: error.message });
        });
        
        req.write(test.body || '');
        req.end();
      } else {
        const response = await makeRequest(test.url, options);
        
        if (response.status === test.expectedStatus) {
          logSuccess(`${test.name} passed (${response.status})`);
          results.push({ success: true, test: test.name });
        } else {
          logError(`${test.name} failed (${response.status})`);
          results.push({ success: false, test: test.name, status: response.status });
        }
      }
    } catch (error) {
      logError(`${test.name} failed: ${error.message}`);
      results.push({ success: false, test: test.name, error: error.message });
    }
  }
  
  return results;
}

// Main check function
async function runHealthCheck() {
  console.log(colors.bright + colors.cyan + '🔍 TAM App Docker Deployment Health Check' + colors.reset);
  console.log(colors.bright + '=' .repeat(50) + colors.reset);
  
  const results = {
    services: [],
    containers: { running: 0, total: 0 },
    redis: false,
    apiTests: []
  };
  
  // Check Docker containers
  results.containers = await checkDockerContainers();
  console.log('');
  
  // Check Redis
  results.redis = await checkRedis();
  console.log('');
  
  // Check services
  for (const service of SERVICES) {
    const result = await checkService(service);
    results.services.push(result);
    console.log('');
  }
  
  // Check API endpoints
  results.apiTests = await checkAPIEndpoints();
  console.log('');
  
  // Summary
  console.log(colors.bright + colors.cyan + '📊 Health Check Summary' + colors.reset);
  console.log(colors.bright + '=' .repeat(30) + colors.reset);
  
  const servicesHealthy = results.services.filter(s => s.success).length;
  const totalServices = results.services.length;
  
  const apiTestsPassed = results.apiTests.filter(t => t.success).length;
  const totalAPITests = results.apiTests.length;
  
  logInfo(`Services: ${servicesHealthy}/${totalServices} healthy`);
  logInfo(`API Tests: ${apiTestsPassed}/${totalAPITests} passed`);
  logInfo(`Docker Containers: ${results.containers.running}/${results.containers.total} running`);
  logInfo(`Redis: ${results.redis ? 'Connected' : 'Disconnected'}`);
  
  const overallHealth = servicesHealthy === totalServices && 
                        results.containers.running === results.containers.total && 
                        results.redis && 
                        apiTestsPassed >= totalAPITests * 0.8; // 80% pass rate
  
  console.log('');
  if (overallHealth) {
    logSuccess('🎉 Overall Health: HEALTHY - All systems operational!');
  } else {
    logWarning('⚠️  Overall Health: ISSUES DETECTED - Some services need attention');
  }
  
  // Service URLs
  console.log('');
  console.log(colors.bright + colors.cyan + '🌐 Service URLs' + colors.reset);
  console.log(colors.bright + '-' .repeat(20) + colors.reset);
  console.log('Frontend: http://localhost');
  console.log('Backend API: http://localhost/api');
  console.log('Secure API: http://localhost/secure-api');
  console.log('Lifecycle API: http://localhost/lifecycle-api');
  console.log('Prometheus: http://localhost:9090');
  console.log('Grafana: http://localhost:3001');
  
  return results;
}

// Run the health check
if (require.main === module) {
  runHealthCheck().catch(error => {
    logError(`Health check failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runHealthCheck };
