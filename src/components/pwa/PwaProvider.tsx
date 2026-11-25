"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isIOSDevice, isNativeApp } from "@/lib/platform";

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
 *   - takes a new version silently: no "update now" prompt and no forced reload
 *     (pages load network-first, so the next page a student opens is already
 *     the new version; a test or class on screen is never interrupted)
 *   - captures beforeinstallprompt and renders an install card that calls
 *     the browser's actual prompt() — no fake button
 */
export function PwaProvider() {
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);

  const canPrompt =
    typeof window !== "undefined" && !isNativeApp() && !isStandalone();

  const isFocusedSession =
    pathname?.startsWith("/install") ||
    pathname?.includes("/attempt") ||
    pathname?.startsWith("/live-class") ||
    pathname?.startsWith("/watch");

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
          // Activate the new worker quietly — no prompt to the student.
          sw.postMessage("SKIP_WAITING");
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

    // No reload when the new worker takes over: the page on screen (a test,
    // a live class) keeps running; the next page opened is the new version.
    const onControllerChange = () => {};
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  // --- Install prompt capture -----------------------------------------
  useEffect(() => {
    if (!canPrompt || isFocusedSession) return;

    if (isIOSDevice()) {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (!dismissedAt || Date.now() - dismissedAt >= REPROMPT_AFTER_MS) {
        const timer = setTimeout(() => setShowIosGuide(true), 2500);
        return () => clearTimeout(timer);
      }
      return;
    }

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
  }, [canPrompt, isFocusedSession]);

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
    setShowIosGuide(false);
  }, []);

  if (isFocusedSession) return null;

  if (showIosGuide) {
    return (
      <div
        role="dialog"
        aria-label="Add Atomic Pathshala to iPhone Home Screen"
        className="fixed inset-x-0 bottom-0 z-[1000] mx-auto max-w-md p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <div className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xl p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/apple-touch-icon.png"
              alt=""
              width={44}
              height={44}
              className="shrink-0 rounded-xl border border-slate-200"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">Get the iPhone App Experience</p>
              <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                Tap <span className="font-semibold text-primary">Share</span> then{" "}
                <span className="font-semibold text-slate-900">&ldquo;Add to Home Screen&rdquo;</span> for full-screen classes &amp; alerts.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Link
              href="/install"
              onClick={() => setShowIosGuide(false)}
              className="flex flex-1 min-h-[40px] items-center justify-center rounded-xl bg-primary px-3 text-xs font-bold text-white hover:bg-primary/90"
            >
              See 5-Step Guide
            </Link>
            <button
              type="button"
              onClick={later}
              className="min-h-[40px] rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!showInstall || !deferred) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Atomic Pathshala"
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
            <p className="text-sm font-bold text-slate-900">Install Atomic Pathshala</p>
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
