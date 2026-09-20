// Vendor signature database. Maps URL/JS/host patterns to a name, a fine category,
// the likely data-processing region (drives cross-border findings), and whether the
// vendor typically processes personal data. Ported from the gap-assessment tool so
// the deep scanner can produce both consent (cookie buckets) and gap (posture) output.

const VENDORS = [
  // Analytics
  { name: "Google Analytics", category: "analytics", region: "US", pii: true, patterns: [/google-analytics\.com/i, /googletagmanager\.com\/gtag/i, /gtag\(/i, /\bga\(\s*['"]create/i, /_gaq\b/i] },
  { name: "Mixpanel", category: "analytics", region: "US", pii: true, patterns: [/cdn\.mxpanel\.com/i, /api\.mixpanel\.com/i, /mixpanel/i] },
  { name: "Amplitude", category: "analytics", region: "US", pii: true, patterns: [/cdn\.amplitude\.com/i, /amplitude\.com\/libs/i, /amplitude/i] },
  { name: "Heap", category: "analytics", region: "US", pii: true, patterns: [/cdn\.heap(analytics)?\.com/i, /heap\.load/i] },
  { name: "Plausible", category: "analytics", region: "EU", pii: false, patterns: [/plausible\.io/i] },
  { name: "Matomo", category: "analytics", region: "EU", pii: true, patterns: [/matomo\.(js|php)/i, /piwik/i] },
  { name: "Segment", category: "analytics", region: "US", pii: true, patterns: [/cdn\.segment\.(com|io)/i, /window\.analytics/i] },

  // Tag managers
  { name: "Google Tag Manager", category: "tagManager", region: "US", pii: true, patterns: [/googletagmanager\.com\/gtm\.js/i, /GTM-[A-Z0-9]+/] },
  { name: "Tealium", category: "tagManager", region: "US", pii: true, patterns: [/tags\.tiqcdn\.com/i, /tealium/i] },

  // Advertising / pixels
  { name: "Meta Pixel", category: "advertising", region: "US", pii: true, patterns: [/connect\.facebook\.net/i, /fbq\(/i, /facebook\.com\/tr/i] },
  { name: "Google Ads", category: "advertising", region: "US", pii: true, patterns: [/googleadservices\.com/i, /google\.com\/ads/i, /gtag\/js\?id=AW-/i] },
  { name: "DoubleClick", category: "advertising", region: "US", pii: true, patterns: [/doubleclick\.net/i, /googlesyndication\.com/i] },
  { name: "LinkedIn Insight", category: "advertising", region: "US", pii: true, patterns: [/snap\.licdn\.com/i, /_linkedin_data_partner_id/i, /px\.ads\.linkedin\.com/i] },
  { name: "Twitter/X Pixel", category: "advertising", region: "US", pii: true, patterns: [/static\.ads-twitter\.com/i, /analytics\.twitter\.com/i, /twq\(/i] },
  { name: "TikTok Pixel", category: "advertising", region: "US", pii: true, patterns: [/analytics\.tiktok\.com/i, /ttq\./i] },
  { name: "Criteo", category: "advertising", region: "EU", pii: true, patterns: [/criteo\.(com|net)/i] },
  { name: "Taboola", category: "advertising", region: "US", pii: true, patterns: [/taboola\.com/i] },

  // Session replay / heatmaps
  { name: "Hotjar", category: "sessionReplay", region: "EU", pii: true, patterns: [/static\.hotjar\.com/i, /\bhj\(/i] },
  { name: "Microsoft Clarity", category: "sessionReplay", region: "US", pii: true, patterns: [/clarity\.ms/i, /clarity\("/i] },
  { name: "FullStory", category: "sessionReplay", region: "US", pii: true, patterns: [/fullstory\.com/i, /\bFS\b\.identify/i] },
  { name: "LogRocket", category: "sessionReplay", region: "US", pii: true, patterns: [/cdn\.logrocket\.io/i, /logrocket/i] },
  { name: "Smartlook", category: "sessionReplay", region: "EU", pii: true, patterns: [/smartlook\.com/i] },

  // A/B testing
  { name: "Optimizely", category: "abTesting", region: "US", pii: true, patterns: [/optimizely\.com/i, /cdn\.optimizely/i] },
  { name: "VWO", category: "abTesting", region: "IN", pii: true, patterns: [/visualwebsiteoptimizer\.com/i, /dev\.visualwebsiteoptimizer/i, /\bvwo\b/i] },
  { name: "Google Optimize", category: "abTesting", region: "US", pii: true, patterns: [/optimize\.google\.com/i] },

  // Chat / support
  { name: "Intercom", category: "chat", region: "US", pii: true, patterns: [/widget\.intercom\.io/i, /intercomcdn\.com/i, /Intercom\(/i] },
  { name: "Drift", category: "chat", region: "US", pii: true, patterns: [/js\.driftt\.com/i, /drift\.com/i] },
  { name: "Zendesk", category: "chat", region: "US", pii: true, patterns: [/static\.zdassets\.com/i, /zendesk/i, /zdchat/i] },
  { name: "Freshchat", category: "chat", region: "IN", pii: true, patterns: [/wchat\.freshchat\.com/i, /freshchat/i] },
  { name: "Crisp", category: "chat", region: "EU", pii: true, patterns: [/client\.crisp\.chat/i] },
  { name: "Tawk.to", category: "chat", region: "US", pii: true, patterns: [/embed\.tawk\.to/i, /tawk\.to/i] },
  { name: "WhatsApp Chat", category: "chat", region: "US", pii: true, patterns: [/wa\.me\//i, /api\.whatsapp\.com/i] },

  // Social embeds
  { name: "Facebook SDK", category: "social", region: "US", pii: true, patterns: [/connect\.facebook\.net\/.+\/sdk\.js/i] },
  { name: "Twitter Widgets", category: "social", region: "US", pii: false, patterns: [/platform\.twitter\.com/i] },
  { name: "Instagram Embed", category: "social", region: "US", pii: false, patterns: [/instagram\.com\/embed/i] },

  // Video
  { name: "YouTube", category: "video", region: "US", pii: false, patterns: [/youtube\.com\/embed/i, /youtube-nocookie\.com/i, /ytimg\.com/i] },
  { name: "Vimeo", category: "video", region: "US", pii: false, patterns: [/player\.vimeo\.com/i] },
  { name: "Wistia", category: "video", region: "US", pii: true, patterns: [/wistia\.(com|net)/i] },

  // Maps
  { name: "Google Maps", category: "maps", region: "US", pii: false, patterns: [/maps\.googleapis\.com/i, /maps\.google\.com/i] },
  { name: "Mapbox", category: "maps", region: "US", pii: false, patterns: [/api\.mapbox\.com/i] },

  // Fonts
  { name: "Google Fonts", category: "fonts", region: "US", pii: false, patterns: [/fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i] },
  { name: "Adobe Fonts", category: "fonts", region: "US", pii: false, patterns: [/use\.typekit\.net/i] },

  // Marketing automation
  { name: "HubSpot", category: "marketing", region: "US", pii: true, patterns: [/js\.hs-scripts\.com/i, /hs-analytics/i, /hubspot/i] },
  { name: "Mailchimp", category: "marketing", region: "US", pii: true, patterns: [/chimpstatic\.com/i, /list-manage\.com/i, /mailchimp/i] },
  { name: "Klaviyo", category: "marketing", region: "US", pii: true, patterns: [/static\.klaviyo\.com/i, /klaviyo/i] },
  { name: "MoEngage", category: "marketing", region: "IN", pii: true, patterns: [/moengage/i, /cdn\.moengage\.com/i] },
  { name: "WebEngage", category: "marketing", region: "IN", pii: true, patterns: [/webengage/i, /ssl\.widgets\.webengage/i] },
  { name: "CleverTap", category: "marketing", region: "IN", pii: true, patterns: [/clevertap/i, /wzrkt\.com/i] },

  // Payments
  { name: "Razorpay", category: "payment", region: "IN", pii: true, patterns: [/checkout\.razorpay\.com/i, /razorpay/i] },
  { name: "Stripe", category: "payment", region: "US", pii: true, patterns: [/js\.stripe\.com/i, /stripe\.com\/v3/i] },
  { name: "PayPal", category: "payment", region: "US", pii: true, patterns: [/paypal\.com\/sdk/i, /paypalobjects\.com/i] },
  { name: "PayU", category: "payment", region: "IN", pii: true, patterns: [/payu\.in/i, /secure\.payu/i] },
  { name: "Cashfree", category: "payment", region: "IN", pii: true, patterns: [/cashfree/i, /sdk\.cashfree\.com/i] },

  // CDN / cloud infra
  { name: "Cloudflare", category: "cloud", region: "US", pii: false, patterns: [/cloudflare\.com/i, /cdnjs\.cloudflare/i, /__cf_bm/i] },
  { name: "AWS", category: "cloud", region: "US", pii: false, patterns: [/amazonaws\.com/i, /cloudfront\.net/i] },
  { name: "Google Cloud", category: "cloud", region: "US", pii: false, patterns: [/storage\.googleapis\.com/i, /appspot\.com/i] },
  { name: "Microsoft Azure", category: "cloud", region: "US", pii: false, patterns: [/azureedge\.net/i, /windows\.net/i] },
  { name: "Vercel", category: "cloud", region: "US", pii: false, patterns: [/vercel\.app/i, /vercel-insights/i] },
  { name: "jsDelivr", category: "cdn", region: "Global", pii: false, patterns: [/cdn\.jsdelivr\.net/i] },
  { name: "unpkg", category: "cdn", region: "US", pii: false, patterns: [/unpkg\.com/i] },

  // Consent management platforms (CMPs)
  { name: "OneTrust", category: "consent", region: "US", pii: false, patterns: [/cdn\.cookielaw\.org/i, /onetrust/i, /optanon/i] },
  { name: "Cookiebot", category: "consent", region: "EU", pii: false, patterns: [/consent\.cookiebot\.com/i, /cookiebot/i] },
  { name: "Termly", category: "consent", region: "US", pii: false, patterns: [/app\.termly\.io/i, /termly/i] },
  { name: "Osano", category: "consent", region: "US", pii: false, patterns: [/cmp\.osano\.com/i, /osano/i] },
  { name: "CookieYes", category: "consent", region: "IN", pii: false, patterns: [/cookie-cdn\.cookieyes\.com/i, /cookieyes/i] },
  { name: "Usercentrics", category: "consent", region: "EU", pii: false, patterns: [/usercentrics/i] },
  { name: "Didomi", category: "consent", region: "EU", pii: false, patterns: [/didomi/i] },
];

const CATEGORY_LABELS = {
  analytics: "Analytics", advertising: "Advertising", tagManager: "Tag Manager", sessionReplay: "Session Replay",
  abTesting: "A/B Testing", chat: "Chat / Support", social: "Social", video: "Video", maps: "Maps", fonts: "Fonts",
  cdn: "CDN", payment: "Payment", marketing: "Marketing", cloud: "Cloud", consent: "Consent (CMP)",
};

const REGION_FLAG = { US: "🇺🇸", EU: "🇪🇺", IN: "🇮🇳", Global: "🌐" };

// Map a fine vendor category to the coarse consent bucket the banner uses.
const GAP_TO_COARSE = {
  analytics: "analytics", sessionReplay: "analytics", abTesting: "analytics", tagManager: "analytics",
  advertising: "marketing", social: "marketing", marketing: "marketing",
  chat: "functional", video: "functional", maps: "functional", fonts: "functional",
  cdn: "necessary", cloud: "necessary", payment: "necessary", consent: "necessary",
};

function detectVendors(html) {
  const found = new Map();
  for (const v of VENDORS) {
    if (v.patterns.some(p => p.test(html))) found.set(v.name, { name: v.name, category: v.category, region: v.region, pii: v.pii });
  }
  return [...found.values()];
}

module.exports = { VENDORS, CATEGORY_LABELS, REGION_FLAG, GAP_TO_COARSE, detectVendors };
