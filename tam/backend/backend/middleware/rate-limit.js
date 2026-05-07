"use strict";
/**
* Rate Limiting Middleware
* Protects API endpoints from abuse with configurable rate limits
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = exports.RATE_LIMIT_CONFIGS = void 0;
exports.createRateLimit = createRateLimit;
exports.createTrustedRateLimit = createTrustedRateLimit;
exports.createUserBasedRateLimit = createUserBasedRateLimit;
exports.createMethodBasedRateLimit = createMethodBasedRateLimit;
exports.getRateLimitStats = getRateLimitStats;
exports.resetRateLimit = resetRateLimit;
exports.resetAllRateLimits = resetAllRateLimits;
// Rate limit storage (in production, use Redis or database)
const rateLimitStore = new Map();
// Default rate limit configurations
exports.RATE_LIMIT_CONFIGS = {
    // General API limits
    default: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        message: 'Too many requests, please try again later.',
    },
    // Strict limits for sensitive endpoints
    strict: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 10,
        message: 'Rate limit exceeded for this endpoint.',
    },
    // Authentication endpoints (very strict)
    auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5,
        message: 'Too many authentication attempts, please try again later.',
    },
    // OTP endpoints (extremely strict)
    otp: {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 3,
        message: 'OTP request limit exceeded. Please wait before requesting another OTP.',
    },
    // Location tracking (higher limit for real-time updates)
    location: {
        windowMs: 1 * 60 * 1000, // 1 minute
        maxRequests: 60, // 1 per second
        message: 'Location update rate limit exceeded.',
    },
    // Search endpoints
    search: {
        windowMs: 1 * 60 * 1000, // 1 minute
        maxRequests: 20,
        message: 'Search rate limit exceeded, please try again later.',
    },
    // File uploads
    upload: {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 10,
        message: 'Upload limit exceeded, please try again later.',
    },
};
// Generate rate limit key based on client identifier
function generateRateLimitKey(c) {
    // Try to get client IP
    const ip = c.req.header('x-forwarded-for') ||
        c.req.header('x-real-ip') ||
        c.env?.CF_CONNECTING_IP || // Cloudflare
        c.env?.VERCEL_IP || // Vercel
        'unknown';
    // Try to get user ID for authenticated requests
    const userId = c.get('userId') || 'anonymous';
    // Include endpoint path
    const path = c.req.path;
    return `${ip}:${userId}:${path}`;
}
// Clean up expired rate limit entries
function cleanupExpiredEntries() {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (now > data.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}
// Rate limiting middleware factory
function createRateLimit(config = {}) {
    const finalConfig = {
        ...exports.RATE_LIMIT_CONFIGS.default,
        ...config,
        keyGenerator: generateRateLimitKey,
    };
    return async (c, next) => {
        const key = finalConfig.keyGenerator(c);
        const now = Date.now();
        // Get or create rate limit data
        let data = rateLimitStore.get(key);
        if (!data || now > data.resetTime) {
            // Create new window
            data = {
                count: 0,
                resetTime: now + finalConfig.windowMs,
                windowStart: now,
            };
            rateLimitStore.set(key, data);
        }
        // Increment request count
        data.count++;
        // Set rate limit headers
        c.header('X-RateLimit-Limit', finalConfig.maxRequests.toString());
        c.header('X-RateLimit-Remaining', Math.max(0, finalConfig.maxRequests - data.count).toString());
        c.header('X-RateLimit-Reset', new Date(data.resetTime).toISOString());
        c.header('X-RateLimit-Window', (finalConfig.windowMs / 1000).toString());
        // Check if rate limit exceeded
        if (data.count > finalConfig.maxRequests) {
            c.header('Retry-After', Math.ceil((data.resetTime - now) / 1000).toString());
            return c.json({
                error: 'Rate limit exceeded',
                message: finalConfig.message || 'Too many requests',
                retryAfter: Math.ceil((data.resetTime - now) / 1000),
                limit: finalConfig.maxRequests,
                windowMs: finalConfig.windowMs,
            }, 429);
        }
        // Clean up expired entries periodically
        if (Math.random() < 0.01) { // 1% chance to clean up
            cleanupExpiredEntries();
        }
        await next();
    };
}
// Pre-configured rate limiters
exports.rateLimit = {
    default: createRateLimit(exports.RATE_LIMIT_CONFIGS.default),
    strict: createRateLimit(exports.RATE_LIMIT_CONFIGS.strict),
    auth: createRateLimit(exports.RATE_LIMIT_CONFIGS.auth),
    otp: createRateLimit(exports.RATE_LIMIT_CONFIGS.otp),
    location: createRateLimit(exports.RATE_LIMIT_CONFIGS.location),
    search: createRateLimit(exports.RATE_LIMIT_CONFIGS.search),
    upload: createRateLimit(exports.RATE_LIMIT_CONFIGS.upload),
};
// Rate limit bypass for trusted origins
function createTrustedRateLimit(config = {}) {
    return async (c, next) => {
        // Check if request is from trusted origin
        const origin = c.req.header('Origin');
        const trustedOrigins = [
            'http://localhost:3000',
            'http://localhost:8081',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:8081',
            // Add your production domains here
        ];
        if (origin && trustedOrigins.includes(origin)) {
            // Skip rate limiting for trusted origins
            c.header('X-RateLimit-Bypass', 'trusted-origin');
            return await next();
        }
        // Apply normal rate limiting
        return createRateLimit(config)(c, next);
    };
}
// Rate limit for authenticated users (different limits per user tier)
function createUserBasedRateLimit(tiers) {
    return async (c, next) => {
        const userTier = c.get('userTier') || 'free';
        const config = tiers[userTier] || tiers.free || exports.RATE_LIMIT_CONFIGS.default;
        return createRateLimit(config)(c, next);
    };
}
// Rate limit middleware for specific HTTP methods
function createMethodBasedRateLimit(configs) {
    return async (c, next) => {
        const method = c.req.method.toLowerCase();
        const config = configs[method] || configs.default || exports.RATE_LIMIT_CONFIGS.default;
        return createRateLimit(config)(c, next);
    };
}
// Get rate limit statistics
function getRateLimitStats() {
    const now = Date.now();
    const activeWindows = Array.from(rateLimitStore.entries())
        .filter(([_, data]) => now < data.resetTime);
    const topConsumers = activeWindows
        .map(([key, data]) => ({ key, count: data.count, resetTime: data.resetTime }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    return {
        totalEntries: rateLimitStore.size,
        activeWindows: activeWindows.length,
        topConsumers,
    };
}
// Reset rate limit for a specific key (admin function)
function resetRateLimit(key) {
    return rateLimitStore.delete(key);
}
// Reset all rate limits (admin function)
function resetAllRateLimits() {
    rateLimitStore.clear();
}
