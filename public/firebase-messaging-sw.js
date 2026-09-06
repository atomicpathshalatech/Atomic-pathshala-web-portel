// Firebase Cloud Messaging Service Worker for background push delivery
/* eslint-disable no-undef */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { notification: { title: "Atomic Pathshala", body: event.data.text() } };
  }

  const notificationTitle = payload.notification?.title || payload.data?.title || "Atomic Pathshala";
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || "You have a new update.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: {
      deepLink: payload.data?.deepLink || payload.fcmOptions?.link || "/",
    },
    actions: [
      { action: "open", title: "Open" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const deepLink = event.notification.data?.deepLink || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open at the app, focus it and navigate
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(deepLink);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(deepLink);
      }
    })
  );
});
