import rateLimit from 'express-rate-limit';

/**
 * Standardized 429 response — returns JSON consistent with the rest of the API.
 */
function rateLimitHandler(req, res, _next, options) {
    const retryAfterSec = Math.ceil(options.windowMs / 1000);
    console.warn(`[rate-limit] ${req.ip} exceeded limit on ${req.path} — retryAfter=${retryAfterSec}s`);
    res.status(429).json({
        error: {
            code: 'RATE_LIMITED',
            message: options.message,
            retryAfter: retryAfterSec,
        },
    });
}

/**
 * Global limiter — covers all /api/* routes.
 * Provides a baseline shield against bulk automation.
 *
 * Default: 120 requests / 15 min per IP
 * Override via env: RATE_LIMIT_GLOBAL_MAX, RATE_LIMIT_GLOBAL_WINDOW_MINUTES
 */
export const globalLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_GLOBAL_WINDOW_MINUTES ?? 15) * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_GLOBAL_MAX ?? 120),
    standardHeaders: true,  // Emit standard RateLimit-* response headers
    legacyHeaders: false,
    message: 'Too many requests from this IP. Please wait before trying again.',
    handler: rateLimitHandler,
    skip: (req) => req.path === '/health', // health checks are exempt
});

/**
 * Scan limiter — tight limit for POST /api/scan.
 *
 * Each scan launches Puppeteer (30–60 s) and calls an AI API, making it
 * the most resource-intensive + cost-incurring endpoint. We allow a generous
 * burst for legitimate users but block repeat polling scripts.
 *
 * Default: 8 scans / 10 min per IP
 * Override via env: RATE_LIMIT_SCAN_MAX, RATE_LIMIT_SCAN_WINDOW_MINUTES
 */
export const scanLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_SCAN_WINDOW_MINUTES ?? 10) * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_SCAN_MAX ?? 8),
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Scan limit reached. Each IP is limited to 8 scans per 10 minutes to protect server resources. Please wait and try again.',
    handler: rateLimitHandler,
    // When behind a reverse proxy / CDN (Cloud Run, Render, etc.) prefer
    // the forwarded IP over the gateway IP so limits are per-user, not per-server.
    keyGenerator: (req) =>
        req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip,
});

/**
 * Bot guard middleware.
 * Blocks obviously automated clients in production — empty User-Agents and
 * known scanning/scraping tool signatures.
 *
 * In development this is a no-op so curl / Postman / test scripts still work.
 */
const SCRAPER_SIGNATURES = [
    /scrapy/i,
    /masscan/i,
    /nikto/i,
    /nmap/i,
    /sqlmap/i,
    /zgrab/i,
    /python-httpx/i,
    /go-http-client\/1\.1$/i, // bare default Go client
    /libwww-perl/i,
];

export function botGuard(req, res, next) {
    if (process.env.NODE_ENV !== 'production') return next();

    const ua = (req.headers['user-agent'] || '').trim();

    if (!ua) {
        return res.status(403).json({
            error: {
                code: 'FORBIDDEN',
                message: 'A valid User-Agent header is required.',
            },
        });
    }

    if (SCRAPER_SIGNATURES.some((pattern) => pattern.test(ua))) {
        console.warn(`[bot-guard] Blocked UA: "${ua}" from ${req.ip}`);
        return res.status(403).json({
            error: {
                code: 'FORBIDDEN',
                message: 'Automated scanning clients are not permitted.',
            },
        });
    }

    next();
}
