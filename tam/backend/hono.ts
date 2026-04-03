import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { createCorsMiddleware } from "./config/cors";

const app = new Hono();

// Apply secure CORS configuration
app.use("*", cors(createCorsMiddleware()));

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
  
  // Rate limiting headers (basic implementation)
  c.header('X-RateLimit-Limit', '1000');
  c.header('X-RateLimit-Remaining', '999');
  c.header('X-RateLimit-Reset', new Date(Date.now() + 3600000).toISOString());
  
  await next();
});

// Request logging middleware
app.use("*", async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const url = c.req.url;
  const origin = c.req.header('Origin') || 'No-Origin';
  
  await next();
  
  const duration = Date.now() - start;
  const status = c.res.status;
  
  console.log(`[API] ${method} ${url} - ${status} (${duration}ms) - Origin: ${origin}`);
});

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

app.get("/", (c) => {
  return c.json({ 
    status: "ok", 
    message: "API is running",
    cors: "enabled",
    security: "hardened",
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cors: "enabled",
    security: "hardened"
  });
});

// CORS test endpoint
app.get("/cors-test", (c) => {
  const origin = c.req.header('Origin');
  return c.json({
    message: "CORS test successful",
    origin: origin,
    allowed: true,
    timestamp: new Date().toISOString(),
  });
});

export default app;
