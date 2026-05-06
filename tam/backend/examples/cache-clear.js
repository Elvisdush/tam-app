/**
 * Cache Clear Utility
 * Clear all cache entries or specific patterns
 */

const { createRedisClient } = require('../config/redis-client');

async function clearCache(pattern = '*') {
  const redis = createRedisClient();
  
  try {
    console.log(`🧹 Clearing cache entries matching: ${pattern}`);
    
    // Clear different cache types
    const patterns = [
      `cache:*${pattern}*`,
      `db_cache:*${pattern}*`,
      `rate_limit:*${pattern}*`,
      `tam_app:*${pattern}*`
    ];
    
    let totalDeleted = 0;
    
    for (const cachePattern of patterns) {
      const keys = await redis.keys(cachePattern);
      
      if (keys.length > 0) {
        for (const key of keys) {
          await redis.del(key);
        }
        
        console.log(`🗑️ Deleted ${keys.length} entries for pattern: ${cachePattern}`);
        totalDeleted += keys.length;
      }
    }
    
    console.log(`✅ Total cache entries cleared: ${totalDeleted}`);
    
    // Get final stats
    const remainingKeys = await redis.keys('*');
    console.log(`📊 Remaining cache entries: ${remainingKeys.length}`);
    
    return totalDeleted;
  } catch (error) {
    console.error('❌ Failed to clear cache:', error);
    return 0;
  } finally {
    await redis.quit();
  }
}

async function clearSpecificCacheTypes() {
  const redis = createRedisClient();
  
  try {
    const cacheTypes = [
      { name: 'API Response Cache', pattern: 'cache:*' },
      { name: 'Database Query Cache', pattern: 'db_cache:*' },
      { name: 'Rate Limit Cache', pattern: 'rate_limit:*' },
      { name: 'Session Cache', pattern: 'tam_app:session:*' }
    ];
    
    console.log('📋 Cache Type Breakdown:');
    
    for (const type of cacheTypes) {
      const keys = await redis.keys(type.pattern);
      console.log(`  ${type.name}: ${keys.length} entries`);
    }
    
  } catch (error) {
    console.error('❌ Failed to get cache breakdown:', error);
  } finally {
    await redis.quit();
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🧹 Cache Clear Utility');
    console.log('');
    console.log('Usage:');
    console.log('  npm run cache:clear              # Clear all cache');
    console.log('  npm run cache:clear api          # Clear API cache only');
    console.log('  npm run cache:clear db           # Clear database cache only');
    console.log('  npm run cache:clear rate-limit   # Clear rate limit cache only');
    console.log('  npm run cache:clear stats        # Show cache statistics');
    console.log('');
    
    await clearSpecificCacheTypes();
    return;
  }
  
  const command = args[0];
  
  switch (command) {
    case 'api':
      await clearCache('cache:');
      break;
    case 'db':
      await clearCache('db_cache:');
      break;
    case 'rate-limit':
      await clearCache('rate_limit:');
      break;
    case 'stats':
      const { getCacheStats } = require('./cache-stats');
      await getCacheStats();
      break;
    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log('Use "npm run cache:clear" for usage information');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { clearCache, clearSpecificCacheTypes };
