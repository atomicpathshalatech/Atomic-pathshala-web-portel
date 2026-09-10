"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { isNativeApp } from "@/lib/platform";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "ag_pwa_install_dismissed_at";
const REPROMPT_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Owns the PWA lifecycle on the web:
 *   - registers /sw.js (never inside the Capacitor WebView, never on http)
 *   - surfaces a real "New version available" prompt when a new SW is waiting
 *   - captures beforeinstallprompt and renders an install card that calls
 *     the browser's actual prompt() — no fake button
 */
export function PwaProvider() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);

  const canPrompt =
    typeof window !== "undefined" && !isNativeApp() && !isStandalone();

  // --- Service worker registration + update handling --------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isNativeApp()) return; // Capacitor manages its own WebView caching
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "https:" && location.hostname !== "localhost") return;

    let cancelled = false;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (cancelled) return;

        function trackWaiting(sw: ServiceWorker | null) {
          if (!sw) return;
          waitingRef.current = sw;
          // Only tell the user about an update if a controller already
          // exists (i.e. this isn't the very first install).
          if (navigator.serviceWorker.controller) {
            toast("New version available.", {
              duration: Infinity,
              id: "pwa-update",
              action: {
                label: "Update Now",
                onClick: () => {
                  waitingRef.current?.postMessage("SKIP_WAITING");
                },
              },
            });
          }
        }

        trackWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed") trackWaiting(reg.waiting ?? installing);
          });
        });
      })
      .catch((err) => {
        console.warn("[pwa] service worker registration failed:", err);
      });

    // When the new SW takes control, reload once so the fresh assets load.
    let refreshed = false;
    const onControllerChange = () => {
      if (refreshed) return;
      refreshed = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  // --- Install prompt capture -----------------------------------------
  useEffect(() => {
    if (!canPrompt) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissedAt && Date.now() - dismissedAt < REPROMPT_AFTER_MS) return;
      setDeferred(e as BeforeInstallPromptEvent);
      setShowInstall(true);
    };
    const onInstalled = () => {
      setShowInstall(false);
      setDeferred(null);
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [canPrompt]);

  const install = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      setShowInstall(false);
      setDeferred(null);
    }
  }, [deferred]);

  const later = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShowInstall(false);
  }, []);

  if (!showInstall || !deferred) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Atomic Guru"
      className="fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-md p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            width={44}
            height={44}
            className="shrink-0 rounded-xl"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">Install Atomic Guru</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Get faster access to your classes, tests and doubts.
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={install}
            className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            Install App
          </button>
          <button
            type="button"
            onClick={later}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
