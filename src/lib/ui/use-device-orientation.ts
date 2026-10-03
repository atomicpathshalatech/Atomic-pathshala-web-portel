"use client";

import { useEffect } from "react";

/**
 * Puts `orient-landscape` / `orient-portrait` on <html> from how the DEVICE is
 * held — the Tailwind `ls:` / `pt:` variants read it (tailwind.config.ts).
 *
 * The CSS `orientation` media query (Tailwind's `landscape:` / `portrait:`)
 * compares the viewport's width and height, and an open phone keyboard makes
 * the viewport shorter than it is wide: a phone held upright "became
 * landscape" the moment the student tapped the chat box — the video shrank
 * and the chat jumped to the side. On a touch device this follows the screen
 * itself, which a keyboard never changes; with a mouse (a desktop window) it
 * keeps following the window's shape.
 */
function deviceIsLandscape(): boolean {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (!touch) return window.innerWidth > window.innerHeight;
  const type = window.screen?.orientation?.type;
  if (type) return type.startsWith("landscape");
  const legacy = (window as unknown as { orientation?: number }).orientation;
  if (typeof legacy === "number") return Math.abs(legacy) === 90;
  return window.screen.width > window.screen.height;
}

export function useDeviceOrientationClass(): void {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const landscape = deviceIsLandscape();
      root.classList.toggle("orient-landscape", landscape);
      root.classList.toggle("orient-portrait", !landscape);
    };
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    window.screen?.orientation?.addEventListener?.("change", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      window.screen?.orientation?.removeEventListener?.("change", apply);
    };
  }, []);
}
