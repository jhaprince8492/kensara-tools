// Stand-in for an advertising pixel (e.g. Meta Pixel). Only runs after "Advertising" consent.
window.__kdemo = window.__kdemo || {};
window.__kdemo.marketing = true;
document.cookie = "_fbp_demo=fb.1." + Date.now() + "; max-age=3600; path=/";
try { localStorage.setItem("_fbq_demo", "1"); } catch (e) {}
document.dispatchEvent(new Event("kdemo:update"));
