import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import scanRouter from './routes/scan.js';
import { globalLimiter, botGuard } from './middleware/rateLimiter.js';

const app = express();
const PORT = process.env.PORT || 8080;

// ─── Trust proxy ────────────────────────────────────────────────────────────
// Required for accurate IP detection behind Cloud Run / Render / Nginx.
// Set TRUST_PROXY=false in env to disable if running without a proxy.
if (process.env.TRUST_PROXY !== 'false') {
    app.set('trust proxy', 1);
}

// ─── Security headers (helmet) ───────────────────────────────────────────────
app.use(helmet({
    // Allow the frontend to load in browsers normally
    contentSecurityPolicy: false, // CSP is handled by the frontend (Vite)
    crossOriginEmbedderPolicy: false,
}));

// ─── CORS ────────────────────────────────────────────────────────────────────
// In production: only accept requests from explicitly allowed origins.
// Set ALLOWED_ORIGINS as a comma-separated list in your deployment environment.
// Example: ALLOWED_ORIGINS=https://your-app.vercel.app,https://yoursite.com
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

// Always allow local dev origins
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // Same-origin requests (e.g. SSR) or no-origin (curl in dev)
        if (!origin) return callback(null, true);

        const allowed = [...DEV_ORIGINS, ...ALLOWED_ORIGINS];
        if (allowed.includes(origin)) return callback(null, true);

        // In production, block unknown origins
        if (process.env.NODE_ENV === 'production') {
            console.warn(`[cors] Blocked request from disallowed origin: ${origin}`);
            return callback(new Error(`Origin ${origin} is not allowed.`));
        }

        // In development, warn but allow
        console.warn(`[cors] Allowing unknown origin in dev mode: ${origin}`);
        return callback(null, true);
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
}));

// ─── Body parsing — enforce size limit to prevent payload attacks ─────────────
app.use(express.json({ limit: '16kb' }));

// ─── Global rate limiter — applied to every /api/* route ─────────────────────
app.use('/api', globalLimiter);

// ─── Bot guard — blocks known automation tools in production ─────────────────
app.use('/api', botGuard);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api', scanRouter);

// ─── Health check (exempt from rate limiting) ────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Global error handler ────────────────────────────────────────────────────
// Catches CORS errors and other unhandled middleware errors
app.use((err, _req, res, _next) => {
    console.error('[server] Unhandled error:', err.message);
    res.status(err.status || 500).json({
        error: {
            code: 'SERVER_ERROR',
            message: process.env.NODE_ENV === 'production'
                ? 'An unexpected error occurred.'
                : err.message,
        },
    });
});

// ─── Start ───────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
    console.log(`[server] Listening on port ${PORT}`);
    console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
    if (ALLOWED_ORIGINS.length > 0) {
        console.log(`[server] Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
    } else {
        console.log('[server] No ALLOWED_ORIGINS set — will allow localhost origins only in production');
    }
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown() {
    server.close(() => process.exit(0));
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
process.once('SIGUSR2', shutdown); // nodemon restart signal

export default app;
