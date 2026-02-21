/**
 * Content length and timeout limits — read from environment with sensible defaults.
 * These are intentionally conservative to protect server resources.
 */

/** Max time (ms) to wait for a page to load via Puppeteer */
export const PUPPETEER_TIMEOUT_MS = Number(process.env.PUPPETEER_TIMEOUT_MS) || 15000;

/** Max visible text characters to extract per page */
export const MAX_TEXT_CHARS = Number(process.env.MAX_TEXT_CHARS) || 30000;
