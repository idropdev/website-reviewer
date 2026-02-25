import puppeteer from 'puppeteer';
import https from 'https';
import http from 'http';
import os from 'os';
import { PUPPETEER_TIMEOUT_MS, MAX_TEXT_CHARS } from '../utils/limits.js';

// --single-process is required on Linux (Docker/Cloud Run) but causes
// renderer crashes on Windows/macOS dev environments with complex pages.
const IS_LINUX = os.platform() === 'linux';


const LAUNCH_ARGS = [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-setuid-sandbox',
    '--no-first-run',
    '--no-zygote',
    ...(IS_LINUX ? ['--single-process'] : []),
];

const REAL_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * Follows HTTP 301/302 server-side redirects via HEAD requests.
 * Returns the final non-redirect URL.
 */
function resolveFinalUrl(startUrl) {
    return new Promise((resolve) => {
        const follow = (currentUrl, hops = 0) => {
            if (hops > 15) { resolve(currentUrl); return; }
            const lib = currentUrl.startsWith('https') ? https : http;
            const req = lib.request(currentUrl, {
                method: 'HEAD',
                headers: { 'User-Agent': REAL_UA, 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
                timeout: 10000,
            }, (res) => {
                // Consume the response body to prevent socket hang
                res.resume();
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const next = new URL(res.headers.location, currentUrl).href;
                    console.log(`[scraper] HTTP ${res.statusCode} -> ${next}`);
                    follow(next, hops + 1);
                } else {
                    console.log(`[scraper] final HTTP URL (${res.statusCode}): ${currentUrl}`);
                    resolve(currentUrl);
                }
            });
            req.on('error', (e) => { console.warn('[scraper] HEAD error:', e.message); resolve(currentUrl); });
            req.on('timeout', () => { req.destroy(); resolve(currentUrl); });
            req.end();
        };
        follow(startUrl);
    });
}

/** DOM extraction function for page.evaluate() */
const extractData = (maxChars) => {
    const title = document.title?.trim() ?? '';
    const metaDescEl = document.querySelector('meta[name="description"]');
    const metaDescription = metaDescEl?.getAttribute('content')?.trim() ?? '';
    const canonicalEl = document.querySelector('link[rel="canonical"]');
    const hasCanonical = !!canonicalEl;
    const robotsMeta = document.querySelector('meta[name="robots"]');
    const hasNoindex = (robotsMeta?.getAttribute('content') ?? '').toLowerCase().includes('noindex');
    const getTextArr = (sel) =>
        [...document.querySelectorAll(sel)].map((el) => el.textContent?.trim()).filter(Boolean).slice(0, 20);
    const headings = { h1: getTextArr('h1'), h2: getTextArr('h2'), h3: getTextArr('h3') };
    const hasSchema = document.querySelectorAll('script[type="application/ld+json"]').length > 0;
    const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'HEADER', 'FOOTER', 'NAV']);
    function getVisibleText(el) {
        if (!el) return '';
        if (skipTags.has(el.tagName)) return '';
        if (el.nodeType === Node.TEXT_NODE) return el.textContent ?? '';
        let t = '';
        for (const c of el.childNodes) t += getVisibleText(c) + ' ';
        return t;
    }
    const visibleText = getVisibleText(document.body).replace(/\s+/g, ' ').trim().slice(0, maxChars);
    const origin = window.location.origin;
    let internal = 0, external = 0;
    document.querySelectorAll('a[href]').forEach((a) => {
        const href = a.href;
        if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;
        try { const u = new URL(href, origin); if (u.origin === origin) internal++; else external++; } catch { }
    });
    return { title, metaDescription, headings, visibleText, links: { internal, external }, technical: { hasSchema, hasCanonical, hasNoindex } };
};

/**
 * Uses CDP Network events to capture the URL of the first document response.
 * This fires BEFORE the Puppeteer frame lifecycle, so we get the URL even
 * when the frame detaches immediately.
 *
 * Returns { finalUrl } if frame detached, or { result } if evaluate succeeded.
 */
async function probeWithCDP(url) {
    let browser;
    let capturedDocUrl = url;
    try {
        browser = await puppeteer.launch({ headless: 'new', args: LAUNCH_ARGS });
        const page = await browser.newPage();
        await page.setUserAgent(REAL_UA);
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

        // Attach CDP session to intercept at the raw network level
        const cdp = await page.createCDPSession();
        await cdp.send('Network.enable');

        // CDP fires Network.responseReceived BEFORE Puppeteer's frame events
        cdp.on('Network.responseReceived', (event) => {
            if (event.type === 'Document') {
                console.log(`[scraper][CDP] Document response ${event.response.status}: ${event.response.url}`);
                if (event.response.status < 300 || event.response.status >= 400) {
                    capturedDocUrl = event.response.url;
                }
            }
        });

        // Also listen for redirect events
        cdp.on('Network.requestWillBeSent', (event) => {
            if (event.type === 'Document' && event.redirectResponse) {
                console.log(`[scraper][CDP] redirect from ${event.redirectResponse.url} -> ${event.request.url}`);
                capturedDocUrl = event.request.url;
            }
        });

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PUPPETEER_TIMEOUT_MS });
            await new Promise((r) => setTimeout(r, 1000));
            console.log(`[scraper][probe] goto succeeded, evaluating directly at: ${page.url()}`);
            const result = await page.evaluate(extractData, MAX_TEXT_CHARS);
            return { result };
        } catch (err) {
            // Allow brief time for any pending CDP events to process
            await new Promise((r) => setTimeout(r, 400));
            const isDetach = err.message?.includes('detached') || err.message?.includes('Execution context was destroyed');
            if (!isDetach) throw err;
            console.log(`[scraper][probe] detached, CDP captured URL: ${capturedDocUrl}`);
            return { finalUrl: capturedDocUrl };
        }
    } finally {
        if (browser) try { await browser.close(); } catch { }
    }
}

/**
 * Scrapes a URL using Puppeteer and returns structured data.
 *
 * For sites with JS-driven redirects (Cloudflare, Google Ads ?gad_source=1):
 *  1. Pre-resolve server-side HTTP redirects via lightweight HEAD requests
 *  2. Probe with CDP to capture the real final URL even if the frame detaches
 *  3. Launch a fresh browser to the known-final URL for a clean scrape
 *
 * @param {string} url
 * @returns {Promise<ScrapeResult>}
 */
export async function scrape(url) {
    // Step 1: resolve HTTP-level redirects
    const httpResolved = await resolveFinalUrl(url);

    // Step 2: CDP probe — captures real URL or directly extracts data
    const probeResult = await probeWithCDP(httpResolved);
    if (probeResult.result) return probeResult.result; // probe succeeded directly

    // Step 3: fresh browser to the captured final URL
    const finalUrl = probeResult.finalUrl;
    console.log(`[scraper] starting clean scrape of: ${finalUrl}`);

    let browser;
    try {
        browser = await puppeteer.launch({ headless: 'new', args: LAUNCH_ARGS });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent(REAL_UA);
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8' });
        await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: PUPPETEER_TIMEOUT_MS });
        await new Promise((r) => setTimeout(r, 1500));
        console.log(`[scraper] clean scrape page URL: ${page.url()}`);
        return await page.evaluate(extractData, MAX_TEXT_CHARS);
    } finally {
        if (browser) try { await browser.close(); } catch { }
    }
}
