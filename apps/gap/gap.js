(function () {
  "use strict";
  const SITE = window.KENSARA_SITE || {};
  const API = String(SITE.scannerBase || "").replace(/\/$/, "");
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const REGION_FLAG = { US: "🇺🇸", EU: "🇪🇺", IN: "🇮🇳", Global: "🌐" };
  const DEADLINE = new Date("2027-05-13T00:00:00Z");

  /* ---------- inline icons (24 viewBox, stroke) ---------- */
  const P = { fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" };
  const svg = d => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON = {
    shieldCheck: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
    shieldAlert: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 8v4"/><path d="M12 16h.01"/>'),
    shieldQ: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M10 10a2 2 0 113 1.7c-.6.4-1 .8-1 1.3"/><path d="M12 16h.01"/>'),
    database: svg('<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
    cookie: svg('<path d="M12 3a9 9 0 109 9 3 3 0 01-3-3 3 3 0 01-3-3 3 3 0 01-3-3z"/><circle cx="9" cy="10" r="1"/><circle cx="13" cy="14" r="1"/><circle cx="15" cy="9" r="1"/>'),
    globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 010 18 14 14 0 010-18z"/>'),
    file: svg('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>'),
    server: svg('<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 8h.01M7 17h.01"/>'),
    fingerprint: svg('<path d="M12 11a2 2 0 012 2c0 3-1 5-1 5"/><path d="M8 11a4 4 0 018 0c0 4-1 6-1 6"/><path d="M5 12a7 7 0 0114 0v1"/>'),
    gavel: svg('<path d="M14 13l-4 4"/><path d="M9 8l7 7"/><path d="M12 5l7 7"/><path d="M3 21h8"/>'),
    scale: svg('<path d="M12 3v18"/><path d="M6 8h12"/><path d="M6 8l-3 6a3 3 0 006 0z"/><path d="M18 8l3 6a3 3 0 01-6 0z"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    check: svg('<path d="M20 6L9 17l-5-5"/>'),
    x: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    lock: svg('<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
    bolt: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
    eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'),
  };

  /* ---------- penalty model (ported from the gap tool) ---------- */
  const PENALTY_HEADS = [
    { key: "security", section: "Section 8(5)", title: "Reasonable security safeguards", obligations: "Protect personal data against breach", maxCr: 250 },
    { key: "breach", section: "Section 8(6)", title: "Personal data breach notification", obligations: "Notify the Board and affected users of a breach", maxCr: 200 },
    { key: "children", section: "Section 9", title: "Obligations regarding children's data", obligations: "Verifiable parental consent; no harmful or targeted processing of minors", maxCr: 200 },
    { key: "sdf", section: "Section 10", title: "Significant Data Fiduciary duties", obligations: "Appoint a DPO, run annual DPIAs and independent audits", maxCr: 150 },
    { key: "general", section: "Schedule (residual)", title: "Any other provision of the Act or Rules", obligations: "Consent, notice, rights, retention, transfers and processor governance", maxCr: 50 },
  ];
  const GENERAL_CATEGORIES = [["consent", "consent"], ["notice", "privacy notice"], ["rights", "rights"], ["crossBorder", "cross-border transfers"], ["vendorGovernance", "processor governance"], ["retention", "data retention"]];
  const AT_RISK = 65;
  const formatCr = cr => `₹${Number(cr).toLocaleString("en-IN")} Cr`;
  function practicalCr(cap, drivingScore, scale) {
    const severity = Math.max(0, Math.min(1, (AT_RISK - drivingScore) / AT_RISK));
    const boost = scale === "gt10L" ? 1.15 : scale === "1Lto10L" ? 1.0 : scale === "10kto1L" ? 0.85 : 0.72;
    const factor = Math.max(0.03, Math.min(0.4, severity * 0.35 * boost));
    return Math.max(1, Math.round(cap * factor));
  }
  function computePenalty(scoreByKey, opts) {
    const s = k => scoreByKey[k] ?? 100;
    const lines = PENALTY_HEADS.map(h => {
      let applicable = true, atRisk = false, driver = "", drivingScore = 100;
      if (h.key === "security") { drivingScore = s("security"); atRisk = drivingScore < AT_RISK; driver = atRisk ? "Security safeguards are incomplete" : "Safeguards appear reasonable"; }
      else if (h.key === "breach") { drivingScore = s("breach"); atRisk = drivingScore < AT_RISK; driver = atRisk ? "No breach-response readiness detected" : "Breach response appears documented"; }
      else if (h.key === "children") { applicable = opts.childrenApplicable; drivingScore = s("children"); atRisk = applicable && drivingScore < AT_RISK; driver = !applicable ? "You don't appear to process children's data" : atRisk ? "No verifiable parental consent" : "Children's-data controls appear in place"; }
      else if (h.key === "sdf") { applicable = opts.sdfApplicable; drivingScore = s("governance"); atRisk = applicable && drivingScore < AT_RISK; driver = !applicable ? "SDF notification unlikely at your scale" : atRisk ? "DPO, DPIA and audit duties unmet" : "SDF duties appear addressed"; }
      else { const failing = GENERAL_CATEGORIES.filter(c => s(c[0]) < AT_RISK).sort((a, b) => s(a[0]) - s(b[0])); atRisk = failing.length > 0; drivingScore = failing.length ? s(failing[0][0]) : 100; driver = atRisk ? `${failing.length} obligation${failing.length > 1 ? "s" : ""} unmet (${failing.slice(0, 3).map(c => c[1]).join(", ")})` : "Core obligations appear met"; }
      const likelyCr = applicable && atRisk ? practicalCr(h.maxCr, drivingScore, opts.scale) : 0;
      return { key: h.key, section: h.section, title: h.title, obligations: h.obligations, maxCr: h.maxCr, maxLabel: formatCr(h.maxCr), likelyCr, likelyLabel: formatCr(likelyCr), applicable, atRisk, driver };
    });
    const risk = lines.filter(l => l.applicable && l.atRisk);
    return { lines, practicalMaxCr: risk.reduce((a, l) => a + l.likelyCr, 0), practicalLabel: formatCr(risk.reduce((a, l) => a + l.likelyCr, 0)), capCr: risk.reduce((a, l) => a + l.maxCr, 0), capLabel: formatCr(risk.reduce((a, l) => a + l.maxCr, 0)), atRiskCount: risk.length,
      note: "The likely exposure is a practical estimate: the Data Protection Board fixes penalties under Section 33, weighing gravity, duration, repetitiveness, gains and mitigation, and early-enforcement fines sit well below the statutory cap. The cap is the maximum the DPDPA 2023 Schedule permits. Penalties apply per contravention and can be cumulative." };
  }

  /* ---------- bands ---------- */
  const bandForScore = x => x < 40 ? "Critical" : x < 60 ? "High Risk" : x < 80 ? "Developing" : "Strong";
  const BAND = {
    Critical: { c: "#f87171", blurb: "Major DPDP gaps across core obligations. High enforcement exposure." },
    "High Risk": { c: "#fb923c", blurb: "Several obligations unmet. Meaningful exposure before May 2027." },
    Developing: { c: "#fbbf24", blurb: "Foundations in place, but key gaps remain to be closed." },
    Strong: { c: "#34d399", blurb: "Largely aligned. Targeted refinements will complete readiness." },
  };
  const catStatus = x => x >= 70 ? "pass" : x >= 45 ? "warn" : "fail";
  const clamp = x => Math.max(0, Math.min(100, Math.round(x)));

  /* ---------- derive the report model from a deep-scan result ---------- */
  const SERVICE = {
    consent: { title: "Trackers fire before consent", ceiling: "₹250 Cr head", service: "Kensara Consent + CMP", blurb: "A DPDP-ready banner that blocks every non-essential tracker until the visitor agrees, with a tamper-evident consent record against the exact notice shown." },
    notice: { title: "Privacy notice is incomplete", ceiling: "₹50 Cr head", service: "DPDP Notice & Policy drafting", blurb: "A lawyer-reviewed, itemised notice covering all nine DPDP disclosures, in plain language and every scheduled language you need." },
    security: { title: "Security safeguards are incomplete", ceiling: "₹250 Cr head", service: "Security hardening review", blurb: "We close the missing transport, header and cookie controls and document reasonable safeguards to the Section 8(5) standard." },
    crossBorder: { title: "Undisclosed cross-border transfers", ceiling: "₹50 Cr head", service: "Data-flow mapping & transfer notices", blurb: "We map every destination, disclose transfers correctly and put processor terms in place for each overseas service." },
    children: { title: "Children's data without parental consent", ceiling: "₹200 Cr head", service: "Age-gating & verifiable parental consent", blurb: "Age assurance plus a verifiable parental-consent flow, so processing of minors meets Section 9." },
    rights: { title: "No data-principal rights mechanism", ceiling: "₹50 Cr head", service: "Rights & grievance workflow", blurb: "A working access/correction/erasure/nomination workflow and a named grievance officer with SLAs." },
    governance: { title: "Governance & DPO duties unmet", ceiling: "₹150 Cr head", service: "DPO-as-a-service & DPIA", blurb: "A named DPO, annual DPIAs and independent audits, the Significant Data Fiduciary duties under Section 10." },
    vendorGovernance: { title: "Processors without contracts", ceiling: "₹50 Cr head", service: "Processor governance", blurb: "Data-processing agreements and due-diligence for every third party that touches personal data." },
    retention: { title: "No retention or erasure policy", ceiling: "₹50 Cr head", service: "Retention & erasure policy", blurb: "Purpose-bound retention schedules and automated erasure once data is no longer needed." },
  };

  function deriveCategories(d) {
    const cov = d.notice && d.notice.total ? d.notice.covered / d.notice.total : 0;
    const secOk = (d.security || []).filter(s => s.ok).length, secTot = (d.security || []).length || 1;
    const v = (d.consent || {}).verdict;
    const consent = v === "ok" ? 82 : v === "pre-ticked" ? 58 : v === "no-reject-option" ? 52 : v === "no-banner" ? ((d.summary && d.summary.trackers) ? 28 : 70) : v === "ignores-reject" ? 18 : v === "tracks-before-consent" ? 20 : ((d.summary && (d.summary.trackers || d.summary.preConsentCookies)) ? 35 : 68);
    const noticeCov = d.notice && d.notice.disclosures ? d.notice.disclosures : [];
    const has = k => noticeCov.some(x => x.key === k && x.covered);
    const cats = [
      { key: "consent", label: "Consent management", score: consent, finding: v === "tracks-before-consent" ? "Trackers fire before the visitor makes any choice." : v === "ok" ? "Banner blocks trackers until consent." : (d.summary && d.summary.trackers) ? "Non-essential services run before consent." : "No pre-consent tracking detected." },
      { key: "notice", label: "Privacy notice", score: clamp(cov * 100), finding: `Notice covers ${d.notice ? d.notice.covered : 0} of ${d.notice ? d.notice.total : 9} DPDP disclosures.` },
      { key: "security", label: "Security safeguards", score: clamp((secOk / secTot) * 100), finding: `${secOk}/${secTot} transport, header and cookie controls in place.` },
      { key: "rights", label: "Data-principal rights", score: d.hasRightsPage ? 78 : 42, finding: d.hasRightsPage ? "A rights/request mechanism was found." : "No access/correction/erasure mechanism found." },
      { key: "crossBorder", label: "Cross-border transfers", score: (d.crossBorderRegions || []).length ? (has("crossBorder") ? 62 : 40) : 88, finding: (d.crossBorderRegions || []).length ? `Data flows to ${d.crossBorderRegions.join(", ")}${has("crossBorder") ? " (disclosed)" : ", not clearly disclosed"}.` : "No obvious cross-border transfers." },
      { key: "children", label: "Children's data", score: (d.dataCollection && d.dataCollection.collectsChildAge) ? (has("children") ? 66 : 30) : 86, finding: (d.dataCollection && d.dataCollection.collectsChildAge) ? "Age/DOB collected, parental-consent duties apply." : "No children's-data collection detected." },
      { key: "governance", label: "Governance & DPO", score: d.hasDpoNamed ? 72 : 44, finding: d.hasDpoNamed ? "A DPO/grievance officer is named." : "No DPO or grievance officer named." },
      { key: "vendorGovernance", label: "Processor governance", score: clamp(100 - Math.min(60, (d.piiVendorCount || 0) * 7)), finding: `${d.piiVendorCount || 0} third parties handle personal data.` },
      { key: "retention", label: "Data retention", score: has("retention") ? 74 : 46, finding: has("retention") ? "Retention is addressed in the notice." : "No retention or erasure policy disclosed." },
      { key: "breach", label: "Breach readiness", score: 50, finding: "Breach-response readiness can't be verified from a scan." },
    ];
    return cats.map(c => ({ ...c, score: clamp(c.score), status: catStatus(c.score) }));
  }

  function deriveFindings(d) {
    const S = d.summary || {}; const out = [];
    const st = (b) => b;
    out.push((S.trackers || S.preConsentCookies)
      ? { label: "Pre-consent tracking", status: "fail", detail: `${S.trackers || 0} tracker service(s) and ${S.preConsentCookies || 0} optional cookie/storage item(s) fired before any choice.` }
      : { label: "Pre-consent tracking", status: "pass", detail: "No non-essential trackers ran before consent on the pages we checked." });
    const cv = (d.consent || {}).verdict;
    out.push(cv === "ok" ? { label: "Consent banner", status: "pass", detail: "A banner was found and it blocks trackers until the visitor chooses." }
      : cv === "no-banner" ? { label: "Consent banner", status: "fail", detail: "No consent banner was detected on the homepage." }
      : cv === "ignores-reject" ? { label: "Consent banner", status: "fail", detail: "Clicking Reject did not stop the trackers." }
      : { label: "Consent banner", status: "warn", detail: cv === "no-reject-option" ? "Banner offers no clear Reject option." : cv === "pre-ticked" ? "Optional purposes are pre-ticked." : "Banner present; behaviour needs review." });
    out.push(d.hasPrivacyPolicy ? { label: "Privacy notice", status: (d.notice && d.notice.covered >= 7) ? "pass" : "warn", detail: `Notice found, covering ${d.notice ? d.notice.covered : 0}/${d.notice ? d.notice.total : 9} DPDP disclosures.` } : { label: "Privacy notice", status: "fail", detail: "No privacy notice was found." });
    out.push((d.dataCollection && d.dataCollection.sensitiveCategories && d.dataCollection.sensitiveCategories.length) ? { label: "Sensitive personal data", status: "warn", detail: `Collects ${d.dataCollection.sensitiveCategories.join(", ")}.` } : { label: "Personal-data collection", status: (d.dataCollection && d.dataCollection.collectsData) ? "warn" : "pass", detail: (d.dataCollection && d.dataCollection.collectsData) ? `${d.dataCollection.fieldCount} form field(s) collect personal data.` : "No obvious collection forms detected." });
    out.push((d.crossBorderRegions || []).length ? { label: "Cross-border transfers", status: "warn", detail: `Data implied to leave India to ${d.crossBorderRegions.map(r => REGION_FLAG[r] || r).join(" ")} (${d.crossBorderRegions.join(", ")}).` } : { label: "Cross-border transfers", status: "pass", detail: "No obvious cross-border transfers detected." });
    out.push({ label: "Transport security", status: d.https ? "pass" : "fail", detail: d.https ? "Served over HTTPS." : "Not served over HTTPS." });
    return out;
  }

  function deriveEvidence(d) {
    const byCat = {};
    (d.vendors || []).forEach(v => { (byCat[v.category] = byCat[v.category] || { category: v.category, label: v.category, region: v.region || "Global", vendors: [] }).vendors.push(v.name); });
    const missing = (d.notice && d.notice.disclosures ? d.notice.disclosures : []).filter(x => !x.covered).map(x => x.label);
    return {
      pagesScanned: d.pagesScanned || (d.pagesVisited || []).length,
      vendorCount: d.vendorCount || (d.vendors || []).length,
      piiVendorCount: d.piiVendorCount || 0,
      vendorsByCategory: Object.values(byCat),
      cookies: (d.cookies || []).map(c => c.name).slice(0, 24),
      cmp: d.cmp && d.cmp !== "detected" ? d.cmp : (d.cmp === "detected" ? "a consent tool" : null),
      consentGating: !!d.consentGating,
      notice: { covered: d.notice ? d.notice.covered : 0, total: d.notice ? d.notice.total : 9, missing, source: d.notice ? d.notice.source : "keywords", summary: d.notice && d.notice.summary, gaps: (d.notice && d.notice.gaps) || [], lastUpdated: d.notice && d.notice.lastUpdated },
      crossBorder: { regions: d.crossBorderRegions || [], destinations: (d.crossBorderRegions || []).length, flags: (d.crossBorderRegions || []).map(r => REGION_FLAG[r] || "🌐") },
      cloudProviders: d.cloudProviders || [],
      security: d.security || [],
      dataPoints: d.dataPoints || [],
      dataCollection: d.dataCollection || { categories: [], sensitiveCategories: [], collectsData: false, fieldCount: 0 },
    };
  }

  // Six things a scan can't see. Each answer refines a DPDP obligation the browser
  // can't observe. Scale drives Significant-Data-Fiduciary likelihood + penalty size.
  const QUESTIONS = [
    { id: "rights", cat: "rights", label: "Data-principal rights (DSAR)",
      q: "Can people request access, correction, erasure or nomination of their personal data, and do you act on it within a set timeline?",
      opts: [["Yes, a working process", 90], ["Informally, by email only", 52], ["No", 18]] },
    { id: "breach", cat: "breach", label: "Breach response",
      q: "Do you have a documented process to detect, contain and report a personal-data breach to the Board and affected people?",
      opts: [["Yes, documented", 86], ["Informal only", 48], ["No", 18]] },
    { id: "consentRecords", cat: "consentRecords", label: "Consent records",
      q: "Do you keep a record of each person's consent, what they agreed to and when, that you can produce on demand?",
      opts: [["Yes, logged and retrievable", 88], ["Partially", 50], ["No", 20]] },
    { id: "retention", cat: "retention", label: "Retention and erasure",
      q: "Do you delete personal data once its purpose is served, on a defined retention schedule?",
      opts: [["Yes, scheduled deletion", 85], ["Ad-hoc", 48], ["No, kept indefinitely", 20]] },
    { id: "processors", cat: "vendorGovernance", label: "Processor contracts",
      q: "Do you have written data-processing agreements with every vendor that handles your users' personal data?",
      opts: [["Yes, with all", 85], ["With some", 50], ["No", 22]] },
    { id: "scale", cat: "scale", label: "Data volume",
      q: "Roughly how many individuals' personal data does your company process?",
      opts: [["Under 10,000", "lt10k"], ["10,000 to 1 lakh", "10kto1L"], ["1 lakh to 10 lakh", "1Lto10L"], ["Over 10 lakh", "gt10L"]] },
  ];
  const CAT_LABELS = { rights: "Data-principal rights", breach: "Breach readiness", consentRecords: "Consent records", retention: "Data retention", vendorGovernance: "Processor governance" };
  const WEIGHTS = { consent: 1.4, notice: 1.2, security: 1.1, rights: 1.0, crossBorder: 0.9, children: 0.8, governance: 1.0, vendorGovernance: 0.9, retention: 0.9, breach: 1.0, consentRecords: 1.0 };
  const weighted = cats => { let s = 0, w = 0; cats.forEach(c => { const wt = WEIGHTS[c.key] ?? 1; s += c.score * wt; w += wt; }); return clamp(w ? s / w : 0); };

  // Fold self-reported answers into the scan-derived categories.
  function mergeAnswers(cats, answers) {
    if (!answers) return cats;
    const out = cats.map(c => ({ ...c }));
    const setCat = (key, score, finding) => { const c = out.find(x => x.key === key); if (c) { c.score = clamp(score); c.status = catStatus(c.score); if (finding) c.finding = finding; } };
    if (answers.rights != null) setCat("rights", answers.rights, answers.rights >= 80 ? "You confirmed a working rights/DSAR process." : answers.rights >= 45 ? "Rights requests are handled only informally." : "No process to fulfil access/correction/erasure/nomination.");
    if (answers.breach != null) setCat("breach", answers.breach, answers.breach >= 80 ? "You confirmed a documented breach-response process." : answers.breach >= 45 ? "Breach response is informal only." : "No breach detection or notification process.");
    if (answers.retention != null) setCat("retention", answers.retention, answers.retention >= 80 ? "You confirmed a defined retention/erasure schedule." : answers.retention >= 45 ? "Retention is handled ad-hoc." : "Personal data is kept with no retention limit.");
    if (answers.processors != null) setCat("vendorGovernance", answers.processors, answers.processors >= 80 ? "You confirmed processing agreements with all vendors." : answers.processors >= 45 ? "Only some processors are under contract." : "No data-processing agreements with vendors.");
    if (answers.consentRecords != null && !out.find(x => x.key === "consentRecords")) {
      out.push({ key: "consentRecords", label: "Consent records", score: clamp(answers.consentRecords), status: catStatus(answers.consentRecords),
        finding: answers.consentRecords >= 80 ? "You keep retrievable consent records." : answers.consentRecords >= 45 ? "Consent records are only partial." : "No retrievable record of consent is kept." });
    }
    return out;
  }

  function buildModel(d, answers) {
    let cats = deriveCategories(d);
    const scanScore = weighted(cats);
    cats = mergeAnswers(cats, answers);
    const scoreByKey = {}; cats.forEach(c => scoreByKey[c.key] = c.score); scoreByKey.automatedDecisions = 70;
    if (answers && answers.consentRecords != null) scoreByKey.consent = Math.round(0.6 * (scoreByKey.consent ?? 60) + 0.4 * answers.consentRecords);
    const dc = d.dataCollection || {};
    const scale = (answers && answers.scale) || "10kto1L";
    const sdfLikely = (answers && (answers.scale === "1Lto10L" || answers.scale === "gt10L")) || (dc.sensitiveCategories || []).length > 0 || (d.piiVendorCount || 0) >= 6 || /fintech|healthcare/.test((d.scoreDetail && d.scoreDetail.sector) || "");
    const penalty = computePenalty(scoreByKey, { childrenApplicable: !!dc.collectsChildAge, sdfApplicable: sdfLikely, scale });
    const days = Math.max(0, Math.ceil((DEADLINE - new Date()) / 86400000));
    const score = answers ? weighted(cats) : scanScore;
    const band = bandForScore(score);
    const worst = cats.filter(c => c.score < 70 && SERVICE[c.key]).sort((a, b) => a.score - b.score).slice(0, 3);
    const priorityGaps = worst.map(c => ({ ...SERVICE[c.key], severity: c.score < 35 ? "Critical" : c.score < 55 ? "High" : "Medium", impact: c.finding }));
    const urgency = band === "Strong" ? "You're ahead of most, lock in readiness before enforcement begins." : band === "Developing" ? "You have foundations, but the gaps below carry real exposure before enforcement." : "These gaps are the kind the Board acts on first. Closing them now is far cheaper than a penalty.";
    return {
      domain: d.domain, generatedAt: d.scannedAt || new Date().toISOString(), score, scanScore, refined: !!answers, answers: answers || null,
      band, sector: (d.scoreDetail && d.scoreDetail.sector) || "general",
      benchmark: d.scoreDetail && d.scoreDetail.benchmark, vsBenchmark: d.scoreDetail && d.scoreDetail.vsBenchmark,
      sdfLikely, scale, daysToDeadline: days, urgencyLine: urgency, consent: d.consent || {}, incomplete: d.incomplete,
      categories: cats, priorityGaps, penalty, evidence: deriveEvidence(d), findings: deriveFindings(d), raw: d,
    };
  }

  /* ---------- render ---------- */
  const dateLabel = iso => { try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } };
  const findIcon = s => s === "pass" ? ICON.shieldCheck : s === "warn" ? ICON.shieldQ : ICON.shieldAlert;

  function heroHtml(m) {
    const b = BAND[m.band];
    return `<div class="hero"><div class="wrap">
      <p class="kicker">DPDP Act Gap Assessment · Deep scan</p>
      <div class="hero-grid">
        <div class="gauge"><svg viewBox="0 0 200 200" style="transform:rotate(-90deg)"><circle cx="100" cy="100" r="84" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="14"/><circle id="g-ring" cx="100" cy="100" r="84" fill="none" stroke="${b.c}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${2 * Math.PI * 84}" stroke-dashoffset="${2 * Math.PI * 84}"/></svg><div class="num"><b id="g-num">0</b><span>/ 100 ready</span></div></div>
        <div>
          <span class="band-pill" style="color:${b.c}"><span class="dotp" style="background:${b.c}"></span>${esc(m.band)}</span>
          <h1>Your DPDP readiness for<br><span class="dom">${esc(m.domain)}</span></h1>
          <p class="blurb">${esc(b.blurb)}</p>
          <div class="tags">
            <span class="tag">${esc(m.sector)}${typeof m.vsBenchmark === "number" ? ` · ${m.vsBenchmark >= 0 ? "+" : ""}${m.vsBenchmark} vs sector` : ""}</span>
            ${m.sdfLikely ? '<span class="tag warn">Significant Data Fiduciary likely</span>' : ""}
            <span class="tag">Assessed ${esc(dateLabel(m.generatedAt))}</span>
            <span class="tag">${ICON.bolt} Live browser scan</span>
          </div>
        </div>
      </div>
      <div class="urgency">
        <div><span class="days">${m.daysToDeadline}</span> <span class="lbl">days to enforcement</span></div>
        <p>${ICON.clock} ${esc(m.urgencyLine)}</p>
      </div>
    </div></div>`;
  }

  function foundHtml(m) {
    const ev = m.evidence;
    const cards = m.findings.map(f => `<div class="finding ${f.status}"><div class="ic">${findIcon(f.status)}</div><div><h4>${esc(f.label)} <span class="badge ${f.status}">${f.status === "pass" ? "OK" : f.status === "warn" ? "Gap" : "Critical"}</span></h4><p>${esc(f.detail)}</p></div></div>`).join("");
    const stats = [["Pages scanned", ev.pagesScanned], ["Third-party services", ev.vendorCount], ["Handle personal data", ev.piiVendorCount], ["Notice disclosures", `${ev.notice.covered}/${ev.notice.total}`], ["Cross-border regions", ev.crossBorder.destinations]]
      .map(s => `<div class="stat"><b>${esc(s[1])}</b><span>${esc(s[0])}</span></div>`).join("");
    return `<div class="sec"><div class="wrap"><p class="kick">What we found on your site</p><h2>Detected on ${esc(m.domain)}</h2>
      <p class="intro">A real browser visited your public pages the way a first-time visitor would. These are the signals a regulator or a data principal can see too.</p>
      <div class="findings">${cards}</div><div class="stats">${stats}</div></div></div>`;
  }

  function consentHtml(m) {
    const c = m.consent || {};
    if (!c.verdict || c.verdict === "not-tested") return "";
    const vmeta = { "ok": ["good", "Your banner blocks trackers until the visitor chooses. This is what DPDP expects."], "tracks-before-consent": ["bad", "Your banner is cosmetic, trackers fire before the visitor makes any choice. Under DPDP this is processing without consent."], "ignores-reject": ["bad", "Clicking Reject did not stop the trackers. Refusal must be honoured as easily as acceptance."], "no-banner": ["bad", "No consent banner was found, yet trackers run before any choice."], "no-reject-option": ["mid", "Your banner offers no clear Reject. DPDP expects refusing to be as easy as accepting."], "pre-ticked": ["mid", "Optional purposes are pre-ticked. Consent must be a clear affirmative action, not a default."] };
    const vm = vmeta[c.verdict] || ["mid", "Banner behaviour needs review."];
    const tri = b => b === true ? '<span style="color:var(--ok);font-weight:700">Yes</span>' : b === false ? '<span style="color:var(--hi);font-weight:700">No</span>' : '<span class="muted">n/a</span>';
    return `<div class="sec alt"><div class="wrap"><p class="kick">Consent, actually tested</p><h2>${ICON.shieldCheck} Does your banner really block anything?</h2>
      <p class="intro">Most scanners only look for a banner. We clicked your own <b>Accept</b> and <b>Reject</b> in fresh sessions to measure what actually fires, the proof a regulator would want.</p>
      <div class="proof">
        <div class="pstate"><div class="st">Before any choice</div><div class="big">${c.trackersBeforeConsent ?? 0}</div><div class="cap">tracker services already contacted</div></div>
        <div class="pstate"><div class="st">After “Accept”</div><div class="big">+${c.newTrackersAfterAccept ?? 0}</div><div class="cap">new tracker services appeared</div></div>
        <div class="pstate"><div class="st">After “Reject”</div><div class="big">${c.trackersAfterReject == null ? "n/a" : c.trackersAfterReject}</div><div class="cap">${c.trackersAfterReject == null ? "not tested" : "still firing after refusal"}</div></div>
      </div>
      <div class="grid3" style="margin-top:16px">
        <div class="card soft"><h3>Reject offered (parity)</h3><p style="margin-top:8px">${tri(c.hasReject)}</p></div>
        <div class="card soft"><h3>Optional pre-ticked</h3><p style="margin-top:8px">${tri(c.preTicked)}</p></div>
        <div class="card soft"><h3>Blocks before consent</h3><p style="margin-top:8px">${tri(c.blocksBeforeConsent)}</p></div>
      </div>
      <div class="verdict ${vm[0]}">${vm[0] === "good" ? ICON.shieldCheck : ICON.shieldAlert}<span>${esc(vm[1])}</span></div>
    </div></div>`;
  }

  function dataHtml(m) {
    const ev = m.evidence;
    const groups = ev.vendorsByCategory.length ? ev.vendorsByCategory.map(g => `<div class="vgroup"><div class="top"><span>${esc(g.label)}</span><span title="${esc(g.region)}">${REGION_FLAG[g.region] || "🌐"}</span></div><div style="margin-top:8px">${g.vendors.map(v => `<span class="chip">${esc(v)}</span>`).join("")}</div></div>`).join("")
      : `<p class="card soft" style="grid-column:1/-1">No third-party services were detected.</p>`;
    const cookies = ev.cookies.length ? ev.cookies.map(c => `<span class="chip mono">${esc(c)}</span>`).join("") : '<span class="muted">None captured.</span>';
    return `<div class="sec"><div class="wrap"><p class="kick">Your data collection surface</p><h2>${ICON.database} Where your data actually goes</h2>
      <p class="intro">Every third-party service detected on ${esc(m.domain)}, grouped by what it does and where it processes data.</p>
      <div class="grid3" style="margin-top:26px">${groups}</div>
      <div class="grid3" style="margin-top:16px">
        <div class="card soft"><h3>${ICON.cookie} Cookies set</h3><div style="margin-top:10px">${cookies}</div></div>
        <div class="card soft"><h3>${ICON.shieldCheck} Consent management</h3><p style="margin-top:8px">${ev.cmp ? `${esc(ev.cmp)} detected${ev.consentGating ? ", scripts appear gated." : ", but scripts may not be gated."}` : "No consent-management platform detected."}</p></div>
        <div class="card soft"><h3>${ICON.globe} Cross-border transfers</h3><p style="margin-top:8px">${ev.crossBorder.destinations ? `Data implied to leave India to ${ev.crossBorder.flags.join(" ")} (${esc(ev.crossBorder.regions.join(", "))}).` : "No obvious cross-border transfers detected."}</p></div>
      </div></div></div>`;
  }

  function piiHtml(m) {
    const dcol = m.evidence.dataCollection;
    if (!dcol.collectsData && !(dcol.categories || []).length) return "";
    const rows = (dcol.categories || []).map(c => `<div class="cat"><div class="row"><b>${esc(c.label)}</b><span class="sev ${c.risk === "high" ? "Critical" : c.risk === "medium" ? "High" : "Medium"}">${esc(c.risk)}</span></div><p>${esc((c.examples || []).join(", ") || (c.count + " field(s)"))}</p></div>`).join("");
    return `<div class="sec alt"><div class="wrap"><p class="kick">Personal-data surface</p><h2>${ICON.fingerprint} What you actually ask people for</h2>
      <p class="intro">We read the real form fields across your pages. DPDP is about personal data, not just cookies${(dcol.sensitiveCategories || []).length ? `, and you collect <b style="color:var(--hi)">${esc(dcol.sensitiveCategories.join(", "))}</b>, which raises the stakes` : ""}.</p>
      <div class="catlist">${rows || '<p class="muted">No structured personal-data fields detected.</p>'}</div></div></div>`;
  }

  function noticeSecHtml(m) {
    const ev = m.evidence; const n = ev.notice;
    const pct = n.total ? (n.covered / n.total) * 100 : 0;
    const cls = n.covered >= 7 ? "ok" : n.covered >= 4 ? "warn" : "fail";
    const miss = n.missing.length ? `<p style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--soft);font-weight:700;margin:16px 0 6px">Missing</p><ul style="margin:0;padding:0;list-style:none">${n.missing.map(x => `<li style="display:flex;gap:8px;align-items:center;font-size:14px;margin:5px 0">${ICON.x.replace('class="i"', 'class="i" style="color:var(--hi)"')} ${esc(x)}</li>`).join("")}</ul>` : "";
    const summ = n.summary ? `<p style="margin-top:14px;font-size:14px;color:var(--soft)">${esc(n.summary)}</p>` : "";
    const secItems = ev.security.map(s => `<li style="display:flex;gap:8px;align-items:center;font-size:14px;margin:5px 0">${(s.ok ? ICON.check.replace('class="i"', 'class="i" style="color:var(--ok)"') : ICON.x.replace('class="i"', 'class="i" style="color:var(--hi)"'))} ${esc(s.label)}</li>`).join("");
    const dpChips = ev.dataPoints.filter(d => d.present).map(d => `<span class="chip" style="border-color:rgba(79,70,229,.25);background:rgba(79,70,229,.06)">${esc(d.label)}</span>`).join("") || '<span class="muted">No obvious collection points.</span>';
    return `<div class="sec"><div class="wrap"><div class="grid2">
      <div class="card"><h3>${ICON.file} Privacy notice completeness ${n.source === "llm" ? '<span class="pill-src">AI-read</span>' : ""}</h3>
        <div style="display:flex;align-items:baseline;gap:8px;margin-top:12px"><span style="font-size:30px;font-weight:800">${n.covered}</span><span class="muted">/ ${n.total} DPDP disclosures</span></div>
        <div class="bar ${cls}" style="margin-top:10px"><i style="width:${pct}%"></i></div>${summ}${miss}
        ${n.lastUpdated ? `<p class="muted" style="font-size:12px;margin-top:12px">Last updated: ${esc(n.lastUpdated)}</p>` : ""}</div>
      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="card"><h3>${ICON.server} Security posture</h3><ul style="margin:12px 0 0;padding:0;list-style:none;columns:2;column-gap:20px">${secItems}</ul></div>
        <div class="card"><h3>${ICON.fingerprint} Personal data collected</h3><div style="margin-top:12px">${dpChips}</div></div>
      </div></div></div></div>`;
  }

  function obligationsHtml(m) {
    const rows = m.categories.map(c => `<div class="cat"><div class="row"><b>${esc(c.label)}</b><span class="sc" style="color:${c.status === "pass" ? "var(--ok)" : c.status === "warn" ? "var(--warn)" : "var(--hi)"}">${c.score}</span></div><div class="bar ${c.status === "pass" ? "ok" : c.status === "warn" ? "warn" : "fail"}"><i data-w="${c.score}" style="width:0"></i></div><p>${esc(c.finding)}</p></div>`).join("");
    return `<div class="sec alt"><div class="wrap"><p class="kick">Obligation breakdown</p><h2>Your score across ${m.categories.length} DPDP obligations</h2><div class="catlist">${rows}</div></div></div>`;
  }

  function gapsHtml(m, gated) {
    const cards = m.priorityGaps.map((g, i) => `<div class="gapwrap"><div class="gap"><div class="in"><div><span class="num">${i + 1}</span> <span class="sev ${g.severity}">${g.severity}</span> <span class="muted" style="font-size:12px;font-weight:600">${esc(g.ceiling)}</span><h3>${esc(g.title)}</h3><p class="impact">${esc(g.impact)}</p></div><div class="fix"><p class="k">How Kensara closes this</p><b>${esc(g.service)}</b><p>${esc(g.blurb)}</p></div></div></div></div>`).join("");
    const unlock = gated ? `<div class="unlock"><div class="box"><div style="display:inline-flex;background:rgba(79,70,229,.1);color:var(--brand);border-radius:50%;padding:12px;margin-bottom:10px">${ICON.lock}</div>
      <p style="font-weight:800;font-size:18px;margin:0">Unlock your priority gaps</p><p class="muted" style="margin-top:6px;font-size:14px">See your top gaps and get the full report in your inbox.</p>
      <form id="unlock-form" style="margin-top:14px;text-align:left"><input type="email" id="ul-email" required placeholder="Work email"><input type="text" id="ul-company" placeholder="Company (optional)"><p class="err" id="ul-err"></p><button class="btn block" id="ul-btn" type="submit" style="margin-top:8px">Unlock full report ${ICON.arrow}</button><p class="muted" style="font-size:11px;text-align:center;margin-top:8px">We use this only to send your report and follow up.</p></form></div></div>` : "";
    return `<div class="sec"><div class="wrap"><p class="kick">Your priority gaps</p><h2>Fix these first</h2><p class="intro">The gaps with the highest enforcement exposure, and exactly how Kensara closes each one.</p>
      <div class="gaps ${gated ? "gated" : ""}">${cards}${unlock}</div></div></div>`;
  }

  function penaltyHtml(m) {
    const pe = m.penalty;
    const fill = pe.capCr > 0 ? Math.max(4, Math.round((pe.practicalMaxCr / pe.capCr) * 100)) : 0;
    const lines = pe.lines.map(l => {
      const state = !l.applicable ? "na" : l.atRisk ? "risk" : "ok";
      const f = l.maxCr > 0 && l.likelyCr > 0 ? Math.max(4, Math.round((l.likelyCr / l.maxCr) * 100)) : 0;
      const mid = state === "risk" ? `<div><div class="bar" style="background:rgba(255,255,255,.1)"><i style="width:${f}%;background:linear-gradient(90deg,#fbbf24,#ef4444)"></i></div><div style="display:flex;justify-content:space-between;margin-top:4px"><span class="likely">${esc(l.likelyLabel)}</span><span class="capc">cap ${esc(l.maxLabel)}</span></div></div>` : `<span class="muted" style="font-size:12px;color:${state === "ok" ? "rgba(52,211,153,.8)" : "rgba(255,255,255,.4)"}">${state === "ok" ? "Not at risk" : "Not applicable"}</span>`;
      return `<div class="pline ${state === "risk" ? "risk" : ""}"><div><div class="t">${state === "risk" ? ICON.shieldAlert.replace('class="i"', 'class="i" style="color:#f87171"') : state === "ok" ? ICON.shieldCheck.replace('class="i"', 'class="i" style="color:#34d399"') : ICON.scale.replace('class="i"', 'class="i" style="color:rgba(255,255,255,.3)"')} ${esc(l.title)} <span class="sect">${esc(l.section)}</span></div><p class="obl">${esc(l.obligations)}</p></div>${mid}<div style="font-size:12px;color:${state === "risk" ? "#fca5a5" : "rgba(255,255,255,.4)"}">${esc(l.driver)}</div></div>`;
    }).join("");
    return `<div class="penalty"><div class="wrap"><p class="kick">Penalty exposure assessment</p>
      <div class="grid2" style="align-items:center">
        <div><h2>${ICON.gavel} Your likely penalty exposure</h2><p class="intro">A practical estimate of what the Data Protection Board would realistically levy under Section 33, against the statutory cap in the DPDP 2023 Schedule.</p></div>
        <div class="pexp"><p class="lbl">Likely exposure</p><p class="amt">${esc(pe.practicalLabel)}</p><div class="bar" style="background:rgba(255,255,255,.1)"><i style="width:${fill}%;background:linear-gradient(90deg,#fbbf24,#ef4444)"></i></div><div class="cap"><span>Likely ${esc(pe.practicalLabel)}</span><span>Cap ${esc(pe.capLabel)}</span></div><p class="lbl" style="margin-top:10px;color:rgba(255,255,255,.4)">Across ${pe.atRiskCount} breach head${pe.atRiskCount === 1 ? "" : "s"} at risk</p></div>
      </div>
      <div class="ptable"><div class="ph"><span>Breach head</span><span>Likely vs cap</span><span>Finding</span></div>${lines}</div>
      <p class="note">${ICON.scale} ${esc(pe.note)}</p></div></div>`;
  }

  function ctaHtml(m) {
    const pe = m.penalty;
    return `<div class="cta"><div class="wrap"><div class="box"><div class="cta-grid">
      <div><p class="kick">This is the surface</p><h2>A full techno-legal gap assessment goes far deeper.</h2>
        <p class="intro">This deep scan covers what's publicly visible. Our experts map every data flow, processor and obligation, then deliver a prioritised roadmap to audit-ready compliance in 2 to 6 weeks.</p>
        <div style="margin-top:20px"><a class="btn" href="${esc(SITE.bookDemoUrl || "#")}" target="_blank" rel="noopener">Book your full gap assessment ${ICON.arrow}</a></div>
        <div class="trust">${["60% lower cost", "100% audit success", "Zero IT disruption"].map(t => `<span>${ICON.check.replace('class="i"', 'class="i" style="color:var(--ok)"')} ${t}</span>`).join("")}</div>
      </div>
      <div class="expo"><p class="kick">Likely exposure</p><p class="amt">${esc(pe.practicalLabel)}</p><div class="bar"><i style="width:${pe.capCr > 0 ? Math.max(4, Math.round((pe.practicalMaxCr / pe.capCr) * 100)) : 0}%;background:linear-gradient(90deg,#fbbf24,#ef4444)"></i></div><p class="muted" style="font-size:12px;margin-top:8px">Statutory cap ${esc(pe.capLabel)}</p><p class="muted" style="font-size:14px;margin-top:12px">Enforcement begins May 2027.</p></div>
    </div></div>
    <p class="disc">This assessment is indicative and for informational purposes only, it is not legal advice. Results are based on a deep scan of public pages. Kensara stores only the details you submit, and uses them solely to prepare your report and follow up.</p>
    </div></div>`;
  }

  // Standalone step shown AFTER the scan and BEFORE the assessment. The report is
  // built from scan + answers together.
  function questionnaireStep(data) {
    $("#landing").hidden = true;
    const r = $("#report"); r.hidden = false;
    const qs = QUESTIONS.map((qq, i) => `<div class="q"><p class="qq"><span class="qn">${i + 1}</span>${esc(qq.q)}</p>
      <div class="qopts">${qq.opts.map(o => `<label class="qopt"><input type="radio" name="q_${qq.id}" value="${esc(o[1])}"> <span>${esc(o[0])}</span></label>`).join("")}</div></div>`).join("");
    r.innerHTML = `<div class="qstep"><div class="wrap">
      <p class="eyebrow">${ICON.check.replace('class="i"', 'class="i" style="color:var(--ok)"')} Scan complete for ${esc(data.domain || "your site")}</p>
      <h1 class="qtitle">Six questions to complete your assessment</h1>
      <p class="lead">Your scan captured what's visible. These answers, on things a scan can't see, complete your DPDP readiness, gaps and penalty exposure.</p>
      <form id="qstep-form" class="qform">${qs}<p class="err" id="qstep-err"></p>
        <button class="btn" id="qstep-btn" type="submit">See my assessment ${ICON.arrow}</button></form>
    </div></div>`;
    window.scrollTo({ top: 0 });
    $("#qstep-form").addEventListener("submit", e => {
      e.preventDefault();
      const answers = readAnswers(e.target, "#qstep-err");
      if (answers) renderReport(buildModel(data, answers));
    });
  }
  function readAnswers(form, errSel) {
    const answers = {};
    for (const qq of QUESTIONS) {
      const sel = form.querySelector(`input[name="q_${qq.id}"]:checked`);
      if (!sel) { const e = $(errSel); if (e) e.textContent = "Please answer all six questions."; return null; }
      answers[qq.id] = qq.cat === "scale" ? sel.value : +sel.value;
    }
    return answers;
  }

  // A slim line under the hero recording that the assessment used scan + answers.
  function provenanceHtml(m) {
    if (!m.refined) return "";
    return `<div class="prov"><div class="wrap">${ICON.check.replace('class="i"', 'class="i" style="color:var(--ok)"')} This assessment combines a live browser scan of <b>${esc(m.domain)}</b> with your ${QUESTIONS.length} answers. Scan-only readiness was ${m.scanScore}; with your answers it is ${m.score}.</div></div>`;
  }

  let lastModel = null, gated = true;
  function renderReport(m) {
    lastModel = m;
    $("#landing").hidden = true;
    const r = $("#report"); r.hidden = false;
    r.innerHTML = heroHtml(m) + provenanceHtml(m) + foundHtml(m) + consentHtml(m) + dataHtml(m) + piiHtml(m) + noticeSecHtml(m) + obligationsHtml(m) + gapsHtml(m, gated) + penaltyHtml(m) + ctaHtml(m);
    window.scrollTo({ top: 0 });
    animate(m);
    wireUnlock();
  }
  function animate(m) {
    // gauge, set the final value first so it's correct even if rAF is throttled (background tab)
    const ring = $("#g-ring"), num = $("#g-num"); const C = 2 * Math.PI * 84;
    if (num) num.textContent = m.score;
    if (ring) ring.style.strokeDashoffset = C - (m.score / 100) * C;
    const t0 = performance.now(), dur = 1100;
    function step(now) { const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3); const v = Math.round(e * m.score); if (num) num.textContent = v; if (ring) ring.style.strokeDashoffset = C - (v / 100) * C; if (t < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step); // rAF only (no synchronous 0), so background tabs keep the final value
    setTimeout(() => document.querySelectorAll(".cat .bar > i[data-w]").forEach(i => i.style.width = i.getAttribute("data-w") + "%"), 60);
  }
  function wireUnlock() {
    const f = $("#unlock-form"); if (!f) return;
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const email = $("#ul-email").value.trim(), company = $("#ul-company").value.trim();
      $("#ul-btn").disabled = true; $("#ul-err").textContent = "";
      try {
        const s = lastModel.raw.summary || {};
        const r = await fetch(API + "/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: email.split("@")[0], email, company, interest: "gap-assessment", website: lastModel.domain, scanSummary: { domain: lastModel.domain, score: lastModel.score, trackers: s.trackers, cookies: s.cookies } }) });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Couldn't unlock. Please try again.");
        gated = false; renderReport(lastModel);
      } catch (err) { $("#ul-err").textContent = err.message + (SITE.contactEmail ? ` (${SITE.contactEmail})` : ""); $("#ul-btn").disabled = false; }
    });
  }

  /* ---------- scan flow ---------- */
  const MSGS = ["Opening your homepage…", "Waiting for tags and pixels to load…", "Testing your consent banner…", "Reading cookies, storage and forms…", "Checking your privacy notice…", "Scoring against DPDP obligations…"];
  $("#scan-form").addEventListener("submit", async e => {
    e.preventDefault();
    const url = $("#url").value.trim(); if (!url) return;
    $("#scan-err").textContent = ""; $("#scan-btn").disabled = true; $("#scanning").hidden = false;
    let i = 0; $("#scan-msg").textContent = MSGS[0];
    const tick = setInterval(() => $("#scan-msg").textContent = MSGS[Math.min(++i, MSGS.length - 1)], 7000);
    try {
      const r = await fetch(API + "/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, turnstileToken: "", mode: "gap" }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "The assessment didn't finish. Try again.");
      gated = true; questionnaireStep(data);                // scan done -> ask the 6 questions -> then the report
    } catch (err) { $("#scan-err").textContent = err.message; }
    finally { clearInterval(tick); $("#scan-btn").disabled = false; $("#scanning").hidden = true; }
  });
  // Sample skips the questions and shows a fully-built example report (scan + typical answers).
  $("#sample").onclick = () => { gated = true; renderReport(buildModel(window.__SAMPLE__, window.__SAMPLE_ANSWERS__ || null)); };
  const nd = $("#nav-demo"); if (nd) nd.href = SITE.bookDemoUrl || "#";
})();
