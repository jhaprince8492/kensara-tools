// Sample deep-scan result so "View a sample report" renders the full dashboard offline.
window.__SAMPLE__ = {
  domain: "sample-store.in", scannedAt: new Date().toISOString(), pagesScanned: 6, pagesVisited: ["/", "/checkout", "/account", "/contact", "/privacy", "/about"], incomplete: false,
  score: 34, scoreDetail: { score: 34, grade: "E", band: "Critical", sector: "ecommerce", benchmark: 44, vsBenchmark: -10 },
  consent: { bannerFound: true, hasAccept: true, hasReject: false, rejectParity: false, preTicked: true, trackersBeforeConsent: 5, newTrackersAfterAccept: 3, trackersAfterReject: null, blocksBeforeConsent: false, honoursReject: null, verdict: "tracks-before-consent" },
  summary: { pages: 6, cookies: 18, trackers: 5, preConsentCookies: 7, cmp: "detected", crossBorder: 2, sensitivePII: 2, consentVerdict: "tracks-before-consent" },
  cookies: [
    { name: "_ga", vendor: "Google Analytics", category: "analytics" }, { name: "_gid", vendor: "Google Analytics", category: "analytics" },
    { name: "_fbp", vendor: "Meta (Facebook)", category: "marketing" }, { name: "_gcl_au", vendor: "Google Ads", category: "marketing" },
    { name: "_clck", vendor: "Microsoft Clarity", category: "analytics" }, { name: "PHPSESSID", vendor: "Website (session)", category: "necessary" },
    { name: "razorpay_checkout", vendor: "Razorpay", category: "necessary" }
  ],
  storage: [{ area: "localStorage", key: "_hjSessionUser_2931", vendor: "Hotjar", category: "analytics" }],
  thirdParties: [
    { host: "www.google-analytics.com", vendor: "Google Analytics", category: "analytics", region: "US", pii: true, requests: 8 },
    { host: "connect.facebook.net", vendor: "Meta Pixel", category: "marketing", region: "US", pii: true, requests: 5 },
    { host: "static.hotjar.com", vendor: "Hotjar", category: "analytics", region: "EU", pii: true, requests: 3 },
    { host: "checkout.razorpay.com", vendor: "Razorpay", category: "necessary", region: "IN", pii: true, requests: 2 }
  ],
  cmp: "detected",
  vendors: [
    { name: "Google Analytics", category: "analytics", region: "US", pii: true }, { name: "Meta Pixel", category: "advertising", region: "US", pii: true },
    { name: "Google Ads", category: "advertising", region: "US", pii: true }, { name: "Hotjar", category: "sessionReplay", region: "EU", pii: true },
    { name: "Microsoft Clarity", category: "sessionReplay", region: "US", pii: true }, { name: "Razorpay", category: "payment", region: "IN", pii: true },
    { name: "Cloudflare", category: "cloud", region: "US", pii: false }, { name: "Google Fonts", category: "fonts", region: "US", pii: false }
  ],
  vendorCount: 8, piiVendorCount: 6, trackers: ["Google Analytics", "Meta Pixel", "Google Ads", "Hotjar", "Microsoft Clarity"],
  cloudProviders: ["Cloudflare"], crossBorderRegions: ["US", "EU"],
  security: [
    { key: "https", label: "HTTPS enforced", ok: true }, { key: "hsts", label: "HSTS", ok: false }, { key: "csp", label: "Content-Security-Policy", ok: false },
    { key: "xcto", label: "X-Content-Type-Options", ok: true }, { key: "xfo", label: "X-Frame-Options", ok: false }, { key: "referrer", label: "Referrer-Policy", ok: false },
    { key: "cookieFlags", label: "Secure + HttpOnly cookies", ok: false }
  ],
  notice: {
    source: "llm", present: true, covered: 4, total: 9,
    disclosures: [
      { key: "dataCategories", label: "Itemised personal data collected", covered: true }, { key: "purposes", label: "Specific purposes of processing", covered: true },
      { key: "retention", label: "Retention period / erasure", covered: false }, { key: "rights", label: "Data-principal rights", covered: true },
      { key: "grievance", label: "Named grievance officer with contact", covered: false }, { key: "withdrawal", label: "How to withdraw consent", covered: true },
      { key: "crossBorder", label: "Cross-border transfer disclosure", covered: false }, { key: "children", label: "Children's data / parental consent", covered: false },
      { key: "board", label: "Right to complain to the Board", covered: false }
    ],
    summary: "The notice lists data and purposes and mentions rights, but names no grievance officer, is silent on retention, cross-border transfers and children, and doesn't mention the Data Protection Board.",
    gaps: ["No named grievance officer", "No retention period stated", "Cross-border transfers not disclosed", "Children's data not addressed"], lastUpdated: "March 2024"
  },
  dataPoints: [
    { key: "forms", label: "Collects data via forms", present: true }, { key: "email", label: "Email capture", present: true },
    { key: "phone", label: "Phone capture", present: true }, { key: "account", label: "Accounts (login / signup)", present: true },
    { key: "payment", label: "Payment collection", present: true }, { key: "children", label: "Age gate / children signals", present: true }
  ],
  dataCollection: {
    collectsData: true, fieldCount: 22, collectsChildAge: true, sensitiveCategories: ["Government ID", "Financial"],
    categories: [
      { category: "government_id", label: "Government ID", risk: "high", count: 1, examples: ["PAN Card"] },
      { category: "financial", label: "Financial", risk: "high", count: 2, examples: ["Card number", "UPI ID"] },
      { category: "phone", label: "Phone", risk: "medium", count: 2, examples: ["Mobile number"] },
      { category: "dob_age", label: "Date of birth / age", risk: "medium", count: 1, examples: ["Date of birth"] },
      { category: "email", label: "Email", risk: "low", count: 3, examples: ["Email"] },
      { category: "name", label: "Name", risk: "low", count: 2, examples: ["Full name"] }
    ]
  },
  https: true, hasPrivacyPolicy: true, hasConsentBanner: true, consentGating: false, hasDpoNamed: false, hasGrievanceContact: false, hasRightsPage: true,
  findings: [], errors: []
};
// Typical answers baked into the sample so "View a sample report" shows the full,
// scan+questionnaire assessment without making the visitor fill the form.
window.__SAMPLE_ANSWERS__ = { rights: 52, breach: 48, consentRecords: 50, retention: 48, processors: 50, scale: "1Lto10L" };
