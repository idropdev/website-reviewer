# HANDOFF.md

## 1. Purpose

`website-reviewer` is a two-part web app that audits a single public web page for SEO, AEO (Answer Engine Optimization), and GEO (Generative Engine Optimization) quality. A user pastes a URL into the React frontend; the Express backend uses Puppeteer (with stealth plugin) to scrape the rendered page, extracts structural signals (headings, meta tags, schema.org/JSON-LD, word count, internal/external links, and — notably — event listings with dates/ticket links), then scores the page either with an AI model (Gemini or OpenAI, whichever is configured) or with a deterministic rule-based fallback ("simulation" scoring) when no AI key is set. Output is a JSON result with `seo`/`aeo`/`geo` scores (0-100), a summary, strengths, issues, and prioritized recommendations, rendered in the UI along with a dedicated panel for any detected events on the page.

## 2. Status

**Dormant.** Last commit `876e1633` ("fix: increase puppeteer parsing timeout back to 30s") on **2026-04-07**, current branch `main`, working tree clean. No commits in over 4 months as of 2026-08-21. Backend was deployed to Google Cloud Run (`website-reviewer-api-489261110781.us-central1.run.app`, per `client/.env.production` and root-level `cloud*.log` files from an April 2026 deploy session).

## 3. Stack

Monorepo with npm workspaces (`client`, `server`), root `package.json` has no `dependencies`, only dev tooling.

**Root**
- `concurrently` ^9.1.2 (runs client + server dev servers together)

**client/** (React + Vite)
- `react` ^19.2.0, `react-dom` ^19.2.0
- `vite` ^6.3.5, `@vitejs/plugin-react` ^4.3.4
- `eslint` ^9.21.0, `@eslint/js` ^9.39.1, `eslint-plugin-react-hooks` ^5.1.0, `eslint-plugin-react-refresh` ^0.4.19
- `@types/react` ^19.2.7, `@types/react-dom` ^19.2.3, `globals` ^15.15.0

**server/** (Node/Express, ESM)
- `express` ^4.21.2, `cors` ^2.8.5, `dotenv` ^16.4.7
- `puppeteer` ^24.3.0, `puppeteer-extra` ^3.3.6, `puppeteer-extra-plugin-stealth` ^2.11.2
- `@google/generative-ai` ^0.24.1 (Gemini), `openai` ^6.33.0 (OpenAI)
- `helmet` ^8.1.0, `express-rate-limit` ^8.3.2 — **installed but not wired into `server/index.js`** (see Gotchas)
- Dev: `nodemon` ^3.1.9

Runtime: no root `.nvmrc`/`engines` field. `server/README.md` states **Node.js 20+, npm 9+** as a requirement (documentation only, not enforced in any manifest).

## 4. Setup & Commands

From repo root:
```bash
npm run install:all   # installs root + client + server workspaces
npm run dev            # runs client (Vite) and server (nodemon) concurrently
npm run build           # builds client only (npm run build --workspace=client)
```
Individual:
```bash
npm run dev:client     # client dev server (Vite)
npm run dev:server     # server dev server (nodemon, port 8080)
```
Server also has its own `start` script (`node index.js`, no watch) — run via `npm start --workspace=server` or from `server/`.

- **No test script defined** at root, client, or server. `test.mjs`, `test_gemini.mjs`, `test_server.mjs` (repo root) and `server/test.mjs`, `server/test_visit.mjs` are standalone manual scripts (`node test.mjs`), not wired to `npm test`.
- **Lint**: only `client` has a lint script — `npm run lint --workspace=client` (ESLint flat config, `client/eslint.config.js`). No lint script for `server` or root.
- `predev` (root) kills any process already listening on port 8080 before `npm run dev` starts (Windows-specific `netstat`/`taskkill` logic).
- `server/Dockerfile` builds on `ghcr.io/puppeteer/puppeteer:24.3.0`, exposes port 8080, runs `node index.js` — used for the Cloud Run deployment described in `server/README.md`.

## 5. Architecture Map

```
/
├── client/                       React 19 + Vite SPA
│   ├── src/
│   │   ├── App.jsx               Top-level state, calls POST /api/scan, renders panels
│   │   ├── components/
│   │   │   ├── ScannerInput.jsx  URL input + submit
│   │   │   ├── AIScanVisualizer.jsx  Renders scores/strengths/issues/recommendations
│   │   │   └── EventsPanel.jsx   Renders detected events (from scrape.events)
│   │   └── main.jsx              React root mount
│   └── .env.production            VITE_API_URL — public build-time API base URL
│
├── server/                       Express API (ESM)
│   ├── index.js                   App bootstrap, CORS, /health, mounts /api routes
│   ├── routes/scan.js             POST /api/scan — orchestrates validate -> scrape -> score
│   ├── services/
│   │   ├── scraper.js (606 lines) Puppeteer scrape: DOM extraction, redirect resolution,
│   │   │                          CDP probing, schema.org/event extraction, text limits
│   │   ├── scoring.js (582 lines) Deterministic "simulation" scoring (no AI key needed)
│   │   └── aiScoring.js           AI-based scoring: Gemini and OpenAI implementations,
│   │                              prompt builder, response normalization
│   ├── utils/
│   │   ├── validators.js          validateUrl() — SSRF protection (blocks private/loopback
│   │   │                          IPs, resolves DNS to check, strips tracking params)
│   │   └── limits.js              PUPPETEER_TIMEOUT_MS / MAX_TEXT_CHARS env-backed constants
│   ├── Dockerfile                 Cloud Run deployment image
│   └── README.md                  API reference, env var table, deploy steps (see notes below)
│
├── graphify-out/                  Codebase knowledge graph (see section 10)
└── cloud*.log, out.txt            Local artifacts from a past Cloud Run debugging session
```

## 6. Entry Points — Read These First

1. `server/routes/scan.js` — the entire request lifecycle (validate → scrape → score → respond) in one file; best single place to understand the product.
2. `server/utils/validators.js` — SSRF-protection logic gating every scrape; understand this before changing URL handling.
3. `server/services/scraper.js` — largest and most complex file; Puppeteer launch args, redirect-following, CDP probing, and the event-detection heuristics all live here.
4. `server/services/aiScoring.js` — provider selection (Gemini vs OpenAI), prompt construction, and JSON response normalization/fallback.
5. `client/src/App.jsx` — frontend request flow and where `VITE_API_URL` is consumed.
6. `server/README.md` — documents the `/api/scan` contract, error codes, and Cloud Run deploy steps (written for Phase 2; cross-check against `aiScoring.js` since both providers are now implemented, not just Gemini).

## 7. Conventions & Gotchas

- **`helmet` and `express-rate-limit` are dependencies of `server/` but are not imported or used anywhere in `server/index.js` or `server/routes/scan.js`.** The API currently has no rate limiting or security headers applied despite these packages being installed — likely intended but not finished.
- **Platform-conditional Puppeteer args**: `server/services/scraper.js` adds `--single-process` only on Linux (`os.platform() === 'linux'`), with a comment noting it's required for Docker/Cloud Run but causes renderer crashes on Windows/macOS dev machines. Do not force this flag on for local dev.
- **AI provider selection is env-driven, not per-request**: `AI_PROVIDER` (`gemini`|`openai`|unset) plus the matching `*_API_KEY` determines scoring mode server-wide; if unset or the key is missing, `routes/scan.js` silently falls back to deterministic `score()` (simulation) — this is by design, not a bug, but easy to mistake for a broken AI integration.
- **`server/README.md`'s env var table lists only `AI_PROVIDER`/`OPENAI_API_KEY`/`GEMINI_API_KEY` as "Phase 2"** and describes the Gemini/OpenAI split as forthcoming, but `aiScoring.js` already fully implements both providers — the README is stale relative to the code.
- Root-level `test.mjs`, `test_gemini.mjs`, `test_server.mjs`, `out.txt`, and `cloud*.log` are ad hoc debugging artifacts from development/deployment sessions, not part of the app or a documented workflow.
- `client/.env.production` is committed to git (confirmed via `git ls-files`) but only contains `VITE_API_URL`, a Vite public build-time value by design (`VITE_` prefix) — not a secret.

## 8. External Dependencies & Environment

**Services**
- Google Gemini API (`@google/generative-ai`, model `gemini-2.5-flash`) — optional AI scoring provider.
- OpenAI API (`openai` SDK, model `gpt-4o-mini`) — optional AI scoring provider.
- Google Cloud Run — deployment target for `server/` (see `server/Dockerfile`, `server/README.md`; live URL referenced in `client/.env.production` and `cloud*.log`, current live status UNKNOWN — not verified in this pass).

**Environment variables** (see `server/.env.example` for the template; `server/.env` exists locally but is git-ignored and was not read for values):
| Variable | Where | Purpose |
|---|---|---|
| `PORT` | server | Server port, default 8080 (Cloud Run sets automatically) |
| `PUPPETEER_TIMEOUT_MS` | server | Max ms to wait for page load (default 30000 in code, `.env.example` shows 15000) |
| `MAX_TEXT_CHARS` | server | Max chars of visible text extracted (default 30000) |
| `AI_PROVIDER` | server | `gemini`, `openai`, or unset/`none` for simulation-only scoring |
| `GEMINI_API_KEY` | server | Required only if `AI_PROVIDER=gemini` |
| `OPENAI_API_KEY` | server | Required only if `AI_PROVIDER=openai` |
| `VITE_API_URL` | client | Public backend base URL, baked in at build time (`client/.env.production`) |

No secret values are reproduced here or elsewhere in this document.

## 9. Known Issues & TODOs

- `helmet` and `express-rate-limit` are installed but unused (see Gotchas, section 7) — the API has no rate limiting or security-header middleware currently active.
- `server/README.md`'s "Phase 2" framing and env var table are out of date relative to the implemented AI scoring code.
- No automated test suite exists; the several `test*.mjs` scripts at root and in `server/` are manual/ad hoc and require live network access and (for AI scoring) a valid API key to exercise those code paths.
- Git history shows a "went back to when it worked" commit (`7aaa8d3`) preceding stabilization commits — no open issue tracker in-repo to cross-reference, so the underlying instability is not otherwise documented.

## 10. Fast Orientation for a New Agent

1. Orient with the graph first (cheap): `export PATH="$HOME/.local/bin:$PATH"` then `graphify-out/GRAPH_REPORT.md` (already generated) or `graphify god-nodes --top 15` for the most-connected functions (`scrape()`, `validateUrl()`, `aiScore()`, `main()`, `extractData()`, `scoreWithGemini()`, `scoreWithOpenAI()`, `score()`).
2. Best first question for this repo: **`graphify query "what calls scrape() and what does it depend on"`** — `scrape()` is the top god node (7 edges) and the functional core; tracing its callers/dependents surfaces the request lifecycle (`routes/scan.js`), the scoring paths (`scoring.js`, `aiScoring.js`), and the SSRF gate (`validators.js`) in one pass.
3. Then read, in order: `server/routes/scan.js` → `server/utils/validators.js` → `server/services/scraper.js` → `server/services/aiScoring.js` → `client/src/App.jsx` (see section 6 for why each matters).
4. To run locally: `npm run install:all` then `npm run dev` from repo root; copy `server/.env.example` to `server/.env` first (simulation scoring works with no AI key at all — only set `AI_PROVIDER`/`*_API_KEY` to test the AI path).
5. Graph freshness: built from commit `876e1633`, which matches current `HEAD` — no `graphify update .` needed unless new commits land first.
