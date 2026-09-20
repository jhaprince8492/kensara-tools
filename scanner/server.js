// Kensara deep scanner HTTP service. Runs on its own box (AWS), never on Vercel.
// Auth is either a shared bearer token (server-to-server) OR a Cloudflare Turnstile
// token + allowed Origin (browser-direct), so the tools can call it whichever way.
const http = require("http");
const crypto = require("crypto");
const net = require("net");
const fs = require("fs");
const path = require("path");
const { scan } = require("./lib/scanner");
const { isPrivateIp } = require("./lib/egress-proxy");

const PORT = +(process.env.PORT || 8080);
const TOKEN = process.env.SCANNER_TOKEN || "";
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || "";
// DEV ONLY: skip auth and serve the throwaway test UI at "/". Never set in production.
const DEV = process.env.ALLOW_INSECURE === "1";
const TEST_PAGE = path.join(__dirname, "test-frontend", "index.html");
const CONSENT_DIR = path.join(__dirname, "..", "apps", "consent");   // consent frontend, served at /consent/
const GAP_DIR = path.join(__dirname, "..", "apps", "gap");           // gap-assessment frontend, served at /gap/
const ASSETS_DIR = path.join(__dirname, "..", "apps", "assets");     // shared logos/favicon, served at /assets/
const LEAD_WEBHOOK_URL = process.env.LEAD_WEBHOOK_URL || "";
const LEAD_NOTICE_VERSION = process.env.LEAD_NOTICE_VERSION || "2026-09";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json" };
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
const MAX_CONCURRENT = +(process.env.MAX_CONCURRENT_SCANS || 2);
const MAX_WAITING = 10;
const CACHE_MS = 60 * 60 * 1000;
const BODY_LIMIT = 8192;

if (TOKEN && TOKEN.length < 32) { console.error("SCANNER_TOKEN must be 32+ chars (openssl rand -hex 32)."); process.exit(1); }
if (!TOKEN && !TURNSTILE_SECRET) console.warn("[scanner] No SCANNER_TOKEN and no TURNSTILE_SECRET set — the endpoint is UNPROTECTED. Set at least one.");

const tokenHash = TOKEN ? crypto.createHash("sha256").update(TOKEN).digest() : null;
function bearerOk(req) {
  if (!tokenHash) return false;
  const got = crypto.createHash("sha256").update((req.headers.authorization || "").replace(/^Bearer /, "")).digest();
  return crypto.timingSafeEqual(got, tokenHash);
}
async function turnstileOk(token, ip) {
  if (!TURNSTILE_SECRET) return false;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: TURNSTILE_SECRET, response: String(token) });
    if (ip) body.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(8000) });
    return !!(await r.json()).success;
  } catch { return false; }
}
const originAllowed = origin => ALLOWED_ORIGINS.length === 0 || (origin && ALLOWED_ORIGINS.includes(origin));

function normalise(input) {
  let s = String(input || "").trim();
  if (!s) throw new Error("Enter a website address.");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^https?:\/\//i.test(s)) throw new Error("Only http and https websites can be scanned.");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u; try { u = new URL(s); } catch { throw new Error("That doesn't look like a website address."); }
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http and https websites can be scanned.");
  if (u.port && !["80", "443"].includes(u.port)) throw new Error("Only standard web ports can be scanned.");
  if (u.username || u.password) throw new Error("Remove the username or password from the address.");
  const h = u.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.(local|internal|localhost))$/i.test(h) || (net.isIP(h) && isPrivateIp(h))) throw new Error("This address isn't a public website.");
  u.hash = "";
  return u;
}

const cache = new Map();
let running = 0; const waiting = [];
async function slot(fn) {
  if (running >= MAX_CONCURRENT) {
    if (waiting.length >= MAX_WAITING) throw Object.assign(new Error("The scanner is busy. Try again in a minute."), { status: 503 });
    await new Promise(r => waiting.push(r));
  }
  running++;
  try { return await fn(); } finally { running--; const n = waiting.shift(); if (n) n(); }
}

function corsHeaders(origin) {
  const h = { "content-type": "application/json" };
  if (originAllowed(origin) && origin) {
    h["access-control-allow-origin"] = origin;
    h["vary"] = "Origin";
    h["access-control-allow-headers"] = "content-type, authorization";
    h["access-control-allow-methods"] = "POST, OPTIONS";
  }
  return h;
}
const send = (res, code, obj, origin) => { res.writeHead(code, corsHeaders(origin)); res.end(JSON.stringify(obj)); };
const readBody = req => new Promise((resolve, reject) => {
  let body = ""; req.on("data", c => { body += c; if (body.length > BODY_LIMIT) req.destroy(new Error("body too large")); });
  req.on("end", () => resolve(body)); req.on("error", reject);
});

// Serve a file from a base dir, safely (no path traversal).
function serveStatic(res, baseDir, relPath) {
  const clean = decodeURIComponent(relPath.split("?")[0]).replace(/\\/g, "/");
  const full = path.normalize(path.join(baseDir, clean));
  if (!full.startsWith(path.normalize(baseDir))) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": MIME[path.extname(full).toLowerCase()] || "application/octet-stream" });
    res.end(buf);
  });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function handleLead(payload) {
  const lead = {
    name: str(payload.name, 100), email: str(payload.email, 200).toLowerCase(), company: str(payload.company, 150),
    website: str(payload.website, 200), phone: str(payload.phone, 30), message: str(payload.message, 1000),
    interest: str(payload.interest, 40), marketingConsent: payload.marketingConsent === true,
    marketingConsentText: payload.marketingConsent === true ? str(payload.marketingConsentText, 300) : "",
    privacyNoticeVersion: LEAD_NOTICE_VERSION,
    scanSummary: payload.scanSummary && typeof payload.scanSummary === "object" ? payload.scanSummary : null,
    submittedAt: new Date().toISOString(),
  };
  if (!lead.name) throw Object.assign(new Error("Enter your name."), { status: 400 });
  if (!EMAIL.test(lead.email)) throw Object.assign(new Error("Enter a valid work email."), { status: 400 });
  if (!LEAD_WEBHOOK_URL) {
    if (!DEV) throw Object.assign(new Error("Enquiries aren't switched on yet. Please email us."), { status: 503 });
    console.log("[lead] (dev, no LEAD_WEBHOOK_URL)", JSON.stringify(lead));
    return { ok: true };
  }
  const headers = { "content-type": "application/json" };
  if (process.env.LEAD_WEBHOOK_SECRET) headers["x-kensara-secret"] = process.env.LEAD_WEBHOOK_SECRET;
  const r = await fetch(LEAD_WEBHOOK_URL, { method: "POST", headers, body: JSON.stringify(lead), signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw Object.assign(new Error("Couldn't send your details just now. Please email us."), { status: 502 });
  return { ok: true };
}

http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") { res.writeHead(204, corsHeaders(origin)); return res.end(); }
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, running, waiting: waiting.length, dev: DEV }, origin);

  // Frontends, served at /consent/ and /gap/ (same origin as the API).
  if (req.method === "GET" && req.url === "/consent") { res.writeHead(301, { location: "/consent/" }); return res.end(); }
  if (req.method === "GET" && req.url.startsWith("/consent/")) {
    const rel = req.url.slice("/consent/".length) || "index.html";
    return serveStatic(res, CONSENT_DIR, rel === "" ? "index.html" : rel);
  }
  if (req.method === "GET" && req.url === "/gap") { res.writeHead(301, { location: "/gap/" }); return res.end(); }
  if (req.method === "GET" && req.url.startsWith("/gap/")) {
    const rel = req.url.slice("/gap/".length) || "index.html";
    return serveStatic(res, GAP_DIR, rel === "" ? "index.html" : rel);
  }
  if (req.method === "GET" && req.url.startsWith("/assets/")) {
    return serveStatic(res, ASSETS_DIR, req.url.slice("/assets/".length));
  }
  // DEV ONLY: throwaway test UI at "/".
  if (DEV && req.method === "GET" && (req.url === "/" || req.url === "/index.html" || req.url === "/test")) {
    return fs.readFile(TEST_PAGE, (err, buf) => { if (err) { res.writeHead(404); return res.end("test UI not found"); } res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(buf); });
  }

  if (req.method === "POST" && (req.url === "/scan" || req.url === "/lead")) {
    let payload;
    try { payload = JSON.parse((await readBody(req)) || "{}"); } catch { return send(res, 400, { error: "Invalid request." }, origin); }
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    const authed = DEV || bearerOk(req) || (originAllowed(origin) && await turnstileOk(payload.turnstileToken, ip));
    if (!authed) return send(res, 401, { error: "Unauthorised" }, origin);
    try {
      if (req.url === "/lead") return send(res, 200, await handleLead(payload), origin);
      const url = normalise(payload.url);
      const hit = cache.get(url.hostname);
      if (hit && Date.now() - hit.at < CACHE_MS) return send(res, 200, { ...hit.result, cached: true }, origin);
      const result = await slot(() => scan(url));
      if (!result.incomplete) { cache.set(url.hostname, { at: Date.now(), result }); if (cache.size > 500) cache.delete(cache.keys().next().value); }
      return send(res, 200, result, origin);
    } catch (e) {
      return send(res, e.status || 400, { error: e.status ? e.message : (e.message || "Request failed.") }, origin);
    }
  }
  return send(res, 404, { error: "Not found" }, origin);
}).listen(PORT, () => console.log(`Kensara deep scanner on :${PORT}${DEV ? " (dev: consent UI at /consent/, test UI at /)" : ""}`));
