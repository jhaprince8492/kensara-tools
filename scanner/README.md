# Kensara deep scanner

One browser-based scanner that powers **both** free tools:

- **Consent banner generator** — cookies, browser storage, third-party hosts, org details (prefill).
- **Gap assessment** — security headers, privacy-notice coverage, data-collection points, vendors with region/PII, cross-border flows, CMP detection.

It visits a site like a first-time visitor who has **not** consented, records everything set before any choice, and derives a compliance posture — one `POST /scan`, one rich result each frontend reads its slice of.

## Why it lives on its own box (not Vercel)
Real Chromium is heavy and scans can run past 60s. Hosting it standalone (AWS Fargate / Lambda container / EC2) removes the Vercel function limit and the 512 MB OOM ceiling, so scans go deeper without losing quality.

## API

`POST /scan`
```json
{ "url": "example.in", "turnstileToken": "<optional, for browser-direct calls>" }
```
Auth is **either**:
- `Authorization: Bearer <SCANNER_TOKEN>` (server-to-server), **or**
- a valid Cloudflare **Turnstile** token + an allowed `Origin` (browser-direct).

`GET /health` → `{ ok, running, waiting }`.

### Result shape (superset)
`domain, pagesScanned, incomplete, score, scoreDetail`, plus:
- **consent:** `cookies[]`, `storage[]`, `thirdParties[]`, `site{orgName,privacyUrl,email,phone}`, `cmp`
- **consent proof (Tier 1):** `consent{bannerFound, hasAccept, hasReject, rejectParity, preTicked, trackersBeforeConsent, newTrackersAfterAccept, trackersAfterReject, blocksBeforeConsent, honoursReject, verdict}` — the three-state test proving whether the banner actually gates.
- **PII surface (Tier 1):** `dataCollection{collectsData, categories[], sensitiveCategories[], collectsChildAge}` — India-aware (Aadhaar/PAN/GSTIN/UPI…).
- **gap:** `security[]`, `notice{disclosures,covered,total,source}` (LLM-read when configured, else keyword), `dataPoints[]`, `vendors[]` (name/category/region/pii), `crossBorderRegions[]`, `cloudProviders[]`, `hasPrivacyPolicy`, `hasConsentBanner`, `consentGating`, `hasDpoNamed`, `hasGrievanceContact`, `hasRightsPage`, `https`
- **score (Tier 3):** `score` (0–100), `scoreDetail{grade, band, sector, benchmark, vsBenchmark, drivers[]}` — every deduction explained.
- **shared:** `findings[]` (with grounded upsell), `summary`, `hints[]`, `errors[]`, optional `evidence` (screenshot data URL).

Two profiles via `mode` in the request: **`gap`** (default) does the full deep read — journey pages, LLM notice, PII surface, three-state consent probe — with a generous budget so it stays qualitative even when several run at once; **`consent`** runs light (fewer pages, no LLM/PII/probe/HTML) so many can run concurrently cheaply. A per-IP rate limit applies to every request.

## Environment
| Var | Purpose |
|---|---|
| `SCANNER_TOKEN` | 32+ char bearer for server-to-server auth |
| `TURNSTILE_SECRET` | Cloudflare Turnstile secret (browser-direct auth) |
| `ALLOWED_ORIGINS` | comma-separated origins allowed for browser-direct/CORS |
| `MAX_PAGES` | gap-scan pages (default 6) |
| `GAP_DEADLINE_MS` | gap-scan budget, generous so it stays full-quality under load (default 90000) |
| `CONSENT_RESERVE_MS` | budget held back for the consent probe in a gap scan (default 22000) |
| `CONSENT_MAX_PAGES` | consent-scan pages (default 3) |
| `CONSENT_DEADLINE_MS` | consent-scan budget — light profile, no probe/LLM/PII (default 40000) |
| `PAGE_TIMEOUT_MS` | per-page nav timeout (default 15000) |
| `MAX_CONCURRENT_SCANS` | parallel scans on this box (default 2; set to 5 on a 4–8 GB box) |
| `RATE_MAX_PER_MIN` | scans per IP per minute (default 6; 0 = off) |
| `RATE_MAX_CONCURRENT_IP` | in-flight scans per IP (default 2) |
| `MAX_WAITING` | queue depth before returning "busy" 503 (default 10) |
| `CAPTURE_EVIDENCE` | `1` = attach a homepage screenshot (data URL) as evidence |
| `LLM_BASE_URL` | OpenAI-compatible base, e.g. `https://integrate.api.nvidia.com/v1` (NIM), `https://api.openai.com/v1` |
| `LLM_API_KEY` | LLM key — **absent ⇒ LLM off, keyword notice fallback used** |
| `LLM_MODEL` | e.g. `meta/llama-3.1-8b-instruct`, `gpt-4.1-nano`, `gemini-2.0-flash` |
| `SCANNER_SINGLE_PROCESS` | `1` = single-process Chromium (very low RAM, last resort) |
| `SCANNER_NO_SANDBOX` | `1` = disable Chromium sandbox (only if the container can't sandbox) |
| `CHROMIUM_PATH` | override the Chromium executable |

## Run locally
```bash
cd scanner
npm install
npx playwright install chromium   # first time
SCANNER_TOKEN=$(openssl rand -hex 32) node server.js
curl -s -XPOST localhost:8080/scan -H "authorization: Bearer $SCANNER_TOKEN" \
  -H 'content-type: application/json' -d '{"url":"https://example.com"}' | jq .
```

## Deploy
Build the image and run it on AWS (Fargate, Lambda container, or EC2). Keep it **out of a VPC** so internet egress is free (no NAT gateway needed); the in-process egress proxy (`lib/egress-proxy.js`) is the SSRF control.
```bash
docker build -t kensara-deep-scanner ./scanner
```

## Security model
All Chromium traffic is forced through `lib/egress-proxy.js`: it resolves DNS once, refuses private / loopback / link-local / NAT64 / 6to4 / Teredo addresses, allows only ports 80/443, and connects to the exact IP it checked — so DNS rebinding has no window.
