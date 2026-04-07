import express from 'express';
import { validateUrl } from '../utils/validators.js';
import { scrape } from '../services/scraper.js';
import { score } from '../services/scoring.js';
import { aiScore } from '../services/aiScoring.js';
import { scanLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * POST /api/scan
 * Body: { url: string }
 * Returns full scan result or structured error.
 *
 * Rate limited: 8 scans / 10 min per IP (on top of the global 120 req/15min limit).
 */
router.post('/scan', scanLimiter, async (req, res) => {
    const { url } = req.body;

    // 1) Validate + SSRF-protect the URL
    const validation = await validateUrl(url);
    if (!validation.ok) {
        return res.status(400).json({
            url: url ?? '',
            error: validation.error,
        });
    }

    // 2) Scrape
    let scrapeResult;
    try {
        scrapeResult = await scrape(validation.url);
    } catch (err) {
        const code = err.code || 'SCRAPE_FAILED';
        return res.status(502).json({
            url: validation.url,
            error: {
                code,
                message: err.message,
            },
        });
    }

    // 3) Score — AI if provider + key configured, simulation fallback otherwise
    const provider = (process.env.AI_PROVIDER ?? '').toLowerCase();
    const hasKey =
        (provider === 'gemini' && process.env.GEMINI_API_KEY) ||
        (provider === 'openai' && process.env.OPENAI_API_KEY);

    console.log(`[scan] Scoring ${validation.url} — provider: ${hasKey ? provider : 'none (simulation)'}`);

    let analysis = null;
    if (hasKey) {
        analysis = await aiScore(scrapeResult);
        if (analysis) {
            console.log(`[scan] ✅ AI scoring succeeded (${analysis.provider} / ${analysis.model})`);
        } else {
            console.log(`[scan] ⚠️  AI scoring failed or returned null — falling back to simulation`);
        }
    }
    if (!analysis) {
        analysis = score(scrapeResult); // simulation fallback
        console.log(`[scan] 🔁 Using simulation scoring`);
    }

    // 4) Return
    return res.json({
        url: validation.url,
        scrape: scrapeResult,
        analysis,
    });
});

export default router;
