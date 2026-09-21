// ===== Edit these before going live =====
window.KENSARA_SITE = {
  // Deep scanner API base. The scan call must hit the GCP box DIRECTLY (not via the
  // Vercel proxy at kensara.in), so a 90s gap scan never hits Vercel's request timeout.
  scannerBase: "https://tools.kensara.in",
  bookDemoUrl: "https://kensara.in/book-demo",
  privacyNoticeUrl: "https://kensara.in/privacy",   // Kensara's OWN privacy notice (covers the lead form and scans)
  contactEmail: "contact@kensara.in",
  pricingUrl: "https://kensara.in/pricing",
  turnstileSiteKey: "0x4AAAAAAE_K0NXlEPS4MHqw"       // Cloudflare Turnstile site key (public). Empty = no bot check.
};
