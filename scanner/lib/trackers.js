// Known cookies and third-party hosts, used to pre-classify scan results.
// category: necessary | functional | analytics | marketing
// Anything not matched is returned as "unclassified" and the organisation must choose.
// Extend this list over time — it is the heart of scan quality.

const COOKIES = [
  // ---- Necessary: sessions, security, carts, load balancing ----
  { re: /^(PHPSESSID|JSESSIONID|ASP\.NET_SessionId|ASPSESSIONID.*|connect\.sid|sessionid|session|laravel_session|ci_session|_session_id)$/i, vendor: "Website (session)", category: "necessary", purpose: "Keeps you signed in and your session working" },
  { re: /^(XSRF-TOKEN|csrftoken|_csrf|csrf_token|__RequestVerificationToken.*)$/i, vendor: "Website (security)", category: "necessary", purpose: "Protects forms against cross-site request forgery" },
  { re: /^(__cf_bm|cf_clearance|__cflb|__cfruid|_cfuvid)$/, vendor: "Cloudflare", category: "necessary", purpose: "Bot protection and load balancing" },
  { re: /^(AWSALB|AWSALBCORS|AWSELB)$/, vendor: "Amazon Web Services", category: "necessary", purpose: "Load balancing" },
  { re: /^(wordpress_logged_in_.*|wordpress_sec_.*|wordpress_test_cookie|wp-settings-.*|wp_lang)$/, vendor: "WordPress", category: "necessary", purpose: "Login and site settings" },
  { re: /^(woocommerce_.*|wp_woocommerce_session_.*)$/, vendor: "WooCommerce", category: "necessary", purpose: "Shopping cart" },
  { re: /^(cart|cart_sig|cart_ts|secure_customer_sig|_shopify_tm|_shopify_tw|_shopify_m|_tracking_consent|localization|_secure_session_id)$/, vendor: "Shopify", category: "necessary", purpose: "Store checkout, cart and security" },
  { re: /^(__stripe_mid|__stripe_sid)$/, vendor: "Stripe", category: "necessary", purpose: "Fraud prevention for payments" },
  { re: /^(rzp_.*|razorpay_.*)$/i, vendor: "Razorpay", category: "necessary", purpose: "Payment processing" },
  { re: /^kensara_consent.*$/, vendor: "Kensara Consent", category: "necessary", purpose: "Remembers your consent choices" },

  // ---- Functional: chat, language, embeds ----
  { re: /^(intercom-.*)$/, vendor: "Intercom", category: "functional", purpose: "Live chat" },
  { re: /^(TawkConnectionTime|twk_.*|tawk_.*|__tawkuuid.*)$/i, vendor: "Tawk.to", category: "functional", purpose: "Live chat widget" },
  { re: /^(crisp-client.*)$/, vendor: "Crisp", category: "functional", purpose: "Live chat" },
  { re: /^(_fw_crm_v|fw_.*)$/, vendor: "Freshworks", category: "functional", purpose: "Chat and CRM widget" },
  { re: /^(zsc.*|zft-sdc|ZohoMarkRef|ZohoMarkSrc)$/, vendor: "Zoho", category: "functional", purpose: "Chat and forms widget" },
  { re: /^(__zlcmid)$/, vendor: "Zendesk", category: "functional", purpose: "Live chat" },
  { re: /^(pll_language|qtrans_.*|googtrans)$/, vendor: "Website (language)", category: "functional", purpose: "Remembers your language" },
  { re: /^(YSC|VISITOR_INFO1_LIVE|VISITOR_PRIVACY_METADATA|yt-remote-.*)$/, vendor: "YouTube", category: "marketing", purpose: "Embedded video tracking and recommendations" },

  // ---- Analytics ----
  { re: /^(_ga|_ga_.*|_gid|_gat|_gat_.*|__utm[a-z]+|AMP_TOKEN)$/, vendor: "Google Analytics", category: "analytics", purpose: "Counts visits and how the site is used" },
  { re: /^(_hj.*)$/, vendor: "Hotjar", category: "analytics", purpose: "Heatmaps and session recordings" },
  { re: /^(_clck|_clsk|CLID|ANONCHK)$/, vendor: "Microsoft Clarity", category: "analytics", purpose: "Heatmaps and session recordings" },
  { re: /^(mp_.*)$/, vendor: "Mixpanel", category: "analytics", purpose: "Product analytics" },
  { re: /^(ajs_.*)$/, vendor: "Segment", category: "analytics", purpose: "Analytics data routing" },
  { re: /^(amp_.*|AMP_.*)$/, vendor: "Amplitude", category: "analytics", purpose: "Product analytics" },
  { re: /^(_pk_.*|MATOMO_SESSID|mtm_.*)$/, vendor: "Matomo", category: "analytics", purpose: "Counts visits and how the site is used" },
  { re: /^(_ym_.*|yandexuid|yabs-sid)$/, vendor: "Yandex Metrica", category: "analytics", purpose: "Visit analytics and session recording" },
  { re: /^(s_cc|s_sq|s_vi|s_fid|AMCV_.*|AMCVS_.*|s_ecid)$/, vendor: "Adobe Analytics", category: "analytics", purpose: "Visit analytics" },
  { re: /^(_shopify_y|_shopify_s|_shopify_sa_p|_shopify_sa_t|_orig_referrer|_landing_page)$/, vendor: "Shopify", category: "analytics", purpose: "Store analytics" },
  { re: /^(__hssc|__hssrc)$/, vendor: "HubSpot", category: "analytics", purpose: "Session analytics" },
  { re: /^(_vwo_.*|_vis_opt_.*)$/, vendor: "VWO", category: "analytics", purpose: "A/B testing" },
  { re: /^(_uetsid|_uetvid)$/, vendor: "Microsoft Advertising", category: "marketing", purpose: "Ad conversion tracking" },

  // ---- Marketing / advertising ----
  { re: /^(_gcl_.*|IDE|test_cookie|DSID|__gads|__gpi|FPGCLAW|FPGCLDC|FLC|RUL|ar_debug)$/, vendor: "Google Ads / DoubleClick", category: "marketing", purpose: "Ad targeting and conversion measurement" },
  { re: /^(NID|1P_JAR|AEC|SOCS|__Secure-3PSID.*|__Secure-3PAPISID|__Secure-ENID|CONSENT)$/, vendor: "Google", category: "marketing", purpose: "Google services ad personalisation" },
  { re: /^(_fbp|_fbc|fr|datr|sb)$/, vendor: "Meta (Facebook)", category: "marketing", purpose: "Ad targeting and conversion tracking" },
  { re: /^(li_.*|bcookie|lidc|bscookie|UserMatchHistory|AnalyticsSyncHistory|li_gc|lms_ads|lms_analytics)$/, vendor: "LinkedIn", category: "marketing", purpose: "Ad targeting and Insight Tag measurement" },
  { re: /^(__hstc|hubspotutk|__hs_.*|messagesUtk)$/, vendor: "HubSpot", category: "marketing", purpose: "Visitor tracking for marketing" },
  { re: /^(_ttp|_tt_enable_cookie|tt_.*)$/, vendor: "TikTok", category: "marketing", purpose: "Ad conversion tracking" },
  { re: /^(personalization_id|guest_id.*|muc_ads|twid)$/, vendor: "X (Twitter)", category: "marketing", purpose: "Ad targeting" },
  { re: /^(_pin_unauth|_pinterest_.*|_derived_epik|_epik)$/, vendor: "Pinterest", category: "marketing", purpose: "Ad conversion tracking" },
  { re: /^(_scid.*|sc_at|_sctr)$/, vendor: "Snapchat", category: "marketing", purpose: "Ad conversion tracking" },
  { re: /^(MUID|MUIDB|_EDGE_V|SRCHD|SRCHUID|SRCHUSR)$/, vendor: "Microsoft Advertising", category: "marketing", purpose: "Ad targeting" },
  { re: /^(t_gid|taboola_.*)$/, vendor: "Taboola", category: "marketing", purpose: "Content recommendation ads" },
  { re: /^(obuid|outbrain_.*)$/, vendor: "Outbrain", category: "marketing", purpose: "Content recommendation ads" },
  { re: /^(_rdt_uuid)$/, vendor: "Reddit", category: "marketing", purpose: "Ad conversion tracking" },
  { re: /^(_kla_id|__kla_id)$/, vendor: "Klaviyo", category: "marketing", purpose: "Email marketing tracking" },
  { re: /^(_mkto_trk)$/, vendor: "Marketo", category: "marketing", purpose: "Marketing automation tracking" },
];

// Third-party hosts seen in network traffic, matched by suffix.
const HOSTS = [
  ["google-analytics.com", "Google Analytics", "analytics"],
  ["analytics.google.com", "Google Analytics", "analytics"],
  ["googletagmanager.com", "Google Tag Manager", "analytics"],
  ["doubleclick.net", "Google Ads / DoubleClick", "marketing"],
  ["googleadservices.com", "Google Ads", "marketing"],
  ["googlesyndication.com", "Google AdSense", "marketing"],
  ["connect.facebook.net", "Meta (Facebook)", "marketing"],
  ["facebook.com", "Meta (Facebook)", "marketing"],
  ["hotjar.com", "Hotjar", "analytics"],
  ["hotjar.io", "Hotjar", "analytics"],
  ["clarity.ms", "Microsoft Clarity", "analytics"],
  ["bat.bing.com", "Microsoft Advertising", "marketing"],
  ["snap.licdn.com", "LinkedIn", "marketing"],
  ["px.ads.linkedin.com", "LinkedIn", "marketing"],
  ["analytics.tiktok.com", "TikTok", "marketing"],
  ["static.ads-twitter.com", "X (Twitter)", "marketing"],
  ["ads-twitter.com", "X (Twitter)", "marketing"],
  ["ct.pinterest.com", "Pinterest", "marketing"],
  ["sc-static.net", "Snapchat", "marketing"],
  ["mixpanel.com", "Mixpanel", "analytics"],
  ["segment.com", "Segment", "analytics"],
  ["segment.io", "Segment", "analytics"],
  ["amplitude.com", "Amplitude", "analytics"],
  ["mc.yandex.ru", "Yandex Metrica", "analytics"],
  ["matomo.cloud", "Matomo", "analytics"],
  ["hs-scripts.com", "HubSpot", "marketing"],
  ["hs-analytics.net", "HubSpot", "marketing"],
  ["hubspot.com", "HubSpot", "marketing"],
  ["taboola.com", "Taboola", "marketing"],
  ["outbrain.com", "Outbrain", "marketing"],
  ["criteo.com", "Criteo", "marketing"],
  ["criteo.net", "Criteo", "marketing"],
  ["klaviyo.com", "Klaviyo", "marketing"],
  ["youtube.com", "YouTube", "marketing"],
  ["youtube-nocookie.com", "YouTube (privacy mode)", "functional"],
  ["intercom.io", "Intercom", "functional"],
  ["intercomcdn.com", "Intercom", "functional"],
  ["tawk.to", "Tawk.to", "functional"],
  ["crisp.chat", "Crisp", "functional"],
  ["zopim.com", "Zendesk", "functional"],
  ["zdassets.com", "Zendesk", "functional"],
  ["salesiq.zoho.in", "Zoho SalesIQ", "functional"],
  ["salesiq.zoho.com", "Zoho SalesIQ", "functional"],
  ["freshchat.com", "Freshworks", "functional"],
  ["checkout.razorpay.com", "Razorpay", "necessary"],
  ["js.stripe.com", "Stripe", "necessary"],
  ["recaptcha.net", "Google reCAPTCHA", "necessary"],
  ["gstatic.com", "Google static content", "necessary"],
  ["fonts.googleapis.com", "Google Fonts", "functional"],
  ["cdn.shopify.com", "Shopify", "necessary"],
  ["cloudflare.com", "Cloudflare", "necessary"],
];

// Ready-made guidance shown to the organisation for each detected vendor.
const TAGGING_HINTS = {
  "Google Analytics": "Kensara sets Google Consent Mode v2 to 'denied' by default and updates it on consent, so a standard GA4 or GTM snippet works as long as consent.js loads first in <head>.",
  "Google Tag Manager": "Load consent.js before GTM. In GTM, enable Consent Overview and make each tag require the matching consent type (analytics_storage, ad_storage).",
  "Google Ads / DoubleClick": "Handled by Consent Mode v2 (ad_storage, ad_user_data, ad_personalization) when consent.js loads first.",
  "Google Ads": "Handled by Consent Mode v2 when consent.js loads first.",
  "Meta (Facebook)": "Change the Meta Pixel <script> to type=\"text/plain\" data-consent=\"marketing\".",
  "Hotjar": "Change the Hotjar <script> to type=\"text/plain\" data-consent=\"analytics\".",
  "Microsoft Clarity": "Change the Clarity <script> to type=\"text/plain\" data-consent=\"analytics\".",
  "LinkedIn": "Change the LinkedIn Insight Tag <script> to type=\"text/plain\" data-consent=\"marketing\".",
  "TikTok": "Change the TikTok Pixel <script> to type=\"text/plain\" data-consent=\"marketing\".",
  "HubSpot": "Change the HubSpot tracking <script> to type=\"text/plain\" data-consent=\"marketing\".",
  "YouTube": "Swap embeds to youtube-nocookie.com, or change <iframe src> to data-src with data-consent=\"marketing\".",
};

// Plain-language best guesses for cookies we don't recognise by name, so a
// non-technical user isn't left staring at a bare "Unknown". These never decide
// the category on their own — they only SUGGEST one and explain, in everyday
// words, what the name looks like. The organisation still confirms.
const GUESSES = [
  { re: /(^|[_-])(sess|sid|session|token|csrf|xsrf|auth|login|logged|secure|cart|checkout|nonce|verify)([_-]|\d|$)/i,
    category: "necessary", note: "The name looks like a sign-in, security or shopping-cart cookie the site needs to work." },
  { re: /(^|[_-])(ad|ads|adid|gcl|fbp|fbc|pixel|track|campaign|utm|click|conversion|remarket|retarget|audience|affiliate|partner)([_-]|\d|$)/i,
    category: "marketing", note: "The name suggests advertising or conversion tracking (used to show or measure ads)." },
  { re: /(^|[_-])(ga|gid|stat|analytic|metric|measure|visit|pageview|hj|clarity|amplitude|mixpanel|matomo|heap|session_?rec|hotjar)([_-]|\d|$)/i,
    category: "analytics", note: "The name suggests a visitor-analytics cookie (counts visits or records how the page is used)." },
  { re: /(^|[_-])(lang|locale|i18n|country|region|theme|dark|font|chat|widget|tawk|zendesk|intercom|crisp|drift|player|video|embed|map|pref|display|ui|timezone)([_-]|\d|$)/i,
    category: "functional", note: "The name suggests a convenience feature such as language, chat, maps or an embedded widget." },
  { re: /(uuid|guid|visitor_?id|client_?id|device_?id|user_?id|[_-]uid|anon)/i,
    category: "analytics", note: "This stores a unique ID for your browser, usually to recognise repeat visitors. That is normally analytics, but some advertising tools do the same — please confirm which applies." },
];
function guessCookie(name) {
  for (const g of GUESSES) if (g.re.test(name)) return { category: g.category, note: g.note };
  return null;
}

function classifyCookie(name) {
  for (const c of COOKIES) if (c.re.test(name)) return { vendor: c.vendor, category: c.category, purpose: c.purpose, suggested: "" };
  const g = guessCookie(name);
  if (g) return { vendor: "Unknown", category: "unclassified", purpose: g.note, suggested: g.category };
  return { vendor: "Unknown", category: "unclassified", suggested: "",
    purpose: "We couldn't identify this one automatically. If the site doesn't need it to work, treat it as optional and pick the closest category." };
}

function classifyHost(host) {
  for (const [suffix, vendor, category] of HOSTS) {
    const h = suffix.split("/")[0];
    if (host === h || host.endsWith("." + h)) return { vendor, category };
  }
  return null;
}

module.exports = { classifyCookie, classifyHost, TAGGING_HINTS };
