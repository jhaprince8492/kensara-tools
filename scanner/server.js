// Kensara deep scanner HTTP service. Runs on its own box (AWS), never on Vercel.
// Auth is either a shared bearer token (server-to-server) OR a Cloudflare Turnstile
// token + allowed Origin (browser-direct), so the tools can call it whichever way.
const http = require("http");
const crypto = require("crypto");
const net = require("net");
const { scan } = require("./lib/scanner");
const { isPrivateIp } = require("./lib/egress-proxy");

const PORT = +(process.env.PORT || 8080);
const TOKEN = process.env.SCANNER_TOKEN || "";
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || "";
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

http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") { res.writeHead(204, corsHeaders(origin)); return res.end(); }
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, running, waiting: waiting.length }, origin);
  if (req.method !== "POST" || req.url !== "/scan") return send(res, 404, { error: "Not found" }, origin);

  let body = "";
  req.on("data", c => { body += c; if (body.length > BODY_LIMIT) req.destroy(); });
  req.on("end", async () => {
    try {
      const payload = JSON.parse(body || "{}");
      // Auth: bearer token OR (Turnstile token + allowed origin).
      const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
      const ok = bearerOk(req) || (originAllowed(origin) && await turnstileOk(payload.turnstileToken, ip));
      if (!ok) return send(res, 401, { error: "Unauthorised" }, origin);

      const url = normalise(payload.url);
      const key = url.hostname;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < CACHE_MS) return send(res, 200, { ...hit.result, cached: true }, origin);
      const result = await slot(() => scan(url));
      if (!result.incomplete) { cache.set(key, { at: Date.now(), result }); if (cache.size > 500) cache.delete(cache.keys().next().value); }
      send(res, 200, result, origin);
    } catch (e) {
      send(res, e.status || 400, { error: e.status ? e.message : (e.message || "Scan failed.") }, origin);
    }
  });
}).listen(PORT, () => console.log(`Kensara deep scanner on :${PORT}`));
