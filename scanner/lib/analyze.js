// Gap-assessment posture signals, computed from what the deep scan already collected
// (homepage response headers, page HTML, and the context's cookies). Ported from the
// old light gap scanner, but now grounded in a real browser visit instead of raw HTTP.

const NOTICE_DISCLOSURES = [
  { key: "dataCategories", label: "Data categories collected", re: /(data we collect|information we collect|categories of (personal )?data|types of data)/i },
  { key: "purposes", label: "Purposes of processing", re: /(purpose of|why we (collect|use|process)|how we use your)/i },
  { key: "retention", label: "Retention period", re: /(retention|how long we (keep|retain)|retain(ed)? for|storage period)/i },
  { key: "rights", label: "Data-principal rights", re: /(your rights|right to access|data principal rights|right to (correct|erasure|rectif))/i },
  { key: "grievance", label: "Grievance / DPO officer", re: /(grievance officer|grievance redressal|data protection officer|\bdpo\b)/i },
  { key: "withdrawal", label: "Consent withdrawal", re: /(withdraw(ing|al)? (of )?consent|revoke consent|opt[- ]?out)/i },
  { key: "crossBorder", label: "Cross-border transfers", re: /(cross[- ]?border|outside india|international transfer|transfer.{0,20}outside|other countries)/i },
  { key: "children", label: "Children's data", re: /(child(ren)?|minor|under 18|parental consent)/i },
  { key: "contact", label: "Privacy contact", re: /(privacy@|dpo@|grievance@|contact.{0,20}privacy|privacy.{0,20}(team|contact))/i },
];

// headers: a plain object of lower-cased response header names -> value (Playwright's response.headers()).
function buildSecurity(headers, https, cookies) {
  const get = k => (headers && (headers[k] || headers[k.toLowerCase()])) || "";
  const optionalCookies = cookies.filter(c => c.category !== "necessary");
  const cookieFlagsOk = optionalCookies.length === 0 || optionalCookies.every(c => c.httpOnly && c.secure);
  const csp = get("content-security-policy");
  return [
    { key: "https", label: "HTTPS enforced", ok: !!https },
    { key: "hsts", label: "HSTS (Strict-Transport-Security)", ok: !!get("strict-transport-security") },
    { key: "csp", label: "Content-Security-Policy", ok: !!csp },
    { key: "xcto", label: "X-Content-Type-Options", ok: /nosniff/i.test(get("x-content-type-options")) },
    { key: "xfo", label: "X-Frame-Options / frame-ancestors", ok: !!get("x-frame-options") || /frame-ancestors/i.test(csp) },
    { key: "referrer", label: "Referrer-Policy", ok: !!get("referrer-policy") },
    { key: "cookieFlags", label: "Secure + HttpOnly cookies", ok: cookieFlagsOk },
  ];
}

function buildDataPoints(html) {
  return [
    { key: "forms", label: "Collects data via forms", present: /<form[\s>]/i.test(html) },
    { key: "email", label: "Email capture", present: /type=["']?email["']?/i.test(html) },
    { key: "phone", label: "Phone capture", present: /type=["']?tel["']?/i.test(html) || /\b(mobile|phone)\b.{0,20}(number)?/i.test(html) },
    { key: "account", label: "Accounts (login / signup)", present: /(sign ?up|log ?in|register|create account|password)/i.test(html) },
    { key: "payment", label: "Payment collection", present: /(razorpay|stripe|payu|cashfree|checkout|card number|upi)/i.test(html) },
    { key: "children", label: "Age gate / children signals", present: /(age|date of birth|dob|student|kids|under 18|parental)/i.test(html) },
  ];
}

function detectLastUpdated(html) {
  const m = html.match(/(last updated|effective date|updated on|revised)[:\s]*([A-Za-z0-9,\s/-]{6,24})/i);
  return m ? m[2].trim().replace(/\s+/g, " ") : null;
}

function buildNotice(hasPrivacy, privacyText) {
  const disclosures = NOTICE_DISCLOSURES.map(d => ({ key: d.key, label: d.label, covered: hasPrivacy && d.re.test(privacyText) }));
  const covered = disclosures.filter(d => d.covered).length;
  return { present: hasPrivacy, lastUpdated: hasPrivacy ? detectLastUpdated(privacyText) : null, disclosures, covered, total: disclosures.length };
}

function emptyNotice() {
  return { present: false, lastUpdated: null, disclosures: NOTICE_DISCLOSURES.map(d => ({ key: d.key, label: d.label, covered: false })), covered: 0, total: NOTICE_DISCLOSURES.length };
}

module.exports = { NOTICE_DISCLOSURES, buildSecurity, buildDataPoints, buildNotice, emptyNotice, detectLastUpdated };
