// Unified classifier for the deep scanner.
//  - Cookie / storage NAMES  -> trackers.js (rich name patterns + plain-language guesses)
//  - Third-party HOSTS        -> vendors.js patterns (name + region + pii + fine category),
//                                falling back to trackers.js host list, then "unknown"
//  - Page HTML                -> vendors.js detectVendors (for gap-assessment posture)
const trackers = require("./trackers");
const { VENDORS, GAP_TO_COARSE, detectVendors, CATEGORY_LABELS, REGION_FLAG } = require("./vendors");

// Cookie/storage name -> { vendor, category(coarse), purpose, suggested }
const classifyCookie = trackers.classifyCookie;

// Host -> { vendor, category(coarse), gapCategory, region, pii }
function classifyHost(host) {
  for (const v of VENDORS) {
    if (v.patterns.some(p => p.test(host))) {
      return { vendor: v.name, category: GAP_TO_COARSE[v.category] || "unclassified", gapCategory: v.category, region: v.region, pii: !!v.pii };
    }
  }
  const t = trackers.classifyHost(host); // { vendor, category } (coarse) or null
  if (t) return { vendor: t.vendor, category: t.category, gapCategory: null, region: "Global", pii: t.category === "analytics" || t.category === "marketing" };
  return { vendor: "Unknown", category: "unclassified", gapCategory: null, region: null, pii: false };
}

module.exports = { classifyCookie, classifyHost, detectVendors, TAGGING_HINTS: trackers.TAGGING_HINTS, CATEGORY_LABELS, REGION_FLAG };
