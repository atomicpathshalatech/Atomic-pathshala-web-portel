"use client";

import { useEffect } from "react";

/**
 * Global provider to disable iOS Safari gesture pinch zoom
 * without ever interfering with native touch scrolling or taps.
 */
export function DisableZoomProvider() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const handleGesture = (e: Event) => {
      e.preventDefault();
    };

    // Only iOS Safari specific gesture events for pinch-zoom
    document.addEventListener("gesturestart", handleGesture);
    document.addEventListener("gesturechange", handleGesture);

    return () => {
      document.removeEventListener("gesturestart", handleGesture);
      document.removeEventListener("gesturechange", handleGesture);
    };
  }, []);

  return null;
}

