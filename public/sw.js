/*
 * Atomic Pathshala — PWA service worker.
 *
 * Scope: "/" (the whole site). Deliberately conservative:
 *   - /api/*  is NEVER cached (auth, tests, results, payments, personal
 *     data always come fresh from the authenticated backend).
 *   - navigations are network-first, falling back to a static offline page
 *     — a stale HTML shell is never shown as if it were live.
 *   - only content-hashed static assets (/_next/static, /icons, /brand,
 *     fonts) get a stale-while-revalidate cache.
 *   - push / notificationclick are intentionally NOT handled here — Firebase
 *     Cloud Messaging's own worker (/firebase-messaging-sw.js) owns those.
 *
 * Bump SW_VERSION on every deploy that changes caching behaviour so old
 * caches are dropped on activate.
 */
const SW_VERSION = "v1.0.0";
const RUNTIME_CACHE = `atomic-guru-runtime-${SW_VERSION}`;
const PRECACHE = `atomic-guru-precache-${SW_VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await cache.addAll(PRECACHE_URLS).catch(() => {});
      // New SW waits until the page tells it to take over (see message
      // handler) so an in-progress test/video isn't reloaded from under
      // the student mid-action.
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("atomic-guru-") && !k.endsWith(SW_VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".ttf")
  );
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok && (res.type === "basic" || res.type === "cors")) {
        cache.put(request, res.clone());
      }
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

async function networkFirstNavigation(request) {
  try {
    const res = await fetch(request);
    return res;
  } catch {
    const cache = await caches.open(PRECACHE);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ||
      new Response(
        "<!doctype html><meta charset=utf-8><title>Offline</title><body style=\"font-family:system-ui;padding:2rem;text-align:center\">You are offline. Please check your internet connection.</body>",
        { headers: { "Content-Type": "text/html" }, status: 503 }
      )
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is ever cacheable; everything else goes straight to network.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Never touch the FCM worker or its scope.
  if (url.pathname === "/firebase-messaging-sw.js" || url.pathname.startsWith("/firebase-cloud-messaging")) {
    return;
  }

  // Never cache the API — auth, tests, results, payments, personal data.
  if (url.pathname.startsWith("/api/")) {
    return; // default browser network handling
  }

  // Auth endpoints / next-auth — always live.
  if (url.pathname.startsWith("/api/auth") || url.pathname.includes("/_next/data/")) {
    return;
  }

  // HTML navigations: network-first, offline page as the only fallback.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Content-hashed static assets: fast, safe to cache.
  if (url.origin === self.location.origin && isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Cross-origin fonts (Google Fonts static files) — cache-first, best effort.
  if (url.hostname === "fonts.gstatic.com") {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Everything else: plain network (no caching).
});
