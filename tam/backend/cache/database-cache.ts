/**
 * Database Query Caching
 * Caches frequently accessed database queries to reduce load
 */

import { createRedisClient } from '../config/redis-client';

interface QueryCacheConfig {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
  invalidateOn?: string[]; // Cache invalidation triggers
}

interface QueryResult {
  data: any;
  timestamp: number;
  queryHash: string;
}

const DEFAULT_TTL = 600; // 10 minutes

export class DatabaseCache {
  private keyPrefix: string;
  private ttl: number;

  constructor(config: QueryCacheConfig = {}) {
    this.keyPrefix = config.keyPrefix || 'db_cache:';
    this.ttl = config.ttl || DEFAULT_TTL;
  }

  /**
   * Generate cache key for query
   */
  private generateKey(query: string, params: any[] = []): string {
    const queryHash = this.hashQuery(query, params);
    return `${this.keyPrefix}${queryHash}`;
  }

  /**
   * Hash query string for consistent cache keys
   */
  private hashQuery(query: string, params: any[]): string {
    const crypto = require('crypto');
    const queryWithParams = `${query}:${JSON.stringify(params)}`;
    return crypto.createHash('md5').update(queryWithParams).digest('hex');
  }

  /**
   * Get cached query result
   */
  async get(query: string, params: any[] = []): Promise<any | null> {
    const cacheKey = this.generateKey(query, params);
    const redis = createRedisClient();

    try {
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        const result: QueryResult = JSON.parse(cached);
        const now = Date.now();
        
        // Check if cache is still valid
        if (now - result.timestamp < (this.ttl * 1000)) {
          console.log(`🎯 Cache HIT for query: ${query.substring(0, 50)}...`);
          return result.data;
        } else {
          // Cache expired, remove it
          await redis.del(cacheKey);
        }
      }

      console.log(`❌ Cache MISS for query: ${query.substring(0, 50)}...`);
      return null;
    } catch (error) {
      console.error('Database cache get error:', error);
      return null;
    } finally {
      await redis.quit();
    }
  }

  /**
   * Set query result in cache
   */
  async set(query: string, data: any, params: any[] = []): Promise<void> {
    const cacheKey = this.generateKey(query, params);
    const redis = createRedisClient();

    try {
      const result: QueryResult = {
        data,
        timestamp: Date.now(),
        queryHash: this.hashQuery(query, params)
      };

      await redis.setex(cacheKey, this.ttl, JSON.stringify(result));
      console.log(`💾 Cached query: ${query.substring(0, 50)}...`);
    } catch (error) {
      console.error('Database cache set error:', error);
    } finally {
      await redis.quit();
    }
  }

  /**
   * Invalidate cache entries matching pattern
   */
  async invalidate(pattern: string): Promise<number> {
    const redis = createRedisClient();
    let deletedCount = 0;

    try {
      const keys = await redis.keys(`${this.keyPrefix}*${pattern}*`);
      
      for (const key of keys) {
        await redis.del(key);
        deletedCount++;
      }
      
      console.log(`🗑️ Invalidated ${deletedCount} cache entries for pattern: ${pattern}`);
      return deletedCount;
    } catch (error) {
      console.error('Database cache invalidate error:', error);
      return 0;
    } finally {
      await redis.quit();
    }
  }

  /**
   * Clear all cache entries for this instance
   */
  async clear(): Promise<number> {
    const redis = createRedisClient();
    let deletedCount = 0;

    try {
      const keys = await redis.keys(`${this.keyPrefix}*`);
      
      for (const key of keys) {
        await redis.del(key);
        deletedCount++;
      }
      
      console.log(`🧹 Cleared ${deletedCount} cache entries`);
      return deletedCount;
    } catch (error) {
      console.error('Database cache clear error:', error);
      return 0;
    } finally {
      await redis.quit();
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ totalEntries: number; sampleKeys: string[] }> {
    const redis = createRedisClient();

    try {
      const keys = await redis.keys(`${this.keyPrefix}*`);
      
      return {
        totalEntries: keys.length,
        sampleKeys: keys.slice(0, 10)
      };
    } catch (error) {
      console.error('Database cache stats error:', error);
      return { totalEntries: 0, sampleKeys: [] };
    } finally {
      await redis.quit();
    }
  }
}

// Pre-configured cache instances
export const userCache = new DatabaseCache({
  keyPrefix: 'user_cache:',
  ttl: 900 // 15 minutes
});

export const locationCache = new DatabaseCache({
  keyPrefix: 'location_cache:',
  ttl: 120 // 2 minutes
});

export const searchCache = new DatabaseCache({
  keyPrefix: 'search_cache:',
  ttl: 300 // 5 minutes
});

export const placesCache = new DatabaseCache({
  keyPrefix: 'places_cache:',
  ttl: 600 // 10 minutes
});

// Cache decorator for database functions
export function cached(cache: DatabaseCache, ttl?: number) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${propertyName}_${JSON.stringify(args)}`;
      
      // Try to get from cache first
      const cached = await cache.get(cacheKey, args);
      if (cached !== null) {
        return cached;
      }

      // Execute original method
      const result = await method.apply(this, args);
      
      // Cache the result
      await cache.set(cacheKey, result, args);
      
      return result;
    };

    return descriptor;
  };
}
