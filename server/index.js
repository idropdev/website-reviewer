import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import scanRouter from './routes/scan.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', scanRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Start server
const server = app.listen(PORT, () => {
    console.log(`[server] Listening on port ${PORT}`);
});

// Graceful shutdown — lets nodemon/watch cleanly release the port before restart
function shutdown(signal) {
    server.close(() => process.exit(0));
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
process.once('SIGUSR2', shutdown); // nodemon restart signal

export default app;
