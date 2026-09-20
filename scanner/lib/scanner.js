// Deep scanner — one browser scan feeds BOTH free tools.
//   consent banner generator : cookies, storage, third-party hosts, site details, live consent-blocking proof
//   gap assessment           : security headers, notice coverage (LLM-read), PII surface, vendors, cross-border, score
//
// Budgeted to finish under ~60s (SCAN_DEADLINE_MS) with graceful partial results.
// SECURITY: all Chromium traffic is forced through lib/egress-proxy.js (SSRF control).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { CONTEXT_OPTS, harden, trackHosts } = require("./context-setup");
const { classifyCookie, classifyHost, detectVendors, TAGGING_HINTS } = require("./classify");
const { GAP_TO_COARSE } = require("./vendors");
const { buildSecurity, buildNotice, emptyNotice, buildDataPoints } = require("./analyze");
const { collectFieldsInPage, summarisePII } = require("./pii");
const { probeConsent } = require("./consent-probe");
const { assessNotice } = require("./llm");
const { computeScore } = require("./score");
const { createEgressProxy } = require("./egress-proxy");

function getChromiumExecutable() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    for (const c of [
      path.join(localAppData, "ms-playwright", "chromium-1243", "chrome-win64", "chrome.exe"),
      path.join(localAppData, "ms-playwright", "chromium-1194", "chrome-win", "chrome.exe"),
    ]) if (fs.existsSync(c)) return c;
  }
  return undefined;
}

const MAX_PAGES = +(process.env.MAX_PAGES || 6);
const PAGE_TIMEOUT = +(process.env.PAGE_TIMEOUT_MS || 15000);
const SCAN_DEADLINE_MS = +(process.env.SCAN_DEADLINE_MS || 60000);
const CONSENT_RESERVE_MS = +(process.env.CONSENT_RESERVE_MS || 22000); // budget kept aside for the consent probe
const HTML_CAP = 300000;
const CAPTURE_EVIDENCE = process.env.CAPTURE_EVIDENCE === "1";

let proxyPort = null;
function startProxy(opts = {}) {
  if (proxyPort) return Promise.resolve(proxyPort);
  return new Promise((res, rej) => {
    const p = createEgressProxy({ log: m => console.warn("[egress]", m), ...opts });
    p.on("error", rej);
    p.listen(0, "127.0.0.1", () => { proxyPort = p.address().port; res(proxyPort); });
  });
}

function registrable(host) {
  const p = host.split(".");
  const two = p.slice(-2).join(".");
  if (/^(co|org|net|gov|ac|edu|firm|gen|ind|com|nic|res)\.(in|uk|au|nz|jp|za|sg)$/.test(two)) return p.slice(-3).join(".");
  return two;
}
function duration(expires) {
  if (!expires || expires < 0) return "Session";
  const days = Math.round((expires * 1000 - Date.now()) / 86400000);
  if (days <= 0) return "Session";
  if (days < 60) return `${days} days`;
  if (days < 730) return `${Math.round(days / 30)} months`;
  return `${Math.round(days / 365)} years`;
}
function stripHash(href) { try { const u = new URL(href); u.hash = ""; return u.href; } catch { return href; } }
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const TIMED_OUT = Symbol("timeout");
function withTimeout(promise, ms) {
  let t; const guard = new Promise(res => { t = setTimeout(() => res(TIMED_OUT), ms); });
  return Promise.race([Promise.resolve(promise).then(v => { clearTimeout(t); return v; }, e => { clearTimeout(t); throw e; }), guard]);
}

// Rank discovered links by DPDP relevance: notice first (for the LLM), then journey pages.
function journeyRank(h) {
  if (/privacy|data.?protection|data.?policy|cookie.?policy/i.test(h)) return 0;
  if (/sign.?up|register|create.?account|\bjoin\b/i.test(h)) return 1;
  if (/checkout|\bcart\b|payment|billing/i.test(h)) return 1;
  if (/login|sign.?in|\baccount\b/i.test(h)) return 2;
  if (/contact|support|enquir|get.?in.?touch|book|demo/i.test(h)) return 2;
  if (/terms|refund|shipping|about/i.test(h)) return 3;
  return 5;
}

async function scan(url, { proxyOptions } = {}) {
  const port = await startProxy(proxyOptions);
  const siteDomain = registrable(url.hostname);
  const browser = await chromium.launch({
    executablePath: getChromiumExecutable(),
    proxy: { server: `http://127.0.0.1:${port}` },
    args: [
      "--proxy-bypass-list=<-loopback>", "--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      "--disable-dev-shm-usage", "--disable-gpu", "--disable-software-rasterizer",
      "--blink-settings=imagesEnabled=false", "--renderer-process-limit=1",
      "--disable-extensions", "--disable-background-networking", "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-component-update",
      "--disable-default-apps", "--disable-breakpad", "--no-first-run", "--no-default-browser-check", "--mute-audio",
      "--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter,OptimizationHints,InterestFeedContentSuggestions",
      "--js-flags=--max-old-space-size=384",
      ...(process.env.SCANNER_SINGLE_PROCESS === "1" ? ["--single-process"] : []),
      ...(process.env.SCANNER_NO_SANDBOX === "1" ? ["--no-sandbox"] : []),
    ],
  });
  const deadlineAt = Date.now() + SCAN_DEADLINE_MS;
  let timer;
  const backstop = new Promise((_, rej) => { timer = setTimeout(() => rej(Object.assign(new Error("The scan took too long. Try again or add cookies by hand."), { status: 504 })), SCAN_DEADLINE_MS + 8000); });
  try {
    return await Promise.race([backstop, run(browser, url, siteDomain, deadlineAt)]);
  } finally {
    clearTimeout(timer);
    await browser.close().catch(() => {});
  }
}

async function run(browser, url, siteDomain, deadlineAt) {
  const hosts = new Map(), storageKeys = new Set(), pagesVisited = [], errors = [], htmlParts = [], rawFields = [];
  let site = {}, homeHeaders = {}, homeHtml = "", privacyText = "", finalHttps = url.protocol === "https:", evidence = null;
  let llmPromise = null;
  const timeLeft = () => deadlineAt - Date.now();
  // Reserve time for the consent probe at the end.
  const crawlDeadline = () => timeLeft() - CONSENT_RESERVE_MS;

  const context = await browser.newContext(CONTEXT_OPTS);
  await harden(context);
  const page = await context.newPage();
  trackHosts(page, hosts);

  async function hydrate(budgetMs) {
    const end = Date.now() + Math.max(0, budgetMs);
    await withTimeout(page.evaluate(async () => {
      try {
        const step = Math.max(400, Math.floor(window.innerHeight * 0.9));
        const h = (document.body && document.body.scrollHeight) || 0;
        const stops = Math.min(10, Math.ceil(h / step));
        for (let i = 1; i <= stops; i++) { window.scrollTo(0, i * step); await new Promise(r => setTimeout(r, 90)); }
        window.scrollTo(0, 0); window.dispatchEvent(new Event("scroll"));
      } catch (e) {}
    }), Math.max(1500, clamp(end - Date.now(), 0, 6000))).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: clamp(end - Date.now(), 700, 6000) }).catch(() => {});
    const tail = clamp(end - Date.now(), 0, 1500);
    if (tail) await page.waitForTimeout(tail).catch(() => {});
  }

  async function visit(target, isHome, isPrivacy) {
    if (crawlDeadline() < 4000) return { visited: false, links: [] };
    try {
      const gotoBudget = clamp(crawlDeadline() - 3000, 3500, PAGE_TIMEOUT);
      const resp = await withTimeout(page.goto(target, { waitUntil: "domcontentloaded", timeout: gotoBudget }), gotoBudget + 2000);
      if (resp === TIMED_OUT) { errors.push(`${target}: load timed out`); return { visited: false, links: [] }; }
      if (resp && typeof resp.headers === "function" && resp.headers()["x-kensara-egress"] === "denied") {
        if (isHome) throw Object.assign(new Error("This address isn't a public website."), { denied: true });
        return { visited: false, links: [] };
      }
      const perPage = isHome ? clamp(crawlDeadline() - 8000, 2500, 11000) : clamp(crawlDeadline() - 4000, 1200, 7000);
      await withTimeout(hydrate(perPage), perPage + 2500);
      pagesVisited.push(page.url());

      const keys = await withTimeout(page.evaluate(() => {
        const out = [];
        try { for (let i = 0; i < localStorage.length; i++) out.push(["localStorage", localStorage.key(i)]); } catch {}
        try { for (let i = 0; i < sessionStorage.length; i++) out.push(["sessionStorage", sessionStorage.key(i)]); } catch {}
        return out;
      }), 3000);
      (Array.isArray(keys) ? keys : []).forEach(k => storageKeys.add(JSON.stringify(k)));

      // PII fields on this page.
      const fields = await withTimeout(page.evaluate(collectFieldsInPage), 3000);
      if (Array.isArray(fields)) for (const f of fields) if (rawFields.length < 400) rawFields.push(f);

      const html = await withTimeout(page.content(), 3500);
      const text = (typeof html === "string" ? html : "").slice(0, HTML_CAP);
      if (text) { htmlParts.push(text); if (isHome) homeHtml = text; if (isPrivacy && !privacyText) privacyText = text; }

      let links = [];
      if (isHome) {
        if (resp && typeof resp.headers === "function") homeHeaders = resp.headers();
        try { finalHttps = new URL(page.url()).protocol === "https:"; } catch {}
        if (CAPTURE_EVIDENCE) { const shot = await withTimeout(page.screenshot({ type: "jpeg", quality: 40 }), 3000).catch(() => null); if (shot && shot !== TIMED_OUT) evidence = "data:image/jpeg;base64," + shot.toString("base64"); }
        const base = new URL(page.url());
        const rawE = await withTimeout(page.$$eval("a[href]", as => as.map(a => a.href)), 4000);
        const raw = Array.isArray(rawE) ? rawE : [];
        links = [...new Set(raw)].filter(h => { try { const u = new URL(h); return u.hostname === base.hostname && /^https?:$/.test(u.protocol) && !/\.(pdf|jpe?g|png|zip|docx?|xlsx?)$/i.test(u.pathname) && !/logout|signout|wp-admin|cart\/add/i.test(u.pathname); } catch { return false; } })
          .map(stripHash).filter(h => h !== base.href).slice(0, MAX_PAGES * 5);
        site = await withTimeout(page.evaluate(() => {
          const meta = n => { const el = document.querySelector(`meta[property="${n}"],meta[name="${n}"]`); return (el && el.content) || ""; };
          let orgName = meta("og:site_name") || meta("application-name") || "";
          try {
            for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
              const parsed = JSON.parse(s.textContent);
              const list = Array.isArray(parsed) ? parsed : (parsed && parsed["@graph"]) || [parsed];
              for (const o of list) { const types = [].concat((o && o["@type"]) || "").join(" "); if (o && o.name && /(Organization|LocalBusiness|Corporation|Store|NGO)/i.test(types)) orgName = orgName || o.name; }
            }
          } catch (e) {}
          if (!orgName) orgName = (document.title || "").split(/[|–—\-:·]/)[0].trim();
          const links = [...document.querySelectorAll("a[href]")];
          const href = a => a.getAttribute("href") || "";
          const privacy = links.find(a => /privacy|data.?protection|\bpolicy\b/i.test((a.textContent || "") + " " + href(a)));
          const mail = links.find(a => /^mailto:/i.test(href(a)));
          const tel = links.find(a => /^tel:/i.test(href(a)));
          const clean = (s, n) => String(s || "").trim().slice(0, n);
          return { orgName: clean(orgName, 150), privacyUrl: privacy ? privacy.href : "", email: mail ? clean(decodeURIComponent(href(mail).replace(/^mailto:/i, "").split("?")[0]), 200) : "", phone: tel ? clean(href(tel).replace(/^tel:/i, "").replace(/[^\d+ ()-]/g, ""), 30) : "" };
        }), 4500);
        if (site === TIMED_OUT || !site) site = {};
      }
      return { visited: true, links };
    } catch (e) {
      if (e.denied) throw e;
      if (isHome && /ERR_TUNNEL_CONNECTION_FAILED/.test(e.message)) throw new Error("This address isn't a public website.");
      errors.push(`${target}: ${e.message.split("\n")[0]}`);
      return { visited: false, links: [] };
    }
  }

  // Fire the LLM notice read as soon as we have policy text, so it overlaps the rest.
  function maybeStartLlm() {
    if (llmPromise) return;
    const src = privacyText || (/(privacy|cookie|data protection)/i.test(homeHtml) ? homeHtml : "");
    if (!src) return;
    const budget = clamp(timeLeft() - 2000, 3000, 12000);
    llmPromise = assessNotice(src, { signal: AbortSignal.timeout(budget) }).catch(() => null);
  }

  // 1) Homepage.
  const home = await visit(url.href, true, false);
  maybeStartLlm();

  // 2) Journey-aware crawl (privacy first, then signup/checkout/contact...).
  const seen = new Set([stripHash(url.href)]);
  const queue = [];
  for (const link of (home.links || [])) { if (!seen.has(link)) { seen.add(link); queue.push(link); } }
  queue.sort((a, b) => journeyRank(a) - journeyRank(b));
  const isPrivacyUrl = h => /privacy|data.?protection|data.?policy|cookie.?policy/i.test(h);

  let reachedAll = true;
  for (const target of queue) {
    if (pagesVisited.length >= MAX_PAGES) break;
    if (crawlDeadline() < 6000) { reachedAll = false; break; }
    await visit(target, false, isPrivacyUrl(target));
    maybeStartLlm();
  }
  await page.close().catch(() => {});
  if (!pagesVisited.length) throw new Error("The site couldn't be loaded. Check the address and that it's publicly reachable.");
  const incomplete = !reachedAll && pagesVisited.length < Math.min(MAX_PAGES, 1 + queue.length);
  maybeStartLlm();

  const rawCookies = await withTimeout(context.cookies(), 4000);
  await context.close().catch(() => {});
  const cookieList = Array.isArray(rawCookies) ? rawCookies : [];

  // 3) Three-state consent probe (fresh contexts), within the reserved budget.
  let consent = { bannerFound: false, verdict: "not-tested" };
  if (timeLeft() > 12000) {
    try { consent = await probeConsent(browser, url.href, url.hostname, deadlineAt - 3000); } catch (e) { consent = { bannerFound: false, verdict: "not-tested" }; }
  }

  // 4) LLM notice (already running in parallel) — collect, else keyword fallback later.
  const llm = llmPromise ? await llmPromise : null;

  // ---- consent-shaped output ----
  const cookies = cookieList.map(c => {
    const cls = classifyCookie(c.name), cdom = c.domain.replace(/^\./, "");
    return { name: c.name, domain: cdom, firstParty: registrable(cdom) === siteDomain, duration: duration(c.expires), httpOnly: !!c.httpOnly, secure: !!c.secure, vendor: cls.vendor, category: cls.category, purpose: cls.purpose, suggested: cls.suggested || "" };
  }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const storage = [...storageKeys].map(s => JSON.parse(s)).map(([area, key]) => ({ area, key, ...classifyCookie(key) }));
  const thirdParties = [...hosts.entries()].filter(([h]) => registrable(h) !== siteDomain)
    .map(([host, requests]) => ({ host, requests, ...classifyHost(host) })).sort((a, b) => b.requests - a.requests);

  // ---- gap-shaped posture output ----
  const allHtml = htmlParts.join("\n");
  const vendorMap = new Map();
  for (const v of detectVendors(allHtml)) vendorMap.set(v.name, v);
  for (const tp of thirdParties) if (tp.vendor !== "Unknown" && tp.gapCategory && !vendorMap.has(tp.vendor)) vendorMap.set(tp.vendor, { name: tp.vendor, category: tp.gapCategory, region: tp.region, pii: tp.pii });
  const gapVendors = [...vendorMap.values()];
  const cmpVendor = gapVendors.find(v => v.category === "consent");
  const trackerVendors = gapVendors.filter(v => ["analytics", "advertising", "sessionReplay"].includes(v.category));
  const cloudProviders = gapVendors.filter(v => v.category === "cloud" || v.category === "cdn").map(v => v.name);
  const crossBorderRegions = [...new Set(gapVendors.filter(v => v.region && v.region !== "IN" && v.region !== "Global").map(v => v.region))];

  const hasPrivacyPolicy = !!privacyText || !!(site && site.privacyUrl) || /\/privacy/i.test(homeHtml);
  // Prefer the LLM's reasoned notice assessment; fall back to keyword coverage.
  let notice;
  if (llm && llm.present) notice = { ...llm, keywordFallback: false };
  else notice = { ...(hasPrivacyPolicy ? buildNotice(true, privacyText || homeHtml) : emptyNotice()), source: "keywords", keywordFallback: true };

  const security = buildSecurity(homeHeaders, finalHttps, cookies);
  const dataPoints = buildDataPoints(allHtml);
  const dataCollection = summarisePII(rawFields);
  const hasConsentBanner = consent.bannerFound || !!cmpVendor || /(cookieconsent|cookie-consent|we use cookies|accept (all )?cookies|consent[-_ ]?banner)/i.test(homeHtml);
  const consentGating = consent.blocksBeforeConsent === true || (!!cmpVendor && /type=["']text\/plain["'][^>]*(cookie|consent)/i.test(homeHtml));
  const hasDpoNamed = (llm && llm.dpoNamed) || /(data protection officer|grievance officer)/i.test(allHtml);
  const hasGrievanceContact = (llm && llm.grievanceOfficerNamed) || /(grievance|privacy@|dpo@|complaint)/i.test(allHtml);
  const hasRightsPage = /(your rights|data principal rights|request.{0,20}data|erasure request)/i.test(allHtml);

  // ---- findings (shared) + grounded upsell ----
  const optional = x => x.category === "functional" || x.category === "analytics" || x.category === "marketing";
  const preCookies = cookies.filter(optional), preStorage = storage.filter(optional), preHosts = thirdParties.filter(h => h.category === "analytics" || h.category === "marketing");
  const unknown = cookies.filter(c => c.category === "unclassified").length + storage.filter(s => s.category === "unclassified").length;
  const cmp = cmpVendor ? cmpVendor.name : (consent.bannerFound ? "detected" : null);

  const findings = [];
  if (preCookies.length || preStorage.length) findings.push({ level: "high", text: `${preCookies.length} cookie(s) and ${preStorage.length} browser-storage item(s) for optional purposes were set before the visitor made any choice. These need consent first.` });
  if (preHosts.length) findings.push({ level: "high", text: `Data was sent to ${preHosts.length} analytics or advertising service(s) (${preHosts.slice(0, 4).map(h => h.vendor).join(", ")}) before any choice.` });
  if (consent.verdict === "tracks-before-consent") findings.push({ level: "high", text: "The consent banner is cosmetic — trackers fire before the visitor chooses. Kensara Pro blocks trackers until consent and logs each choice against the notice shown." });
  else if (consent.verdict === "ignores-reject") findings.push({ level: "high", text: "Clicking “Reject” did not stop the trackers — the banner doesn't honour refusal. Kensara Pro enforces the choice and proves it." });
  else if (consent.verdict === "no-reject-option") findings.push({ level: "medium", text: "The consent banner offers no clear “Reject” — DPDP expects refusing to be as easy as accepting." });
  else if (consent.verdict === "no-banner" && (preHosts.length || preCookies.length)) findings.push({ level: "high", text: "No consent banner was found, yet trackers run before any choice. Kensara Pro installs a DPDP-ready banner that blocks them automatically." });
  else if (consent.preTicked) findings.push({ level: "medium", text: "Optional purposes are pre-ticked in the banner — consent must be a clear affirmative action, not a default." });
  if ((dataCollection.sensitiveCategories || []).length) findings.push({ level: "medium", text: `The site collects higher-risk personal data (${dataCollection.sensitiveCategories.join(", ")}). This raises notice, security and (for children) verifiable-consent obligations.` });
  if (crossBorderRegions.length) findings.push({ level: "medium", text: `Personal data appears to flow outside India (${crossBorderRegions.join(", ")}). Cross-border transfers must be disclosed.` });
  if (!hasPrivacyPolicy) findings.push({ level: "high", text: "No privacy notice was found. DPDP requires a clear, itemised notice before collecting personal data." });
  else if (notice.total && notice.covered < 6) findings.push({ level: "medium", text: `The privacy notice is missing ${notice.total - notice.covered} of ${notice.total} expected DPDP disclosures${llm && llm.gaps && llm.gaps.length ? ": " + llm.gaps.slice(0, 3).join("; ") : "."}` });
  if (unknown) findings.push({ level: "medium", text: `${unknown} item(s) set before consent couldn't be identified. If they aren't essential, they also need consent.` });
  if (!finalHttps) findings.push({ level: "medium", text: "The site doesn't use HTTPS. Personal data should be protected in transit." });
  if (errors.length) findings.push({ level: "low", text: `${errors.length} page(s) couldn't be loaded during the scan.` });
  if (incomplete) findings.push({ level: "low", text: `The scan stopped early to stay within the time limit; results cover ${pagesVisited.length} page(s).` });

  const base = {
    url: url.href, domain: url.hostname.replace(/^www\./, ""), scannedAt: new Date().toISOString(),
    reachable: true, pagesScanned: pagesVisited.length, pagesVisited, incomplete,
    site, cookies, storage, thirdParties, cmp, consent,
    vendors: gapVendors, vendorCount: gapVendors.length, piiVendorCount: gapVendors.filter(v => v.pii).length,
    trackers: trackerVendors.map(v => v.name), cloudProviders, crossBorderRegions,
    security, notice, dataPoints, dataCollection, https: finalHttps, hasPrivacyPolicy,
    hasConsentBanner, consentGating, hasDpoNamed, hasGrievanceContact, hasRightsPage,
    summary: { pages: pagesVisited.length, cookies: cookies.length, trackers: preHosts.length, preConsentCookies: preCookies.length + preStorage.length, cmp, crossBorder: crossBorderRegions.length, sensitivePII: (dataCollection.sensitiveCategories || []).length, consentVerdict: consent.verdict },
    hints: gapVendors.map(v => v.name).filter(n => TAGGING_HINTS[n]).map(n => ({ vendor: n, hint: TAGGING_HINTS[n] })),
    findings, errors,
  };
  if (evidence) base.evidence = evidence;
  base.scoreDetail = computeScore(base);
  base.score = base.scoreDetail.score;
  base.privacyLooksAligned = hasPrivacyPolicy && notice.covered >= 6;
  return base;
}

module.exports = { scan };
