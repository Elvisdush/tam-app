/**
 * Rate Limiting Middleware for Backend
 * JavaScript version for Docker compatibility
 */

const rateLimitMap = new Map();
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_REQUESTS = 1000;

const createRateLimit = (config = {}) => {
  const windowMs = config.windowMs || DEFAULT_WINDOW_MS;
  const maxRequests = config.maxRequests || DEFAULT_MAX_REQUESTS;
  
  return async (c, next) => {
    const clientIp = c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!rateLimitMap.has(clientIp)) {
      rateLimitMap.set(clientIp, []);
    }
    
    const requests = rateLimitMap.get(clientIp);
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= maxRequests) {
      c.header('X-RateLimit-Limit', maxRequests.toString());
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', Math.ceil((validRequests[0] + windowMs) / 1000).toString());
      c.header('X-RateLimit-Window', (windowMs / 1000).toString());
      
      return c.json({
        error: 'Too Many Requests',
        message: config.message || 'Rate limit exceeded',
        retryAfter: Math.ceil(windowMs / 1000)
      }, 429);
    }
    
    validRequests.push(now);
    rateLimitMap.set(clientIp, validRequests);
    
    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', (maxRequests - validRequests.length).toString());
    c.header('X-RateLimit-Reset', Math.ceil((validRequests[0] + windowMs) / 1000).toString());
    c.header('X-RateLimit-Window', (windowMs / 1000).toString());
    
    await next();
  };
};

const createTrustedRateLimit = (config = {}) => {
  return async (c, next) => {
    const origin = c.req.header('Origin');
    const trustedOrigins = config.trustedOrigins || [];
    
    if (trustedOrigins.includes(origin)) {
      return await next();
    }
    
    return await createRateLimit(config)(c, next);
  };
};

const createUserBasedRateLimit = (config = {}) => {
  return async (c, next) => {
    const user = c.get('user');
    const userType = user?.type || 'free';
    const userConfig = config[userType] || config.free || {};
    
    return await createRateLimit(userConfig)(c, next);
  };
};

const getRateLimitStats = () => {
  const stats = {
    activeWindows: rateLimitMap.size,
    totalEntries: Array.from(rateLimitMap.values()).reduce((sum, requests) => sum + requests.length, 0)
  };
  
  return stats;
};

const resetRateLimit = (key) => {
  if (key) {
    rateLimitMap.delete(key);
    return true;
  }
  return false;
};

const resetAllRateLimits = () => {
  rateLimitMap.clear();
  return true;
};

const rateLimit = {
  default: createRateLimit(),
  strict: createRateLimit({ windowMs: 5 * 60 * 1000, maxRequests: 100 }),
  auth: createRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 50 }),
  otp: createRateLimit({ windowMs: 60 * 1000, maxRequests: 10 }),
  search: createRateLimit({ windowMs: 60 * 1000, maxRequests: 100 }),
  upload: createRateLimit({ windowMs: 60 * 1000, maxRequests: 20 }),
  location: createRateLimit({ windowMs: 60 * 1000, maxRequests: 1000 })
};

module.exports = {
  createRateLimit,
  createTrustedRateLimit,
  createUserBasedRateLimit,
  getRateLimitStats,
  resetRateLimit,
  resetAllRateLimits,
  rateLimit
};
