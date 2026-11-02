"use client";

import { useEffect, useRef, useState } from "react";
import { isNativeApp } from "@/lib/platform";

const TRIGGER_PX = 80;
const MAX_PULL_PX = 120;

/** Is this element (or a parent) a scroll area that is not at its top? Then the pull scrolls it instead. */
function insideScrolledArea(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.scrollTop > 0) return true;
  }
  return false;
}

/**
 * Pull down to refresh, in the Android app (a WebView has none of its own):
 * pull at the top of a page and let go → the page reloads with fresh data
 * (schedule, classes, tests…). Ignored while the page is scrolled, inside a
 * scrolled inner list, in full screen, or with a dialog open.
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    if (!isNativeApp()) return;
    const onStart = (e: TouchEvent) => {
      if (refreshing || e.touches.length !== 1 || window.scrollY > 0 || document.fullscreenElement) return;
      if (document.querySelector('[aria-modal="true"], [role="dialog"][data-state="open"]')) return;
      if (insideScrolledArea(e.target as Element)) return;
      start.current = e.touches[0]!.clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0]!.clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) {
        start.current = null;
        pullRef.current = 0;
        setPull(0);
        return;
      }
      // Resistance: the indicator moves slower than the finger.
      const p = Math.min(MAX_PULL_PX, dy * 0.5);
      pullRef.current = p;
      setPull(p);
    };
    const onEnd = () => {
      if (start.current === null) return;
      start.current = null;
      if (pullRef.current >= TRIGGER_PX * 0.5 + 20) {
        setRefreshing(true);
        setPull(56);
        window.location.reload();
        return;
      }
      pullRef.current = 0;
      setPull(0);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [refreshing]);

  if (pull <= 0 && !refreshing) return null;
  const ready = refreshing || pull >= TRIGGER_PX * 0.5 + 20;
  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-[900] flex justify-center" style={{ transform: `translateY(${pull - 44}px)` }} aria-hidden>
      <div className="mt-2 grid h-10 w-10 place-items-center rounded-full bg-white shadow-lg ring-1 ring-black/5">
        <span
          className={`material-symbols-outlined text-xl text-blue-600 ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)`, opacity: ready ? 1 : 0.6 }}
        >
          refresh
        </span>
      </div>
    </div>
  );
}
