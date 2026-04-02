/**
 * Deterministic simulation scoring for SEO, AEO, and GEO.
 * No external AI required.
 *
 * Calibrated to approximate what the Gemini AI scorer would produce,
 * using the enriched scrape data from the expanded scraper.
 * All new fields are accessed safely so this still works with legacy scrape shapes.
 *
 * @param {object} scrape - Result from scraper.js
 * @returns {object} analysis result
 */
export function score(scrape) {
    const { title, metaDescription, headings, visibleText, links, technical } = scrape;

    // New enriched fields (safe fallbacks)
    const og = scrape.og ?? {};
    const cs = scrape.contentSignals ?? {};
    const sch = scrape.schema ?? {};
    const img = scrape.images ?? {};
    const questionHeadings = scrape.questionHeadings ?? [];
    const authorByline = scrape.authorByline ?? null;
    const hasAboutContact = scrape.hasAboutContact ?? false;
    const externalDomains = links?.externalDomains ?? [];
    const wordCount = scrape.wordCount ?? (visibleText?.split(/\s+/).filter(Boolean).length ?? 0);
    const slug = scrape.slug ?? '/';
    const ev = scrape.events ?? {};
    const evItems = ev.items ?? [];

    const h1Count = headings.h1.length;
    const h2Count = headings.h2.length;
    const h3Count = headings.h3.length;
    const totalHeadings = h1Count + h2Count + h3Count;
    const lowerText = (visibleText ?? '').toLowerCase();

    // ─── SEO Score ────────────────────────────────────────────
    // Max possible: 100
    let seo = 0;

    // Title tag quality: 0–18 pts
    if (title) {
        const tLen = title.length;
        if (tLen >= 30 && tLen <= 60) seo += 18;
        else if (tLen >= 20 && tLen < 30) seo += 12;
        else if (tLen > 60 && tLen <= 80) seo += 10;
        else if (tLen > 80) seo += 6;
        else seo += 8; // very short but present
    }

    // Meta description: 0–14 pts
    if (metaDescription) {
        const mLen = metaDescription.length;
        if (mLen >= 120 && mLen <= 160) seo += 14;
        else if (mLen >= 80 && mLen < 120) seo += 11;
        else if (mLen > 160) seo += 8;
        else seo += 6; // present but short
    }

    // H1 presence and quality: 0–12 pts
    if (h1Count === 1) {
        const h1Len = headings.h1[0].length;
        if (h1Len >= 10 && h1Len <= 70) seo += 12; // descriptive H1
        else seo += 8; // too short or too long
    } else if (h1Count > 1) {
        seo += 5; // multiple H1s — penalty
    }

    // Canonical tag: 0–8 pts
    if (technical.hasCanonical) seo += 8;

    // Noindex penalty: -15 pts
    if (technical.hasNoindex) seo -= 15;

    // OG tags (discoverability on social + link previews): 0–6 pts
    if (og.title) seo += 2;
    if (og.description) seo += 2;
    if (og.image) seo += 2;

    // Schema presence: 0–8 pts
    const schemaTypeCount = (sch.types ?? []).length;
    if (schemaTypeCount >= 2) seo += 8;
    else if (schemaTypeCount >= 1) seo += 5;

    // Word count adequacy: 0–10 pts
    if (wordCount >= 2000) seo += 10;
    else if (wordCount >= 1000) seo += 8;
    else if (wordCount >= 500) seo += 6;
    else if (wordCount >= 300) seo += 4;
    else if (wordCount >= 100) seo += 2;

    // Image alt coverage: 0–8 pts
    if (img.total > 0) {
        const withAlt = img.total - (img.missingAlt ?? 0);
        const ratio = withAlt / img.total;
        if (ratio >= 0.95) seo += 8;
        else if (ratio >= 0.75) seo += 5;
        else if (ratio >= 0.5) seo += 3;
        else seo += 1;
    } else {
        seo += 3; // no images — neutral
    }

    // Internal link structure: 0–8 pts
    if (links.internal >= 15) seo += 8;
    else if (links.internal >= 8) seo += 6;
    else if (links.internal >= 3) seo += 4;
    else if (links.internal >= 1) seo += 2;

    // External links: 0–4 pts
    if (links.external >= 5) seo += 4;
    else if (links.external >= 2) seo += 3;
    else if (links.external >= 1) seo += 2;

    // URL/slug quality bonus: 0–4 pts (clean slugs score better)
    if (slug && slug !== '/') {
        const isClean = /^\/[a-z0-9\-\/]+$/.test(slug) && !slug.includes('?') && slug.length < 80;
        if (isClean) seo += 4;
        else seo += 2;
    }

    // Events: 0–6 pts
    if (ev.detected) {
        if (ev.hasSchema) seo += 3;
        if (ev.hasDateInfo) seo += 2;
        if (ev.hasTicketLinks) seo += 1;
    }

    seo = Math.min(100, Math.max(0, seo));

    // ─── AEO Score ────────────────────────────────────────────
    // Max possible: 100
    let aeo = 0;

    // Heading hierarchy depth: 0–12 pts
    if (h1Count >= 1 && h2Count >= 3 && h3Count >= 1) aeo += 12;
    else if (h1Count >= 1 && h2Count >= 2) aeo += 10;
    else if (h1Count >= 1 && h2Count >= 1) aeo += 7;
    else if (h1Count >= 1) aeo += 4;
    else if (h2Count >= 1) aeo += 2;

    // Question-format headings: 0–18 pts (strongest AEO signal)
    if (questionHeadings.length >= 5) aeo += 18;
    else if (questionHeadings.length >= 3) aeo += 14;
    else if (questionHeadings.length >= 2) aeo += 10;
    else if (questionHeadings.length >= 1) aeo += 6;

    // Fallback: question-like words in body text: 0–8 pts (only if no question headings)
    if (questionHeadings.length === 0) {
        const qWords = ['what is', 'how to', 'how do', 'why does', 'when should', 'who can', 'where to', 'which', 'can i', 'do i', 'is there', 'does it'];
        const qMatches = qWords.filter((w) => lowerText.includes(w)).length;
        if (qMatches >= 6) aeo += 8;
        else if (qMatches >= 4) aeo += 6;
        else if (qMatches >= 2) aeo += 4;
        else if (qMatches >= 1) aeo += 2;
    }

    // Structured content (lists): 0–10 pts
    if (cs.hasLists) aeo += 10;
    else {
        // Fallback: step/sequence language
        const seqWords = ['step 1', 'step 2', 'first,', 'second,', 'finally,', 'in conclusion'];
        const seqMatches = seqWords.filter((w) => lowerText.includes(w)).length;
        if (seqMatches >= 3) aeo += 7;
        else if (seqMatches >= 1) aeo += 3;
    }

    // Direct answer signal: 0–12 pts
    if (cs.hasDirectAnswer) aeo += 12;

    // Reading level: 0–10 pts (basic/intermediate = best for answer engines)
    const rl = cs.readingLevel ?? 'unknown';
    if (rl === 'basic') aeo += 10;
    else if (rl === 'intermediate') aeo += 9;
    else if (rl === 'advanced') aeo += 3;

    // FAQPage schema: 0–12 pts
    const faqCount = (sch.faqEntries ?? []).length;
    if (faqCount >= 5) aeo += 12;
    else if (faqCount >= 3) aeo += 9;
    else if (faqCount >= 1) aeo += 6;

    // Content depth: 0–10 pts
    if (wordCount >= 3000) aeo += 10;
    else if (wordCount >= 1500) aeo += 8;
    else if (wordCount >= 800) aeo += 6;
    else if (wordCount >= 400) aeo += 4;
    else if (wordCount >= 200) aeo += 2;

    // Meta description presence (snippet source): 0–6 pts
    if (metaDescription && metaDescription.length >= 100) aeo += 6;
    else if (metaDescription && metaDescription.length >= 50) aeo += 3;

    // Events structured data: 0–4 pts (helps answer engines extract event info)
    if (ev.detected) {
        if (ev.hasSchema && ev.hasDateInfo) aeo += 4;
        else if (ev.hasSchema || ev.hasDateInfo) aeo += 2;
        else aeo += 1;
    }

    aeo = Math.min(100, Math.max(0, aeo));

    // ─── GEO Score ────────────────────────────────────────────
    // Max possible: 100
    let geo = 0;

    // Schema type richness: 0–22 pts (the most important GEO signal)
    if (schemaTypeCount >= 4) geo += 22;
    else if (schemaTypeCount >= 3) geo += 18;
    else if (schemaTypeCount >= 2) geo += 14;
    else if (schemaTypeCount >= 1) geo += 10;

    // Named author (schema or page byline): 0–10 pts
    if (sch.author && authorByline) geo += 10; // both = strong
    else if (sch.author || authorByline) geo += 7;

    // Date signals (freshness for LLMs): 0–8 pts
    if (sch.datePublished && sch.dateModified) geo += 8;
    else if (sch.datePublished) geo += 5;
    else if (sch.dateModified) geo += 4;

    // Entity clarity keywords: 0–12 pts
    const entityWords = ['about us', 'contact us', 'our services', 'our team', 'founded', 'mission', 'company', 'headquarters', 'address', 'location', 'established'];
    const entityMatches = entityWords.filter((w) => lowerText.includes(w)).length;
    if (entityMatches >= 5) geo += 12;
    else if (entityMatches >= 3) geo += 9;
    else if (entityMatches >= 2) geo += 6;
    else if (entityMatches >= 1) geo += 3;

    // Heading density (structured knowledge): 0–8 pts
    if (totalHeadings >= 10) geo += 8;
    else if (totalHeadings >= 6) geo += 6;
    else if (totalHeadings >= 3) geo += 4;
    else if (totalHeadings >= 1) geo += 2;

    // Canonical: 0–5 pts (entity deduplication)
    if (technical.hasCanonical) geo += 5;

    // Has About/Contact link: 0–5 pts (entity credibility)
    if (hasAboutContact) geo += 5;

    // External link authority: 0–10 pts (citable sources)
    if (externalDomains.length >= 8) geo += 10;
    else if (externalDomains.length >= 5) geo += 8;
    else if (externalDomains.length >= 3) geo += 6;
    else if (externalDomains.length >= 1) geo += 3;

    // Content is factual/citable style: 0–10 pts
    // Approximated by reading level + word count + presence of data-like patterns
    const hasCitableStyle = rl !== 'basic' && wordCount >= 500;
    const hasNumbers = /\d{4}|\d+%|\$\d+/.test(visibleText ?? '');
    if (hasCitableStyle && hasNumbers) geo += 10;
    else if (hasCitableStyle) geo += 6;
    else if (hasNumbers) geo += 4;
    else if (wordCount >= 300) geo += 2;

    // Internal site structure: 0–5 pts
    if (links.internal >= 10) geo += 5;
    else if (links.internal >= 5) geo += 3;
    else if (links.internal >= 1) geo += 1;

    // OG presence bonus for GEO (entity representation): 0–5 pts
    if (og.title && og.description && og.image) geo += 5;
    else if (og.title && og.description) geo += 3;
    else if (og.title) geo += 1;

    // Events schema richness: 0–6 pts
    if (ev.detected) {
        if (ev.hasSchema && ev.count >= 5) geo += 6;
        else if (ev.hasSchema) geo += 4;
        else if (ev.count >= 5) geo += 3;
        else geo += 1;
    }

    geo = Math.min(100, Math.max(0, geo));

    // ─── Derive qualitative outputs ───────────────────────────
    const strengths = [];
    const issues = [];
    const recommendations = [];

    // ─── Strengths ─────────────────────────────────────
    if (title && title.length >= 30 && title.length <= 60)
        strengths.push(`Title tag is well-optimized (${title.length} chars): "${title.slice(0, 50)}${title.length > 50 ? '…' : ''}"`);
    if (metaDescription && metaDescription.length >= 100)
        strengths.push(`Meta description is present and descriptive (${metaDescription.length} chars)`);
    if (h1Count === 1)
        strengths.push(`Clear H1: "${headings.h1[0].slice(0, 60)}${headings.h1[0].length > 60 ? '…' : ''}"`);
    if (og.title && og.description && og.image)
        strengths.push('Complete Open Graph tags — page will display rich previews when shared');
    if (schemaTypeCount >= 2)
        strengths.push(`Rich structured data: ${sch.types.join(', ')} schema types detected`);
    else if (schemaTypeCount === 1)
        strengths.push(`Schema.org ${sch.types[0]} structured data detected`);
    if (technical.hasCanonical)
        strengths.push('Canonical tag present — prevents duplicate content issues');
    if (h2Count >= 3)
        strengths.push(`Well-structured content: ${h2Count} H2 sections organize the page`);
    if (wordCount >= 1000)
        strengths.push(`Substantial content depth (${wordCount.toLocaleString()} words)`);
    if (links.internal >= 5)
        strengths.push(`Strong internal linking (${links.internal} links connecting site pages)`);
    if (questionHeadings.length >= 2)
        strengths.push(`${questionHeadings.length} question-format headings — excellent for featured snippets and AI answers`);
    else if (questionHeadings.length === 1)
        strengths.push(`Question heading found: "${questionHeadings[0].slice(0, 50)}${questionHeadings[0].length > 50 ? '…' : ''}"`);
    if (cs.hasDirectAnswer)
        strengths.push('Concise answer provided near the top of the page — strong AEO signal');
    if (cs.hasLists)
        strengths.push('Structured list content helps AI engines extract information');
    if (sch.author || authorByline) {
        const name = sch.author || authorByline;
        strengths.push(`Named author present: ${name} — boosts E-E-A-T credibility`);
    }
    if (sch.datePublished)
        strengths.push(`Content freshness signal: published ${sch.datePublished}`);
    if (hasAboutContact)
        strengths.push('About/Contact pages linked — important for entity credibility');
    if (img.total > 0 && (img.missingAlt ?? 0) === 0)
        strengths.push(`All ${img.total} images have descriptive alt text`);
    if (externalDomains.length >= 3)
        strengths.push(`Links to ${externalDomains.length} external domains — signals research and authority`);
    if (faqCount >= 1)
        strengths.push(`FAQPage schema with ${faqCount} Q&A entries — direct AEO boost`);
    if (ev.detected) {
        strengths.push(`${ev.count} event(s) detected on the page`);
        if (ev.hasSchema) strengths.push('Events use Schema.org Event structured data — excellent for rich results');
        if (ev.hasDateInfo) strengths.push('Events include date information — helps search engines show event snippets');
        if (ev.hasTicketLinks) strengths.push('Ticket/registration links found — drives user action');
    }

    // ─── Issues ────────────────────────────────────────
    if (!title)
        issues.push('Missing title tag — the most critical on-page SEO element');
    else if (title.length < 20)
        issues.push(`Title tag is very short (${title.length} chars) — lacks descriptive keywords`);
    else if (title.length < 30)
        issues.push(`Title tag is below optimal length (${title.length} chars, aim for 30–60)`);
    else if (title.length > 60)
        issues.push(`Title tag may truncate in SERPs (${title.length} chars, max ~60 recommended)`);

    if (!metaDescription)
        issues.push('Missing meta description — search engines and AI will auto-generate one, often poorly');
    else if (metaDescription.length < 80)
        issues.push(`Meta description is short (${metaDescription.length} chars) — not enough to entice clicks`);

    if (h1Count === 0)
        issues.push('No H1 tag — search engines and LLMs rely on H1 to identify the page\'s primary topic');
    if (h1Count > 1)
        issues.push(`${h1Count} H1 tags found — should use exactly one per page`);

    if (!og.title || !og.description)
        issues.push('Missing Open Graph tags — page will have poor previews when shared on social media');

    if (schemaTypeCount === 0)
        issues.push('No Schema.org structured data — LLMs and search engines have less context about your entity');

    if (!technical.hasCanonical)
        issues.push('No canonical tag — risks duplicate content issues across URL variants');

    if (wordCount < 200)
        issues.push(`Very thin content (${wordCount} words) — likely insufficient for ranking or AI citations`);
    else if (wordCount < 400)
        issues.push(`Light content (${wordCount} words) — may struggle to rank for competitive queries`);

    if (technical.hasNoindex)
        issues.push('⚠ Noindex tag detected — this page is completely blocked from search engine indexing');

    if (img.total > 0 && (img.missingAlt ?? 0) > 0) {
        const pct = Math.round(((img.missingAlt) / img.total) * 100);
        issues.push(`${img.missingAlt} of ${img.total} images (${pct}%) missing alt text — hurts accessibility and image SEO`);
    }

    if (!sch.author && !authorByline)
        issues.push('No author attribution found — weakens E-E-A-T trust signals for AI and search');

    if (questionHeadings.length === 0 && wordCount > 300)
        issues.push('No question-format headings (H2/H3) — missed opportunity for featured snippets and AI answers');

    if (!sch.datePublished && !sch.dateModified)
        issues.push('No date published or modified in schema — AI models prefer content with freshness signals');

    if (externalDomains.length === 0 && wordCount > 500)
        issues.push('No external links — citing authoritative sources improves content credibility for GEO');

    if (!hasAboutContact)
        issues.push('No About or Contact page linked — reduces entity credibility for generative engines');

    if (ev.detected && !ev.hasSchema)
        issues.push(`${ev.count} events found on page but no Event schema.org markup — missing rich result eligibility`);
    if (ev.detected && !ev.hasDateInfo)
        issues.push('Events detected but no date information found — search engines cannot show event dates in results');

    // ─── Recommendations ───────────────────────────────
    if (!title) {
        recommendations.push({
            priority: 'high',
            item: 'Add a descriptive title tag',
            why: 'Title tags are the #1 on-page SEO signal. Search engines, social previews, and LLMs all use it as the primary page identifier.',
            how: `Add <title>Your Primary Keyword – Brand Name</title> in <head>. Aim for 30–60 characters that clearly describe the page topic.`,
        });
    } else if (title.length < 30 || title.length > 60) {
        recommendations.push({
            priority: 'medium',
            item: `Adjust title length (currently ${title.length} chars)`,
            why: 'Titles under 30 chars lack keyword context; over 60 chars get truncated in search results.',
            how: `Rewrite to 30–60 chars. Current: "${title.slice(0, 60)}${title.length > 60 ? '…' : ''}"`,
        });
    }

    if (!metaDescription) {
        recommendations.push({
            priority: 'high',
            item: 'Add a meta description',
            why: 'Without one, search engines auto-generate a snippet that may not be compelling. AI engines also use it for summarization.',
            how: `Add <meta name="description" content="..."> in <head>. Write 120–160 chars summarizing the page's key value proposition.`,
        });
    } else if (metaDescription.length < 100) {
        recommendations.push({
            priority: 'low',
            item: `Expand meta description (currently ${metaDescription.length} chars)`,
            why: 'Short descriptions underutilize the available snippet space in search results.',
            how: 'Expand to 120–160 chars with a clear value proposition and relevant keywords.',
        });
    }

    if (schemaTypeCount === 0) {
        const suggestedType = lowerText.includes('article') || lowerText.includes('blog') ? 'Article' :
            lowerText.includes('product') ? 'Product' :
            lowerText.includes('about') || lowerText.includes('company') ? 'Organization' :
            lowerText.includes('service') ? 'Service' : 'WebPage';
        recommendations.push({
            priority: 'high',
            item: 'Add Schema.org structured data',
            why: 'Structured data is the strongest signal for LLMs to correctly represent your entity and content in AI-generated answers.',
            how: `Add a JSON-LD <script type="application/ld+json"> block. Based on your content, start with the "${suggestedType}" schema type. Include name, description, and any relevant properties.`,
        });
    }

    if (h1Count === 0) {
        recommendations.push({
            priority: 'high',
            item: 'Add a single H1 heading',
            why: 'The H1 is the semantic "topic tag" of the page. Without it, search engines and LLMs struggle to identify the page\'s primary subject.',
            how: 'Add one <h1> near the top of the page body with your main keyword/topic. Keep it under 70 characters and make it descriptive.',
        });
    }

    if (!og.title || !og.description) {
        recommendations.push({
            priority: 'medium',
            item: 'Add Open Graph meta tags',
            why: 'OG tags control how your page appears when shared on social media, chat apps, and link previews — a key discoverability channel.',
            how: 'Add <meta property="og:title">, <meta property="og:description">, and <meta property="og:image"> in your <head>.',
        });
    }

    if (h2Count < 2 && wordCount > 300) {
        recommendations.push({
            priority: 'medium',
            item: 'Add H2 subheadings to organize content',
            why: 'H2 sections create scannable chunks that AI engines can extract as individual answers.',
            how: `Your page has ${wordCount} words but only ${h2Count} H2 tag(s). Break topics into 3–6 sections with descriptive H2 headings.`,
        });
    }

    if (!technical.hasCanonical) {
        recommendations.push({
            priority: 'medium',
            item: 'Add a canonical link tag',
            why: 'Without a canonical, URL parameters (like tracking tags) can create duplicate content issues.',
            how: `Add <link rel="canonical" href="${scrape.url ?? 'https://yourdomain.com/page/'}"> in <head>.`,
        });
    }

    if (img.total > 0 && (img.missingAlt ?? 0) > 0) {
        recommendations.push({
            priority: 'medium',
            item: `Add alt text to ${img.missingAlt} image(s)`,
            why: `${Math.round((img.missingAlt / img.total) * 100)}% of images lack alt text — this hurts accessibility, image search ranking, and AI context.`,
            how: 'Add descriptive alt attributes to each <img>. Describe what the image shows naturally, including relevant keywords.',
        });
    }

    if (questionHeadings.length === 0 && wordCount > 300) {
        recommendations.push({
            priority: 'medium',
            item: 'Add question-format headings',
            why: 'Pages with question headings (H2/H3 ending with "?") are far more likely to appear in featured snippets and AI answers.',
            how: 'Rephrase 2–3 H2/H3 headings as questions your audience would search for (e.g. "What is [topic]?", "How do I [action]?").',
        });
    }

    if (!sch.author && !authorByline) {
        recommendations.push({
            priority: 'low',
            item: 'Add author attribution',
            why: 'Google\'s E-E-A-T framework rewards content with identifiable authors. LLMs also prefer attributed content when constructing answers.',
            how: 'Add <meta name="author" content="Name">, an author byline on the page, or author info in Schema.org data.',
        });
    }

    if (!sch.datePublished) {
        recommendations.push({
            priority: 'low',
            item: 'Add publication date to schema',
            why: 'Content freshness signals help both search engines and AI models assess relevance. Undated content may be deprioritized.',
            how: 'Add "datePublished" and "dateModified" to your Schema.org JSON-LD block (ISO 8601 format).',
        });
    }

    if (externalDomains.length === 0 && wordCount > 500) {
        recommendations.push({
            priority: 'low',
            item: 'Link to authoritative external sources',
            why: 'Outbound links to reputable sources signal research quality and boost content credibility for GEO.',
            how: 'Add 2–5 links to relevant, authoritative sources (e.g. research papers, industry sites, official docs).',
        });
    }

    if (!cs.hasDirectAnswer && wordCount > 200) {
        recommendations.push({
            priority: 'low',
            item: 'Lead with a concise answer',
            why: 'AI answer engines and featured snippets prefer pages that provide a clear, concise answer in the first 1–2 sentences.',
            how: 'Start the main content with a 1–2 sentence direct answer to the page\'s primary question, then expand with detail.',
        });
    }

    if (ev.detected && !ev.hasSchema) {
        recommendations.push({
            priority: 'high',
            item: 'Add Schema.org Event markup to your events',
            why: `You have ${ev.count} events but no Event structured data. Google uses Event schema to show rich event snippets, date/time info, and ticket links directly in search results.`,
            how: 'Add JSON-LD <script type="application/ld+json"> blocks with @type "Event" for each event. Include name, startDate, endDate, location, description, and offers (for ticket links).',
        });
    }

    if (ev.detected && !ev.hasDateInfo) {
        recommendations.push({
            priority: 'medium',
            item: 'Add date information to events',
            why: 'Events without dates cannot be surfaced in date-filtered searches or calendar integrations.',
            how: 'Use <time datetime="YYYY-MM-DD"> elements or include startDate in Event schema. Ensure every event has a visible date.',
        });
    }

    if (ev.detected && !ev.hasTicketLinks) {
        recommendations.push({
            priority: 'low',
            item: 'Add ticket or registration links to events',
            why: 'Events with action links (buy tickets, register) drive higher engagement and can appear in Google\'s event rich results with direct CTAs.',
            how: 'Add "offers" with a URL in your Event schema, and include visible "Buy Tickets" or "Register" links for each event.',
        });
    }

    // ─── Summary ──────────────────────────────────────────────
    const avgScore = Math.round((seo + aeo + geo) / 3);
    let grade, gradeEmoji;
    if (avgScore >= 80) { grade = 'excellent'; gradeEmoji = '🟢'; }
    else if (avgScore >= 60) { grade = 'good'; gradeEmoji = '🟡'; }
    else if (avgScore >= 40) { grade = 'fair'; gradeEmoji = '🟠'; }
    else { grade = 'poor'; gradeEmoji = '🔴'; }

    const highPriCount = recommendations.filter(r => r.priority === 'high').length;
    const topStrengths = strengths.slice(0, 3).join('; ');
    const topIssues = issues.slice(0, 2).join('; ');

    const summary = `${gradeEmoji} Overall ${grade} (${avgScore}/100 avg across SEO ${seo}, AEO ${aeo}, GEO ${geo}). ` +
        (topStrengths ? `Strengths: ${topStrengths}. ` : '') +
        (topIssues ? `Key issues: ${topIssues}. ` : '') +
        (highPriCount > 0
            ? `${highPriCount} high-priority fix${highPriCount > 1 ? 'es' : ''} recommended — start there for the biggest impact.`
            : 'No critical issues found — focus on the medium-priority optimizations for incremental gains.');

    return {
        provider: 'simulation',
        scores: { seo, aeo, geo },
        summary,
        strengths,
        issues,
        recommendations,
    };
}
