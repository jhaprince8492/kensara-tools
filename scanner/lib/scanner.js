// Deep scanner. Visits a website like a first-time visitor who has NOT consented and
// records what it sets, then derives a compliance posture. ONE scan feeds two tools:
//   - consent banner generator  -> cookies, storage, third-party hosts, site details
//   - gap assessment            -> security headers, notice coverage, data points,
//                                  vendors (region/PII), cross-border, CMP
//
// SECURITY MODEL: Chromium is forced through lib/egress-proxy.js (the real SSRF control).
// Runs on its own box (AWS), never on Vercel — so it isn't bound by a 60s function limit.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { classifyCookie, classifyHost, detectVendors, TAGGING_HINTS } = require("./classify");
const { buildSecurity, buildNotice, buildDataPoints, emptyNotice } = require("./analyze");
const { GAP_TO_COARSE } = require("./vendors");
const { createEgressProxy } = require("./egress-proxy");

function getChromiumExecutable() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const candidates = [
      path.join(localAppData, "ms-playwright", "chromium-1243", "chrome-win64", "chrome.exe"),
      path.join(localAppData, "ms-playwright", "chromium-1194", "chrome-win", "chrome.exe"),
    ];
    for (const c of candidates) if (fs.existsSync(c)) return c;
  }
  return undefined;
}

// Tunable from the environment. Defaults suit an AWS box with real RAM and no 60s cap,
// so we can scan a little deeper than the old Vercel-bound worker.
const MAX_PAGES = +(process.env.MAX_PAGES || 6);
const PAGE_TIMEOUT = +(process.env.PAGE_TIMEOUT_MS || 15000);
const SCAN_DEADLINE_MS = +(process.env.SCAN_DEADLINE_MS || 70000);
const HTML_CAP = 300000; // characters of HTML kept per page for posture analysis
const DROP_TYPES = new Set(["image", "imageset", "media", "font", "stylesheet"]); // never needed to spot trackers

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

// Bound ANY browser call so a hostile/heavy page can never overrun the budget.
const TIMED_OUT = Symbol("timeout");
function withTimeout(promise, ms) {
  let t;
  const guard = new Promise(res => { t = setTimeout(() => res(TIMED_OUT), ms); });
  return Promise.race([Promise.resolve(promise).then(v => { clearTimeout(t); return v; }, e => { clearTimeout(t); throw e; }), guard]);
}

async function scan(url, { proxyOptions } = {}) {
  const port = await startProxy(proxyOptions);
  const siteDomain = registrable(url.hostname);
  const browser = await chromium.launch({
    executablePath: getChromiumExecutable(),
    proxy: { server: `http://127.0.0.1:${port}` },
    args: [
      "--proxy-bypass-list=<-loopback>",
      "--disable-quic",
      "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--blink-settings=imagesEnabled=false",
      "--renderer-process-limit=1",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-breakpad",
      "--no-first-run",
      "--no-default-browser-check",
      "--mute-audio",
      "--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter,OptimizationHints,InterestFeedContentSuggestions",
      "--js-flags=--max-old-space-size=384",
      ...(process.env.SCANNER_SINGLE_PROCESS === "1" ? ["--single-process"] : []),
      ...(process.env.SCANNER_NO_SANDBOX === "1" ? ["--no-sandbox"] : []),
    ],
  });
  const deadlineAt = Date.now() + SCAN_DEADLINE_MS;
  let timer;
  const backstop = new Promise((_, rej) => {
    timer = setTimeout(() => rej(Object.assign(new Error("The scan took too long. Try again or add cookies by hand."), { status: 504 })), SCAN_DEADLINE_MS + 8000);
  });
  try {
    return await Promise.race([backstop, run(browser, url, siteDomain, deadlineAt)]);
  } finally {
    clearTimeout(timer);
    await browser.close().catch(() => {});
  }
}

async function run(browser, url, siteDomain, deadlineAt) {
  const hosts = new Map(), storageKeys = new Set(), pagesVisited = [], errors = [], htmlParts = [];
  let site = {}, homeHeaders = {}, homeHtml = "", privacyText = "", finalHttps = url.protocol === "https:";
  const timeLeft = () => deadlineAt - Date.now();

  const context = await browser.newContext({
    locale: "en-IN", timezoneId: "Asia/Kolkata", viewport: { width: 1366, height: 850 },
    serviceWorkers: "block", acceptDownloads: false,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 KensaraScanner/1.0",
  });
  await context.addInitScript(() => { try { delete window.RTCPeerConnection; delete window.webkitRTCPeerConnection; } catch (e) {} });
  if (context.routeWebSocket) await context.routeWebSocket(/.*/, ws => ws.close());
  await context.route("**/*", route => {
    const r = route.request();
    let u; try { u = new URL(r.url()); } catch { return route.abort(); }
    if (!/^https?:$/.test(u.protocol)) return route.continue();
    if (u.port && u.port !== "80" && u.port !== "443") return route.abort();
    if (DROP_TYPES.has(r.resourceType())) return route.abort();
    return route.continue();
  });

  const page = await context.newPage();
  page.on("request", r => {
    try { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol)) hosts.set(u.hostname, (hosts.get(u.hostname) || 0) + 1); } catch {}
  });

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

  async function readStorage() {
    const keys = await page.evaluate(() => {
      const out = [];
      try { for (let i = 0; i < localStorage.length; i++) out.push(["localStorage", localStorage.key(i)]); } catch {}
      try { for (let i = 0; i < sessionStorage.length; i++) out.push(["sessionStorage", sessionStorage.key(i)]); } catch {}
      return out;
    }).catch(() => []);
    keys.forEach(k => storageKeys.add(JSON.stringify(k)));
  }

  async function visit(target, isHome, isPrivacy) {
    if (timeLeft() < 5000) return { visited: false, links: [] };
    try {
      const gotoBudget = clamp(timeLeft() - 4000, 3500, PAGE_TIMEOUT);
      const resp = await withTimeout(page.goto(target, { waitUntil: "domcontentloaded", timeout: gotoBudget }), gotoBudget + 2000);
      if (resp === TIMED_OUT) { errors.push(`${target}: load timed out`); return { visited: false, links: [] }; }
      if (resp && resp.headers && resp.headers()["x-kensara-egress"] === "denied") {
        if (isHome) throw Object.assign(new Error("This address isn't a public website."), { denied: true });
        return { visited: false, links: [] };
      }
      const perPage = isHome ? clamp(timeLeft() - 12000, 3000, 12000) : clamp(timeLeft() - 5000, 1500, 8000);
      await withTimeout(hydrate(perPage), perPage + 2500);
      pagesVisited.push(page.url());
      await withTimeout(readStorage(), 3500);

      // Capture HTML (bounded) for posture analysis: vendors, notice, data points.
      const html = await withTimeout(page.content(), 3500);
      const text = (typeof html === "string" ? html : "").slice(0, HTML_CAP);
      if (text) { htmlParts.push(text); if (isHome) homeHtml = text; if (isPrivacy) privacyText = text; }

      let links = [];
      if (isHome) {
        if (resp && typeof resp.headers === "function") homeHeaders = resp.headers();
        try { finalHttps = new URL(page.url()).protocol === "https:"; } catch {}
        const base = new URL(page.url());
        const rawE = await withTimeout(page.$$eval("a[href]", as => as.map(a => a.href)), 4000);
        const raw = Array.isArray(rawE) ? rawE : [];
        links = [...new Set(raw)].filter(h => { try { const u = new URL(h); return u.hostname === base.hostname && /^https?:$/.test(u.protocol) && !/\.(pdf|jpe?g|png|zip|docx?|xlsx?)$/i.test(u.pathname) && !/logout|signout|wp-admin|cart\/add/i.test(u.pathname); } catch { return false; } })
          .map(stripHash).filter(h => h !== base.href).slice(0, MAX_PAGES * 4);
        site = await withTimeout(page.evaluate(() => {
          const meta = n => { const el = document.querySelector(`meta[property="${n}"],meta[name="${n}"]`); return (el && el.content) || ""; };
          let orgName = meta("og:site_name") || meta("application-name") || "";
          try {
            for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
              const parsed = JSON.parse(s.textContent);
              const list = Array.isArray(parsed) ? parsed : (parsed && parsed["@graph"]) || [parsed];
              for (const o of list) {
                const types = [].concat((o && o["@type"]) || "").join(" ");
                if (o && o.name && /(Organization|LocalBusiness|Corporation|Store|NGO)/i.test(types)) { orgName = orgName || o.name; }
              }
            }
          } catch (e) {}
          if (!orgName) orgName = (document.title || "").split(/[|–—\-:·]/)[0].trim();
          const links = [...document.querySelectorAll("a[href]")];
          const href = a => a.getAttribute("href") || "";
          const privacy = links.find(a => /privacy|data.?protection|\bpolicy\b/i.test((a.textContent || "") + " " + href(a)));
          const mail = links.find(a => /^mailto:/i.test(href(a)));
          const tel = links.find(a => /^tel:/i.test(href(a)));
          const clean = (s, n) => String(s || "").trim().slice(0, n);
          return {
            orgName: clean(orgName, 150),
            privacyUrl: privacy ? privacy.href : "",
            email: mail ? clean(decodeURIComponent(href(mail).replace(/^mailto:/i, "").split("?")[0]), 200) : "",
            phone: tel ? clean(href(tel).replace(/^tel:/i, "").replace(/[^\d+ ()-]/g, ""), 30) : "",
          };
        }).catch(() => ({})), 4500);
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

  // 1) Homepage.
  const home = await visit(url.href, true, false);

  // 2) Queue the rest — a privacy/policy page first (needed for notice coverage), then others.
  const seen = new Set([stripHash(url.href)]);
  const queue = [];
  for (const link of (home.links || [])) { if (!seen.has(link)) { seen.add(link); queue.push(link); } }
  const isPrivacyUrl = h => /privacy|data.?protection|data.?policy|cookie|terms/i.test(h);
  queue.sort((a, b) => (isPrivacyUrl(b) ? 1 : 0) - (isPrivacyUrl(a) ? 1 : 0));

  let reachedAll = true;
  for (const target of queue) {
    if (pagesVisited.length >= MAX_PAGES) break;
    if (timeLeft() < 8000) { reachedAll = false; break; }
    await visit(target, false, isPrivacyUrl(target));
  }
  if (!pagesVisited.length) { await page.close().catch(() => {}); throw new Error("The site couldn't be loaded. Check the address and that it's publicly reachable."); }
  const incomplete = !reachedAll && pagesVisited.length < Math.min(MAX_PAGES, 1 + queue.length);

  const rawCookies = await withTimeout(context.cookies(), 4000);
  await page.close().catch(() => {});
  const cookieList = Array.isArray(rawCookies) ? rawCookies : [];

  // ---- consent-shaped output ----
  const cookies = cookieList.map(c => {
    const cls = classifyCookie(c.name), cdom = c.domain.replace(/^\./, "");
    return { name: c.name, domain: cdom, firstParty: registrable(cdom) === siteDomain, duration: duration(c.expires), httpOnly: !!c.httpOnly, secure: !!c.secure, vendor: cls.vendor, category: cls.category, purpose: cls.purpose, suggested: cls.suggested || "" };
  }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const storage = [...storageKeys].map(s => JSON.parse(s)).map(([area, key]) => ({ area, key, ...classifyCookie(key) }));
  const thirdParties = [...hosts.entries()].filter(([h]) => registrable(h) !== siteDomain)
    .map(([host, requests]) => ({ host, requests, ...classifyHost(host) }))
    .sort((a, b) => b.requests - a.requests);

  // ---- gap-shaped posture output ----
  const allHtml = htmlParts.join("\n");
  const htmlVendors = detectVendors(allHtml);
  // Merge HTML-detected vendors with host-detected ones (both carry region/pii).
  const vendorMap = new Map();
  for (const v of htmlVendors) vendorMap.set(v.name, v);
  for (const tp of thirdParties) if (tp.vendor !== "Unknown" && tp.gapCategory && !vendorMap.has(tp.vendor)) vendorMap.set(tp.vendor, { name: tp.vendor, category: tp.gapCategory, region: tp.region, pii: tp.pii });
  const gapVendors = [...vendorMap.values()];

  const cmpVendor = gapVendors.find(v => v.category === "consent");
  const trackerVendors = gapVendors.filter(v => ["analytics", "advertising", "sessionReplay"].includes(v.category));
  const cloudProviders = gapVendors.filter(v => v.category === "cloud" || v.category === "cdn").map(v => v.name);
  const crossBorderRegions = [...new Set(gapVendors.filter(v => v.region && v.region !== "IN" && v.region !== "Global").map(v => v.region))];

  const hasPrivacyPolicy = !!privacyText || !!(site && site.privacyUrl) || /\/privacy/i.test(homeHtml);
  const noticeText = privacyText || (hasPrivacyPolicy ? homeHtml : "");
  const notice = hasPrivacyPolicy ? buildNotice(true, noticeText) : emptyNotice();
  const security = buildSecurity(homeHeaders, finalHttps, cookies);
  const dataPoints = buildDataPoints(allHtml);
  const hasConsentBanner = !!cmpVendor || /(cookieconsent|cookie-consent|we use cookies|accept (all )?cookies|consent[-_ ]?banner)/i.test(homeHtml);
  const consentGating = !!cmpVendor && /type=["']text\/plain["'][^>]*(cookie|consent)/i.test(homeHtml);
  const hasDpoNamed = /(data protection officer|grievance officer)/i.test(allHtml);
  const hasGrievanceContact = /(grievance|privacy@|dpo@|complaint)/i.test(allHtml);
  const hasRightsPage = /(your rights|data principal rights|request.{0,20}data|erasure request)/i.test(allHtml);
  const privacyLooksAligned = hasPrivacyPolicy && notice.covered >= 6;

  // ---- findings (shared) + grounded upsell ----
  const optional = x => x.category === "functional" || x.category === "analytics" || x.category === "marketing";
  const preCookies = cookies.filter(optional), preStorage = storage.filter(optional), preHosts = thirdParties.filter(h => h.category === "analytics" || h.category === "marketing");
  const unknown = cookies.filter(c => c.category === "unclassified").length + storage.filter(s => s.category === "unclassified").length;
  const cmp = cmpVendor ? cmpVendor.name : null;

  const findings = [];
  if (preCookies.length || preStorage.length) findings.push({ level: "high", text: `${preCookies.length} cookie(s) and ${preStorage.length} browser-storage item(s) for optional purposes were set before the visitor made any choice. These need consent first.` });
  if (preHosts.length) findings.push({ level: "high", text: `Data was sent to ${preHosts.length} analytics or advertising service(s) (${preHosts.slice(0, 4).map(h => h.vendor).join(", ")}) before any choice. Sending the visitor's IP address and device details is processing even without cookies.` });
  if (!cmp && (preHosts.length || preCookies.length)) findings.push({ level: "high", text: "No consent tool was detected, yet trackers ran before any choice. Kensara Pro installs a DPDP-ready banner that blocks these automatically until the visitor agrees, and keeps a record that stands up." });
  else if (cmp && (preHosts.length || preCookies.length)) findings.push({ level: "medium", text: `A consent tool (${cmp}) was detected, but trackers still ran before any choice, so it isn't blocking them. Kensara Pro blocks trackers until consent and logs each choice against the exact notice shown.` });
  if (crossBorderRegions.length) findings.push({ level: "medium", text: `Personal data appears to flow to services outside India (${crossBorderRegions.join(", ")}). Cross-border transfers must be disclosed and, for some destinations, restricted.` });
  if (hasPrivacyPolicy && notice.covered < 6) findings.push({ level: "medium", text: `The privacy notice is missing ${notice.total - notice.covered} of ${notice.total} expected DPDP disclosures.` });
  if (!hasPrivacyPolicy) findings.push({ level: "high", text: "No privacy notice was found. DPDP requires a clear, itemised notice before collecting personal data." });
  if (unknown) findings.push({ level: "medium", text: `${unknown} item(s) set before consent couldn't be identified. If they aren't essential, they also need consent.` });
  if (!finalHttps) findings.push({ level: "medium", text: "The site doesn't use HTTPS. Personal data should be protected in transit." });
  if (errors.length) findings.push({ level: "low", text: `${errors.length} page(s) couldn't be loaded during the scan.` });
  if (incomplete) findings.push({ level: "low", text: `The scan stopped early to stay within the time limit; results cover ${pagesVisited.length} page(s).` });

  return {
    url: url.href, domain: url.hostname.replace(/^www\./, ""), scannedAt: new Date().toISOString(),
    reachable: true, pagesScanned: pagesVisited.length, pagesVisited, incomplete,
    // consent tool
    site, cookies, storage, thirdParties, cmp,
    // gap tool
    vendors: gapVendors, vendorCount: gapVendors.length, piiVendorCount: gapVendors.filter(v => v.pii).length,
    trackers: trackerVendors.map(v => v.name), cloudProviders, crossBorderRegions,
    security, notice, dataPoints, https: finalHttps, hasPrivacyPolicy, privacyLooksAligned,
    hasConsentBanner, consentGating, hasDpoNamed, hasGrievanceContact, hasRightsPage,
    // shared
    summary: { pages: pagesVisited.length, cookies: cookies.length, trackers: preHosts.length, preConsentCookies: preCookies.length + preStorage.length, cmp, crossBorder: crossBorderRegions.length },
    hints: gapVendors.map(v => v.name).filter(n => TAGGING_HINTS[n]).map(n => ({ vendor: n, hint: TAGGING_HINTS[n] })),
    findings, errors,
  };
}

module.exports = { scan };
