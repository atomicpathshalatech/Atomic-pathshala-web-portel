"use client";

import React, { useEffect, useState } from "react";
import { isNativeApp, isAndroid } from "@/lib/platform";
import {
  checkOverlayPermission,
  requestOverlayPermission,
} from "@/lib/platform/floating-poll";

const STORAGE_KEY = "atomic_overlay_prompt_seen";

export function FloatingPollPermissionPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!isNativeApp() || !isAndroid()) return;

    async function evaluatePermission() {
      const granted = await checkOverlayPermission();
      if (!granted) {
        // Only prompt if not already dismissed or not yet granted
        const seen = localStorage.getItem(STORAGE_KEY);
        if (!seen) {
          // Delay by 1.5s so splash/welcome screen clears first
          setTimeout(() => setShowPrompt(true), 1500);
        }
      }
    }

    evaluatePermission();

    // Check again when user returns from Android system settings
    const onFocus = async () => {
      const granted = await checkOverlayPermission();
      if (granted) {
        setShowPrompt(false);
        localStorage.setItem(STORAGE_KEY, "granted");
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("app:foreground", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("app:foreground", onFocus);
    };
  }, []);

  if (!showPrompt) return null;

  const handleGrantClick = async () => {
    setIsVerifying(true);
    await requestOverlayPermission();
    localStorage.setItem(STORAGE_KEY, "prompted");
    setTimeout(() => setIsVerifying(false), 2000);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem(STORAGE_KEY, "dismissed");
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[#11131f] border-2 border-blue-500/80 rounded-2xl shadow-2xl p-5 text-white flex flex-col gap-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/40">
            <span className="material-symbols-outlined text-xl">picture_in_picture_alt</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">One-Time Setup</span>
            <h3 className="text-sm font-bold text-white leading-tight">Enable Live Polls Over YouTube</h3>
          </div>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed">
          Jab aap live class directly <strong>YouTube</strong> par dekh rahe honge, tab bhi Teacher ke polls aapki screen par floating card me aayenge!
        </p>

        <p className="text-[11px] text-gray-400">
          Iske liye Android ki <strong>&apos;Display over other apps&apos;</strong> permission ek baar allow karni hoti hai.
        </p>

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={handleGrantClick}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>
            <span>{isVerifying ? "Opening Settings…" : "Allow Permission Now"}</span>
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-2 rounded-xl text-gray-400 hover:text-white text-xs font-medium transition cursor-pointer"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
