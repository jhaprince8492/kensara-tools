// Drives the "Behind the scenes" panel and receives the banner config from the generator page.
(function () {
  var KEY = "kensara_demo_config";
  var LABELS = { functional: "Functional (chat widget)", analytics: "Analytics tag", marketing: "Advertising pixel + video" };
  // Demo trackers' own cookies/storage, so withdrawal visibly clears them too.
  var DEMO_CLEAR = {
    cookies: [{ name: "_ga_demo", category: "analytics" }, { name: "_fbp_demo", category: "marketing" }, { name: "chat_demo_id", category: "functional" }],
    storage: [{ key: "_ga_demo_session", category: "analytics" }, { key: "_fbq_demo", category: "marketing" }]
  };

  function start(cfg) {
    cfg.clearAlso = DEMO_CLEAR;
    window.KensaraConsent.init(cfg, { mode: "demo" });
    paint();
  }
  function paint() {
    var ul = document.getElementById("status"), s = window.__kdemo || {};
    var cfg; try { cfg = JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) { cfg = {}; }
    ul.innerHTML = "";
    Object.keys(LABELS).forEach(function (c) {
      var li = document.createElement("li"), on = !!s[c];
      var used = cfg.categories && cfg.categories[c] && cfg.categories[c].enabled;
      li.innerHTML = "<span></span><span></span>";
      li.firstChild.textContent = LABELS[c];
      li.lastChild.textContent = !used ? "Not used" : on ? "Running" : "Blocked";
      li.lastChild.className = on ? "on" : used ? "off" : "muted";
      ul.appendChild(li);
    });
    document.getElementById("cookies").textContent = document.cookie || "(none)";
    var keys = []; try { for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); } catch (e) {}
    document.getElementById("storage").textContent = keys.length ? keys.join(", ") : "(none)";
    var f = document.querySelector("iframe[data-consent]");
    document.getElementById("video-note").hidden = !!f.getAttribute("src");
  }
  document.addEventListener("kdemo:update", paint);
  document.addEventListener("kensara:consent", function () { setTimeout(paint, 50); });
  setInterval(paint, 1500);

  document.getElementById("reload").onclick = function () { location.reload(); };
  document.getElementById("reset").onclick = function () {
    try { localStorage.clear(); } catch (e) {}
    document.cookie.split(";").forEach(function (kv) { var n = kv.split("=")[0].trim(); if (n) document.cookie = n + "=; Max-Age=0; path=/"; });
    location.reload();
  };
  document.getElementById("footer-choices").onclick = function (e) { e.preventDefault(); window.KensaraConsent.open(); };

  // Config arrives from the generator (same origin only) and is kept for reloads in this tab.
  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== "kensara-demo-config") return;
    var prev = sessionStorage.getItem(KEY), next = JSON.stringify(e.data.config);
    sessionStorage.setItem(KEY, next);
    if (prev && prev !== next) location.reload(); else if (!prev) start(e.data.config);
  });
  var saved = sessionStorage.getItem(KEY);
  if (saved) start(JSON.parse(saved));
  else if (window.parent !== window) window.parent.postMessage({ type: "kensara-demo-ready" }, location.origin);
  else document.querySelector(".hero p").textContent = "Open this page from the Kensara banner generator to see your banner here.";
})();
