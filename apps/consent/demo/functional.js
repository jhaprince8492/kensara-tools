// Stand-in for a live chat widget. Only runs after "Functional" consent.
window.__kdemo = window.__kdemo || {};
window.__kdemo.functional = true;
document.cookie = "chat_demo_id=" + Date.now() + "; max-age=3600; path=/";
var b = document.createElement("div");
b.className = "chat"; b.textContent = "💬 Chat with us";
document.body.appendChild(b);
document.dispatchEvent(new Event("kdemo:update"));
