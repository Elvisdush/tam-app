"use strict";
/**
 * CORS Configuration
 * Environment-specific CORS settings for security
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.testCors = exports.productionCors = exports.developmentCors = void 0;
exports.getCorsConfig = getCorsConfig;
exports.validateOrigin = validateOrigin;
exports.createCorsMiddleware = createCorsMiddleware;
// Development CORS Configuration
exports.developmentCors = {
    origins: [
        // Local development servers (any port — Expo web often uses 8081, 8082, …)
        'http://localhost:*',
        'http://127.0.0.1:*',
        'http://localhost:3000',
        'http://localhost:8081',
        'http://localhost:19006',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8081',
        'http://127.0.0.1:19006',
        // Expo Go development
        'exp://192.168.1.74:8081',
        'exp://127.0.0.1:8081',
        // Network IP ranges for local testing
        'exp://192.168.*:8081',
        'exp://10.*.*.*:8081',
        'http://192.168.*:3000',
        'http://10.*.*.*:3000',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
        'X-Client-Version',
        'X-Platform',
    ],
    exposeHeaders: [
        'Content-Length',
        'X-Total-Count',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
};
// Production CORS Configuration
exports.productionCors = {
    origins: [
        // Add your production domains here
        'https://your-production-domain.com',
        'https://www.your-production-domain.com',
        'https://app.your-production-domain.com',
        // Production Expo distribution
        'exp://exp.host/@your-username/your-app',
        // Add staging domains
        'https://your-staging-domain.com',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
        'X-Client-Version',
        'X-Platform',
    ],
    exposeHeaders: [
        'Content-Length',
        'X-Total-Count',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
};
// Test CORS Configuration
exports.testCors = {
    origins: [
        'http://localhost:3000',
        'http://localhost:8081',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8081',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
    ],
    exposeHeaders: ['Content-Length'],
    credentials: false,
    maxAge: 3600, // 1 hour
};
// Get CORS configuration based on environment
function getCorsConfig() {
    const env = process.env.NODE_ENV || 'development';
    switch (env) {
        case 'production':
            return exports.productionCors;
        case 'test':
            return exports.testCors;
        case 'development':
        default:
            return exports.developmentCors;
    }
}
// Custom origin validation function
function validateOrigin(origin, allowedOrigins) {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin)
        return true;
    // Direct match
    if (allowedOrigins.includes(origin))
        return true;
    // Wildcard matching for development
    if (process.env.NODE_ENV === 'development') {
        return allowedOrigins.some(allowed => {
            if (allowed.includes('*')) {
                const pattern = allowed.replace(/\*/g, '.*');
                const regex = new RegExp(`^${pattern}$`);
                return regex.test(origin);
            }
            return false;
        });
    }
    return false;
}
// CORS middleware factory
function createCorsMiddleware() {
    const config = getCorsConfig();
    return {
        origin: (origin, c) => {
            if (validateOrigin(origin, config.origins)) {
                return origin;
            }
            // Log blocked origins in production
            if (process.env.NODE_ENV === 'production') {
                console.warn(`[CORS] Blocked origin: ${origin}`);
            }
            return null; // Reject origin
        },
        allowMethods: config.allowMethods,
        allowHeaders: config.allowHeaders,
        exposeHeaders: config.exposeHeaders,
        credentials: config.credentials,
        maxAge: config.maxAge,
    };
}
