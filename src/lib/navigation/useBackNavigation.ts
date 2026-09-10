"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { runBackGuards } from "./back-guards";
import { parentPathFor } from "./hierarchy";

/**
 * The single "go back" behaviour for the whole app.
 *
 *   guards -> browser history -> logical parent
 *
 * WHY NOT `window.history.length > 1`:
 * that counts the entire tab's history, including pages from before the user
 * ever reached this app. Open a deep link in a tab that already had Google
 * in it and history.length is 2, so router.back() throws the user out of the
 * app entirely - the exact "I had to close the app" complaint this replaces.
 *
 * Instead we record history.length once, the first time the app boots in
 * this tab, and treat only entries added after that as ours. sessionStorage
 * is the right store: per-tab, and cleared when the tab closes.
 */

const BASELINE_KEY = "ap:histBaseline";

function readBaseline(): number {
  if (typeof window === "undefined") return 0;
  try {
    const stored = window.sessionStorage.getItem(BASELINE_KEY);
    if (stored !== null) {
      const parsed = Number.parseInt(stored, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    // First page of this tab that ran the app: everything already in the
    // history stack belongs to whatever came before us.
    const baseline = window.history.length;
    window.sessionStorage.setItem(BASELINE_KEY, String(baseline));
    return baseline;
  } catch {
    // Private mode / storage blocked: assume no in-app history and fall back
    // to the logical parent, which is always a safe destination.
    return Number.MAX_SAFE_INTEGER;
  }
}

/** True when going back would stay inside this app. */
export function hasInAppHistory(): boolean {
  if (typeof window === "undefined") return false;
  return window.history.length > readBaseline();
}

export function useBackNavigation(options?: {
  /** Overrides the computed parent for this screen. */
  fallbackHref?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const fallbackRef = useRef(options?.fallbackHref);
  fallbackRef.current = options?.fallbackHref;

  // Establish the baseline as early as possible in the tab's life.
  useEffect(() => {
    readBaseline();
  }, []);

  const goBack = useCallback(async () => {
    // 1. Anything that must intervene first - open sheet, running quiz,
    //    live class, unsaved edits.
    if (await runBackGuards()) return;

    // 2. Real history, so query params, filters, tab state and scroll
    //    position are restored by the router rather than rebuilt by us.
    if (hasInAppHistory()) {
      router.back();
      return;
    }

    // 3. Deep link with nothing behind it.
    router.push(fallbackRef.current ?? parentPathFor(pathname));
  }, [router, pathname]);

  return { goBack, parentHref: fallbackRef.current ?? parentPathFor(pathname) };
}

/**
 * Makes the browser/OS back gesture run the same guards as the Back button,
 * for screens where leaving unannounced would lose work or state.
 *
 * Mechanism: while armed, an extra history entry is parked on the stack. A
 * back press pops it, we hear popstate, and we re-push it before asking the
 * guards - so the user stays put while the confirmation is open. Only once a
 * guard declines (nothing to confirm, or the user chose to leave) do we let
 * the navigation through.
 *
 * Deliberately opt-in: parking a history entry on every page would make the
 * browser's own Back button need two presses everywhere.
 */
export function useBlockBrowserBack(active: boolean) {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const SENTINEL = { __apBackSentinel: true };
    window.history.pushState(SENTINEL, "");

    let releasing = false;

    const onPopState = async () => {
      if (releasing) return;

      // Put the sentinel back immediately so the page does not slip away
      // while an async confirmation is on screen.
      window.history.pushState(SENTINEL, "");

      const handled = await runBackGuards();
      if (!handled) {
        // Nothing objected: consume the sentinel and perform the real back.
        releasing = true;
        window.history.back(); // pops sentinel
        window.setTimeout(() => window.history.back(), 0); // real navigation
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (!releasing) {
        // Remove the parked entry so it cannot linger and swallow a later
        // back press on some other page.
        releasing = true;
        window.history.back();
      }
    };
  }, [active]);
}
