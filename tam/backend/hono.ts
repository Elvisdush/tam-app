import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { createCorsMiddleware } from "./config/cors";
import { rateLimit, createTrustedRateLimit, createUserBasedRateLimit, getRateLimitStats, resetRateLimit, resetAllRateLimits } from "./middleware/rate-limit";

const app = new Hono();

// Apply secure CORS configuration
app.use("*", cors(createCorsMiddleware()));

// Apply global rate limiting with trusted origin bypass
app.use("*", createTrustedRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000, // Generous global limit
}));

// Security Headers Middleware
app.use("*", async (c, next) => {
  // Security headers
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // API information headers
  c.header('X-API-Version', '1.0.0');
  c.header('X-Environment', process.env.NODE_ENV || 'development');
  
  await next();
});

// Request logging middleware
app.use("*", async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const url = c.req.url;
  const origin = c.req.header('Origin') || 'No-Origin';
  const userAgent = c.req.header('User-Agent') || 'Unknown';
  
  await next();
  
  const duration = Date.now() - start;
  const status = c.res.status;
  const rateLimitRemaining = c.res.headers.get('X-RateLimit-Remaining');
  
  console.log(`[API] ${method} ${url} - ${status} (${duration}ms) - Origin: ${origin} - RateLimit: ${rateLimitRemaining} - ${userAgent.substring(0, 50)}`);
});

// Rate limiting for specific endpoint groups

// Authentication endpoints - very strict
app.use("/api/auth/*", rateLimit.auth);
app.use("/api/sign-in*", rateLimit.auth);
app.use("/api/sign-up*", rateLimit.auth);
app.use("/api/otp*", rateLimit.otp);

// Location tracking - higher limit for real-time updates
app.use("/api/location*", rateLimit.location);
app.use("/api/tracking*", rateLimit.location);

// Search endpoints
app.use("/api/search*", rateLimit.search);
app.use("/api/places*", rateLimit.search);

// File uploads
app.use("/api/upload*", rateLimit.upload);
app.use("/api/profile-image*", rateLimit.upload);

// tRPC endpoints with user-based rate limiting
app.use(
  "/trpc/*",
  createUserBasedRateLimit({
    free: { windowMs: 15 * 60 * 1000, maxRequests: 100 },
    premium: { windowMs: 15 * 60 * 1000, maxRequests: 500 },
    enterprise: { windowMs: 15 * 60 * 1000, maxRequests: 2000 },
  }),
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

// Rate limit monitoring endpoint (admin only)
app.get("/admin/rate-limit-stats", async (c) => {
  // In production, add authentication check here
  const stats = getRateLimitStats();
  
  return c.json({
    ...stats,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Reset rate limit endpoint (admin only)
app.post("/admin/reset-rate-limit", async (c) => {
  // In production, add authentication check here
  const { key } = await c.req.json();
  
  if (key) {
    const success = resetRateLimit(key);
    return c.json({ success, key, message: success ? 'Rate limit reset' : 'Key not found' });
  } else {
    resetAllRateLimits();
    return c.json({ success: true, message: 'All rate limits reset' });
  }
});

app.get("/", (c) => {
  return c.json({ 
    status: "ok", 
    message: "API is running",
    cors: "enabled",
    security: "hardened",
    rateLimit: "enabled",
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get("/health", (c) => {
  const stats = getRateLimitStats();
  
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cors: "enabled",
    security: "hardened",
    rateLimit: "enabled",
    rateLimitStats: {
      activeWindows: stats.activeWindows,
      totalEntries: stats.totalEntries,
    }
  });
});

// CORS test endpoint with rate limiting
app.get("/cors-test", rateLimit.search, (c) => {
  const origin = c.req.header('Origin');
  return c.json({
    message: "CORS test successful",
    origin: origin,
    allowed: true,
    timestamp: new Date().toISOString(),
    rateLimit: c.res.headers.get('X-RateLimit-Remaining'),
  });
});

// Rate limit test endpoint
app.get("/rate-limit-test", rateLimit.strict, (c) => {
  return c.json({
    message: "Rate limit test endpoint",
    timestamp: new Date().toISOString(),
    rateLimit: {
      limit: c.res.headers.get('X-RateLimit-Limit'),
      remaining: c.res.headers.get('X-RateLimit-Remaining'),
      reset: c.res.headers.get('X-RateLimit-Reset'),
      window: c.res.headers.get('X-RateLimit-Window'),
    }
  });
});

export default app;
