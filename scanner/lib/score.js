// A single, explainable DPDP-readiness score (0-100, higher = better) plus a sector
// guess and a rough benchmark. Grounded entirely in the scan signals — every deduction
// is listed in `drivers` so the report can show its working. The gap frontend may still
// apply its own scoring; this is a scanner-side convenience + upsell hook.

const SECTORS = [
  ["fintech", /razorpay|payu|cashfree|stripe|paypal|loan|credit|mutual fund|insurance|\bnbfc\b|\bupi\b|wallet|banking/i],
  ["ecommerce", /cart|checkout|add to cart|shop|store|product|woocommerce|shopify|magento/i],
  ["healthcare", /clinic|hospital|patient|doctor|pharma|health|diagnos|medic/i],
  ["education", /course|student|admission|school|college|university|\bedu\b|learning/i],
  ["saas", /pricing|sign ?up|free trial|dashboard|api|integrat|\bsaas\b|book a demo/i],
  ["media", /article|news|subscribe|newsletter|editor|magazine|blog/i],
];

function guessSector(html) {
  const h = String(html || "").slice(0, 20000);
  for (const [name, re] of SECTORS) if (re.test(h)) return name;
  return "general";
}

// Static, indicative sector baselines (avg readiness we typically see). Placeholder
// numbers — refine with real data later; used only for "you vs typical" framing.
const SECTOR_BASELINE = { fintech: 58, ecommerce: 44, healthcare: 46, education: 42, saas: 52, media: 38, general: 46 };

function computeScore(r) {
  let score = 100;
  const drivers = [];
  const hit = (pts, text) => { score -= pts; drivers.push({ impact: -pts, text }); };

  const preTrackers = (r.summary && r.summary.trackers) || 0;
  const preCookies = (r.summary && r.summary.preConsentCookies) || 0;
  if (preTrackers || preCookies) hit(25, `Tracks before consent (${preTrackers} tracker host(s), ${preCookies} optional cookie/storage item(s)).`);

  const c = r.consent || {};
  if (c.bannerFound && c.verdict === "ignores-reject") hit(15, "Consent banner does not honour “Reject”.");
  else if (c.bannerFound && !c.hasReject) hit(8, "Consent banner has no clear “Reject” option (parity failure).");
  if (c.preTicked) hit(8, "Optional purposes are pre-ticked in the banner.");
  if (!c.bannerFound && (preTrackers || preCookies)) hit(6, "No consent banner detected while tracking before consent.");

  if (!r.hasPrivacyPolicy) hit(25, "No privacy notice found.");
  else if (r.notice && r.notice.total) { const missing = r.notice.total - r.notice.covered; if (missing > 0) hit(Math.round((missing / r.notice.total) * 20), `Privacy notice missing ${missing}/${r.notice.total} DPDP disclosures.`); }

  const secMissing = (r.security || []).filter(s => !s.ok).length;
  if (secMissing) hit(Math.min(10, secMissing * 2), `${secMissing} security header(s)/control(s) missing.`);

  if ((r.crossBorderRegions || []).length) hit(8, `Cross-border data flows (${r.crossBorderRegions.join(", ")}) — must be disclosed.`);

  const pii = r.dataCollection || {};
  if ((pii.sensitiveCategories || []).length) hit(6, `Collects higher-risk personal data (${pii.sensitiveCategories.join(", ")}).`);
  if (pii.collectsChildAge && !(r.notice && r.notice.disclosures && r.notice.disclosures.find(d => d.key === "children" && d.covered))) hit(6, "Appears to collect age/DOB but notice doesn't address children's data.");

  if (r.https === false) hit(8, "Site is not served over HTTPS.");

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "E";
  const band = score >= 80 ? "Strong" : score >= 65 ? "Fair" : score >= 50 ? "Weak" : score >= 35 ? "Poor" : "Critical";
  const sector = guessSector([...(r.pagesVisited || [])].join(" ") + " " + (r.domain || "") + " " + JSON.stringify(r.dataPoints || []) + " " + (r.trackers || []).join(" "));
  const benchmark = SECTOR_BASELINE[sector] ?? SECTOR_BASELINE.general;

  drivers.sort((a, b) => a.impact - b.impact);
  return { score, grade, band, sector, benchmark, vsBenchmark: score - benchmark, drivers };
}

module.exports = { computeScore, guessSector, SECTOR_BASELINE };
