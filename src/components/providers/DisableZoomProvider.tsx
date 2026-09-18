"use client";

import { useEffect } from "react";

/**
 * Global provider to strictly disable unwanted viewport zoom-in and zoom-out
 * (pinch-to-zoom, iOS Safari gesture zoom, double-tap zoom, and Ctrl+Wheel zoom).
 */
export function DisableZoomProvider() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    // 1. Prevent Safari gesture pinch zooming (gesturestart, gesturechange, gestureend)
    const handleGesture = (e: Event) => {
      e.preventDefault();
    };

    // 2. Prevent multi-touch pinch-to-zoom on mobile touchscreens
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    // 3. Prevent double-tap to zoom
    let lastTouchEnd = 0;
    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    // 4. Prevent Ctrl + Wheel zoom on desktops / trackpads
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    // 5. Prevent Ctrl + '+', Ctrl + '-', Ctrl + '0' keyboard zoom
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "0")
      ) {
        e.preventDefault();
      }
    };

    // Register event listeners with non-passive flag where preventDefault is required
    document.addEventListener("gesturestart", handleGesture, { passive: false });
    document.addEventListener("gesturechange", handleGesture, { passive: false });
    document.addEventListener("gestureend", handleGesture, { passive: false });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: false });
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("gesturestart", handleGesture);
      document.removeEventListener("gesturechange", handleGesture);
      document.removeEventListener("gestureend", handleGesture);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
