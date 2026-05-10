/**
 * CORS Configuration for Backend
 * JavaScript version for Docker compatibility
 */

const cors = {
  development: {
    origin: ['http://localhost:3000', 'http://localhost:3011', 'http://127.0.0.1:3000', 'http://127.0.0.1:3011'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 204
  },
  production: {
    origin: ['http://localhost', 'https://yourdomain.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 204
  },
  test: {
    origin: ['http://localhost:3000', 'http://localhost:3011'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 204
  }
};

const createCorsMiddleware = (environment = 'development') => {
  return cors[environment] || cors.development;
};

const validateOrigin = (origin, allowedOrigins) => {
  return allowedOrigins.includes(origin);
};

module.exports = {
  cors,
  createCorsMiddleware,
  validateOrigin
};
