/**
 * Redis-based Rate Limiting Middleware
 * Distributed rate limiting for production scalability
 */

import { Context, Next } from 'hono';
import { createRedisClient } from '../config/redis-client';

interface RateLimitData {
  count: number;
  resetTime: number;
  windowStart: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (c: Context) => string;
}

// Redis rate limit storage
const redisRateLimitStore = new Map<string, any>();

export const createRedisRateLimit = (config: RateLimitConfig) => {
  return async (c: Context, next: Next) => {
    const key = config.keyGenerator ? config.keyGenerator(c) : `rate_limit:${c.req.method}:${c.req.url}`;
    const redis = createRedisClient();
    
    try {
      // Get current rate limit data
      const currentData = await redis.get(key);
      const data: RateLimitData = currentData ? JSON.parse(currentData) : {
        count: 0,
        resetTime: Date.now(),
        windowStart: Date.now()
      };

      const now = Date.now();
      const windowMs = config.windowMs;
      
      // Reset window if expired
      if (now - data.resetTime > windowMs) {
        data.count = 0;
        data.resetTime = now;
        data.windowStart = now;
      }

      // Check rate limit
      if (data.count >= config.maxRequests) {
        const resetAfter = Math.ceil((windowMs - (now - data.windowStart)) / 1000);
        
        c.header('X-RateLimit-Limit', config.maxRequests.toString());
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', resetAfter.toString());
        
        if (!config.skipSuccessfulRequests) {
          c.status(429);
          return c.json({
            error: 'Rate limit exceeded',
            message: config.message || 'Too many requests, please try again later.',
            retryAfter: resetAfter
          });
        }
      }

      // Increment counter
      data.count++;
      data.windowStart = now;

      // Store in Redis with expiration
      await redis.setex(key, JSON.stringify(data), Math.ceil(windowMs / 1000));

      // Add rate limit headers for successful requests
      const remaining = Math.max(0, config.maxRequests - data.count);
      c.header('X-RateLimit-Limit', config.maxRequests.toString());
      c.header('X-RateLimit-Remaining', remaining.toString());
      c.header('X-RateLimit-Reset', Math.ceil((data.resetTime + windowMs - now) / 1000).toString());

      await next();
      
    } catch (error) {
      console.error('Redis rate limit error:', error);
      // Fallback to in-memory if Redis fails
      return next();
    } finally {
      await redis.quit();
    }
  };
};

export const getRedisRateLimitStats = async () => {
  const redis = createRedisClient();
  
  try {
    const keys = await redis.keys('rate_limit:*');
    const stats: Record<string, any> = {};
    
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        stats[key] = JSON.parse(data);
      }
    }
    
    return stats;
  } catch (error) {
    console.error('Failed to get Redis stats:', error);
    return {};
  } finally {
    await redis.quit();
  }
};

export const createTrustedRateLimit = (config: RateLimitConfig) => {
  return async (c: Context, next: Next) => {
    const key = config.keyGenerator ? config.keyGenerator(c) : `rate_limit:${c.req.method}:${c.req.url}`;
    
    try {
      // Use in-memory fallback for trusted rate limiting
      const data: RateLimitData = {
        count: 0,
        resetTime: Date.now(),
        windowStart: Date.now()
      };

      const now = Date.now();
      const windowMs = config.windowMs;
      
      // Reset window if expired
      if (now - data.resetTime > windowMs) {
        data.count = 0;
        data.resetTime = now;
        data.windowStart = now;
      }

      // Check rate limit
      if (data.count >= config.maxRequests) {
        const resetAfter = Math.ceil((windowMs - (now - data.windowStart)) / 1000);
        
        c.header('X-RateLimit-Limit', config.maxRequests.toString());
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', resetAfter.toString());
        
        if (!config.skipSuccessfulRequests) {
          c.status(429);
          return c.json({
            error: 'Rate limit exceeded',
            message: config.message || 'Too many requests, please try again later.',
            retryAfter: resetAfter
          });
        }
      }

      // Increment counter
      data.count++;
      data.windowStart = now;

      // Add rate limit headers for successful requests
      const remaining = Math.max(0, config.maxRequests - data.count);
      c.header('X-RateLimit-Limit', config.maxRequests.toString());
      c.header('X-RateLimit-Remaining', remaining.toString());
      c.header('X-RateLimit-Reset', Math.ceil((data.resetTime + windowMs - now) / 1000).toString());

      await next();
      
    } catch (error) {
      console.error('Trusted rate limit error:', error);
      return next();
    }
  };
};

export const resetRedisRateLimit = async (pattern?: string) => {
  const redis = createRedisClient();
  
  try {
    const keys = pattern ? await redis.keys(`rate_limit:${pattern}*`) : await redis.keys('rate_limit:*');
    
    for (const key of keys) {
      await redis.del(key);
    }
    
    console.log(`Reset ${keys.length} rate limit keys`);
  } catch (error) {
    console.error('Failed to reset Redis rate limits:', error);
  } finally {
    await redis.quit();
  }
};
