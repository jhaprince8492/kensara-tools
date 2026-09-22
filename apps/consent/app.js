(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const SITE = window.KENSARA_SITE || {};
  const CAT_LABEL = { necessary: "Necessary", functional: "Functional", analytics: "Analytics", marketing: "Advertising", unclassified: "Choose…" };
  const OPT = ["functional", "analytics", "marketing"];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DEFAULTS = window.KensaraConsent.defaults("en");
  const blank = () => ({ scan: null, cookies: [], storage: [], hosts: [], leadContext: "" });
  let state = blank();
  const BASE = (function () {
    var p = location.pathname;
    return p.endsWith("/") ? p : p.slice(0, p.lastIndexOf("/") + 1);
  })();
  // Deep scanner API. Empty = same origin (served by the scanner service). Set
  // SITE.scannerBase to a full URL (e.g. https://consent.kensara.in) for cross-origin.
  const API = String(SITE.scannerBase || "").replace(/\/$/, "");

  /* ---------- links from site-config.js ---------- */
  ["#privacy-link-1", "#privacy-link-2"].forEach(s => { const el = $(s); if (el) el.href = SITE.privacyNoticeUrl || "#"; });
  const navDemo = $("#nav-demo"); if (navDemo) navDemo.href = SITE.bookDemoUrl || "#";
  const priceLine = $("#pricing-line"); if (priceLine) priceLine.innerHTML = SITE.pricingUrl ? `See <a href="${esc(SITE.pricingUrl)}" target="_blank" rel="noopener">plans and pricing</a>.` : "";

  /* ---------- optional Cloudflare Turnstile (implicit render) ----------
     We tag the placeholders with .cf-turnstile + data-sitekey and load api.js once.
     Cloudflare auto-renders them and drops a hidden <input name="cf-turnstile-response">
     into each container, which we read on submit. We never call turnstile.render()
     ourselves, so a double-load or an extension pre-defining window.turnstile can't
     crash us. tsToken/tsReset take the container id ("turnstile" or "turnstile-lead"). */
  function loadTurnstile() {
    if (!SITE.turnstileSiteKey) return;
    document.querySelectorAll("#turnstile, #turnstile-lead").forEach(el => {
      el.classList.add("cf-turnstile");
      el.setAttribute("data-sitekey", SITE.turnstileSiteKey);
    });
    if (window.__kTsLoaded) return; window.__kTsLoaded = true;
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  }
  const tsToken = id => { const c = document.getElementById(id), inp = c && c.querySelector('[name="cf-turnstile-response"]'); return inp ? inp.value : ""; };
  const tsReset = id => { if (window.turnstile) { try { turnstile.reset("#" + id); } catch (e) {} } };
  loadTurnstile();

  /* ---------- navigation ---------- */
  function go(id) {
    document.querySelectorAll("section.step").forEach(s => s.classList.toggle("on", s.id === id));
    window.scrollTo({ top: 0 });
    if (id === "s2") renderPurposes();
    if (id === "s3") startDemo();
  }
  document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.go === "s0") { state = blank(); $("#details").reset(); $("#purposes").innerHTML = ""; delete $("#details").dataset.touched; }
    go(b.dataset.go);
  }));

  /* ---------- scan ---------- */
  const msgs = ["Opening your homepage…", "Waiting for tags and pixels to load…", "Visiting a few more pages…", "Reading cookies and storage…", "Identifying trackers…"];
  $("#scan-form").addEventListener("submit", async e => {
    e.preventDefault();
    const url = $("#url").value.trim(); if (!url) return;
    $("#scan-err").textContent = ""; $("#scan-btn").disabled = true; $("#scanning").hidden = false;
    let i = 0; $("#scan-msg").textContent = msgs[0];
    const tick = setInterval(() => { $("#scan-msg").textContent = msgs[Math.min(++i, msgs.length - 1)]; }, 7000);
    try {
      const r = await fetch(API + "/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, turnstileToken: tsToken("turnstile"), mode: "consent" }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "The scan didn't finish. Try again, or try the sample website.");
      loadScan(data);
    } catch (err) { $("#scan-err").textContent = err.message; }
    finally { clearInterval(tick); $("#scan-btn").disabled = false; $("#scanning").hidden = true; tsReset("turnstile"); }
  });
  $("#sample").onclick = async () => { const r = await fetch(BASE + "sample-scan.json"); loadScan(await r.json()); };

  function loadScan(data) {
    state.scan = data;
    // For cookies/storage we couldn't identify, the scanner suggests a category.
    // Pre-fill it (flagged as a guess) so a non-technical user isn't stuck on "Choose…".
    const applyGuess = x => (x.category === "unclassified" && x.suggested)
      ? { ...x, category: x.suggested, guessed: true } : { ...x };
    state.cookies = (data.cookies || []).map(applyGuess);
    state.storage = (data.storage || []).map(applyGuess);
    state.hosts = data.thirdParties || [];
    const F = $("#details");
    delete F.dataset.touched;
    // Pre-fill the organisation details from the scan where we can (all editable).
    const site = data.site || {};
    if (data.sample) {
      F.domain.value = "";
    } else {
      F.domain.value = data.domain || "";
      if (site.orgName && !F.orgName.value) F.orgName.value = site.orgName;
      if (site.privacyUrl && !F.noticeUrl.value) F.noticeUrl.value = site.privacyUrl;
      if (site.email && !F.gEmail.value) F.gEmail.value = site.email;
      if (site.phone && !F.gPhone.value) F.gPhone.value = site.phone;
    }
    renderReview(); go("s1");
  }

  /* ---------- review ---------- */
  function catSelect(v, kind, idx) {
    const opts = (v === "unclassified" ? ["unclassified"] : []).concat(["necessary", ...OPT]);
    return `<select data-kind="${kind}" data-i="${idx}" aria-label="Category">${opts.map(o => `<option value="${o}"${o === v ? " selected" : ""}>${CAT_LABEL[o]}</option>`).join("")}</select>`;
  }
  function renderReview() {
    const s = state.scan;
    $("#r-title").textContent = s ? `What we found on ${s.domain}` : "What we found";
    $("#r-sample-note").hidden = !(s && s.sample);
    $("#r-summary").innerHTML = s ? `
      <div><strong>${s.pagesVisited.length}</strong>pages checked</div>
      <div><strong>${state.cookies.length}</strong>cookies</div>
      <div><strong>${state.storage.length}</strong>storage items</div>
      <div><strong>${state.hosts.length}</strong>third-party services</div>` : "";
    const f = s ? s.findings || [] : [];
    $("#r-findings").innerHTML = f.length
      ? f.map(x => `<div class="finding"><span class="sev ${esc(x.level)}">${x.level === "high" ? "Fix before launch" : x.level === "medium" ? "Review" : "Note"}</span><div>${esc(x.text)}</div></div>`).join("")
      : `<div class="finding"><div>No trackers ran before consent on the pages we checked. Trackers that fire only after clicks or logins can still be missed.</div></div>`;
    renderCookies(); renderStorage(); renderHosts();
  }
  function renderCookies() {
    const rows = state.cookies;
    $("#r-cookies").innerHTML = `<tr><th>Cookie</th><th>Provider</th><th>Kept for</th><th>Set by</th><th>Category</th><th></th></tr>` +
      (rows.length ? rows.map((c, i) => `<tr class="${c.category === "unclassified" ? "unc" : ""}">
        <td><code>${esc(c.name)}</code>${c.purpose ? `<div class="fine">${esc(c.purpose)}</div>` : ""}${c.guessed ? `<div class="fine guess">Auto-suggested, please confirm the category</div>` : ""}</td>
        <td>${esc(c.vendor)}</td><td>${esc(c.duration)}</td><td>${c.firstParty === false ? "Third party" : "This site"}</td>
        <td>${catSelect(c.category, "cookie", i)}</td><td><button class="linkbtn" data-del-cookie="${i}" aria-label="Remove ${esc(c.name)}">Remove</button></td></tr>`).join("")
        : `<tr><td colspan="6" class="muted">No cookies found.</td></tr>`);
    wireSelects("#r-cookies");
    $("#r-cookies").querySelectorAll("[data-del-cookie]").forEach(b => b.onclick = () => { state.cookies.splice(+b.dataset.delCookie, 1); renderCookies(); });
  }
  function renderStorage() {
    const rows = state.storage;
    $("#r-storage").innerHTML = `<tr><th>Key</th><th>Where</th><th>Provider</th><th>Category</th></tr>` +
      (rows.length ? rows.map((s, i) => `<tr class="${s.category === "unclassified" ? "unc" : ""}"><td><code>${esc(s.key)}</code>${s.purpose ? `<div class="fine">${esc(s.purpose)}</div>` : ""}${s.guessed ? `<div class="fine guess">Auto-suggested, please confirm</div>` : ""}</td><td>${esc(s.area)}</td><td>${esc(s.vendor)}</td><td>${catSelect(s.category, "storage", i)}</td></tr>`).join("")
        : `<tr><td colspan="4" class="muted">None found.</td></tr>`);
    wireSelects("#r-storage");
  }
  function wireSelects(sel) {
    $(sel).querySelectorAll("select[data-i]").forEach(s => s.onchange = () => {
      const list = s.dataset.kind === "cookie" ? state.cookies : state.storage;
      list[+s.dataset.i].category = s.value;
      list[+s.dataset.i].guessed = false; // the user has now confirmed it
      s.dataset.kind === "cookie" ? renderCookies() : renderStorage();
    });
  }
  function renderHosts() {
    $("#r-hosts").innerHTML = `<tr><th>Service</th><th>Provider</th><th>Type</th><th>Requests</th></tr>` +
      (state.hosts.length ? state.hosts.slice(0, 40).map(h => `<tr><td><code>${esc(h.host)}</code></td><td>${esc(h.vendor)}</td><td>${h.category === "unclassified" ? "Unknown" : CAT_LABEL[h.category] || esc(h.category)}</td><td>${+h.requests || 0}</td></tr>`).join("")
        : `<tr><td colspan="4" class="muted">None.</td></tr>`);
  }
  $("#add-cookie").onclick = () => {
    const name = (prompt("Cookie name") || "").trim().slice(0, 120); if (!name) return;
    const vendor = (prompt("Who sets it? (e.g. Google Analytics, your own site)") || "Website").slice(0, 80);
    const duration = (prompt("How long is it kept? (e.g. Session, 13 months)") || "Session").slice(0, 40);
    state.cookies.push({ name, vendor, duration, category: "unclassified", firstParty: true, purpose: "" });
    renderCookies();
  };
  $("#to-details").onclick = () => {
    const unc = state.cookies.concat(state.storage).filter(c => c.category === "unclassified").length;
    if (unc) { $("#r-err").textContent = `Choose a category for the ${unc} item(s) marked in amber first.`; return; }
    $("#r-err").textContent = ""; go("s2");
  };

  /* ---------- details: purposes ---------- */
  function renderPurposes() {
    const F = $("#details");
    if (F.dataset.touched) return;
    const used = new Set([...state.cookies, ...state.storage, ...state.hosts].map(x => x.category));
    $("#purposes").innerHTML = OPT.map(c => {
      const vendors = [...new Set([...state.cookies, ...state.storage, ...state.hosts].filter(x => x.category === c && x.vendor && x.vendor !== "Unknown" && !/^Website/.test(x.vendor)).map(x => x.vendor))].join(", ");
      const on = used.has(c);
      return `<fieldset class="purpose" data-cat="${c}"${on ? "" : " data-off"}>
        <label class="check"><input type="checkbox" name="cat_${c}"${on ? " checked" : ""}> <b>${CAT_LABEL[c]}</b></label>
        <div class="grid">
          <label class="f full">Personal data used<span>Itemised, in plain words</span><input name="data_${c}" maxlength="400" value="${esc(DEFAULTS[c].dataItems)}"></label>
          <label class="f full">What it's used for<input name="uses_${c}" maxlength="400" value="${esc(DEFAULTS[c].uses)}"></label>
          <label class="f">Kept for<input name="ret_${c}" maxlength="120" placeholder="${c === "marketing" ? "90 days" : "13 months"}"></label>
          <label class="f">Shared with<input name="rec_${c}" maxlength="300" value="${esc(vendors)}"></label>
        </div></fieldset>`;
    }).join("") + `<p class="fine">Edited text is shown as written in every language. Pro includes translation of your own text.</p>`;
    $("#purposes").querySelectorAll('input[name^="cat_"]').forEach(i => i.onchange = () => {
      i.closest(".purpose").toggleAttribute("data-off", !i.checked); F.dataset.touched = "1";
    });
    F.dataset.touched = "1";
  }

  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i); return (h >>> 0).toString(36); }
  function buildConfig() {
    const F = $("#details"), v = n => (F[n] ? String(F[n].value || "").trim() : "");
    const categories = {};
    OPT.forEach(c => categories[c] = { enabled: !!(F["cat_" + c] && F["cat_" + c].checked), dataItems: v("data_" + c), uses: v("uses_" + c), retention: v("ret_" + c), recipients: v("rec_" + c) });
    const cfg = {
      siteId: "demo",
      org: { name: v("orgName"), noticeUrl: v("noticeUrl"), rightsUrl: v("rightsUrl"),
        grievance: { name: v("gName"), email: v("gEmail"), phone: v("gPhone"), responseDays: Math.min(90, Math.max(1, +v("gDays") || 30)) },
        dpoEmail: v("dpoEmail"), boardUrl: v("boardUrl") },
      languages: F.lang_hi.checked ? ["en", "hi"] : ["en"], defaultLang: "en",
      categories,
      cookies: state.cookies.map(({ name, vendor, category, duration, purpose }) => ({ name, vendor, category, duration, purpose })),
      storage: state.storage.map(({ key, area, vendor, category }) => ({ key, area, vendor, category })),
      theme: { accent: F.accent.value, position: F.position.value },
      ageGate: F.ageGate.checked, reconsentDays: 365
    };
    cfg.noticeVersion = "demo-" + hash(JSON.stringify(cfg));   // any change = new notice version = visitor asked again
    return cfg;
  }
  const isHttpUrl = s => { try { return /^https?:$/.test(new URL(s).protocol); } catch { return false; } };
  const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  function validate(c) {
    if (!c.org.name) return "Enter the organisation's name.";
    if (!isHttpUrl(c.org.noticeUrl)) return "Enter the full link to your privacy notice, starting with https://";
    if (c.org.rightsUrl && !isHttpUrl(c.org.rightsUrl)) return "The rights request link should start with https://";
    if (!isEmail(c.org.grievance.email)) return "Enter a valid grievance officer email. The Act requires a way to raise grievances.";
    if (c.org.dpoEmail && !isEmail(c.org.dpoEmail)) return "The Data Protection Officer email doesn't look right.";
    if (!isHttpUrl(c.org.boardUrl)) return "Enter the Data Protection Board complaint link. The notice must say how to complain to the Board.";
    for (const k of OPT) if (c.categories[k].enabled && !c.categories[k].dataItems) return `List the personal data used for ${CAT_LABEL[k]}.`;
    return null;
  }
  $("#to-demo").onclick = () => {
    const c = buildConfig(), err = validate(c);
    $("#d-err").textContent = err || "";
    if (!err) { state.config = c; go("s3"); }
  };

  /* ---------- live demo ---------- */
  const frame = $("#demo-frame");
  function sendConfig() { if (state.config && frame.contentWindow) frame.contentWindow.postMessage({ type: "kensara-demo-config", config: state.config }, location.origin); }
  function startDemo() {
    if (!frame.src.endsWith("demo-site.html")) frame.src = BASE + "demo-site.html"; else sendConfig();
    setTimeout(() => frame.scrollIntoView({ block: "start", behavior: "smooth" }), 400);
  }
  frame.addEventListener("load", sendConfig);
  window.addEventListener("message", e => { if (e.origin === location.origin && e.data && e.data.type === "kensara-demo-ready") sendConfig(); });

  /* ---------- lead form ---------- */
  const dlg = $("#lead"), LF = $("#lead-form");
  const MARKETING_TEXT = "Also send me occasional product updates and offers from Kensara. You can unsubscribe any time.";
  $("#marketing-text").textContent = MARKETING_TEXT;
  $("#lead-notice").innerHTML = `Kensara will use these details only to contact you about your request. <a href="${esc(SITE.privacyNoticeUrl || "#")}" target="_blank" rel="noopener">Privacy notice</a>, including how to withdraw consent and raise a grievance.`;
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-lead]"); if (!b) return;
    state.leadContext = b.dataset.lead;
    $("#lead-body").hidden = false; $("#lead-done").hidden = true; $("#lead-err").textContent = "";
    if (!LF.website.value && state.scan && !state.scan.sample) LF.website.value = state.scan.domain;
    dlg.showModal(); LF.name.focus();
  });
  $("#lead-close").onclick = $("#lead-ok").onclick = () => dlg.close();
  LF.addEventListener("submit", async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(LF));
    if (!d.name.trim()) return ($("#lead-err").textContent = "Enter your name.");
    if (!isEmail(d.email.trim())) return ($("#lead-err").textContent = "Enter a valid work email.");
    const s = state.scan, f = (s && s.findings) || [];
    const payload = {
      name: d.name, email: d.email, company: d.company, website: d.website, phone: d.phone, message: d.message,
      marketingConsent: !!LF.marketing.checked, marketingConsentText: MARKETING_TEXT,
      interest: state.leadContext,
      // Only scan statistics go with the lead, never the grievance officer or other details typed into the generator.
      scanSummary: s && !s.sample ? { domain: s.domain, highFindings: f.filter(x => x.level === "high").length, mediumFindings: f.filter(x => x.level === "medium").length,
        cookies: state.cookies.length, trackers: state.hosts.filter(h => h.category === "analytics" || h.category === "marketing").length } : null,
      turnstileToken: tsToken("turnstile-lead")
    };
    $("#lead-send").disabled = true; $("#lead-err").textContent = "";
    try {
      const r = await fetch(API + "/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Couldn't send. Please email us instead.");
      $("#lead-body").hidden = true; $("#lead-done").hidden = false; LF.reset();
    } catch (err) {
      $("#lead-err").textContent = err.message + (SITE.contactEmail ? ` (${SITE.contactEmail})` : "");
    } finally { $("#lead-send").disabled = false; tsReset("turnstile-lead"); }
  });
})();
