// Stand-in for an analytics tag (e.g. Google Analytics). Only runs after "Analytics" consent.
window.__kdemo = window.__kdemo || {};
window.__kdemo.analytics = true;
document.cookie = "_ga_demo=GA1.1." + Date.now() + "; max-age=3600; path=/";
try { localStorage.setItem("_ga_demo_session", String(Date.now())); } catch (e) {}
document.dispatchEvent(new Event("kdemo:update"));
