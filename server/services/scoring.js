/**
 * Deterministic simulation scoring for SEO, AEO, and GEO.
 * No external AI required.
 *
 * @param {object} scrape - Result from scraper.js
 * @returns {object} analysis result
 */
export function score(scrape) {
    const { title, metaDescription, headings, visibleText, links, technical } = scrape;

    const textLen = visibleText?.length ?? 0;
    const h1Count = headings.h1.length;
    const h2Count = headings.h2.length;
    const h3Count = headings.h3.length;
    const totalHeadings = h1Count + h2Count + h3Count;
    const lowerText = visibleText.toLowerCase();

    // ─── SEO Score ────────────────────────────────────────────
    // Based on: title, meta, H1, schema, text length, links
    let seo = 0;

    // Title: 0–25 pts
    if (title) {
        if (title.length >= 30 && title.length <= 60) seo += 25;
        else if (title.length > 0 && title.length < 30) seo += 15;
        else if (title.length > 60) seo += 18;
    }

    // Meta description: 0–20 pts
    if (metaDescription) {
        if (metaDescription.length >= 100 && metaDescription.length <= 160) seo += 20;
        else if (metaDescription.length > 0) seo += 12;
    }

    // H1 presence: 0–15 pts
    if (h1Count === 1) seo += 15;
    else if (h1Count > 1) seo += 8; // multiple H1s = partial credit
    else seo += 0;

    // Schema presence: 0–15 pts
    if (technical.hasSchema) seo += 15;

    // Text length: 0–15 pts
    if (textLen >= 1000) seo += 15;
    else if (textLen >= 300) seo += 10;
    else if (textLen >= 100) seo += 5;

    // External links (signals authority): 0–5 pts
    if (links.external >= 3) seo += 5;
    else if (links.external >= 1) seo += 3;

    // Internal links (site structure): 0–5 pts
    if (links.internal >= 5) seo += 5;
    else if (links.internal >= 1) seo += 3;

    seo = Math.min(100, seo);

    // ─── AEO Score ────────────────────────────────────────────
    // Based on: heading depth, question/answer patterns, readability, text density
    let aeo = 0;

    // Good heading hierarchy (h1 + h2s): 0–20 pts
    if (h1Count >= 1 && h2Count >= 2) aeo += 20;
    else if (h1Count >= 1 && h2Count >= 1) aeo += 12;
    else if (h1Count >= 1) aeo += 6;

    // H3 depth for sub-topics: 0–10 pts
    if (h3Count >= 2) aeo += 10;
    else if (h3Count >= 1) aeo += 5;

    // FAQ / Q&A patterns: 0–20 pts
    const questionWords = ['what', 'how', 'why', 'when', 'who', 'where', 'which', 'can i', 'do i', 'is there'];
    const questionMatches = questionWords.filter((w) => lowerText.includes(w)).length;
    if (questionMatches >= 5) aeo += 20;
    else if (questionMatches >= 3) aeo += 14;
    else if (questionMatches >= 1) aeo += 7;

    // Structured content signals (lists, steps, etc.): 0–15 pts
    const structureWords = ['step', 'first', 'second', 'finally', 'next', 'then', 'last', 'conclusion'];
    const structureMatches = structureWords.filter((w) => lowerText.includes(w)).length;
    if (structureMatches >= 4) aeo += 15;
    else if (structureMatches >= 2) aeo += 10;
    else if (structureMatches >= 1) aeo += 5;

    // Good text length (enough to answer questions): 0–20 pts
    if (textLen >= 2000) aeo += 20;
    else if (textLen >= 500) aeo += 12;
    else if (textLen >= 200) aeo += 6;

    // Meta description (helps AEO with snippet quality): 0–15 pts
    if (metaDescription && metaDescription.length >= 100) aeo += 15;
    else if (metaDescription) aeo += 8;

    aeo = Math.min(100, aeo);

    // ─── GEO Score ────────────────────────────────────────────
    // Based on: schema, entity signals (about/contact/named topics), heading density, citations
    let geo = 0;

    // Schema.org structured data: 0–30 pts (strong entity signal)
    if (technical.hasSchema) geo += 30;

    // Entity keywords (topic clarity): 0–25 pts
    const entityWords = ['about', 'contact', 'services', 'products', 'team', 'founded', 'mission', 'company', 'address', 'location'];
    const entityMatches = entityWords.filter((w) => lowerText.includes(w)).length;
    if (entityMatches >= 6) geo += 25;
    else if (entityMatches >= 3) geo += 16;
    else if (entityMatches >= 1) geo += 8;

    // Heading density (good content structure): 0–20 pts
    if (totalHeadings >= 8) geo += 20;
    else if (totalHeadings >= 4) geo += 14;
    else if (totalHeadings >= 2) geo += 8;
    else if (totalHeadings >= 1) geo += 4;

    // Canonical tag (entity deduplication for LLMs): 0–10 pts
    if (technical.hasCanonical) geo += 10;

    // Internal links (site structure for crawlers): 0–10 pts
    if (links.internal >= 10) geo += 10;
    else if (links.internal >= 5) geo += 7;
    else if (links.internal >= 1) geo += 3;

    // Text richness: 0–5 pts
    if (textLen >= 3000) geo += 5;
    else if (textLen >= 1000) geo += 3;

    geo = Math.min(100, geo);

    // ─── Derive qualitative outputs ───────────────────────────
    const strengths = [];
    const issues = [];
    const recommendations = [];

    // Strengths
    if (title && title.length >= 30 && title.length <= 60) strengths.push('Title tag is optimal length (30–60 chars)');
    if (metaDescription && metaDescription.length >= 100) strengths.push('Meta description is present and well-sized');
    if (h1Count === 1) strengths.push('Single H1 tag — correct semantic hierarchy');
    if (technical.hasSchema) strengths.push('Schema.org structured data detected');
    if (technical.hasCanonical) strengths.push('Canonical tag present — prevents duplicate content');
    if (h2Count >= 3) strengths.push(`Strong content structure: ${h2Count} H2 subheadings found`);
    if (textLen >= 1000) strengths.push('Sufficient body text for context and indexing');
    if (links.internal >= 5) strengths.push(`Good internal linking (${links.internal} internal links)`);

    // Issues
    if (!title) issues.push('Missing title tag');
    else if (title.length < 30) issues.push('Title tag too short (under 30 chars)');
    else if (title.length > 60) issues.push('Title tag too long (over 60 chars — may truncate in SERPs)');
    if (!metaDescription) issues.push('Missing meta description');
    if (h1Count === 0) issues.push('No H1 tag found');
    if (h1Count > 1) issues.push(`Multiple H1 tags (${h1Count}) — use only one`);
    if (!technical.hasSchema) issues.push('No Schema.org structured data found');
    if (!technical.hasCanonical) issues.push('No canonical tag — risk of duplicate content issues');
    if (textLen < 300) issues.push('Very little visible text — may be thin content');
    if (technical.hasNoindex) issues.push('⚠ Noindex meta tag detected — this page is blocked from search indexing');

    // Recommendations
    if (!title) {
        recommendations.push({
            priority: 'high',
            item: 'Add a descriptive title tag',
            why: 'Title tags are the #1 on-page SEO signal and the first thing LLMs and search engines read.',
            how: 'Add <title>Your Page Title Here</title> in the <head>. Aim for 30–60 characters.',
        });
    } else if (title.length < 30 || title.length > 60) {
        recommendations.push({
            priority: 'medium',
            item: 'Optimize title tag length',
            why: 'Short titles may not contain enough context; long titles get truncated in search results.',
            how: 'Rewrite your title to be between 30 and 60 characters, including your main keyword.',
        });
    }

    if (!metaDescription) {
        recommendations.push({
            priority: 'high',
            item: 'Add a meta description',
            why: 'Meta descriptions are critical for click-through rate and are used by AI engines for summarization.',
            how: 'Add <meta name="description" content="..."> in <head>. Aim for 100–160 characters.',
        });
    }

    if (!technical.hasSchema) {
        recommendations.push({
            priority: 'high',
            item: 'Add Schema.org structured data',
            why: 'Structured data is the strongest signal for Generative AI engines to understand your entity correctly.',
            how: 'Add a JSON-LD <script type="application/ld+json"> block. Start with Organization or WebSite schema.',
        });
    }

    if (h1Count === 0) {
        recommendations.push({
            priority: 'high',
            item: 'Add a single H1 heading',
            why: 'H1 defines the primary topic of the page for search engines and LLMs.',
            how: 'Add one <h1> containing your primary keyword near the top of the visible page content.',
        });
    }

    if (h2Count < 2 && textLen > 300) {
        recommendations.push({
            priority: 'medium',
            item: 'Add H2 subheadings to break up content',
            why: 'Headings improve AEO by making content answerable in structured chunks.',
            how: 'Break your content into sections with descriptive H2 tags that answer likely user questions.',
        });
    }

    if (!technical.hasCanonical) {
        recommendations.push({
            priority: 'low',
            item: 'Add a canonical link tag',
            why: 'Canonical tags prevent duplicate content penalties and help search engines pick the authoritative URL.',
            how: 'Add <link rel="canonical" href="https://yourdomain.com/page/"> in your <head>.',
        });
    }

    // ─── Summary ──────────────────────────────────────────────
    const avgScore = Math.round((seo + aeo + geo) / 3);
    let grade;
    if (avgScore >= 80) grade = 'excellent';
    else if (avgScore >= 60) grade = 'good';
    else if (avgScore >= 40) grade = 'fair';
    else grade = 'poor';

    const summary = `This page has an overall ${grade} signal profile (avg ${avgScore}/100 across SEO, AEO, GEO). ` +
        `${strengths.length > 0 ? `Key strengths include: ${strengths.slice(0, 2).join('; ')}. ` : ''}` +
        `${issues.length > 0 ? `Primary issues: ${issues.slice(0, 2).join('; ')}. ` : ''}` +
        `Addressing the ${recommendations.filter(r => r.priority === 'high').length} high-priority recommendations will have the biggest impact on AI and search engine discoverability.`;

    return {
        provider: 'simulation',
        scores: { seo, aeo, geo },
        summary,
        strengths,
        issues,
        recommendations,
    };
}
