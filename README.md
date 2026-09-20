# kensara-tools

AWS-hosted home for Kensara's two free tools, sharing **one deep scanner**:

- **Consent banner generator** — scan a site, configure a DPDP consent banner, see it working live.
- **Gap assessment** — scan a site, get a DPDP compliance-posture report.

Both call the same browser scanner; each renders its own view of one rich result. This repo is deployed entirely on **AWS** (the marketing site stays on Vercel and just links here), so scans aren't bound by Vercel's 60s function limit and can run deeper.

## Layout
```
scanner/        deep browser scanner service (Playwright + egress proxy)   ← built
apps/consent/   consent banner frontend (static)                            ← next
apps/gap/       gap-assessment frontend + report                            ← next
```

## Status
- [x] **Deep scanner** — unified superset result (consent + gap), merged vendor/cookie classifier, SSRF egress proxy, bounded ~60s scans with graceful partial. See `scanner/README.md`.
  - [x] Tier 1 — 3-state consent proof (does the banner actually block?), India-aware PII surface mapping, LLM-read privacy notice (provider-agnostic, keyword fallback).
  - [x] Tier 2 — journey-aware crawl (privacy/signup/checkout/contact), consent-UI quality (reject-parity, pre-ticked), children/age signals, optional evidence screenshot.
  - [x] Tier 3 — explainable DPDP readiness score, sector guess + benchmark.
- [ ] Consent frontend (port from the existing static kit).
- [ ] Gap frontend (port React components + scoring).
- [ ] API/lead + rate limiting.
- [ ] AWS deploy (Fargate/Lambda) + DNS.
- [ ] Live end-to-end validation on real sites (blocked in this sandbox by NAT64).

## Next step
Test the scanner (`scanner/README.md`), then wire the two frontends to its `/scan`.
