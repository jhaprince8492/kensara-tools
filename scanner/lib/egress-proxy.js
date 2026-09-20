// Egress proxy for the scanner's Chromium. ALL browser traffic (http, https, ws, wss)
// goes through here. Each connection: resolve DNS once -> reject non-public IPs ->
// connect to that exact IP. Because the checked IP is the IP we connect to, DNS
// rebinding has no window, and nothing the page does can reach a private address.
const http = require("http");
const net = require("net");
const dns = require("dns").promises;

const ALLOWED_PORTS = new Set([80, 443]);

// ---- IP classification ------------------------------------------------------
function v4ToInt(ip) { return ip.split(".").reduce((a, o) => (a << 8) + +o, 0) >>> 0; }
const V4_BLOCK = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12",
  "192.0.0.0/24", "192.0.2.0/24", "192.88.99.0/24", "192.168.0.0/16", "198.18.0.0/15",
  "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
].map(c => { const [b, n] = c.split("/"); const m = +n === 0 ? 0 : (~0 << (32 - +n)) >>> 0; return [v4ToInt(b) & m, m]; });
const v4Private = ip => V4_BLOCK.some(([b, m]) => (v4ToInt(ip) & m) === b);

// Expand an IPv6 string to 8 16-bit groups (handles ::, and embedded dotted IPv4).
function v6Groups(ip) {
  let s = ip.toLowerCase().split("%")[0];
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) { const n = v4ToInt(dotted[1]); s = s.slice(0, -dotted[1].length) + (n >>> 16).toString(16) + ":" + (n & 0xffff).toString(16); }
  const [head, tail] = s.split("::");
  const h = head ? head.split(":") : [], t = tail !== undefined && tail ? tail.split(":") : [];
  const fill = tail !== undefined ? Array(8 - h.length - t.length).fill("0") : [];
  return [...h, ...fill, ...t].map(x => parseInt(x || "0", 16));
}
const groupsToV4 = (a, b) => [a >> 8, a & 255, b >> 8, b & 255].join(".");

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) return v4Private(ip);
  if (!net.isIPv6(ip)) return true;                                   // unknown -> deny
  const g = v6Groups(ip);
  if (g.every(x => x === 0)) return true;                             // ::
  if (g.slice(0, 7).every(x => x === 0) && g[7] === 1) return true;   // ::1
  if (g.slice(0, 5).every(x => x === 0) && g[5] === 0xffff) return v4Private(groupsToV4(g[6], g[7])); // ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) return true;                  // NAT64 64:ff9b::/96 (and /48 local-use)
  if (g[0] === 0x2002) return true;                                   // 6to4 (embeds arbitrary IPv4)
  if (g[0] === 0x2001 && g[1] === 0) return true;                     // Teredo
  if ((g[0] & 0xfe00) === 0xfc00) return true;                        // fc00::/7 unique-local
  if ((g[0] & 0xffc0) === 0xfe80) return true;                        // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true;                        // multicast
  if (g[0] === 0x2001 && g[1] === 0xdb8) return true;                 // documentation
  return false;
}

// ---- Proxy ------------------------------------------------------------------
function createEgressProxy({ lookup = (h) => dns.lookup(h, { all: true }), testPublicIps = [], log = () => {} } = {}) {
  const exempt = new Set(testPublicIps); // TEST ONLY: lets a harness treat one loopback IP as "public"

  async function resolvePublic(host, port) {
    if (!ALLOWED_PORTS.has(port)) throw new Error(`port ${port} not allowed`);
    const h = host.replace(/^\[|\]$/g, "");
    const addrs = net.isIP(h) ? [{ address: h }] : await lookup(h);
    if (!addrs.length) throw new Error("no address");
    // Every answer must be public, otherwise refuse (prevents mixed public/private answers).
    for (const a of addrs) if (isPrivateIp(a.address) && !exempt.has(a.address)) throw new Error(`blocked ${h} -> ${a.address}`);
    return addrs[0].address; // connect to exactly the address we checked
  }

  const server = http.createServer(async (req, res) => {         // plain http:// requests
    try {
      const u = new URL(req.url);
      const ip = await resolvePublic(u.hostname, +(u.port || 80));
      const up = http.request({ host: ip, port: u.port || 80, method: req.method, path: u.pathname + u.search,
        headers: { ...req.headers, host: u.host } }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
      up.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
      req.pipe(up);
    } catch (e) { log("DENY " + req.url + " : " + e.message); res.writeHead(403, { "x-kensara-egress": "denied" }); res.end(); }
  });

  server.on("connect", async (req, sock, head) => {              // https:// and ws(s):// tunnels
    const [host, port] = splitHostPort(req.url);
    try {
      const ip = await resolvePublic(host, port);
      const up = net.connect(port, ip, () => { sock.write("HTTP/1.1 200 Connection Established\r\n\r\n"); up.write(head); up.pipe(sock); sock.pipe(up); });
      up.on("error", () => sock.destroy()); sock.on("error", () => up.destroy());
    } catch (e) { log("DENY CONNECT " + req.url + " : " + e.message); sock.end("HTTP/1.1 403 Forbidden\r\n\r\n"); }
  });
  server.on("upgrade", (req, sock) => sock.end("HTTP/1.1 403 Forbidden\r\n\r\n"));
  return server;
}
function splitHostPort(s) { const m = s.match(/^\[?([^\]]+?)\]?:(\d+)$/); return m ? [m[1], +m[2]] : [s, 443]; }

module.exports = { createEgressProxy, isPrivateIp };
