"use client";

import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { isNativeApp } from "@/lib/platform";

const SNOOZE_KEY = "atomic_update_snoozed";

/** 1.0.10 > 1.0.9 — numeric, part by part. */
function newer(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

/**
 * The Android app is installed from an APK, which never updates itself:
 * when a newer build is published, say so and offer it. The link is the
 * file in storage (outside the app's own site), so Android opens it in the
 * browser and downloads it — works on old app versions too. "Later" waits
 * a day.
 */
export function AppUpdatePrompt() {
  const [update, setUpdate] = useState<{ version: string; url: string } | null>(null);

  useEffect(() => {
    if (!isNativeApp()) return;
    let alive = true;
    (async () => {
      try {
        const snoozed = Number(localStorage.getItem(SNOOZE_KEY) || 0);
        if (Date.now() < snoozed) return;
      } catch {
        // no storage: just check
      }
      const [info, res] = await Promise.all([App.getInfo(), fetch("/api/apps/releases", { cache: "no-store" })]);
      const json = await res.json().catch(() => null);
      const latest = json?.data?.android as { version?: string; url?: string } | null;
      if (alive && latest?.version && latest.url && newer(latest.version, info.version)) setUpdate({ version: latest.version, url: latest.url });
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!update) return null;

  const later = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    } catch {
      // ignore
    }
    setUpdate(null);
  };

  return (
    <div className="fixed inset-x-3 bottom-24 z-[940] mx-auto max-w-sm rounded-2xl bg-slate-900 p-4 text-white shadow-2xl" role="dialog" aria-label="App update">
      <p className="text-sm font-black">New version {update.version} is available</p>
      <p className="mt-0.5 text-xs text-white/70">Smoother app, fixes for screen fit, full screen and more. Download it and tap Install.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={later} className="flex-1 rounded-xl border border-white/20 py-2 text-xs font-bold">
          Later
        </button>
        <a href={update.url} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-xl bg-blue-600 py-2 text-center text-xs font-bold">
          Update now
        </a>
      </div>
    </div>
  );
}
