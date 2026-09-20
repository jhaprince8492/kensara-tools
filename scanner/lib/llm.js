// Provider-agnostic privacy-notice reader. Uses any OpenAI-compatible chat endpoint,
// so you can point it at NVIDIA NIM (free prototyping), Gemini, OpenAI, Groq, etc. by
// env alone. Returns a reasoned DPDP disclosure assessment; the scanner falls back to
// keyword coverage if this is disabled, times out, or errors, so it's never a hard dep.
//
//   LLM_BASE_URL  e.g. https://integrate.api.nvidia.com/v1  |  https://api.openai.com/v1
//   LLM_API_KEY   provider key (absent => feature off, keyword fallback used)
//   LLM_MODEL     e.g. meta/llama-3.1-8b-instruct | gpt-4.1-nano | gemini-2.0-flash

const DISCLOSURES = [
  ["dataCategories", "Itemised personal data collected"],
  ["purposes", "Specific purposes of processing"],
  ["retention", "Retention period / erasure"],
  ["rights", "Data-principal rights (access, correction, erasure, nomination)"],
  ["grievance", "Named grievance officer with contact"],
  ["withdrawal", "How to withdraw consent (as easy as giving it)"],
  ["crossBorder", "Cross-border transfer disclosure"],
  ["children", "Children's data / verifiable parental consent"],
  ["board", "Right to complain to the Data Protection Board of India"],
];

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ").trim();
}

function buildPrompt(text) {
  const list = DISCLOSURES.map(([k, l]) => `- ${k}: ${l}`).join("\n");
  return [
    { role: "system", content: "You are a DPDP (India, Digital Personal Data Protection Act 2023) compliance analyst. You assess whether a privacy notice contains required disclosures. Judge only from the text provided. Be strict: a vague mention is not coverage. Reply with ONLY a JSON object, no prose." },
    { role: "user", content:
`Assess this privacy notice against these DPDP disclosures:
${list}

Return JSON exactly:
{
 "disclosures": [{"key":"<key>","covered":true|false,"evidence":"<=120 chars quote or ''"}],
 "grievanceOfficerNamed": true|false,
 "dpoNamed": true|false,
 "retentionStated": true|false,
 "withdrawalMechanism": true|false,
 "childrenAddressed": true|false,
 "crossBorderCountries": ["..."],
 "summary": "<=280 chars plain-English verdict",
 "gaps": ["specific missing item", "..."]
}

NOTICE TEXT (may be truncated):
"""${text.slice(0, 12000)}"""` },
  ];
}

async function assessNotice(policyTextOrHtml, { signal } = {}) {
  const base = process.env.LLM_BASE_URL, key = process.env.LLM_API_KEY, model = process.env.LLM_MODEL;
  if (!base || !key || !model) return null;                       // feature off -> keyword fallback
  const text = htmlToText(policyTextOrHtml);
  if (text.length < 200) return null;                             // nothing meaningful to read
  try {
    const r = await fetch(base.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0, max_tokens: 900, response_format: { type: "json_object" }, messages: buildPrompt(text) }),
      signal,
    });
    if (!r.ok) return null;
    const data = await r.json();
    const raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!raw) return null;
    const json = JSON.parse(String(raw).replace(/^```json\s*|\s*```$/g, "").trim());
    const labels = Object.fromEntries(DISCLOSURES);
    const disclosures = DISCLOSURES.map(([k, label]) => {
      const hit = Array.isArray(json.disclosures) ? json.disclosures.find(d => d.key === k) : null;
      return { key: k, label, covered: !!(hit && hit.covered), evidence: (hit && String(hit.evidence || "").slice(0, 120)) || "" };
    });
    const covered = disclosures.filter(d => d.covered).length;
    return {
      source: "llm", model, present: true, disclosures, covered, total: DISCLOSURES.length,
      grievanceOfficerNamed: !!json.grievanceOfficerNamed, dpoNamed: !!json.dpoNamed,
      retentionStated: !!json.retentionStated, withdrawalMechanism: !!json.withdrawalMechanism,
      childrenAddressed: !!json.childrenAddressed,
      crossBorderCountries: Array.isArray(json.crossBorderCountries) ? json.crossBorderCountries.slice(0, 12).map(String) : [],
      summary: String(json.summary || "").slice(0, 280),
      gaps: Array.isArray(json.gaps) ? json.gaps.slice(0, 10).map(g => String(g).slice(0, 160)) : [],
    };
  } catch (e) {
    return null; // timeout / network / parse -> fallback
  }
}

module.exports = { assessNotice, htmlToText, DISCLOSURES };
