// PII surface mapping. Enumerates real form fields across the visited pages and
// classifies what personal data the site actually asks for, India-aware (Aadhaar,
// PAN, GSTIN, UPI…). DPDP is about personal data, not just cookies, so this maps the
// true collection surface that generic cookie scanners never see.

// Runs in the browser: returns a compact descriptor for every meaningful input.
// (Defined as a string-returning fn so it can be page.evaluate'd.)
function collectFieldsInPage() {
  const out = [];
  const labelFor = el => {
    try {
      if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) return l.textContent; }
      const wrap = el.closest("label"); if (wrap) return wrap.textContent;
      const aria = el.getAttribute("aria-label"); if (aria) return aria;
    } catch (e) {}
    return "";
  };
  const nodes = document.querySelectorAll("input, select, textarea");
  let count = 0;
  for (const el of nodes) {
    if (count >= 120) break;
    const type = (el.getAttribute("type") || el.tagName).toLowerCase();
    if (["hidden", "submit", "button", "reset", "image", "search"].includes(type)) continue;
    out.push({
      type,
      name: (el.getAttribute("name") || "").slice(0, 80),
      id: (el.id || "").slice(0, 80),
      placeholder: (el.getAttribute("placeholder") || "").slice(0, 120),
      autocomplete: (el.getAttribute("autocomplete") || "").slice(0, 60),
      label: String(labelFor(el) || "").replace(/\s+/g, " ").trim().slice(0, 120),
      required: el.hasAttribute("required"),
      maxlength: el.getAttribute("maxlength") || "",
      pattern: (el.getAttribute("pattern") || "").slice(0, 80),
    });
    count++;
  }
  return out;
}

// category, whether it's higher-risk under DPDP, and the matchers (against the field's
// combined name/id/placeholder/label/autocomplete text).
const FIELD_RULES = [
  { category: "government_id", risk: "high", label: "Government ID", re: /\b(aadha?ar|\buid\b|uidai|\bpan\b|pan[_-]?card|passport|voter[_ ]?id|epic|driv(ing|er).?licen[cs]e|\bdl[_-]?no|gstin|\bgst\b|national[_ ]?id|ssn)\b/i },
  { category: "financial", risk: "high", label: "Financial", re: /(card[_ ]?number|cardnum|\bcvv\b|\bcvc\b|expir|\bupi\b|vpa\b|bank|ifsc|account[_ ]?(no|number)|micr|\biban\b|routing)/i },
  { category: "health", risk: "high", label: "Health", re: /(health|medical|disease|diagnos|blood[_ ]?group|disabilit|prescription|patient|insurance[_ ]?(id|no))/i },
  { category: "biometric", risk: "high", label: "Biometric", re: /(biometric|fingerprint|face[_ ]?(id|scan)|retina|iris)/i },
  { category: "dob_age", risk: "medium", label: "Date of birth / age", re: /(date[_ ]?of[_ ]?birth|\bdob\b|birth[_ ]?date|\bage\b|bday)/i },
  { category: "password", risk: "medium", label: "Password / credential", re: /(password|passwd|\bpwd\b|otp|\bpin\b|security[_ ]?(question|answer))/i },
  { category: "address", risk: "medium", label: "Address", re: /(address|street|city|state|\bpin[_ ]?code|postal|zip|locality|landmark)/i },
  { category: "phone", risk: "medium", label: "Phone", re: /(phone|mobile|contact[_ ]?(no|number)|whatsapp|\btel\b)/i },
  { category: "email", risk: "low", label: "Email", re: /e-?mail/i },
  { category: "name", risk: "low", label: "Name", re: /(first[_ ]?name|last[_ ]?name|full[_ ]?name|\bfname\b|\blname\b|your[_ ]?name|\bname\b)/i },
  { category: "gender", risk: "low", label: "Gender", re: /(gender|\bsex\b)/i },
  { category: "location", risk: "medium", label: "Precise location", re: /(geoloc|latitude|longitude|\blat\b|\blng\b|\bgeo\b)/i },
];

function classifyField(f) {
  // type=email / tel / date / password are strong signals on their own
  if (f.type === "email") return FIELD_RULES.find(r => r.category === "email");
  if (f.type === "tel") return FIELD_RULES.find(r => r.category === "phone");
  if (f.type === "password") return FIELD_RULES.find(r => r.category === "password");
  if (f.type === "date") return FIELD_RULES.find(r => r.category === "dob_age");
  const hay = [f.name, f.id, f.placeholder, f.label, f.autocomplete].join(" ").toLowerCase();
  // PAN pattern in a validation attribute is a dead giveaway
  if (/[a-z]\{5\}.*\[0-9\]\{4\}/i.test(f.pattern)) return FIELD_RULES.find(r => r.category === "government_id");
  for (const r of FIELD_RULES) if (r.re.test(hay)) return r;
  return null;
}

// Aggregate raw fields (from all pages) into a data-collection surface.
function summarisePII(rawFields) {
  const byCategory = new Map();
  for (const f of rawFields) {
    const rule = classifyField(f);
    if (!rule) continue;
    if (!byCategory.has(rule.category)) byCategory.set(rule.category, { category: rule.category, label: rule.label, risk: rule.risk, count: 0, examples: [] });
    const g = byCategory.get(rule.category);
    g.count++;
    const ex = f.label || f.placeholder || f.name || f.type;
    if (ex && g.examples.length < 3 && !g.examples.includes(ex)) g.examples.push(ex);
  }
  const categories = [...byCategory.values()].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.risk] - { high: 0, medium: 1, low: 2 }[b.risk]) || b.count - a.count);
  const sensitive = categories.filter(c => c.risk === "high");
  return {
    collectsData: rawFields.length > 0,
    fieldCount: rawFields.length,
    categories,                                   // e.g. [{category:"government_id",label,risk,count,examples}]
    sensitiveCategories: sensitive.map(c => c.label),
    collectsChildAge: categories.some(c => c.category === "dob_age"),
  };
}

module.exports = { collectFieldsInPage, classifyField, summarisePII, FIELD_RULES };
