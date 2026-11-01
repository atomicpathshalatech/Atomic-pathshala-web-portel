"use client";

import { useEffect, useState } from "react";
import { browserPushReady, browserPushSupported, registerBrowserPush } from "@/lib/notifications/webPushClient";
import { getDesktopBridge } from "@/lib/desktop/bridge";
import { isNativeApp } from "@/lib/platform";

const DISMISS_KEY = "atomic_push_prompt_dismissed_at";
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Browser push on the website (Chrome / Edge / Firefox, and an iPhone once
 * the site is added to the Home Screen): a small bar asking to turn on
 * notifications for classes, tests and notices. The Android app (its own
 * push) and the Windows app (Windows notifications) never show it.
 * Already allowed: the subscription is renewed quietly on each visit.
 */
export function EnablePushPrompt() {
  const [mode, setMode] = useState<"hidden" | "ask" | "ios-home-screen">("hidden");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (isNativeApp() || getDesktopBridge()) return;
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (Date.now() - at < DISMISS_FOR_MS) return;
    } catch {
      // storage unavailable: just ask
    }
    if (!browserPushSupported()) {
      // iPhone Safari tab: push exists only for the site added to the Home Screen.
      if (isIos() && !isStandalone()) setMode("ios-home-screen");
      return;
    }
    let alive = true;
    // Only once the server has its push key (otherwise "Turn on" can't work).
    void browserPushReady().then((ready) => {
      if (!alive || !ready) return;
      if (Notification.permission === "granted") void registerBrowserPush();
      else if (Notification.permission === "default") setMode("ask");
    });
    return () => {
      alive = false;
    };
  }, []);

  if (mode === "hidden") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setMode("hidden");
  };

  const turnOn = async () => {
    setBusy(true);
    const res = await registerBrowserPush();
    setBusy(false);
    if (res.success) {
      setMode("hidden");
      return;
    }
    if (res.reason?.includes("denied")) {
      setNote("Notifications are blocked for this site. Allow them in the browser's site settings (the lock icon next to the address).");
    } else {
      setNote("Notifications couldn't be turned on right now. Please try again later.");
    }
  };

  return (
    <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-900 flex flex-wrap items-center gap-2" role="region" aria-label="Notifications">
      <span className="material-symbols-outlined text-base text-blue-600" aria-hidden>
        notifications_active
      </span>
      <span className="flex-1 min-w-[12rem]">
        {mode === "ask"
          ? "Turn on notifications to know when a class starts, a test or DPP arrives, or a class is moved."
          : "To get notifications on iPhone: tap Share → Add to Home Screen, then open Atomic Pathshala from the Home Screen."}
        {note && <span className="block mt-1 text-rose-700">{note}</span>}
      </span>
      {mode === "ask" && (
        <button type="button" onClick={turnOn} disabled={busy} className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold px-3 py-1.5">
          {busy ? "Turning on…" : "Turn on"}
        </button>
      )}
      <button type="button" onClick={dismiss} className="rounded-lg px-2 py-1.5 font-semibold text-blue-700 hover:bg-blue-100">
        Later
      </button>
    </div>
  );
}
