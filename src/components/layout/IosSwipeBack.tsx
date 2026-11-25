"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isIOSDevice, isStandalonePwa } from "@/lib/platform";
import { isRootRoute } from "@/lib/navigation/hierarchy";
import { useBackNavigation } from "@/lib/navigation/useBackNavigation";

const BLOCKED_SWIPE_BACK_PATTERNS = [
  /^\/tests\/[^/]+\/attempt/,
  /^\/live-class/,
  /^\/watch/,
  /^\/classroom/,
  /^\/practice-board/,
];

function shouldIgnoreSwipeTarget(target: EventTarget | null): boolean {
  let el = target instanceof HTMLElement ? target : null;
  while (el) {
    const tag = el.tagName;
    if (
      tag === "CANVAS" ||
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      tag === "VIDEO" ||
      el.hasAttribute("data-no-swipe-back") ||
      el.getAttribute("role") === "slider"
    ) {
      return true;
    }
    if (el.scrollWidth > el.clientWidth + 2) {
      const style = window.getComputedStyle(el);
      if (style.overflowX === "auto" || style.overflowX === "scroll") {
        return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * Enables native-feeling left-edge swipe-back on iPhone/iPad when running
 * as an installed Home Screen PWA (where iOS disables Safari's built-in
 * swipe-back gesture). Disabled on root tabs, active exams/live classes,
 * video players, canvases, and horizontally scrollable containers.
 */
export function IosSwipeBack() {
  const pathname = usePathname();
  const { goBack } = useBackNavigation();
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    if (!isIOSDevice() || !isStandalonePwa()) return;
    if (isRootRoute(pathname)) return;
    if (BLOCKED_SWIPE_BACK_PATTERNS.some((re) => re.test(pathname))) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (!t || t.clientX > 28) return;
      if (shouldIgnoreSwipeTarget(e.target)) return;
      touchStart.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    };

    const onTouchEnd = (e: TouchEvent) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (!start || e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);
      const dt = Date.now() - start.time;
      if (dx > 72 && dy < 48 && dt < 600) {
        void goBack();
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pathname, goBack]);

  return null;
}
