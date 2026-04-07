import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

const GEMINI_MODEL = 'gemini-2.5-flash';
const OPENAI_MODEL = 'gpt-4o-mini'; // fast + cheap; swap to gpt-4o for higher quality

/**
 * Builds the shared prompt payload from the scrape result.
 */
function buildPrompt(scrape) {
  const {
    url, slug, title, metaDescription, og, headings, questionHeadings,
    visibleText, wordCount, contentSignals, schema, authorByline,
    hasAboutContact, images, links, technical,
  } = scrape;

  const snippet = (visibleText ?? '').slice(0, 5000);
  const cs = contentSignals ?? {};
  const sch = schema ?? {};
  const img = images ?? {};
  const ogData = og ?? {};

  const faqSection = (sch.faqEntries ?? []).length > 0
    ? sch.faqEntries.map((e) => `  Q: ${e.question}\n  A: ${e.answer}`).join('\n')
    : '(none)';

  return `You are an expert SEO, AEO (Answer Engine Optimization), and GEO (Generative Engine Optimization) analyst. 
          Analyze the following website page data and return a JSON object with scores and recommendations.

## Page Data
- URL: ${url ?? '(unknown)'}
- URL Slug: ${slug ?? '/'}
- Title: ${title || '(none)'}
- Meta Description: ${metaDescription || '(none)'}
- OG Title: ${ogData.title ?? '(none)'}
- OG Description: ${ogData.description ?? '(none)'}
- Canonical URL: ${technical?.canonical ?? '(none)'}
- Has Noindex: ${technical?.hasNoindex ?? false}

## Heading Structure
- H1: ${JSON.stringify(headings?.h1 ?? [])}
- H2s: ${JSON.stringify(headings?.h2 ?? [])}
- H3s: ${JSON.stringify(headings?.h3 ?? [])}
- Question headings: ${JSON.stringify(questionHeadings ?? [])}

## Content Signals
- Visible Word Count: ${wordCount ?? 0}
- Has lists: ${cs.hasLists ?? false}
- Has direct answer in first 150 words: ${cs.hasDirectAnswer ?? false}
- Avg sentence length: ${cs.avgSentenceLength ?? 0} words (${cs.readingLevel ?? 'unknown'})

## Schema.org
- Types found: ${JSON.stringify(sch.types ?? [])}
- Author (schema): ${sch.author ?? '(none)'}
- datePublished: ${sch.datePublished ?? '(none)'}
- dateModified: ${sch.dateModified ?? '(none)'}
- FAQ entries:
${faqSection}

## Trust Signals
- Author byline on page: ${authorByline ?? '(none)'}
- Has About/Contact link: ${hasAboutContact ?? false}
- External link domains: ${JSON.stringify((links?.externalDomains ?? []).slice(0, 20))}

## Images
- Total: ${img.total ?? 0}
- Missing alt text: ${img.missingAlt ?? 0}

## Links
- Internal: ${links?.internal ?? 0}
- External: ${links?.external ?? 0}

## Events
- Events detected: ${(scrape.events?.detected) ?? false}
- Event count: ${scrape.events?.count ?? 0}
- Has Event schema: ${scrape.events?.hasSchema ?? false}
- Has date info: ${scrape.events?.hasDateInfo ?? false}
- Has ticket/registration links: ${scrape.events?.hasTicketLinks ?? false}
- Detection signals: ${JSON.stringify(scrape.events?.signals ?? [])}
- Event names (first 10): ${JSON.stringify((scrape.events?.items ?? []).slice(0, 10).map(e => e.name))}

## Visible Text (first 5000 chars):
${snippet}

## Required JSON Output Format
Return ONLY a valid JSON object in this exact shape (no markdown, no explanation, no code fences):
{
  "scores": {
    "seo": <integer 0-100>,
    "aeo": <integer 0-100>,
    "geo": <integer 0-100>
  },
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "issues": ["<issue 1>", "<issue 2>"],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "item": "<short title>",
      "why": "<why it matters>",
      "how": "<specific actionable fix>"
    }
  ]
}

## Scoring Criteria
- SEO (0-100): Title tag quality, meta description, H1 presence and clarity, canonical tag, noindex status, image alt coverage, internal link structure, word count adequacy
- AEO (0-100): Heading hierarchy, presence of question-format headings, lists/structured content, direct answer near top of page, reading level (basic/intermediate preferred), FAQPage schema
- GEO (0-100): Entity clarity from schema types and content, named author + dates present, schema richness (multiple types, key properties filled), factual/citable content style, external link authority signals

Be specific and actionable. Recommendations should reference the actual page content where possible.`;
}

/**
 * Normalise and validate the parsed JSON from any provider.
 * Returns null if the shape is wrong.
 */
function normalise(parsed, provider, model) {
  if (
    typeof parsed.scores?.seo !== 'number' ||
    typeof parsed.scores?.aeo !== 'number' ||
    typeof parsed.scores?.geo !== 'number'
  ) {
    console.error(`[aiScoring] ${provider} returned unexpected shape:`, parsed);
    return null;
  }
  parsed.scores.seo = Math.min(100, Math.max(0, Math.round(parsed.scores.seo)));
  parsed.scores.aeo = Math.min(100, Math.max(0, Math.round(parsed.scores.aeo)));
  parsed.scores.geo = Math.min(100, Math.max(0, Math.round(parsed.scores.geo)));

  return {
    provider,
    model,
    scores: parsed.scores,
    summary: parsed.summary ?? '',
    strengths: parsed.strengths ?? [],
    issues: parsed.issues ?? [],
    recommendations: parsed.recommendations ?? [],
  };
}

/** Strip markdown code fences if the model wraps its JSON output */
function stripFences(text) {
  return text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function scoreWithGemini(scrape) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent(buildPrompt(scrape));
  const text = stripFences(result.response.text().trim());
  return normalise(JSON.parse(text), 'gemini', GEMINI_MODEL);
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function scoreWithOpenAI(scrape) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: 'json_object' }, // enforces JSON output
    messages: [
      {
        role: 'system',
        content: 'You are an expert SEO, AEO, and GEO analyst. Always respond with valid JSON only.',
      },
      {
        role: 'user',
        content: buildPrompt(scrape),
      },
    ],
  });
  const text = stripFences(completion.choices[0].message.content.trim());
  return normalise(JSON.parse(text), 'openai', OPENAI_MODEL);
}

// ─── Public entry point ────────────────────────────────────────────────────────

/**
 * Score a page using an AI provider (Gemini or OpenAI).
 * Provider is selected via AI_PROVIDER env var.
 * Returns null on any error so the caller can fall back to simulation scoring.
 *
 * @param {object} scrape - Result from scraper.js
 * @returns {object|null} analysis result, or null on failure
 */
export async function aiScore(scrape) {
  const provider = (process.env.AI_PROVIDER ?? '').toLowerCase();

  try {
    if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      return await scoreWithGemini(scrape);
    }
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      return await scoreWithOpenAI(scrape);
    }
    // No valid provider/key configured
    return null;
  } catch (err) {
    console.error(`[aiScoring] ${provider} call failed, falling back to simulation:`, err.message);
    return null;
  }
}
