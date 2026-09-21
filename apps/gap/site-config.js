// ===== Edit these before going live =====
window.KENSARA_SITE = {
  // Deep scanner API base. The scan call must hit the GCP box DIRECTLY (not via the
  // Vercel proxy at kensara.in), so a 90s gap scan never hits Vercel's request timeout.
  scannerBase: "https://tools.kensara.in",
  bookDemoUrl: "https://kensara.in/book-demo",
  privacyNoticeUrl: "https://kensara.in/privacy",
  contactEmail: "contact@kensara.in",
  turnstileSiteKey: "0x4AAAAAAE_K0NXlEPS4MHqw"   // Cloudflare Turnstile site key (public). Empty = no bot check.
};
