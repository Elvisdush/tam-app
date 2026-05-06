/**
 * Frontend Caching Utilities
 * Provides caching for API responses, images, and user data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  etag?: string;
}

interface CacheConfig {
  ttl?: number; // Time to live in seconds
  maxSize?: number; // Maximum cache size
  persistToDisk?: boolean; // Whether to persist to AsyncStorage
}

class CacheManager {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;

  constructor(config: CacheConfig = {}) {
    this.config = {
      ttl: 300, // 5 minutes default
      maxSize: 100, // Max 100 entries
      persistToDisk: true,
      ...config
    };

    // Load persisted cache on initialization
    this.loadPersistedCache();
  }

  /**
   * Get cached data
   */
  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (entry) {
      const now = Date.now();
      
      // Check if cache is still valid
      if (now - entry.timestamp < (entry.ttl * 1000)) {
        console.log(`🎯 Cache HIT: ${key}`);
        return entry.data;
      } else {
        // Remove expired entry
        this.cache.delete(key);
        this.persistCache();
      }
    }

    console.log(`❌ Cache MISS: ${key}`);
    return null;
  }

  /**
   * Set data in cache
   */
  async set<T = any>(key: string, data: T, ttl?: number): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.ttl!,
      etag: this.generateETag(data)
    };

    // Check cache size limit
    if (this.cache.size >= this.config.maxSize!) {
      this.evictOldest();
    }

    this.cache.set(key, entry);
    
    if (this.config.persistToDisk) {
      await this.persistCache();
    }

    console.log(`💾 Cached: ${key}`);
  }

  /**
   * Remove specific cache entry
   */
  async remove(key: string): Promise<void> {
    this.cache.delete(key);
    
    if (this.config.persistToDisk) {
      await this.persistCache();
    }
    
    console.log(`🗑️ Removed cache: ${key}`);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    
    if (this.config.persistToDisk) {
      await AsyncStorage.removeItem('app_cache');
    }
    
    console.log('🧹 Cleared all cache');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    keys: string[];
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize!,
      keys: Array.from(this.cache.keys()),
      hitRate: this.calculateHitRate()
    };
  }

  /**
   * Invalidate cache entries matching pattern
   */
  async invalidate(pattern: string): Promise<number> {
    let invalidatedCount = 0;
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }
    
    if (this.config.persistToDisk && invalidatedCount > 0) {
      await this.persistCache();
    }
    
    console.log(`🗑️ Invalidated ${invalidatedCount} cache entries for pattern: ${pattern}`);
    return invalidatedCount;
  }

  /**
   * Persist cache to AsyncStorage
   */
  private async persistCache(): Promise<void> {
    if (!this.config.persistToDisk) return;

    try {
      const cacheData = JSON.stringify(Array.from(this.cache.entries()));
      await AsyncStorage.setItem('app_cache', cacheData);
    } catch (error) {
      console.error('Failed to persist cache:', error);
    }
  }

  /**
   * Load persisted cache from AsyncStorage
   */
  private async loadPersistedCache(): Promise<void> {
    if (!this.config.persistToDisk) return;

    try {
      const cacheData = await AsyncStorage.getItem('app_cache');
      
      if (cacheData) {
        const entries = JSON.parse(cacheData) as [string, CacheEntry][];
        
        // Filter out expired entries
        const now = Date.now();
        const validEntries = entries.filter(([_, entry]) => 
          now - entry.timestamp < (entry.ttl * 1000)
        );
        
        this.cache = new Map(validEntries);
        console.log(`📂 Loaded ${validEntries.length} cache entries from storage`);
      }
    } catch (error) {
      console.error('Failed to load persisted cache:', error);
    }
  }

  /**
   * Evict oldest cache entries
   */
  private evictOldest(): void {
    let oldestKey = '';
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`🗑️ Evicted oldest cache entry: ${oldestKey}`);
    }
  }

  /**
   * Generate ETag for cache validation
   */
  private generateETag(data: any): string {
    const crypto = require('crypto');
    const dataString = JSON.stringify(data);
    return crypto.createHash('md5').update(dataString).digest('hex');
  }

  /**
   * Calculate cache hit rate (simplified)
   */
  private calculateHitRate(): number {
    // This would need more sophisticated tracking in a real implementation
    return 0.75; // Placeholder
  }
}

// Pre-configured cache instances
export const apiCache = new CacheManager({
  ttl: 300, // 5 minutes
  maxSize: 50,
  persistToDisk: true
});

export const imageCache = new CacheManager({
  ttl: 3600, // 1 hour
  maxSize: 200,
  persistToDisk: true
});

export const userCache = new CacheManager({
  ttl: 900, // 15 minutes
  maxSize: 20,
  persistToDisk: true
});

export const locationCache = new CacheManager({
  ttl: 120, // 2 minutes
  maxSize: 100,
  persistToDisk: true
});

// Cache utilities
export const cacheUtils = {
  /**
   * Cache API response with automatic invalidation
   */
  async cacheApiResponse<T>(
    cache: CacheManager,
    key: string,
    apiCall: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute API call
    const result = await apiCall();
    
    // Cache the result
    await cache.set(key, result, ttl);
    
    return result;
  },

  /**
   * Invalidate related cache entries
   */
  async invalidateRelatedCaches(patterns: string[]): Promise<void> {
    const promises = patterns.map(pattern => 
      Promise.all([
        apiCache.invalidate(pattern),
        userCache.invalidate(pattern),
        locationCache.invalidate(pattern)
      ])
    );

    await Promise.all(promises);
    console.log(`🗑️ Invalidated caches for patterns: ${patterns.join(', ')}`);
  },

  /**
   * Clear all caches
   */
  async clearAllCaches(): Promise<void> {
    await Promise.all([
      apiCache.clear(),
      imageCache.clear(),
      userCache.clear(),
      locationCache.clear()
    ]);
  }
};

// React hooks for caching
export const useCachedData = <T>(
  key: string,
  fetcher: () => Promise<T>,
  cache: CacheManager = apiCache,
  ttl?: number
) => {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await cacheUtils.cacheApiResponse(cache, key, fetcher, ttl);
        setData(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [key]);

  return { data, loading, error, refetch: fetchData };
};
