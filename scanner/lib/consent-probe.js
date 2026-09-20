// Three-state consent probe — the finding no free competitor shows.
// Loads the site's OWN banner and proves whether it actually gates trackers:
//   1. pre-consent : what fires before any choice
//   2. accept      : click the site's "Accept" -> did new trackers only now appear (gated) or were they already firing (not gated)?
//   3. reject      : click the site's "Reject" -> do trackers still fire (violation)? is a reject even offered (parity)?
const { CONTEXT_OPTS, harden, trackHosts } = require("./context-setup");
const { classifyHost } = require("./classify");

const TIMED_OUT = Symbol("timeout");
function withTimeout(promise, ms) {
  let t; const guard = new Promise(res => { t = setTimeout(() => res(TIMED_OUT), ms); });
  return Promise.race([Promise.resolve(promise).then(v => { clearTimeout(t); return v; }, e => { clearTimeout(t); throw e; }), guard]);
}

// Runs in the page: find + tag the banner's Accept / Reject controls (pierces open shadow DOM).
function detectAndTagControls() {
  const ACCEPT = /\b(accept all|allow all|accept cookies|accept & close|i accept|accept|allow all cookies|allow cookies|i agree|agree|got it|enable all|yes,? i agree)\b/i;
  const REJECT_DIRECT = /\b(reject all|reject|decline all|decline|refuse|deny|only necessary|necessary only|essential (only|cookies)|use necessary|do not (accept|allow)|disagree|opt[- ]?out)\b/i;
  const REJECT_ADJ = /\b(manage|customi[sz]e|preferences|settings|choose|options|more options|cookie settings)\b/i;

  const clickables = [];
  const walk = root => {
    try { root.querySelectorAll('button, a[role="button"], a, input[type="button"], input[type="submit"], [role="button"]').forEach(el => clickables.push(el)); } catch (e) {}
    try { root.querySelectorAll("*").forEach(el => { if (el.shadowRoot) walk(el.shadowRoot); }); } catch (e) {}
  };
  walk(document);

  const bodyText = (document.body ? document.body.innerText || "" : "").slice(0, 5000);
  const knownSel = ["#onetrust-banner-sdk", "#CybotCookiebotDialog", ".cky-consent-container", "#usercentrics-root",
    "#cookie-law-info-bar", ".cc-window", "#cookieConsent", '[class*="cookie-consent" i]', '[class*="consent" i][class*="banner" i]', '[id*="cookie" i][class*="banner" i]'];
  let bannerFound = knownSel.some(s => { try { return !!document.querySelector(s); } catch (e) { return false; } });
  if (!bannerFound) bannerFound = /(we use cookies|cookies? (to|help|policy|and)|your privacy|accept (all )?cookies|cookie (settings|preferences|consent))/i.test(bodyText);

  let acceptEl = null, rejectEl = null, rejectAdjEl = null;
  for (const el of clickables) {
    const t = (el.textContent || el.value || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 45) continue;
    if (!acceptEl && ACCEPT.test(t)) acceptEl = el;
    if (!rejectEl && REJECT_DIRECT.test(t)) rejectEl = el;
    if (!rejectAdjEl && REJECT_ADJ.test(t)) rejectAdjEl = el;
  }

  let preTicked = false;
  try {
    for (const c of document.querySelectorAll('input[type="checkbox"], input[type="radio"], [role="switch"]')) {
      const lbl = (((c.closest("label") || {}).textContent) || "") + " " + (c.name || "") + " " + (c.id || "");
      const on = c.checked || c.getAttribute("aria-checked") === "true";
      if (on && /(analytic|marketing|advertis|statistic|performance|targeting|social)/i.test(lbl)) { preTicked = true; break; }
    }
  } catch (e) {}

  if (acceptEl) acceptEl.setAttribute("data-kensara-consent", "accept");
  if (rejectEl) rejectEl.setAttribute("data-kensara-consent", "reject");
  return {
    bannerFound, hasAccept: !!acceptEl, hasReject: !!rejectEl, hasManageOnly: !rejectEl && !!rejectAdjEl, preTicked,
    acceptText: acceptEl ? (acceptEl.textContent || "").replace(/\s+/g, " ").trim().slice(0, 45) : "",
    rejectText: rejectEl ? (rejectEl.textContent || "").replace(/\s+/g, " ").trim().slice(0, 45) : "",
  };
}

// Count distinct analytics/advertising tracker hosts contacted so far.
function trackerHostCount(hosts, siteHost) {
  let n = 0;
  for (const h of hosts.keys()) {
    if (h === siteHost || h.endsWith("." + siteHost.replace(/^www\./, ""))) continue;
    const c = classifyHost(h).category;
    if (c === "analytics" || c === "marketing") n++;
  }
  return n;
}

async function loadAndDetect(browser, url) {
  const hosts = new Map();
  const context = await browser.newContext(CONTEXT_OPTS);
  await harden(context);
  const page = await context.newPage();
  trackHosts(page, hosts);
  let controls = { bannerFound: false, hasAccept: false, hasReject: false, hasManageOnly: false, preTicked: false, acceptText: "", rejectText: "" };
  try {
    const resp = await withTimeout(page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 }), 14000);
    if (resp === TIMED_OUT) throw new Error("load timed out");
    await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1500).catch(() => {});
    const c = await withTimeout(page.evaluate(detectAndTagControls), 4000);
    if (c && c !== TIMED_OUT) controls = c;
  } catch (e) { /* leave defaults */ }
  return { context, page, hosts, controls };
}

// Public: run the probe. Bounded; skips the reject leg if time is short.
async function probeConsent(browser, url, siteHost, deadlineAt) {
  const timeLeft = () => deadlineAt - Date.now();
  const out = {
    bannerFound: false, hasAccept: false, hasReject: false, hasManageOnly: false, rejectParity: false, preTicked: false,
    acceptText: "", rejectText: "",
    trackersBeforeConsent: 0, newTrackersAfterAccept: 0, trackersAfterReject: null,
    blocksBeforeConsent: null, honoursReject: null, tested: { accept: false, reject: false }, verdict: "",
  };

  // --- Accept leg ---
  let ctxA;
  try {
    const a = await loadAndDetect(browser, url);
    ctxA = a.context;
    Object.assign(out, {
      bannerFound: a.controls.bannerFound, hasAccept: a.controls.hasAccept, hasReject: a.controls.hasReject,
      hasManageOnly: a.controls.hasManageOnly, preTicked: a.controls.preTicked,
      acceptText: a.controls.acceptText, rejectText: a.controls.rejectText,
    });
    out.rejectParity = a.controls.hasReject; // a direct, banner-level reject exists
    out.trackersBeforeConsent = trackerHostCount(a.hosts, siteHost);
    if (a.controls.hasAccept) {
      const before = out.trackersBeforeConsent;
      await a.page.click('[data-kensara-consent="accept"]', { timeout: 3000 }).catch(() => {});
      await a.page.waitForTimeout(3500).catch(() => {});
      out.newTrackersAfterAccept = Math.max(0, trackerHostCount(a.hosts, siteHost) - before);
      out.tested.accept = true;
      // Banner "blocks before consent" only if nothing tracked pre-consent AND tags appeared post-accept.
      out.blocksBeforeConsent = out.trackersBeforeConsent === 0 && out.newTrackersAfterAccept > 0;
    }
  } catch (e) { /* ignore */ } finally { if (ctxA) await ctxA.close().catch(() => {}); }

  // --- Reject leg (fresh state, only if a reject exists and time remains) ---
  if (out.hasReject && timeLeft() > 16000) {
    let ctxR;
    try {
      const r = await loadAndDetect(browser, url);
      ctxR = r.context;
      if (r.controls.hasReject) {
        await r.page.click('[data-kensara-consent="reject"]', { timeout: 3000 }).catch(() => {});
        await r.page.waitForTimeout(3500).catch(() => {});
        out.trackersAfterReject = trackerHostCount(r.hosts, siteHost);
        out.honoursReject = out.trackersAfterReject === 0;
        out.tested.reject = true;
      }
    } catch (e) { /* ignore */ } finally { if (ctxR) await ctxR.close().catch(() => {}); }
  }

  // --- Verdict ---
  if (!out.bannerFound) out.verdict = "no-banner";
  else if (out.trackersBeforeConsent > 0) out.verdict = "tracks-before-consent";   // worst: banner is cosmetic
  else if (out.tested.reject && out.honoursReject === false) out.verdict = "ignores-reject";
  else if (!out.hasReject) out.verdict = "no-reject-option";
  else if (out.preTicked) out.verdict = "pre-ticked";
  else out.verdict = "ok";
  return out;
}

module.exports = { probeConsent };
