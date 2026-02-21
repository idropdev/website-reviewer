import dns from 'dns/promises';

/**
 * Private IP range checkers
 */
function isPrivateIP(ip) {
    // IPv4 private ranges + loopback + link-local
    const privateRanges = [
        /^127\./,                          // 127.0.0.0/8 (loopback)
        /^10\./,                           // 10.0.0.0/8
        /^192\.168\./,                     // 192.168.0.0/16
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
        /^169\.254\./,                     // 169.254.0.0/16 (link-local)
        /^0\.0\.0\.0/,                     // 0.0.0.0
        /^::1$/,                           // IPv6 loopback
        /^fc00:/i,                         // IPv6 unique local
        /^fe80:/i,                         // IPv6 link-local
    ];
    return privateRanges.some((re) => re.test(ip));
}

const BLOCKED_HOSTNAMES = new Set([
    'localhost',
    'broadcasthost',
    'local',
]);

/**
 * Validates a URL for use in scraping.
 * Blocks private IPs, loopback, and SSRF vectors.
 *
 * @param {string|undefined} raw
 * @returns {Promise<{ok: true, url: string} | {ok: false, error: {code: string, message: string}}>}
 */
export async function validateUrl(raw) {
    if (!raw || typeof raw !== 'string') {
        return err('INVALID_URL', 'URL is required and must be a string.');
    }

    let parsed;
    try {
        parsed = new URL(raw.trim());
    } catch {
        return err('INVALID_URL', 'The provided value is not a valid URL.');
    }

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return err('INVALID_URL', 'Only http and https URLs are allowed.');
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block by hostname
    if (BLOCKED_HOSTNAMES.has(hostname)) {
        return err('BLOCKED', `Hostname "${hostname}" is not allowed.`);
    }

    // Block if hostname looks like an IP
    if (isPrivateIP(hostname)) {
        return err('BLOCKED', 'Requests to private or loopback IP addresses are not allowed.');
    }

    // DNS resolution check — block if resolved IP is private
    try {
        const addresses = await dns.lookup(hostname, { all: true });
        for (const { address } of addresses) {
            if (isPrivateIP(address)) {
                return err('BLOCKED', `"${hostname}" resolves to a private IP address and is blocked.`);
            }
        }
    } catch {
        return err('INVALID_URL', `Could not resolve hostname "${hostname}". Check the URL and try again.`);
    }

    return { ok: true, url: parsed.href };
}

function err(code, message) {
    return { ok: false, error: { code, message } };
}
