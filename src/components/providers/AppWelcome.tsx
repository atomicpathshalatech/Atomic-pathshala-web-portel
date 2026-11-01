"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/platform";

const SHOWN_KEY = "atomic_app_welcomed";
const SHOW_MS = 2000;

/**
 * "Welcome to Atomic Pathshala" with the logo for ~2 s when the Android app
 * is started fresh. sessionStorage lives as long as the app's page: a fresh
 * start has none (welcome shows), coming back to an app that was only in the
 * background keeps it (no welcome — the student resumes where they were).
 */
export function AppWelcome() {
  const [phase, setPhase] = useState<"off" | "on" | "leaving">("off");

  useEffect(() => {
    if (!isNativeApp()) return;
    try {
      if (sessionStorage.getItem(SHOWN_KEY)) return;
      sessionStorage.setItem(SHOWN_KEY, "1");
    } catch {
      // storage unavailable: show it once for this load
    }
    setPhase("on");
    const leave = setTimeout(() => setPhase("leaving"), SHOW_MS);
    const done = setTimeout(() => setPhase("off"), SHOW_MS + 300);
    return () => {
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, []);

  if (phase === "off") return null;
  return (
    <div
      className={`fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-5 bg-[#090D16] transition-opacity duration-300 ${phase === "leaving" ? "opacity-0" : "opacity-100"}`}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, shown before anything else loads */}
      <img src="/brand/logo.png" alt="" className="w-24 h-24 object-contain animate-in zoom-in-90 fade-in duration-500" />
      <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-700">
        <p className="text-white/70 text-sm font-semibold tracking-wide">Welcome to</p>
        <p className="text-white text-2xl font-black tracking-tight">Atomic Pathshala</p>
      </div>
    </div>
  );
}
