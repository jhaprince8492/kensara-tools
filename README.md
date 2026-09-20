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
- [x] **Deep scanner** — unified superset result (consent + gap), merged vendor/cookie classifier, SSRF egress proxy, bounded sub-budget scans. See `scanner/README.md`.
- [ ] Consent frontend (port from the existing static kit).
- [ ] Gap frontend (port React components + scoring).
- [ ] API/lead + Turnstile + rate limiting.
- [ ] AWS deploy (Fargate/Lambda) + DNS.

## Next step
Test the scanner (`scanner/README.md`), then wire the two frontends to its `/scan`.
