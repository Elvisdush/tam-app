/**
 * Cache Statistics Utility
 * Monitor and analyze cache performance
 */

const { createRedisClient } = require('../config/redis-client');

async function getCacheStats() {
  const redis = createRedisClient();
  
  try {
    // Get all cache keys
    const apiKeys = await redis.keys('cache:*');
    const dbKeys = await redis.keys('db_cache:*');
    const rateLimitKeys = await redis.keys('rate_limit:*');
    
    // Get memory usage
    const info = await redis.info('memory');
    const memoryUsage = parseRedisMemoryInfo(info);
    
    // Calculate hit rates (simplified)
    const stats = {
      api: {
        totalEntries: apiKeys.length,
        sampleKeys: apiKeys.slice(0, 10),
        estimatedMemory: estimateMemoryUsage(apiKeys.length, 'api')
      },
      database: {
        totalEntries: dbKeys.length,
        sampleKeys: dbKeys.slice(0, 10),
        estimatedMemory: estimateMemoryUsage(dbKeys.length, 'database')
      },
      rateLimit: {
        totalEntries: rateLimitKeys.length,
        sampleKeys: rateLimitKeys.slice(0, 10),
        estimatedMemory: estimateMemoryUsage(rateLimitKeys.length, 'rate_limit')
      },
      memory: memoryUsage,
      total: {
        entries: apiKeys.length + dbKeys.length + rateLimitKeys.length,
        estimatedMemory: estimateMemoryUsage(
          apiKeys.length + dbKeys.length + rateLimitKeys.length,
          'total'
        )
      }
    };
    
    console.log('📊 Cache Statistics:');
    console.log(JSON.stringify(stats, null, 2));
    
    return stats;
  } catch (error) {
    console.error('❌ Failed to get cache stats:', error);
    return null;
  } finally {
    await redis.quit();
  }
}

function parseRedisMemoryInfo(info) {
  const lines = info.split('\r\n');
  const memory = {};
  
  for (const line of lines) {
    if (line.includes('used_memory_human:')) {
      memory.used = line.split(':')[1].trim();
    }
    if (line.includes('used_memory_peak_human:')) {
      memory.peak = line.split(':')[1].trim();
    }
    if (line.includes('used_memory_dataset_human:')) {
      memory.dataset = line.split(':')[1].trim();
    }
  }
  
  return memory;
}

function estimateMemoryUsage(entries, type) {
  const avgSize = {
    api: 1024, // 1KB per API response
    database: 512, // 512B per DB query
    rate_limit: 128, // 128B per rate limit entry
    total: 512 // Average
  };
  
  const bytes = entries * (avgSize[type] || avgSize.total);
  
  if (bytes < 1024) {
    return `${bytes}B`;
  } else if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  } else {
    return `${Math.round(bytes / (1024 * 1024))}MB`;
  }
}

// Run if called directly
if (require.main === module) {
  getCacheStats();
}

module.exports = { getCacheStats };
