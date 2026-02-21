import express from 'express';
import { validateUrl } from '../utils/validators.js';
import { scrape } from '../services/scraper.js';
import { score } from '../services/scoring.js';

const router = express.Router();

/**
 * POST /api/scan
 * Body: { url: string }
 * Returns full scan result or structured error
 */
router.post('/scan', async (req, res) => {
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

    // 3) Score
    const analysis = score(scrapeResult);

    // 4) Return
    return res.json({
        url: validation.url,
        scrape: scrapeResult,
        analysis,
    });
});

export default router;
