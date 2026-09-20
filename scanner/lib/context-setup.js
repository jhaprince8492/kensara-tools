// Shared browser-context setup so every context (main crawl + consent probes) is
// hardened and resource-trimmed identically. The egress proxy (browser-level) is the
// SSRF control; this adds the per-context routing that drops non-essential resources.
const DROP_TYPES = new Set(["image", "imageset", "media", "font", "stylesheet"]); // never needed to spot trackers

const CONTEXT_OPTS = {
  locale: "en-IN", timezoneId: "Asia/Kolkata", viewport: { width: 1366, height: 850 },
  serviceWorkers: "block", acceptDownloads: false,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 KensaraScanner/1.0",
};

async function harden(context) {
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
}

// Attach a request listener that tallies contacted hostnames into a Map.
function trackHosts(page, hosts) {
  page.on("request", r => {
    try { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol)) hosts.set(u.hostname, (hosts.get(u.hostname) || 0) + 1); } catch {}
  });
}

module.exports = { DROP_TYPES, CONTEXT_OPTS, harden, trackHosts };
