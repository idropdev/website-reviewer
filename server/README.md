# Website Reviewer — Server

Node.js/Express backend with Puppeteer scraping and deterministic SEO/AEO/GEO scoring.

## Requirements

- Node.js 20+
- npm 9+

## Local Development

```bash
# From server/ directory
cp .env.example .env
npm install      # Downloads Puppeteer + Chromium (~170 MB, first run only)
npm run dev      # Starts server with --watch on port 8080
```

Or from the **repo root**:

```bash
npm run dev:server
```

Or start **both client and server** together:

```bash
npm run dev
```

## API Reference

### `POST /api/scan`

Scrapes a public URL and returns SEO/AEO/GEO scores with recommendations.

**Request:**
```bash
curl -X POST http://localhost:8080/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

**Success Response (200):**
```json
{
  "url": "https://example.com",
  "scrape": {
    "title": "Example Domain",
    "metaDescription": "",
    "headings": { "h1": ["Example Domain"], "h2": [], "h3": [] },
    "visibleText": "Example Domain This domain is for use in illustrative...",
    "links": { "internal": 0, "external": 1 },
    "technical": { "hasSchema": false, "hasCanonical": false, "hasNoindex": false }
  },
  "analysis": {
    "provider": "simulation",
    "scores": { "seo": 55, "aeo": 32, "geo": 18 },
    "summary": "...",
    "strengths": ["Single H1 tag — correct semantic hierarchy"],
    "issues": ["Missing meta description", "No Schema.org structured data"],
    "recommendations": [
      {
        "priority": "high",
        "item": "Add a meta description",
        "why": "...",
        "how": "..."
      }
    ]
  }
}
```

**Error Response (400/502):**
```json
{
  "url": "http://localhost",
  "error": {
    "code": "BLOCKED",
    "message": "Hostname \"localhost\" is not allowed."
  }
}
```

**Error codes:**
| Code | Meaning |
|------|---------|
| `INVALID_URL` | Malformed, non-http/https, or unresolvable URL |
| `BLOCKED` | URL resolves to a private/loopback IP (SSRF protection) |
| `TIMEOUT` | Puppeteer timed out waiting for the page |
| `SCRAPE_FAILED` | Any other Puppeteer/network error |

### `GET /health`

Returns `{ "status": "ok" }`.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Server port (Cloud Run sets this automatically) |
| `PUPPETEER_TIMEOUT_MS` | `15000` | Max ms to wait for page load |
| `MAX_TEXT_CHARS` | `30000` | Max chars of visible text to extract |
| `AI_PROVIDER` | `none` | Set to `openai` or `gemini` for Phase 2 |
| `OPENAI_API_KEY` | — | OpenAI API key (Phase 2) |
| `GEMINI_API_KEY` | — | Gemini API key (Phase 2) |

---

## Cloud Run Deployment (Phase 2)

1. **Build the image:**
   ```bash
   docker build -t website-reviewer-server .
   ```

2. **Test locally:**
   ```bash
   docker run -p 8080:8080 --env-file .env website-reviewer-server
   ```

3. **Push to Artifact Registry:**
   ```bash
   docker tag website-reviewer-server gcr.io/YOUR_PROJECT/website-reviewer-server
   docker push gcr.io/YOUR_PROJECT/website-reviewer-server
   ```

4. **Deploy:**
   ```bash
   gcloud run deploy website-reviewer-server \
     --image gcr.io/YOUR_PROJECT/website-reviewer-server \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars AI_PROVIDER=none
   ```

> **Note:** Cloud Run automatically provides the `PORT` environment variable. The server reads it via `process.env.PORT || 8080`.
>
> For Puppeteer on Cloud Run, the Docker image uses `ghcr.io/puppeteer/puppeteer` which bundles Chromium — no extra setup needed.
