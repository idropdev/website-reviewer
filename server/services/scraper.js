import puppeteer from 'puppeteer';
import { PUPPETEER_TIMEOUT_MS, MAX_TEXT_CHARS } from '../utils/limits.js';

/**
 * Scrapes a URL using Puppeteer and returns structured data
 * @param {string} url
 * @returns {Promise<ScrapeResult>}
 */
export async function scrape(url) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-setuid-sandbox',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
            ],
        });

        const page = await browser.newPage();

        // Set a reasonable viewport
        await page.setViewport({ width: 1280, height: 800 });

        // Set user agent to avoid bot blocks
        await page.setUserAgent(
            'Mozilla/5.0 (compatible; WebsiteReviewerBot/1.0; +https://github.com/website-reviewer)'
        );

        // Navigate with timeout
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: PUPPETEER_TIMEOUT_MS,
        });

        // Wait a short moment for any deferred content
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Extract all data in a single page.evaluate call
        const result = await page.evaluate((maxChars) => {
            // --- Title ---
            const title = document.title?.trim() ?? '';

            // --- Meta description ---
            const metaDescEl = document.querySelector('meta[name="description"]');
            const metaDescription = metaDescEl?.getAttribute('content')?.trim() ?? '';

            // --- Canonical ---
            const canonicalEl = document.querySelector('link[rel="canonical"]');
            const hasCanonical = !!canonicalEl;

            // --- Robots / noindex ---
            const robotsMeta = document.querySelector('meta[name="robots"]');
            const robotsContent = robotsMeta?.getAttribute('content') ?? '';
            const hasNoindex = robotsContent.toLowerCase().includes('noindex');

            // --- Headings ---
            const getTextArr = (selector) =>
                [...document.querySelectorAll(selector)]
                    .map((el) => el.textContent?.trim())
                    .filter(Boolean)
                    .slice(0, 20);

            const headings = {
                h1: getTextArr('h1'),
                h2: getTextArr('h2'),
                h3: getTextArr('h3'),
            };

            // --- Schema.org ---
            const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');
            const hasSchema = schemaScripts.length > 0;

            // --- Visible text (body, excluding scripts/styles/nav) ---
            const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'HEADER', 'FOOTER', 'NAV']);
            function getVisibleText(el) {
                if (!el) return '';
                if (skipTags.has(el.tagName)) return '';
                if (el.nodeType === Node.TEXT_NODE) {
                    return el.textContent ?? '';
                }
                let text = '';
                for (const child of el.childNodes) {
                    text += getVisibleText(child) + ' ';
                }
                return text;
            }
            const rawText = getVisibleText(document.body);
            const visibleText = rawText
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, maxChars);

            // --- Links ---
            const origin = window.location.origin;
            let internal = 0;
            let external = 0;
            document.querySelectorAll('a[href]').forEach((a) => {
                const href = a.href;
                if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;
                try {
                    const url = new URL(href, origin);
                    if (url.origin === origin) internal++;
                    else external++;
                } catch {
                    // skip malformed hrefs
                }
            });

            return {
                title,
                metaDescription,
                headings,
                visibleText,
                links: { internal, external },
                technical: { hasSchema, hasCanonical, hasNoindex },
            };
        }, MAX_TEXT_CHARS);

        return result;
    } finally {
        if (browser) await browser.close();
    }
}
