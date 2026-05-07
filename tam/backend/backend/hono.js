"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const trpc_server_1 = require("@hono/trpc-server");
const cors_1 = require("hono/cors");
const app_router_1 = require("./trpc/app-router");
const create_context_1 = require("./trpc/create-context");
const cors_2 = require("./config/cors");
const rate_limit_1 = require("./middleware/rate-limit");
const dns_security_1 = require("./config/dns-security");
const twilio_otp_1 = require("./twilio-otp");
const app = new hono_1.Hono();
// Apply secure CORS configuration
app.use("*", (0, cors_1.cors)((0, cors_2.createCorsMiddleware)()));
// Apply global rate limiting with trusted origin bypass
app.use("*", (0, rate_limit_1.createTrustedRateLimit)({
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
app.use("/api/auth/*", rate_limit_1.rateLimit.auth);
app.use("/api/sign-in*", rate_limit_1.rateLimit.auth);
app.use("/api/sign-up*", rate_limit_1.rateLimit.auth);
app.use("/api/otp*", rate_limit_1.rateLimit.otp);
/**
 * Web sign-in OTP: browsers cannot call Twilio directly (CORS). The app POSTs here instead.
 * Set EXPO_PUBLIC_API_BASE_URL (e.g. http://localhost:3000) in the Expo app .env when using web.
 * Optional: OTP_PROXY_SECRET on server + EXPO_PUBLIC_OTP_PROXY_SECRET in the app must match.
 */
app.post("/api/otp/send-sign-in", async (c) => {
    const serverSecret = process.env.OTP_PROXY_SECRET?.trim();
    if (serverSecret) {
        const sent = c.req.header("x-otp-proxy-secret")?.trim();
        if (sent !== serverSecret) {
            return c.json({ ok: false, error: "unauthorized" }, 401);
        }
    }
    let body;
    try {
        body = await c.req.json();
    }
    catch {
        return c.json({ ok: false, error: "invalid_json" }, 400);
    }
    const toE164 = typeof body.toE164 === "string" ? body.toE164.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const result = await (0, twilio_otp_1.sendSignInOtpViaTwilioServer)(toE164, code);
    if (result.ok) {
        return c.json({ ok: true });
    }
    return c.json({ ok: false, error: "send_failed", upstreamStatus: result.status, detail: result.detail }, 502);
});
// Location tracking - higher limit for real-time updates
app.use("/api/location*", rate_limit_1.rateLimit.location);
app.use("/api/tracking*", rate_limit_1.rateLimit.location);
// Search endpoints
app.use("/api/search*", rate_limit_1.rateLimit.search);
app.use("/api/places*", rate_limit_1.rateLimit.search);
// File uploads
app.use("/api/upload*", rate_limit_1.rateLimit.upload);
app.use("/api/profile-image*", rate_limit_1.rateLimit.upload);
// tRPC endpoints with user-based rate limiting
app.use("/trpc/*", (0, rate_limit_1.createUserBasedRateLimit)({
    free: { windowMs: 15 * 60 * 1000, maxRequests: 100 },
    premium: { windowMs: 15 * 60 * 1000, maxRequests: 500 },
    enterprise: { windowMs: 15 * 60 * 1000, maxRequests: 2000 },
}), (0, trpc_server_1.trpcServer)({
    endpoint: "/api/trpc",
    router: app_router_1.appRouter,
    createContext: create_context_1.createContext,
}));
// Rate limit monitoring endpoint (admin only)
app.get("/admin/rate-limit-stats", async (c) => {
    // In production, add authentication check here
    const stats = (0, rate_limit_1.getRateLimitStats)();
    return c.json({
        ...stats,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    });
});
// Rate limit reset endpoint (admin only)
app.post("/admin/reset-rate-limit", async (c) => {
    // In production, add authentication check here
    const { key } = await c.req.json();
    if (key) {
        const success = (0, rate_limit_1.resetRateLimit)(key);
        return c.json({ success, key, message: success ? 'Rate limit reset' : 'Key not found' });
    }
    else {
        (0, rate_limit_1.resetAllRateLimits)();
        return c.json({ success: true, message: 'All rate limits reset' });
    }
});
// DNS Security endpoints
app.get("/admin/dns-security", async (c) => {
    // In production, add authentication check here
    const environment = (process.env.NODE_ENV || 'development');
    const dnsManager = (0, dns_security_1.createDNSManager)(environment);
    return c.json({
        domain: dnsManager['config'].domain,
        securityScore: dnsManager.getSecurityScore(),
        recommendations: dnsManager.getSecurityRecommendations(),
        deploymentChecklist: dnsManager.generateDeploymentChecklist(),
        sslCertificates: dnsManager['config'].sslCertificates,
        cdnConfiguration: dnsManager['config'].cdnConfiguration,
        environment,
        timestamp: new Date().toISOString(),
    });
});
app.get("/admin/dns-health", async (c) => {
    // In production, add authentication check here
    const environment = (process.env.NODE_ENV || 'development');
    const dnsConfig = (0, dns_security_1.createDNSConfig)(environment);
    const dnsMonitor = (0, dns_security_1.createDNSMonitor)(dnsConfig.monitoring);
    const healthCheck = await dnsMonitor.checkDNSHealth();
    const certificateCheck = await dnsMonitor.checkCertificateExpiry();
    return c.json({
        dnsHealth: healthCheck,
        certificateStatus: certificateCheck,
        monitoring: dnsConfig.monitoring,
        timestamp: new Date().toISOString(),
    });
});
app.get("/admin/dns-records", async (c) => {
    // In production, add authentication check here
    const environment = (process.env.NODE_ENV || 'development');
    const dnsManager = (0, dns_security_1.createDNSManager)(environment);
    return c.json({
        records: dnsManager.generateDNSRecords(),
        domain: dnsManager['config'].domain,
        subdomains: dnsManager['config'].subdomains,
        environment,
        timestamp: new Date().toISOString(),
    });
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
    const stats = (0, rate_limit_1.getRateLimitStats)();
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
app.get("/cors-test", rate_limit_1.rateLimit.search, (c) => {
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
app.get("/rate-limit-test", rate_limit_1.rateLimit.strict, (c) => {
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
exports.default = app;
