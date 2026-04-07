import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
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
    try {
        // ─── Basics ────────────────────────────────────────────────
        const title = document.title?.trim() ?? '';
        const metaDescEl = document.querySelector('meta[name="description"]');
        const metaDescription = metaDescEl?.getAttribute('content')?.trim() ?? '';
        const canonicalEl = document.querySelector('link[rel="canonical"]');
        const hasCanonical = !!canonicalEl;
        const canonical = canonicalEl?.getAttribute('href')?.trim() ?? null;
        const robotsMeta = document.querySelector('meta[name="robots"]');
        const hasNoindex = (robotsMeta?.getAttribute('content') ?? '').toLowerCase().includes('noindex');

        // ─── URL & Slug ────────────────────────────────────────────
        const pageUrl = window.location.href;
        const slug = window.location.pathname;

        // ─── Open Graph ────────────────────────────────────────────
        const ogMeta = (prop) => document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content')?.trim() ?? null;
        const og = {
            title: ogMeta('og:title'),
            description: ogMeta('og:description'),
            image: ogMeta('og:image'),
        };

        // ─── Headings ─────────────────────────────────────────────
        const getTextArr = (sel) =>
            [...document.querySelectorAll(sel)].map((el) => el.textContent?.trim()).filter(Boolean).slice(0, 20);
        const headings = { h1: getTextArr('h1'), h2: getTextArr('h2'), h3: getTextArr('h3') };

        // ─── Question Headings ─────────────────────────────────────
        const questionHeadings = [...headings.h2, ...headings.h3].filter((h) => h.endsWith('?'));

        // ─── Schema.org (rich extraction) ──────────────────────────
        const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');
        const schemaTypes = [];
        let schemaAuthor = null;
        let datePublished = null;
        let dateModified = null;
        const faqEntries = [];

        schemaScripts.forEach((script) => {
            try {
                const data = JSON.parse(script.textContent);
                const items = Array.isArray(data) ? data : [data];
                for (const item of items) {
                    if (item['@type']) {
                        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
                        types.forEach((t) => { if (!schemaTypes.includes(t)) schemaTypes.push(t); });
                    }
                    if (item.author && !schemaAuthor) {
                        schemaAuthor = typeof item.author === 'string' ? item.author
                            : item.author?.name ?? null;
                    }
                    if (item.datePublished && !datePublished) datePublished = item.datePublished;
                    if (item.dateModified && !dateModified) dateModified = item.dateModified;
                    // FAQPage mainEntity
                    if ((item['@type'] === 'FAQPage' || (Array.isArray(item['@type']) && item['@type'].includes('FAQPage')))
                        && Array.isArray(item.mainEntity)) {
                        item.mainEntity.forEach((q) => {
                            const question = q.name ?? q.text ?? '';
                            const answer = q.acceptedAnswer?.text ?? '';
                            if (question) faqEntries.push({ question, answer: answer.slice(0, 300) });
                        });
                    }
                }
            } catch { /* skip malformed JSON-LD */ }
        });

        const schema = {
            types: schemaTypes,
            author: schemaAuthor,
            datePublished,
            dateModified,
            faqEntries,
        };

        const hasSchema = schemaTypes.length > 0;

        // ─── Visible Text ──────────────────────────────────────────
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

        // ─── Content Signals ───────────────────────────────────────
        // hasLists: any <ul> or <ol> with ≥ 2 <li> children
        const hasLists = [...document.querySelectorAll('ul, ol')].some(
            (list) => list.querySelectorAll(':scope > li').length >= 2
        );

        // hasDirectAnswer: first 150 words contain a sentence ≤ 40 words
        const words = visibleText.split(/\s+/).slice(0, 150).join(' ');
        const firstSentences = words.split(/[.?!]/).map((s) => s.trim()).filter(Boolean);
        const hasDirectAnswer = firstSentences.some((s) => s.split(/\s+/).length <= 40 && s.split(/\s+/).length >= 5);

        // avgSentenceLength & readingLevel
        const allSentences = visibleText.split(/[.?!]/).map((s) => s.trim()).filter((s) => s.length > 3);
        const totalWords = allSentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0);
        const avgSentenceLength = allSentences.length > 0 ? Math.round((totalWords / allSentences.length) * 10) / 10 : 0;
        let readingLevel = 'basic';
        if (avgSentenceLength > 25) readingLevel = 'advanced';
        else if (avgSentenceLength >= 15) readingLevel = 'intermediate';

        const wordCount = visibleText.split(/\s+/).filter(Boolean).length;

        // ─── Author Byline ─────────────────────────────────────────
        let authorByline = null;
        const metaAuthor = document.querySelector('meta[name="author"]');
        if (metaAuthor) authorByline = metaAuthor.getAttribute('content')?.trim() || null;
        if (!authorByline) {
            const relAuthor = document.querySelector('a[rel="author"]');
            if (relAuthor) authorByline = relAuthor.textContent?.trim() || null;
        }
        if (!authorByline) {
            const authorEl = document.querySelector('[class*="author"], [itemprop*="author"]');
            if (authorEl) authorByline = authorEl.textContent?.trim().slice(0, 100) || null;
        }

        // ─── Has About/Contact Link ────────────────────────────────
        let hasAboutContact = false;
        document.querySelectorAll('nav a[href], footer a[href]').forEach((a) => {
            const href = (a.getAttribute('href') ?? '').toLowerCase();
            if (href.includes('/about') || href.includes('/contact')) hasAboutContact = true;
        });

        // ─── Images ────────────────────────────────────────────────
        const allImages = document.querySelectorAll('img');
        const imageCount = allImages.length;
        let imagesMissingAlt = 0;
        allImages.forEach((img) => {
            const alt = img.getAttribute('alt');
            if (!alt || alt.trim() === '') imagesMissingAlt++;
        });
        const images = { total: imageCount, missingAlt: imagesMissingAlt };

        // ─── Links ─────────────────────────────────────────────────
        const origin = window.location.origin;
        let internal = 0, external = 0;
        const extDomainSet = new Set();
        document.querySelectorAll('a[href]').forEach((a) => {
            const href = a.href;
            if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;
            try {
                const u = new URL(href, origin);
                if (u.origin === origin) {
                    internal++;
                } else {
                    external++;
                    extDomainSet.add(u.hostname);
                }
            } catch { }
        });
        const externalDomains = [...extDomainSet].slice(0, 50);

        // ─── Events Detection ──────────────────────────────────────
        const eventItems = [];
        const eventSignals = [];
        let eventsHasSchema = false;
        let eventsHasDateInfo = false;
        let eventsHasTicketLinks = false;

        // 1) Schema.org Event types from JSON-LD
        schemaScripts.forEach((script) => {
            try {
                const data = JSON.parse(script.textContent);
                const items = Array.isArray(data) ? data : [data];
                for (const item of items) {
                    const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
                    if (types.includes('Event')) {
                        eventsHasSchema = true;
                        const ev = {
                            name: item.name ?? item.headline ?? '',
                            date: item.startDate ?? null,
                            endDate: item.endDate ?? null,
                            venue: (typeof item.location === 'string' ? item.location
                                : item.location?.name ?? item.location?.address ?? null),
                            url: item.url ?? null,
                            description: (item.description ?? '').slice(0, 200),
                            source: 'schema',
                        };
                        if (ev.date) eventsHasDateInfo = true;
                        if (item.offers?.url || item.url) eventsHasTicketLinks = true;
                        eventItems.push(ev);
                    }
                }
            } catch { /* skip malformed JSON-LD */ }
        });
        if (eventsHasSchema) eventSignals.push('schema.org Event JSON-LD');

        // 2) DOM heuristics — detect repeating event-like cards
        const dateRegex = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/i;
        const ticketWords = ['ticket', 'register', 'rsvp', 'buy ticket', 'get tickets', 'book now', 'sign up'];

        // Look for <time> elements often used in event listings
        const timeEls = document.querySelectorAll('time[datetime]');
        if (timeEls.length >= 2) eventSignals.push('<time> elements');

        // Scan common event card selectors
        const eventCardSelectors = [
            '[class*="event"]', '[class*="calendar"]', '[class*="listing"]',
            '[data-type="event"]', '[itemtype*="Event"]', '.event-card', '.event-item',
        ];
        const seenNames = new Set(eventItems.map(e => e.name.toLowerCase()));

        for (const sel of eventCardSelectors) {
            const cards = document.querySelectorAll(sel);
            if (cards.length < 2) continue; // need at least 2 to be a listing pattern
            let addedFromSelector = 0;
            cards.forEach((card) => {
                // Skip non-content elements (buttons, links, nav items, spans, small tags)
                const tag = card.tagName;
                if (['BUTTON', 'A', 'SPAN', 'LABEL', 'INPUT', 'SELECT', 'OPTION',
                     'NAV', 'HEADER', 'FOOTER', 'MAIN', 'BODY', 'HTML'].includes(tag)) return;
                // Skip large containers that hold many child event elements
                if (['SECTION', 'DIV', 'UL'].includes(tag)
                    && card.querySelectorAll('[class*="event"]').length > 3) return;

                const text = card.textContent?.trim() ?? '';
                // Must have meaningful content (30-2000 chars) to be an event card
                if (text.length < 30 || text.length > 2000) return;

                // Extract event name from heading or first prominent text
                const heading = card.querySelector('h1, h2, h3, h4, h5');
                const linkEl = card.querySelector('a[href]');
                const name = heading?.textContent?.trim()?.slice(0, 120)
                          ?? linkEl?.textContent?.trim()?.slice(0, 120)
                          ?? text.slice(0, 80);
                if (!name || name.length < 3 || seenNames.has(name.toLowerCase())) return;

                // Must have either a date or a detail link to qualify as an event
                const timeEl = card.querySelector('time[datetime]');
                let date = timeEl?.getAttribute('datetime') ?? null;
                if (!date) {
                    const match = text.match(dateRegex);
                    if (match) date = match[0];
                }
                const url = linkEl?.href ?? null;
                // Require at least a date OR a plausible event detail link
                if (!date && !url) return;

                seenNames.add(name.toLowerCase());
                if (date) eventsHasDateInfo = true;

                // Check for ticket links
                const allLinks = card.querySelectorAll('a[href]');
                allLinks.forEach((a) => {
                    const lt = (a.textContent ?? '').toLowerCase();
                    const lh = (a.href ?? '').toLowerCase();
                    if (ticketWords.some(w => lt.includes(w) || lh.includes(w))) {
                        eventsHasTicketLinks = true;
                    }
                });

                // Extract venue
                const venueEl = card.querySelector('[class*="venue"], [class*="location"], address');
                const venue = venueEl?.textContent?.trim()?.slice(0, 100) ?? null;

                eventItems.push({
                    name,
                    date,
                    endDate: null,
                    venue,
                    url,
                    description: text.slice(0, 200),
                    source: 'dom',
                });
            });
        }

        // ─── Text-based events fallback ──────────────────────────────
        // When DOM detection finds nothing, try parsing Name+Date pairs from
        // visible text. This covers JS-rendered pages where event card elements
        // don't exist in the DOM at extraction time but text is already present.
        //
        // Handles three common date formats:
        //   Month DD, YYYY  →  "April 28, 2026"
        //   MM/DD/YYYY      →  "4/28/2026"
        //   YYYY-MM-DD      →  "2026-04-28"  (ISO)
        const textDateRegex = /\b(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/gi;
        const textDateMatches = (visibleText || '').match(textDateRegex) || [];
        const textEventsFound = textDateMatches.length;
        let extractionNote = null;

        // Helper — run text extraction and merge unique results into eventItems
        function extractFromText(text, existingItems) {
            const textEventRegex = /([A-Z][^.!?\n]{4,100}?)\s+((?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}))/g;
            const seen = new Set(existingItems.map(e => e.name.toLowerCase().slice(0, 50)));
            const added = [];
            let m;
            while ((m = textEventRegex.exec(text || '')) !== null) {
                const rawName = m[1].replace(/^[\s\-\u2013\u2014\u2022*]\s*/, '').trim();
                const textDate = m[2];
                if (!rawName || rawName.length < 5) continue;
                const key = rawName.toLowerCase().slice(0, 50);
                if (seen.has(key)) continue;
                seen.add(key);
                const item = { name: rawName.slice(0, 120), date: textDate, endDate: null, venue: null, url: null, description: null, source: 'text' };
                existingItems.push(item);
                added.push(item);
                eventsHasDateInfo = true;
            }
            return added;
        }

        if (eventItems.length === 0 && textEventsFound >= 2) {
            // DOM found nothing — try full text extraction as primary source
            const added = extractFromText(visibleText, eventItems);
            if (added.length > 0) {
                eventSignals.push('text extraction (page may use JS rendering)');
                extractionNote = 'partial_render';
            } else {
                extractionNote = 'text_has_dates_no_structure';
            }
        } else if (eventItems.length > 0 && textEventsFound >= 2 && textEventsFound > eventItems.length) {
            // DOM found some events, but text has more date patterns —
            // supplement DOM results with text-extracted events
            const addedCount = extractFromText(visibleText, eventItems).length;
            if (addedCount > 0) {
                eventSignals.push('text extraction (supplemental)');
                extractionNote = 'partial_render';
            } else {
                extractionNote = 'may_have_more_events';
            }
        }

        const events = {
            detected: eventItems.length > 0,
            count: eventItems.length,
            hasSchema: eventsHasSchema,
            hasDateInfo: eventsHasDateInfo,
            hasTicketLinks: eventsHasTicketLinks,
            items: eventItems,
            signals: eventSignals,
            textEventsFound,
            extractionNote,
        };

        const scrapeQuality = wordCount >= 500 ? 'full' : wordCount >= 100 ? 'partial' : 'minimal';

        return {
            url: pageUrl,
            slug,
            title,
            metaDescription,
            og,
            headings,
            questionHeadings,
            visibleText,
            wordCount,
            contentSignals: {
                hasLists,
                hasDirectAnswer,
                avgSentenceLength,
                readingLevel,
            },
            schema,
            authorByline,
            hasAboutContact,
            images,
            links: { internal, external, externalDomains },
            technical: { hasSchema, hasCanonical, canonical, hasNoindex },
            events,
            scrapeQuality,
        };
    } catch (err) {
        // Catastrophic fallback — return minimal data so the pipeline doesn't break
        return {
            url: window.location.href,
            slug: window.location.pathname,
            title: document.title?.trim() ?? '',
            metaDescription: '',
            og: { title: null, description: null, image: null },
            headings: { h1: [], h2: [], h3: [] },
            questionHeadings: [],
            visibleText: '',
            wordCount: 0,
            contentSignals: { hasLists: false, hasDirectAnswer: false, avgSentenceLength: 0, readingLevel: 'basic' },
            schema: { types: [], author: null, datePublished: null, dateModified: null, faqEntries: [] },
            authorByline: null,
            hasAboutContact: false,
            images: { total: 0, missingAlt: 0 },
            links: { internal: 0, external: 0, externalDomains: [] },
            technical: { hasSchema: false, hasCanonical: false, canonical: null, hasNoindex: false },
            events: { detected: false, count: 0, hasSchema: false, hasDateInfo: false, hasTicketLinks: false, items: [], signals: [], textEventsFound: 0, extractionNote: null },
            scrapeQuality: 'minimal',
        };
    }
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
/**
 * Performs a clean browser scrape with retry logic.
 * Uses networkidle2 on the first attempt (waits for JS data fetches to settle),
 * escalating to networkidle0 + longer waits on retries.
 *
 * Retries automatically when the page returns thin content (< 100 words),
 * which indicates the JS framework hadn't finished rendering at extraction time.
 *
 * @param {string} url - Final URL to scrape (after redirect resolution)
 * @param {number} attempt - Current attempt number (1-indexed)
 */
async function scrapeClean(url, attempt = 1) {
    const MAX_ATTEMPTS = 2; // Reduced from 3 to prevent serverless timeout crashes
    // Use conservative wait times so we don't breach strict 10-15s hosting limits
    const waitMsByAttempt = [1500, 3000];
    const waitMs = waitMsByAttempt[attempt - 1] ?? 3000;
    // networkidle2 is risky for serverless because of persistent websockets/pixels. Use domcontentloaded for retries
    const waitUntil = attempt === 1 ? 'networkidle2' : 'domcontentloaded';

    console.log(`[scraper] Clean scrape attempt ${attempt}/${MAX_ATTEMPTS}: ${url} (${waitUntil}, +${waitMs}ms)`);

    let browser;
    try {
        browser = await puppeteer.launch({ headless: 'new', args: LAUNCH_ARGS });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent(REAL_UA);
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        });
        await page.goto(url, { waitUntil, timeout: PUPPETEER_TIMEOUT_MS });
        await new Promise((r) => setTimeout(r, waitMs));
        console.log(`[scraper] Page URL after goto: ${page.url()}`);
        const result = await page.evaluate(extractData, MAX_TEXT_CHARS);

        // Retry with longer wait if content is too thin and retries remain
        if (result.wordCount < 100 && attempt < MAX_ATTEMPTS) {
            console.log(`[scraper] Thin result (${result.wordCount} words) on attempt ${attempt} — retrying with longer wait...`);
            await new Promise((r) => setTimeout(r, 500)); // Just 500ms brief pause before retry (was 1500ms)
            return scrapeClean(url, attempt + 1);
        }

        return result;
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
 *  3. Run scrapeClean() on the known-final URL with networkidle2 + retries
 *
 * @param {string} url
 * @returns {Promise<ScrapeResult>}
 */
export async function scrape(url) {
    // Step 1: resolve HTTP-level redirects
    const httpResolved = await resolveFinalUrl(url);

    // Step 2: CDP probe — captures real URL or directly extracts data
    const probeResult = await probeWithCDP(httpResolved);

    if (probeResult.result) {
        const result = probeResult.result;
        // Probe extracted content directly. If it looks complete, use it.
        if (result.wordCount >= 100) {
            console.log(`[scraper] Probe returned good content (${result.wordCount} words) — using directly`);
            return result;
        }
        // Probe returned thin content (page likely not fully rendered yet).
        // Fall through to a proper networkidle2 scrape.
        console.log(`[scraper] Probe result too thin (${result.wordCount} words) — escalating to full scrape`);
        return scrapeClean(result.url || httpResolved);
    }

    // Step 3: fresh browser to the captured final URL with networkidle2 + retries
    return scrapeClean(probeResult.finalUrl);
}
