/**
 * Security Middleware Suite (JavaScript)
 * Comprehensive security middleware for API protection
 */

const { authSystem } = require('./auth-system');

/**
 * Authentication Middleware
 * Validates JWT tokens and sets user context
 */
const authenticate = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const securityContext = {
    permissions: [],
    isAuthorized: false
  };

  if (!authHeader) {
    c.set('security', securityContext);
    return next();
  }

  // Extract token from "Bearer <token>" format
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/);
  if (!tokenMatch) {
    c.set('security', securityContext);
    return next();
  }

  const token = tokenMatch[1];
  const payload = authSystem.verifyAccessToken(token);

  if (!payload) {
    c.set('security', securityContext);
    return next();
  }

  // In production, fetch user from database
  // For now, create user object from payload
  const user = {
    id: payload.userId,
    email: payload.email,
    role: payload.role,
    permissions: payload.permissions,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  securityContext.user = user;
  securityContext.permissions = user.permissions;
  securityContext.isAuthorized = true;

  c.set('security', securityContext);
  await next();
};

/**
 * API Key Authentication Middleware
 * Validates API keys for service-to-service communication
 */
const authenticateApiKey = async (c, next) => {
  const apiKeyHeader = c.req.header('X-API-Key');
  const securityContext = {
    permissions: [],
    isAuthorized: false
  };

  if (!apiKeyHeader) {
    c.set('security', securityContext);
    return next();
  }

  const apiKeyData = authSystem.verifyApiKey(apiKeyHeader);

  if (!apiKeyData) {
    c.set('security', securityContext);
    return next();
  }

  securityContext.apiKey = {
    keyId: 'api-key-123', // In production, get from database
    userId: apiKeyData.userId
  };
  securityContext.permissions = apiKeyData.permissions;
  securityContext.isAuthorized = true;

  c.set('security', securityContext);
  await next();
};

/**
 * Authorization Middleware
 * Checks if user has required permissions
 */
const authorize = (requiredPermissions) => {
  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  
  return async (c, next) => {
    const security = c.get('security');

    if (!security.isAuthorized) {
      return c.json({
        error: 'Unauthorized',
        message: 'Authentication required'
      }, 401);
    }

    // Check if user has all required permissions
    const hasAllPermissions = permissions.every(permission => 
      security.permissions.includes(permission) || 
      security.permissions.includes('*')
    );

    if (!hasAllPermissions) {
      return c.json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        required: permissions,
        current: security.permissions
      }, 403);
    }

    await next();
  };
};

/**
 * Role-based Authorization Middleware
 * Checks if user has required role
 */
const requireRole = (requiredRole) => {
  return async (c, next) => {
    const security = c.get('security');

    if (!security.isAuthorized || !security.user) {
      return c.json({
        error: 'Unauthorized',
        message: 'Authentication required'
      }, 401);
    }

    if (!authSystem.hasRole(security.user, requiredRole)) {
      return c.json({
        error: 'Forbidden',
        message: `Role '${requiredRole}' required`,
        currentRole: security.user.role
      }, 403);
    }

    await next();
  };
};

/**
 * Input Validation Middleware
 * Validates and sanitizes request data
 */
const validateInput = (schema) => {
  return async (c, next) => {
    try {
      const body = await c.req.json();
      
      // Basic validation - in production, use a library like Joi or Zod
      if (schema.required) {
        for (const field of schema.required) {
          if (!body[field]) {
            return c.json({
              error: 'Bad Request',
              message: `Missing required field: ${field}`
            }, 400);
          }
        }
      }

      // Sanitize input
      const sanitized = sanitizeInput(body);
      c.set('validatedInput', sanitized);
      
      await next();
    } catch (error) {
      return c.json({
        error: 'Bad Request',
        message: 'Invalid JSON format'
      }, 400);
    }
  };
};

/**
 * Rate Limiting Middleware (Enhanced)
 * User-based rate limiting with different tiers
 */
const createUserRateLimit = (config) => {
  const userLimits = new Map();

  return async (c, next) => {
    const security = c.get('security');
    
    // Get user identifier
    let userId;
    if (security.user) {
      userId = security.user.id;
    } else if (security.apiKey) {
      userId = `api_${security.apiKey.keyId}`;
    } else {
      // Fallback to IP-based limiting
      userId = c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || 'anonymous';
    }

    const now = Date.now();
    const userLimit = userLimits.get(userId) || { count: 0, resetTime: now + config.windowMs };

    // Reset window if expired
    if (now > userLimit.resetTime) {
      userLimit.count = 0;
      userLimit.resetTime = now + config.windowMs;
    }

    // Check rate limit
    if (userLimit.count >= config.maxRequests) {
      const resetAfter = Math.ceil((userLimit.resetTime - now) / 1000);
      
      c.header('X-RateLimit-Limit', config.maxRequests.toString());
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', resetAfter.toString());

      return c.json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: resetAfter
      }, 429);
    }

    // Increment counter
    userLimit.count++;
    userLimits.set(userId, userLimit);

    // Add rate limit headers
    const remaining = config.maxRequests - userLimit.count;
    c.header('X-RateLimit-Limit', config.maxRequests.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', Math.ceil((userLimit.resetTime - now) / 1000).toString());

    await next();
  };
};

/**
 * Security Headers Middleware (Enhanced)
 * Adds comprehensive security headers
 */
const securityHeaders = async (c, next) => {
  // Basic security headers
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Enhanced security headers
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
  c.header('X-Permitted-Cross-Domain-Policies', 'none');
  c.header('X-Download-Options', 'noopen');
  c.header('X-Server', 'TAM-App-Secure');
  
  // Remove server signature
  c.header('Server', '');

  await next();
};

/**
 * HTTPS Enforcement Middleware
 * Forces HTTPS in production
 */
const enforceHTTPS = async (c, next) => {
  if (process.env.NODE_ENV === 'production') {
    const proto = c.req.header('X-Forwarded-Proto');
    
    if (proto && proto !== 'https') {
      const httpsUrl = `https://${c.req.header('Host')}${c.req.url}`;
      return c.redirect(httpsUrl, 301);
    }
  }

  await next();
};

/**
 * Request Size Limit Middleware
 * Limits request body size to prevent abuse
 */
const limitRequestSize = (maxSize) => {
  return async (c, next) => {
    const contentLength = c.req.header('Content-Length');
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return c.json({
        error: 'Request Too Large',
        message: `Request body too large. Maximum size: ${maxSize} bytes`
      }, 413);
    }

    await next();
  };
};

/**
 * IP Whitelist/Blacklist Middleware
 * Controls access based on IP addresses
 */
const controlIPAccess = (config) => {
  return async (c, next) => {
    const clientIP = c.req.header('X-Forwarded-For') || 
                     c.req.header('X-Real-IP') || 
                     c.req.header('CF-Connecting-IP') || 
                     'unknown';

    // Check blacklist first
    if (config.blacklist && config.blacklist.includes(clientIP)) {
      return c.json({
        error: 'Forbidden',
        message: 'Access denied from this IP address'
      }, 403);
    }

    // Check whitelist if configured
    if (config.whitelist && !config.whitelist.includes(clientIP)) {
      return c.json({
        error: 'Forbidden',
        message: 'Access not allowed from this IP address'
      }, 403);
    }

    await next();
  };
};

/**
 * Audit Logging Middleware
 * Logs security-relevant events
 */
const auditLog = async (c, next) => {
  const startTime = Date.now();
  const security = c.get('security');
  
  await next();
  
  const duration = Date.now() - startTime;
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: c.req.method,
    url: c.req.url,
    status: c.res.status,
    duration,
    userId: security.user?.id || 'anonymous',
    apiKey: security.apiKey?.keyId,
    ip: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || 'unknown',
    userAgent: c.req.header('User-Agent') || 'unknown',
    securityEvent: c.res.status >= 400 ? 'SECURITY_VIOLATION' : 'NORMAL'
  };

  // Log security events
  if (logEntry.securityEvent === 'SECURITY_VIOLATION') {
    console.warn('🚨 Security Event:', logEntry);
  } else {
    console.log('📊 Request Log:', logEntry);
  }
};

/**
 * Helper function to sanitize input
 */
function sanitizeInput(data) {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sanitized = Array.isArray(data) ? [] : {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // Basic XSS prevention
      sanitized[key] = value
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeInput(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Combined Security Middleware
 * Applies all security measures
 */
const applySecurity = (options = {}) => {
  return [
    securityHeaders,
    enforceHTTPS,
    options.requireAuth ? authenticate : async (c, next) => next(),
    options.permissions ? authorize(options.permissions) : async (c, next) => next(),
    options.roles ? requireRole(options.roles[0]) : async (c, next) => next(),
    options.rateLimit ? createUserRateLimit(options.rateLimit) : async (c, next) => next(),
    options.ipControl ? controlIPAccess(options.ipControl) : async (c, next) => next(),
    options.maxRequestSize ? limitRequestSize(options.maxRequestSize) : async (c, next) => next(),
    auditLog
  ];
};

module.exports = {
  authenticate,
  authenticateApiKey,
  authorize,
  requireRole,
  validateInput,
  createUserRateLimit,
  securityHeaders,
  enforceHTTPS,
  limitRequestSize,
  controlIPAccess,
  auditLog,
  applySecurity
};
