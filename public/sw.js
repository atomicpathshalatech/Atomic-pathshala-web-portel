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
 *   - push / notificationclick ARE handled here (browser push, VAPID). A
 *     site has ONE service worker per scope: a second worker at "/" (the old
 *     /firebase-messaging-sw.js) replaced this one or was replaced by it on
 *     the next page load, so pushes arrived with no handler. That file now
 *     just loads this one.
 *
 * The offline page is plain HTML written here, not the Next.js /offline
 * route: a cached Next page loads the JS chunks of the deploy it was cached
 * from, and after the next deploy those are gone ("Loading chunk … failed").
 *
 * Bump SW_VERSION on every deploy that changes caching behaviour so old
 * caches are dropped on activate.
 */
const SW_VERSION = "v1.2.0";
const RUNTIME_CACHE = `atomic-guru-runtime-${SW_VERSION}`;
const PRECACHE = `atomic-guru-precache-${SW_VERSION}`;
const OFFLINE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline · Atomic Pathshala</title></head>
<body style="margin:0;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:2rem;box-sizing:border-box;text-align:center;background:#090D16;color:#E7ECF5;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
<img src="/icons/icon-192.png" alt="Atomic Pathshala" width="72" height="72" style="border-radius:16px">
<h1 style="font-size:1.15rem;font-weight:700;margin:0">You are offline. Please check your internet connection.</h1>
<p style="font-size:.9rem;opacity:.7;margin:0;max-width:22rem">Atomic Pathshala needs a connection to load your classes, tests and doubts. This page reloads by itself once you're back online.</p>
<button onclick="location.reload()" style="margin-top:.5rem;padding:.6rem 1.4rem;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#E7ECF5;font-weight:600;font-size:.9rem;cursor:pointer">Try again</button>
<script>addEventListener("online",function(){location.reload()})</script>
</body></html>`;

const PRECACHE_URLS = [
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
    return new Response(OFFLINE_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 503,
    });
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

// ---- Browser push (VAPID, see src/lib/notifications/webPushServer.ts) -------
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { title: "Atomic Pathshala", body: event.data.text() } };
  }
  const n = payload.notification || {};
  const data = payload.data || n.data || {};
  const title = n.title || data.title || payload.title || "Atomic Pathshala";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: n.body || data.body || payload.body || "You have a new update.",
      icon: n.icon || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.notificationId || undefined,
      data: { deepLink: data.deepLink || payload.deepLink || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.deepLink || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then((c) => (c && "navigate" in c ? c.navigate(target) : c));
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    })
  );
});
