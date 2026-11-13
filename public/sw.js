// Hearth service worker (2026-10-27, home-screen app). DELIBERATELY TINY.
//
// One job: when the installed app is opened with no signal, show a "no connection" page instead of a
// blank white screen. It caches exactly one file (offline.html) and NOTHING else: Hearth pages and API
// responses are private and always live, so no authed HTML or data is ever stored on the phone, and a
// deploy can never be hidden behind a stale cached bundle.
//
// Only top-level DOCUMENT navigations are intercepted (mode "navigate" + destination "document"). The
// library's epub reader loads chapters into blob: iframes; a broader handler could serve the offline
// page inside a book. Everything else passes straight to the network untouched.

const CACHE = "hearth-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(new Request(OFFLINE_URL, { cache: "reload" }))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate" || req.destination !== "document") return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
  );
});
