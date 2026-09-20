/*! Kensara Consent banner v2.
 *  Layout hooks: set --kc-right / --kc-bottom on #kensara-consent to keep clear of chat widgets.
 *  Demo:  KensaraConsent.init(config, { mode: "demo" })  -> choices stay in this browser, nothing is sent anywhere.
 *  Live:  <script src="https://consent.kensara.in/consent.js" data-site="SITE_ID"></script> (needs the Kensara Pro backend)
 */
(function () {
  "use strict";
  var W = window, D = document;
  if (W.KensaraConsent && W.KensaraConsent.__loaded) return;

  var script = D.currentScript;
  var SITE = script && script.getAttribute("data-site");
  var BASE = script && script.src ? new URL(script.src, location.href).origin : location.origin;

  /* ---------- 1. Google Consent Mode v2: denied until the visitor chooses (set as early as possible) ---------- */
  W.dataLayer = W.dataLayer || [];
  if (typeof W.gtag !== "function") W.gtag = function () { W.dataLayer.push(arguments); };
  W.gtag("consent", "default", {
    ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    analytics_storage: "denied", functionality_storage: "denied", personalization_storage: "denied",
    security_storage: "granted", wait_for_update: 500
  });

  /* ---------- 2. Text. Only languages present here are offered to visitors. ---------- */
  var LANG_NAMES = { en: "English", hi: "हिन्दी" };
  var T = {
    en: {
      title: "Your choices about your data",
      intro: "{org} uses cookies and similar technologies. Necessary ones keep this site working. The optional ones below run only if you choose them:",
      onlyNecessary: "{org} uses only necessary cookies and similar technologies, to keep this site working and secure.",
      free: "You can use this site fully whether you accept or reject, and change your mind any time from “Privacy choices”.",
      accept: "Accept all", reject: "Reject all", manage: "Choose by purpose", save: "Save my choices", ok: "OK",
      notice: "Full privacy notice", rights: "Your rights and complaints", fab: "Privacy choices", close: "Close",
      prefTitle: "Privacy choices", prefSub: "Notice version {v}. Turn each purpose on or off. Withdrawing later is just as easy.",
      tabP: "Purposes", tabR: "Rights and grievances", tabC: "Your record",
      ageQ: "Are you 18 or older?", ageY: "Yes, 18 or older", ageN: "No, under 18",
      ageNeed: "Please answer the age question before switching on optional purposes.",
      ageNote: "For anyone under 18, the law requires verifiable consent from a parent or guardian and bars tracking and targeted advertising. Optional purposes stay off.",
      childLocked: "Not available for users under 18",
      always: "Always on", details: "Details", cName: "Name", cVendor: "Provider", cDur: "Kept for", cPurpose: "Used for",
      dataLbl: "Personal data used", usesLbl: "What it's used for", retention: "Kept for", recipients: "Shared with",
      cookiesLbl: "Cookies", storageLbl: "Other browser storage", none: "None listed.",
      recIntro: "This is the record of your choices kept in this browser.",
      noRec: "No choice recorded yet.", saved: "Your choices are saved", withdrawn: "Consent withdrawn. Reloading so those features stop…",
      c_necessary: "Necessary",
      d_necessary: "Needed to run the site you asked for and keep it secure: sessions, security, carts, and remembering these choices. Not used for analytics or advertising.",
      data_necessary: "Session and security identifiers; your consent choice",
      c_functional: "Functional", d_functional: "Extra features such as live chat, remembering your language, and embedded content.",
      data_functional: "Language setting; chat identifiers; messages you type into chat",
      c_analytics: "Analytics", d_analytics: "Counts visits and page views so we can see what's used and fix what isn't working.",
      data_analytics: "IP address; device and browser details; pages visited; approximate location (city); analytics identifiers",
      c_marketing: "Advertising", d_marketing: "Lets advertising partners show ads based on your visits and measure those ads.",
      data_marketing: "IP address; device and browser details; pages visited; advertising identifiers; ad clicks and views",
      r1: "Under the Digital Personal Data Protection Act, 2023 you can:",
      r2: "get a summary of the personal data held about you and who it was shared with",
      r3: "have inaccurate data corrected or completed, and data erased when it's no longer needed",
      r4: "withdraw consent at any time; processing already done stays lawful",
      r5: "nominate someone to act for you if you die or become unable to",
      r6: "have your grievance answered, and then complain to the Data Protection Board of India",
      rReq: "Make a rights request", rGo: "Grievance officer", rDays: "Response within {d} days", rDpo: "Data Protection Officer",
      rBoard: "Complain to the Data Protection Board of India", demo: "Demo banner by Kensara"
    },
    hi: {
      title: "आपके डेटा से जुड़ी आपकी पसंद",
      intro: "{org} कुकीज़ और इसी तरह की तकनीकों का उपयोग करता है। आवश्यक कुकीज़ साइट को चालू रखती हैं। नीचे दिए गए वैकल्पिक उपयोग तभी चलते हैं जब आप उन्हें चुनें:",
      onlyNecessary: "{org} केवल आवश्यक कुकीज़ और इसी तरह की तकनीकों का उपयोग करता है, ताकि साइट चालू और सुरक्षित रहे।",
      free: "आप स्वीकार करें या अस्वीकार, साइट पूरी तरह उपयोग कर सकते हैं, और “गोपनीयता विकल्प” से कभी भी अपनी पसंद बदल सकते हैं।",
      accept: "सभी स्वीकार करें", reject: "सभी अस्वीकार करें", manage: "उद्देश्य के अनुसार चुनें", save: "मेरी पसंद सहेजें", ok: "ठीक है",
      notice: "पूर्ण गोपनीयता सूचना", rights: "आपके अधिकार और शिकायत", fab: "गोपनीयता विकल्प", close: "बंद करें",
      prefTitle: "गोपनीयता विकल्प", prefSub: "सूचना संस्करण {v}। हर उद्देश्य को चालू या बंद करें। बाद में सहमति वापस लेना भी उतना ही आसान है।",
      tabP: "उद्देश्य", tabR: "अधिकार और शिकायत", tabC: "आपका रिकॉर्ड",
      ageQ: "क्या आपकी आयु 18 वर्ष या उससे अधिक है?", ageY: "हाँ, 18 या अधिक", ageN: "नहीं, 18 से कम",
      ageNeed: "वैकल्पिक उद्देश्य चालू करने से पहले कृपया आयु वाले प्रश्न का उत्तर दें।",
      ageNote: "18 वर्ष से कम आयु वालों के लिए कानून माता-पिता या अभिभावक की सत्यापन योग्य सहमति माँगता है, और ट्रैकिंग व लक्षित विज्ञापन पर रोक लगाता है। वैकल्पिक उद्देश्य बंद रहेंगे।",
      childLocked: "18 वर्ष से कम उपयोगकर्ताओं के लिए उपलब्ध नहीं",
      always: "हमेशा चालू", details: "विवरण", cName: "नाम", cVendor: "प्रदाता", cDur: "अवधि", cPurpose: "उपयोग",
      dataLbl: "उपयोग होने वाला व्यक्तिगत डेटा", usesLbl: "किस काम में उपयोग", retention: "कितने समय तक रखा जाता है", recipients: "किसके साथ साझा",
      cookiesLbl: "कुकीज़", storageLbl: "अन्य ब्राउज़र स्टोरेज", none: "कुछ सूचीबद्ध नहीं।",
      recIntro: "यह इस ब्राउज़र में रखा गया आपकी पसंद का रिकॉर्ड है।",
      noRec: "अभी तक कोई पसंद दर्ज नहीं।", saved: "आपकी पसंद सहेज ली गई", withdrawn: "सहमति वापस ले ली गई। वे सुविधाएँ बंद करने के लिए पेज दोबारा लोड हो रहा है…",
      c_necessary: "आवश्यक",
      d_necessary: "आपकी माँगी साइट चलाने और उसे सुरक्षित रखने के लिए ज़रूरी: सत्र, सुरक्षा, कार्ट, और आपकी पसंद याद रखना। विश्लेषण या विज्ञापन के लिए उपयोग नहीं होतीं।",
      data_necessary: "सत्र और सुरक्षा पहचानकर्ता; आपकी सहमति की पसंद",
      c_functional: "कार्यात्मक", d_functional: "अतिरिक्त सुविधाएँ जैसे लाइव चैट, आपकी भाषा याद रखना और एम्बेड की गई सामग्री।",
      data_functional: "भाषा की सेटिंग; चैट पहचानकर्ता; चैट में आपके लिखे संदेश",
      c_analytics: "विश्लेषण", d_analytics: "विज़िट और पेज व्यू गिनता है ताकि पता चले क्या उपयोग होता है और क्या ठीक करना है।",
      data_analytics: "IP पता; डिवाइस और ब्राउज़र का विवरण; देखे गए पेज; अनुमानित स्थान (शहर); विश्लेषण पहचानकर्ता",
      c_marketing: "विज्ञापन", d_marketing: "विज्ञापन भागीदारों को आपकी विज़िट के आधार पर विज्ञापन दिखाने और उन्हें मापने देता है।",
      data_marketing: "IP पता; डिवाइस और ब्राउज़र का विवरण; देखे गए पेज; विज्ञापन पहचानकर्ता; विज्ञापन पर क्लिक और व्यू",
      r1: "डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 के तहत आप:",
      r2: "अपने व्यक्तिगत डेटा और जिनके साथ वह साझा हुआ, उसका सारांश पा सकते हैं",
      r3: "गलत डेटा सुधरवा या पूरा करवा सकते हैं, और ज़रूरत न रहने पर मिटवा सकते हैं",
      r4: "कभी भी सहमति वापस ले सकते हैं; पहले हुई प्रोसेसिंग वैध रहती है",
      r5: "मृत्यु या असमर्थता की स्थिति में अपनी ओर से किसी को नामित कर सकते हैं",
      r6: "अपनी शिकायत का उत्तर पा सकते हैं, और फिर भारतीय डेटा संरक्षण बोर्ड से शिकायत कर सकते हैं",
      rReq: "अधिकार के लिए अनुरोध करें", rGo: "शिकायत अधिकारी", rDays: "{d} दिनों में उत्तर", rDpo: "डेटा संरक्षण अधिकारी",
      rBoard: "भारतीय डेटा संरक्षण बोर्ड से शिकायत करें", demo: "Kensara का डेमो बैनर"
    }
  };
  var CATS = ["necessary", "functional", "analytics", "marketing"], OPT = CATS.slice(1);

  /* ---------- 3. State ---------- */
  var cfg = null, mode = "demo", lang = "en", age = null, host, root, lastFocus, listeners = [], observer = null;
  var released = typeof WeakSet === "function" ? new WeakSet() : { has: function () { return false; }, add: function () {} };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function safeUrl(u) { try { var x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch (e) { return ""; } }
  function t(k, m) { var s = (T[lang] && T[lang][k]) || T.en[k] || k; return m ? s.replace(/\{(\w+)\}/g, function (_, x) { return m[x] == null ? "" : m[x]; }) : s; }
  function KEY() { return mode === "demo" ? "kensara_demo_consent" : "kensara_consent_" + cfg.siteId; }
  function load() { try { return JSON.parse(localStorage.getItem(KEY())); } catch (e) { return null; } }
  function store(r) { try { localStorage.setItem(KEY(), JSON.stringify(r)); } catch (e) {} }
  function uuid() {
    if (W.crypto && crypto.randomUUID) try { return crypto.randomUUID(); } catch (e) {}
    var a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return (b + 256).toString(16).slice(1); }).join("");
  }
  function enabled(c) { return c === "necessary" || !!(cfg.categories[c] && cfg.categories[c].enabled); }
  function enabledOpt() { return OPT.filter(enabled); }
  function isChild() { return age === "child"; }
  function ageDecl() { return !cfg.ageGate ? "not_asked" : age === "adult" ? "18_or_over" : age === "child" ? "under_18" : "not_declared"; }

  function normalise(c) {
    c = c || {};
    var o = c.org || {}, g = o.grievance || {}, cats = {};
    OPT.forEach(function (k) {
      var x = (c.categories || {})[k] || {};
      cats[k] = { enabled: !!x.enabled, dataItems: String(x.dataItems || "").slice(0, 400), uses: String(x.uses || "").slice(0, 400),
        retention: String(x.retention || "").slice(0, 120), recipients: String(x.recipients || "").slice(0, 300) };
    });
    var langs = (Array.isArray(c.languages) ? c.languages : ["en"]).filter(function (l) { return !!T[l]; });
    if (langs.indexOf("en") < 0) langs.unshift("en");
    var rd = Number(c.reconsentDays);
    return {
      siteId: String(c.siteId || "demo"), noticeVersion: String(c.noticeVersion || "v1"), demo: mode === "demo",
      org: { name: String(o.name || "This website"), noticeUrl: safeUrl(o.noticeUrl || ""), rightsUrl: safeUrl(o.rightsUrl || ""),
        grievance: { name: String(g.name || ""), email: String(g.email || ""), phone: String(g.phone || ""), responseDays: Math.min(90, Math.max(1, +g.responseDays || 30)) },
        dpoEmail: String(o.dpoEmail || ""), boardUrl: safeUrl(o.boardUrl || "") },
      languages: langs, defaultLang: langs.indexOf(c.defaultLang) > -1 ? c.defaultLang : "en",
      categories: cats,
      cookies: (Array.isArray(c.cookies) ? c.cookies : []).slice(0, 400).filter(function (k) { return k && k.name; }),
      storage: (Array.isArray(c.storage) ? c.storage : []).slice(0, 200).filter(function (k) { return k && k.key; }),
      clearAlso: c.clearAlso || { cookies: [], storage: [] },
      theme: { accent: /^#[0-9a-f]{6}$/i.test((c.theme || {}).accent) ? c.theme.accent : "#0E6BA8",
        position: ["bottom", "bottom-left", "center"].indexOf((c.theme || {}).position) > -1 ? c.theme.position : "bottom" },
      ageGate: c.ageGate !== false,
      reconsentDays: isFinite(rd) && rd >= 0 ? Math.min(730, rd) : 365   // 0 = never expires
    };
  }

  function current() {
    var r = load();
    if (!r || r.noticeVersion !== cfg.noticeVersion) return null;
    if (cfg.reconsentDays > 0 && Date.now() - new Date(r.timestamp).getTime() > cfg.reconsentDays * 864e5) return null;
    return r;
  }

  /* ---------- 4. Enforcement ---------- */
  function applyConsentMode(p) {
    var g = function (b) { return b ? "granted" : "denied"; };
    W.gtag("consent", "update", {
      analytics_storage: g(p.analytics), ad_storage: g(p.marketing), ad_user_data: g(p.marketing), ad_personalization: g(p.marketing),
      functionality_storage: g(p.functional), personalization_storage: g(p.functional)
    });
  }
  function allowedFor(el, p) {
    var need = (el.getAttribute("data-consent") || "").split(/[\s,]+/).filter(Boolean);
    return need.length > 0 && need.every(function (c) { return !!p[c]; });
  }
  // Runs tagged scripts in document order: each external script finishes loading before the next one runs.
  function release(p) {
    var list = Array.prototype.filter.call(D.querySelectorAll('script[type="text/plain"][data-consent]'), function (s) {
      return !released.has(s) && allowedFor(s, p);
    });
    list.forEach(function (s) { released.add(s); });
    (function next(i) {
      if (i >= list.length) return;
      var s = list[i], n = D.createElement("script");
      for (var j = 0; j < s.attributes.length; j++) {
        var a = s.attributes[j];
        if (a.name !== "type" && a.name !== "data-consent") n.setAttribute(a.name, a.value);
      }
      if (s.nonce) n.nonce = s.nonce;                       // works with a site's CSP nonce
      if (s.src) {
        if (!s.hasAttribute("async")) n.async = false;
        n.onload = n.onerror = function () { next(i + 1); };
        s.parentNode.insertBefore(n, s.nextSibling);
      } else {
        n.text = s.text;
        s.parentNode.insertBefore(n, s.nextSibling);
        next(i + 1);
      }
    })(0);
    D.querySelectorAll("iframe[data-consent][data-src]").forEach(function (f) {
      if (allowedFor(f, p) && !f.getAttribute("src")) f.setAttribute("src", f.getAttribute("data-src"));
    });
  }
  function matchName(pattern, name) { return pattern.slice(-1) === "*" ? name.indexOf(pattern.slice(0, -1)) === 0 : pattern === name; }
  function clearFor(p) {
    var ck = [], st = [];
    cfg.cookies.forEach(function (c) { if (c.category !== "necessary" && !p[c.category]) ck.push(c.name); });
    cfg.storage.forEach(function (s) { if (s.category !== "necessary" && !p[s.category]) st.push(s.key); });
    OPT.forEach(function (c) {
      if (p[c]) return;
      (cfg.clearAlso.cookies || []).forEach(function (x) { if (x.category === c) ck.push(x.name); });
      (cfg.clearAlso.storage || []).forEach(function (x) { if (x.category === c) st.push(x.key); });
    });
    if (ck.length) {
      var hostParts = location.hostname.split("."), paths = ["/"], segs = location.pathname.split("/").filter(Boolean), acc = "";
      segs.forEach(function (s) { acc += "/" + s; paths.push(acc); });
      D.cookie.split(";").forEach(function (kv) {
        var name = kv.split("=")[0].trim();
        if (!ck.some(function (pat) { return matchName(pat, name); })) return;
        paths.forEach(function (path) {
          D.cookie = name + "=; Max-Age=0; path=" + path;
          for (var i = 0; i < hostParts.length - 1; i++) D.cookie = name + "=; Max-Age=0; path=" + path + "; domain=." + hostParts.slice(i).join(".");
        });
      });
    }
    if (st.length) [W.localStorage, W.sessionStorage].forEach(function (area) {
      try {
        for (var i = area.length - 1; i >= 0; i--) {
          var k = area.key(i);
          if (k && k.indexOf("kensara_") !== 0 && st.some(function (pat) { return matchName(pat, k); })) area.removeItem(k);
        }
      } catch (e) {}
    });
  }
  function whenReady(fn) { if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", fn); else fn(); }
  function watch() {
    if (observer || !W.MutationObserver) return;
    var queued = false;
    observer = new MutationObserver(function () {
      if (queued) return; queued = true;
      setTimeout(function () { queued = false; var r = current(); if (r) release(r.purposes); }, 0);
    });
    observer.observe(D.documentElement, { childList: true, subtree: true });
  }
  function enforce(r, fromUser, withdrawnList) {
    applyConsentMode(r.purposes);
    clearFor(r.purposes);
    W.kensaraConsent = r;
    listeners.forEach(function (fn) { try { fn(r); } catch (e) {} });
    try { D.dispatchEvent(new CustomEvent("kensara:consent", { detail: r })); } catch (e) {}
    if (fromUser && withdrawnList.length) {                // running scripts can't be un-run: reload so they stop
      toast(t("withdrawn"));
      setTimeout(function () { location.reload(); }, 900);
      return;
    }
    whenReady(function () { release(r.purposes); watch(); });
  }

  /* ---------- 5. Save ---------- */
  function save(action, choices) {
    var prev = current(), p = { necessary: true }, withdrawnList = [];
    OPT.forEach(function (c) { p[c] = !!choices[c] && enabled(c) && !isChild(); });
    if (prev && prev.purposes) OPT.forEach(function (c) { if (prev.purposes[c] && !p[c]) withdrawnList.push(c); });
    var now = new Date().toISOString();
    var r = {
      consentId: prev && prev.consentId ? prev.consentId : uuid(),
      dataFiduciary: cfg.org.name, siteId: cfg.siteId, noticeVersion: cfg.noticeVersion,
      timestamp: now, language: lang, action: withdrawnList.length && action !== "accept_all" ? "withdraw" : action,
      withdrawn: withdrawnList, method: "clear affirmative action (button)", ageDeclaration: ageDecl(),
      purposes: p,
      history: ((prev && prev.history) || []).concat([{ at: now, action: action, purposes: p }]).slice(-20)
    };
    store(r);
    if (mode === "live") {
      var body = JSON.stringify(r), url = BASE + "/api/consent/" + encodeURIComponent(cfg.siteId);
      try {
        var sent = navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }));
        if (!sent) fetch(url, { method: "POST", body: body, keepalive: true, mode: "no-cors" });
      } catch (e) {}
    }
    hideBanner(); closeModal(true); toast(t("saved"));
    enforce(r, true, withdrawnList);
  }

  /* ---------- 6. UI ---------- */
  var CSS = ":host{all:initial}*{box-sizing:border-box}" +
    ".k{--a:#0E6BA8;--ai:#fff;--ink:#1B2440;--soft:#4A5470;--bg:#fff;--sf:#F2F4F8;--ln:#D5DAE3;--ok:#1F7A4D;--wr:#9A5B00;--er:#B3261E;" +
    "font:15px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans','Noto Sans Devanagari',sans-serif;color:var(--ink)}" +
    "@media (prefers-color-scheme:dark){.k{--ink:#E6EAF3;--soft:#A9B2C7;--bg:#161C2E;--sf:#1F2740;--ln:#313B58;--ok:#5BC98C;--wr:#E3A64A;--er:#F2877E}}" +
    "a{color:var(--a)}button,select,input{font:inherit}:focus-visible{outline:3px solid #F2A900;outline-offset:2px}" +
    ".bn{position:fixed;z-index:2147483646;background:var(--bg);color:var(--ink);border:1px solid var(--ln);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.25);padding:16px 20px;display:none;max-height:calc(100vh - var(--kc-bottom,16px) - 16px);overflow-y:auto;overscroll-behavior:contain}" +
    ".bn.bottom{left:16px;right:var(--kc-right,16px);bottom:var(--kc-bottom,16px);max-width:980px;margin:0 auto}.bn.bottom-left{left:16px;bottom:var(--kc-bottom,16px);max-width:440px}" +
    ".bn.center{left:50%;top:50%;transform:translate(-50%,-50%);width:min(580px,calc(100vw - 32px))}" +
    ".bn.on{display:block}.bn h2{font-size:17px;margin:0 0 6px;font-weight:650}.bn p{margin:0 0 6px;color:var(--soft);font-size:14px}" +
    ".pl{margin:2px 0 8px;padding-left:18px;font-size:13.5px;color:var(--soft)}.pl li{margin:2px 0}.pl b{color:var(--ink)}" +
    ".bpl{margin:6px 0 8px}.bp{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:9px 0;border-top:1px solid var(--ln)}.bp:first-child{border-top:0}" +
    ".bpi{min-width:0}.bpi b{font-size:14px;color:var(--ink)}.bpi span{display:block;font-size:12.5px;color:var(--soft);margin-top:1px}.bpi .lo{display:block;font-size:12px;color:var(--wr);margin-top:2px;font-style:normal}" +
    ".row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}" +
    ".acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;position:sticky;bottom:-16px;background:var(--bg);padding:8px 0 4px;margin-bottom:-4px}" +
    ".b{border-radius:9px;padding:10px 16px;font-weight:600;cursor:pointer;border:2px solid var(--a);min-width:140px;font-size:14px}" +
    ".p{background:var(--a);color:var(--ai)}.s{background:transparent;color:var(--a)}" +
    ".lk{font-size:13px;margin-top:8px}.lk a{margin-right:14px}" +
    ".dm{font-size:11px;color:var(--soft);margin-top:6px;letter-spacing:.02em}" +
    ".er{color:var(--er);font-size:13px;margin:4px 0 0;min-height:0}" +
    "select{border:1px solid var(--ln);background:var(--bg);color:var(--ink);border-radius:8px;padding:5px 8px;font-size:13px}" +
    ".ov{position:fixed;inset:0;z-index:2147483647;background:rgba(10,14,28,.55);display:none;align-items:center;justify-content:center;padding:12px}.ov.on{display:flex}" +
    ".md{background:var(--bg);color:var(--ink);border-radius:14px;width:100%;max-width:720px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.35)}" +
    ".hd{padding:18px 20px 10px;border-bottom:1px solid var(--ln)}.hd h2{margin:0;font-size:19px}.hd p{margin:4px 0 0;font-size:13px;color:var(--soft)}" +
    ".x{background:none;border:0;font-size:24px;line-height:1;cursor:pointer;color:var(--ink);padding:2px 8px;border-radius:6px}" +
    ".bd{padding:4px 20px 14px;overflow-y:auto}.ft{padding:12px 20px;border-top:1px solid var(--ln);display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}" +
    ".tabs{display:flex;gap:2px;border-bottom:1px solid var(--ln);margin:6px 0 10px;overflow-x:auto}" +
    ".tb{background:none;border:0;border-bottom:3px solid transparent;padding:9px 11px;color:var(--soft);cursor:pointer;white-space:nowrap;font-size:14px}.tb[aria-selected=true]{color:var(--ink);border-bottom-color:var(--a);font-weight:600}" +
    ".age{background:var(--sf);border-radius:10px;padding:8px 12px;margin:6px 0;font-size:14px;border:0}.age legend{font-weight:600;padding:0;margin-bottom:2px;float:left;width:100%}.age label{margin-right:16px;cursor:pointer;white-space:nowrap}.age .n{color:var(--wr);margin:6px 0 0;font-size:13px}" +
    ".pu{border:1px solid var(--ln);border-radius:10px;margin:8px 0}.pr{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px}" +
    ".pu h3{margin:0;font-size:15px}.pu .d{margin:2px 0 0;font-size:13px;color:var(--soft)}.al{font-size:12px;font-weight:600;color:var(--ok);white-space:nowrap}.lo{font-size:12px;color:var(--wr);margin-top:3px}" +
    "details{border-top:1px solid var(--ln);padding:0 14px;font-size:13px}summary{cursor:pointer;padding:8px 0;color:var(--a)}details p{margin:4px 0}" +
    ".tw{overflow-x:auto;margin-bottom:10px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:5px 6px;border-bottom:1px solid var(--ln);vertical-align:top}th{color:var(--soft);font-weight:600}" +
    ".sw{position:relative;width:48px;height:27px;flex:none}.sw input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer;z-index:1;width:100%;height:100%}" +
    ".sw span{position:absolute;inset:0;background:var(--ln);border-radius:99px;transition:background .15s}.sw span:after{content:'';position:absolute;top:3px;left:3px;width:21px;height:21px;border-radius:50%;background:#fff;transition:transform .15s;box-shadow:0 1px 3px rgba(0,0,0,.3)}" +
    ".sw input:checked+span{background:var(--a)}.sw input:checked+span:after{transform:translateX(21px)}.sw input:focus-visible+span{outline:3px solid #F2A900;outline-offset:2px}.sw input:disabled+span{opacity:.4}" +
    ".rt ul{padding-left:18px}.rt li,.rt p{font-size:14px}pre{background:var(--sf);border-radius:8px;padding:10px;font-size:12px;white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto}" +
    ".fab{position:fixed;left:14px;bottom:var(--kc-bottom,14px);z-index:2147483645;background:var(--bg);color:var(--ink);border:1px solid var(--ln);border-radius:99px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.18);display:none;align-items:center;gap:6px}.fab.on{display:inline-flex}" +
    ".fab svg{width:15px;height:15px}.to{position:fixed;right:var(--kc-right,14px);bottom:var(--kc-bottom,14px);z-index:2147483647;background:var(--ink);color:var(--bg);padding:9px 14px;border-radius:9px;font-size:14px;display:none;max-width:320px}.to.on{display:block}" +
    ".sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}" +
    "@media (max-width:600px){.bn.bottom,.bn.bottom-left{left:8px;right:var(--kc-right,8px);bottom:var(--kc-bottom,8px);max-width:none;max-height:calc(100vh - var(--kc-bottom,8px) - 8px);padding:14px}.pl{font-size:13px}.b{flex:1 1 40%;min-width:0;padding:10px 8px}.acts{bottom:-14px}.row{flex-direction:column}}" +
    "@media (prefers-reduced-motion:reduce){*{transition:none!important}}";

  function langSelect(id) {
    if (cfg.languages.length < 2) return "";
    return '<label><span class="sr">Language</span><select data-lang id="' + id + '">' + cfg.languages.map(function (l) {
      return '<option value="' + l + '"' + (l === lang ? " selected" : "") + ">" + esc(LANG_NAMES[l] || l) + "</option>";
    }).join("") + "</select></label>";
  }
  function ageFieldset(nm) {
    if (!cfg.ageGate) return "";
    return '<fieldset class="age"><legend>' + t("ageQ") + '</legend>' +
      '<label><input type="radio" name="' + nm + '" value="adult"' + (age === "adult" ? " checked" : "") + "> " + t("ageY") + "</label>" +
      '<label><input type="radio" name="' + nm + '" value="child"' + (age === "child" ? " checked" : "") + "> " + t("ageN") + "</label>" +
      '<p class="n" data-agenote' + (isChild() ? "" : " hidden") + ">" + t("ageNote") + "</p></fieldset>";
  }
  function dataItemsFor(c) { return (cfg.categories[c] && cfg.categories[c].dataItems) || t("data_" + c); }
  function usesFor(c) { return (cfg.categories[c] && cfg.categories[c].uses) || t("d_" + c); }
  // A single optional purpose shown as a toggle directly on the first banner view.
  function bannerToggle(c) {
    var locked = isChild(), r = current();
    var on = !!(r && r.purposes[c]); if (locked) on = false;
    return '<div class="bp"><div class="bpi"><b>' + t("c_" + c) + "</b><span>" + esc(dataItemsFor(c)) + "</span>" +
      (locked ? '<em class="lo">' + t("childLocked") + "</em>" : "") + "</div>" +
      '<label class="sw"><input type="checkbox" role="switch" data-c="' + c + '"' + (on ? " checked" : "") + (locked ? " disabled" : "") + ' aria-label="' + esc(t("c_" + c)) + '"><span></span></label></div>';
  }
  function syncBannerLock() {
    var locked = isChild();
    root.querySelectorAll("[data-bpurposes] input[data-c]").forEach(function (i) { i.disabled = locked; if (locked) i.checked = false; });
  }

  function build() {
    if (host) host.remove();
    host = D.createElement("div"); host.id = "kensara-consent";
    root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    D.body.insertBefore(host, D.body.firstChild);          // first in tab order for keyboard users
    render();
  }

  function render() {
    var o = cfg.org, pos = cfg.theme.position, opts = enabledOpt();
    var noticeLink = o.noticeUrl ? '<a href="' + esc(o.noticeUrl) + '" target="_blank" rel="noopener">' + t("notice") + "</a>" : "";
    var purposeList = opts.length ? '<div class="bpl" data-bpurposes>' + opts.map(bannerToggle).join("") + "</div>" : "";
    var acts = opts.length
      ? '<button class="b p" data-act="accept">' + t("accept") + '</button><button class="b s" data-act="reject">' + t("reject") + '</button><button class="b p" data-act="save">' + t("save") + "</button>"
      : '<button class="b p" data-act="reject">' + t("ok") + "</button>";
    root.innerHTML = "<style>" + CSS + "</style>" +
      '<div class="k" style="--a:' + esc(cfg.theme.accent) + '" lang="' + lang + '">' +
      '<div class="bn ' + pos + '" role="region" aria-labelledby="kb-t" aria-describedby="kb-d">' +
        '<div class="row"><div><h2 id="kb-t">' + t("title") + '</h2><p id="kb-d">' + esc(t(opts.length ? "intro" : "onlyNecessary", { org: o.name })) + "</p>" + purposeList +
        (opts.length ? ageFieldset("kage1") : "") + '<p style="font-size:13px">' + t("free") + "</p></div>" + langSelect("kl1") + "</div>" +
        '<p class="er" role="alert" data-err1></p>' +
        '<div class="acts">' + acts + "</div>" +
        '<div class="lk">' + noticeLink + (opts.length ? '<a href="#" data-act="manage">' + t("manage") + "</a>" : "") + '<a href="#" data-act="rights">' + t("rights") + "</a></div>" +
        (cfg.demo ? '<div class="dm">' + t("demo") + "</div>" : "") +
      "</div>" +
      '<div class="ov"><div class="md" role="dialog" aria-modal="true" aria-labelledby="km-t">' +
        '<div class="hd"><div class="row"><div><h2 id="km-t">' + t("prefTitle") + "</h2><p>" + esc(t("prefSub", { v: cfg.noticeVersion })) + '</p></div><div style="display:flex;gap:6px;align-items:center">' + langSelect("kl2") + '<button class="x" data-act="close" aria-label="' + t("close") + '">×</button></div></div></div>' +
        '<div class="bd"><div class="tabs" role="tablist">' +
          '<button class="tb" role="tab" data-tab="p" aria-selected="true">' + t("tabP") + '</button><button class="tb" role="tab" data-tab="r" aria-selected="false">' + t("tabR") + '</button><button class="tb" role="tab" data-tab="c" aria-selected="false">' + t("tabC") + "</button></div>" +
          '<div data-pane="p">' + (opts.length ? ageFieldset("kage2") : "") + '<div data-purposes></div></div>' +
          '<div data-pane="r" class="rt" hidden>' + rightsHtml() + "</div>" +
          '<div data-pane="c" hidden><p style="font-size:14px">' + t("recIntro") + "</p><pre data-rec></pre></div>" +
        "</div>" +
        '<p class="er" role="alert" data-err2 style="padding:0 20px"></p>' +
        '<div class="ft">' + (opts.length ? '<button class="b p" data-act="reject">' + t("reject") + '</button><button class="b p" data-act="accept">' + t("accept") + '</button><button class="b s" data-act="save">' + t("save") + "</button>" : '<button class="b p" data-act="reject">' + t("ok") + "</button>") + "</div>" +
      "</div></div>" +
      '<button class="fab" data-act="open" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></svg>' + t("fab") + "</button>" +
      '<div class="to" role="status" aria-live="polite"></div></div>';
    wire();
    renderPurposes();
  }

  function rightsHtml() {
    var o = cfg.org, g = o.grievance;
    return "<p>" + t("r1") + "</p><ul><li>" + t("r2") + "</li><li>" + t("r3") + "</li><li>" + t("r4") + "</li><li>" + t("r5") + "</li><li>" + t("r6") + "</li></ul>" +
      (o.rightsUrl ? '<p><a href="' + esc(o.rightsUrl) + '" target="_blank" rel="noopener">' + t("rReq") + "</a></p>" : "") +
      "<p><strong>" + t("rGo") + (g.name ? ": " + esc(g.name) : "") + "</strong><br>" +
      (g.email ? '<a href="mailto:' + encodeURIComponent(g.email).replace(/%40/g, "@") + '">' + esc(g.email) + "</a>" : "") + (g.phone ? " · " + esc(g.phone) : "") +
      "<br>" + esc(t("rDays", { d: g.responseDays })) + "</p>" +
      (o.dpoEmail ? "<p>" + t("rDpo") + ': <a href="mailto:' + encodeURIComponent(o.dpoEmail).replace(/%40/g, "@") + '">' + esc(o.dpoEmail) + "</a></p>" : "") +
      "<p>" + (o.boardUrl ? '<a href="' + esc(o.boardUrl) + '" target="_blank" rel="noopener">' + t("rBoard") + "</a>" : t("rBoard")) + "</p>";
  }

  function renderPurposes() {
    var wrap = q("[data-purposes]"), r = current(), prev = {};
    wrap.querySelectorAll("input[data-c]").forEach(function (i) { prev[i.getAttribute("data-c")] = i.checked; });
    wrap.innerHTML = CATS.filter(enabled).map(function (c) {
      var meta = cfg.categories[c] || {}, locked = c !== "necessary" && isChild();
      var on = c in prev ? prev[c] : !!(r && r.purposes[c]); if (locked) on = false;
      var cookies = cfg.cookies.filter(function (k) { return k.category === c; });
      var storage = cfg.storage.filter(function (k) { return k.category === c; });
      var table = cookies.length ? '<div class="tw"><table><tr><th>' + t("cName") + "</th><th>" + t("cVendor") + "</th><th>" + t("cDur") + "</th><th>" + t("cPurpose") + "</th></tr>" +
        cookies.map(function (k) { return "<tr><td>" + esc(k.name) + "</td><td>" + esc(k.vendor) + "</td><td>" + esc(k.duration) + "</td><td>" + esc(k.purpose) + "</td></tr>"; }).join("") + "</table></div>" : "<p>" + t("none") + "</p>";
      var st = storage.length ? "<p><b>" + t("storageLbl") + ":</b> " + storage.map(function (s) { return esc(s.key); }).join(", ") + "</p>" : "";
      var extra = "<p><b>" + t("dataLbl") + ":</b> " + esc(dataItemsFor(c)) + "</p>" +
        (meta.retention ? "<p><b>" + t("retention") + ":</b> " + esc(meta.retention) + "</p>" : "") +
        (meta.recipients ? "<p><b>" + t("recipients") + ":</b> " + esc(meta.recipients) + "</p>" : "") +
        "<p><b>" + t("cookiesLbl") + ":</b></p>" + table + st;
      return '<div class="pu"><div class="pr"><div><h3 id="kc-' + c + '">' + t("c_" + c) + '</h3><p class="d">' + esc(usesFor(c)) + "</p>" + (locked ? '<div class="lo">' + t("childLocked") + "</div>" : "") + "</div>" +
        (c === "necessary" ? '<span class="al">' + t("always") + "</span>" :
          '<label class="sw"><input type="checkbox" role="switch" data-c="' + c + '" aria-labelledby="kc-' + c + '"' + (on ? " checked" : "") + (locked ? " disabled" : "") + "><span></span></label>") +
        "</div><details><summary>" + t("details") + "</summary>" + extra + "</details></div>";
    }).join("");
    root.querySelectorAll("[data-agenote]").forEach(function (n) { n.hidden = !isChild(); });
    var rec = load(); q("[data-rec]").textContent = rec ? JSON.stringify(rec, null, 2) : t("noRec");
  }

  function q(s) { return root.querySelector(s); }
  function all(v) { var o = {}; CATS.forEach(function (c) { o[c] = v; }); return o; }
  function toggles(sel) { var o = {}; root.querySelectorAll((sel || "[data-purposes]") + " input[data-c]").forEach(function (i) { o[i.getAttribute("data-c")] = i.checked; }); return o; }
  function anyOn(o) { return OPT.some(function (c) { return o[c]; }); }
  function showBanner() { q(".bn").classList.add("on"); q(".fab").classList.remove("on"); }
  function hideBanner() { q(".bn").classList.remove("on"); q(".fab").classList.add("on"); }
  function tab(name) {
    root.querySelectorAll("[data-tab]").forEach(function (b) { b.setAttribute("aria-selected", b.getAttribute("data-tab") === name ? "true" : "false"); });
    root.querySelectorAll("[data-pane]").forEach(function (p) { p.hidden = p.getAttribute("data-pane") !== name; });
  }
  function openModal(which) { lastFocus = D.activeElement; renderPurposes(); tab(which || "p"); q(".ov").classList.add("on"); q(".x").focus(); }
  function closeModal(decided) {
    q(".ov").classList.remove("on");
    if (!decided && !current()) showBanner();           // closing is not consent
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }
  function toast(m) { var e = q(".to"); if (!e) return; e.textContent = m; e.classList.add("on"); setTimeout(function () { e.classList.remove("on"); }, 2600); }
  function ageError(inModal) {
    var e = q(inModal ? "[data-err2]" : "[data-err1]"); e.textContent = t("ageNeed");
    var first = q('input[name="' + (inModal ? "kage2" : "kage1") + '"]'); if (first) first.focus();
  }
  function clearErrors() { root.querySelectorAll(".er").forEach(function (e) { e.textContent = ""; }); }

  function wire() {
    root.querySelectorAll("[data-act]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        var a = el.getAttribute("data-act"), inModal = !!el.closest(".md");
        clearErrors();
        if (a === "accept") { if (cfg.ageGate && !age && enabledOpt().length) return ageError(inModal); save("accept_all", all(true)); }
        else if (a === "reject") save("reject_all", all(false));
        else if (a === "save") { var inB = !inModal, tg = toggles(inB ? "[data-bpurposes]" : "[data-purposes]"); if (cfg.ageGate && !age && anyOn(tg)) return ageError(!inB); save("custom", tg); }
        else if (a === "manage" || a === "open") openModal("p");
        else if (a === "rights") { e.preventDefault(); openModal("r"); }
        else if (a === "close") closeModal(false);
      });
    });
    root.querySelectorAll("[data-tab]").forEach(function (b) { b.addEventListener("click", function () { tab(b.getAttribute("data-tab")); }); });
    root.querySelectorAll("[data-lang]").forEach(function (s) {
      s.addEventListener("change", function () {
        var wasOpen = q(".ov").classList.contains("on"), bannerOn = q(".bn").classList.contains("on");
        lang = s.value; render();
        if (bannerOn) showBanner(); else q(".fab").classList.add("on");
        if (wasOpen) openModal("p");
      });
    });
    root.querySelectorAll('input[name="kage1"],input[name="kage2"]').forEach(function (r) {
      r.addEventListener("change", function () {
        age = r.value; clearErrors();
        root.querySelectorAll('input[name="kage1"],input[name="kage2"]').forEach(function (x) { x.checked = x.value === age; });
        renderPurposes(); syncBannerLock();
      });
    });
    q(".ov").addEventListener("keydown", function (e) {
      if (e.key === "Escape") return closeModal(false);
      if (e.key !== "Tab") return;
      var f = Array.prototype.filter.call(root.querySelectorAll(".md button,.md select,.md input:not([disabled]),.md a[href],.md summary"), function (x) { return x.offsetParent !== null; });
      var act = root.activeElement;
      if (e.shiftKey && act === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && act === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
  }

  /* ---------- 7. Boot ---------- */
  function init(config, options) {
    mode = options && options.mode === "live" ? "live" : "demo";
    cfg = normalise(config);
    var r = current();
    age = r ? (r.ageDeclaration === "18_or_over" ? "adult" : r.ageDeclaration === "under_18" ? "child" : null) : null;
    var nav = (navigator.language || "en").slice(0, 2);
    lang = r && T[r.language] && cfg.languages.indexOf(r.language) > -1 ? r.language : cfg.languages.indexOf(nav) > -1 ? nav : cfg.defaultLang;
    if (r) { applyConsentMode(r.purposes); clearFor(r.purposes); }  // before any tag gets a chance to fire
    var go = function () { build(); if (r) { hideBanner(); enforce(r, false, []); } else showBanner(); };
    if (D.body) go(); else D.addEventListener("DOMContentLoaded", go);
  }

  W.KensaraConsent = {
    __loaded: true,
    init: init,
    open: function () { if (root) openModal("p"); },
    get: function () { return cfg ? current() : null; },
    withdraw: function () { if (cfg) save("withdraw", all(false)); },
    onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); },
    defaults: function (l) { var src = T[l] || T.en, out = {}; CATS.forEach(function (c) { out[c] = { uses: src["d_" + c], dataItems: src["data_" + c] }; }); return out; },
    languages: function () { return Object.keys(T); }
  };

  if (SITE) {
    fetch(BASE + "/api/embed/" + encodeURIComponent(SITE))
      .then(function (r) { if (!r.ok) throw new Error("Kensara Consent: this banner isn't active."); return r.json(); })
      .then(function (c) { init(c, { mode: "live" }); })
      .catch(function (e) { if (W.console) console.warn(e.message); });
  }
})();
