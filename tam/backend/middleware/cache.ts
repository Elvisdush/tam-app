/**
 * Response Caching Middleware
 * Caches API responses to improve performance and reduce database load
 */

import { Context, Next } from 'hono';
import { createRedisClient } from '../config/redis-client';

interface CacheConfig {
  ttl?: number; // Time to live in seconds
  keyGenerator?: (c: Context) => string;
  skipCache?: (c: Context) => boolean;
  varyOn?: string[]; // Headers to vary cache on
}

interface CacheEntry {
  data: any;
  status: number;
  headers: Record<string, string>;
  timestamp: number;
  etag?: string;
}

const DEFAULT_TTL = 300; // 5 minutes

export const createCache = (config: CacheConfig = {}) => {
  return async (c: Context, next: Next) => {
    // Skip caching for certain requests
    if (config.skipCache && config.skipCache(c)) {
      return next();
    }

    // Only cache GET requests
    if (c.req.method !== 'GET') {
      return next();
    }

    const cacheKey = config.keyGenerator 
      ? config.keyGenerator(c)
      : `cache:${c.req.method}:${c.req.url}`;

    const redis = createRedisClient();
    
    try {
      // Check cache first
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        const entry: CacheEntry = JSON.parse(cached);
        
        // Check if cache is still valid
        const now = Date.now();
        const ttl = config.ttl || DEFAULT_TTL;
        
        if (now - entry.timestamp < (ttl * 1000)) {
          // Return cached response
          Object.entries(entry.headers).forEach(([key, value]) => {
            c.header(key, value);
          });
          
          c.header('X-Cache', 'HIT');
          c.header('X-Cache-Age', Math.floor((now - entry.timestamp) / 1000).toString());
          
          if (entry.etag) {
            c.header('ETag', entry.etag);
          }
          
          return c.json(entry.data, entry.status);
        }
      }

      // Execute request and cache response
      await next();

      // Only cache successful responses
      if (c.res.status < 400) {
        const responseData = await c.res.clone().json();
        const entry: CacheEntry = {
          data: responseData,
          status: c.res.status,
          headers: {},
          timestamp: Date.now()
        };

        // Copy relevant headers
        const headersToCache = ['content-type', 'cache-control', 'etag'];
        headersToCache.forEach(header => {
          const value = c.res.headers.get(header);
          if (value) {
            entry.headers[header] = value;
          }
        });

        // Store in cache
        await redis.setex(cacheKey, config.ttl || DEFAULT_TTL, JSON.stringify(entry));
        
        // Add cache headers to response
        c.header('X-Cache', 'MISS');
        c.header('X-Cache-TTL', (config.ttl || DEFAULT_TTL).toString());
      }
      
    } catch (error) {
      console.error('Cache middleware error:', error);
      // Continue without caching on error
      await next();
    } finally {
      await redis.quit();
    }
  };
};

// Cache configurations for different endpoints
export const CACHE_CONFIGS = {
  // Location data - cache for 2 minutes
  location: {
    ttl: 120,
    keyGenerator: (c: Context) => `location:${c.req.query('lat')},${c.req.query('lng')}`,
    skipCache: (c: Context) => !c.req.query('lat') || !c.req.query('lng')
  },
  
  // Search results - cache for 5 minutes
  search: {
    ttl: 300,
    keyGenerator: (c: Context) => `search:${c.req.query('q')}:${c.req.query('type')}`,
    skipCache: (c: Context) => !c.req.query('q')
  },
  
  // User profile - cache for 10 minutes
  profile: {
    ttl: 600,
    keyGenerator: (c: Context) => `profile:${c.get('userId')}`,
    skipCache: (c: Context) => !c.get('userId')
  },
  
  // Places data - cache for 15 minutes
  places: {
    ttl: 900,
    keyGenerator: (c: Context) => `places:${c.req.query('category')}:${c.req.query('near')}`,
    skipCache: (c: Context) => c.req.method !== 'GET'
  }
};

// Cache invalidation utilities
export const invalidateCache = async (pattern: string) => {
  const redis = createRedisClient();
  
  try {
    const keys = await redis.keys(`cache:${pattern}*`);
    
    for (const key of keys) {
      await redis.del(key);
    }
    
    console.log(`Invalidated ${keys.length} cache entries for pattern: ${pattern}`);
  } catch (error) {
    console.error('Failed to invalidate cache:', error);
  } finally {
    await redis.quit();
  }
};

// Cache statistics
export const getCacheStats = async () => {
  const redis = createRedisClient();
  
  try {
    const keys = await redis.keys('cache:*');
    const stats = {
      totalEntries: keys.length,
      keys: keys.slice(0, 10) // Show first 10 keys
    };
    
    return stats;
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return { totalEntries: 0, keys: [] };
  } finally {
    await redis.quit();
  }
};
