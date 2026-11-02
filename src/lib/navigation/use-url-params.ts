"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * In-page steps (subject → chapter → list) kept in the URL query, so the
 * phone's Back key / the browser's Back steps back one level instead of
 * leaving the page. Opening a level adds a history entry; Back restores the
 * previous one (popstate).
 *
 *   const [step, setStep] = useUrlParams(["ds", "dc"]);
 *   setStep({ ds: subjectId });            // push
 *   setStep({ ds: null, dc: null });       // back to the top, as a new entry
 */
export function useUrlParams<K extends string>(names: readonly K[]) {
  const key = names.join(",");
  const read = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    return Object.fromEntries(key.split(",").map((n) => [n, params.get(n)])) as Record<K, string | null>;
  }, [key]);

  const [values, setValues] = useState<Record<K, string | null>>(
    () => Object.fromEntries(key.split(",").map((n) => [n, null])) as Record<K, string | null>
  );

  useEffect(() => {
    const sync = () => setValues(read());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [read]);

  const set = useCallback(
    (next: Partial<Record<K, string | null>>) => {
      const params = new URLSearchParams(window.location.search);
      for (const [n, v] of Object.entries(next) as [K, string | null | undefined][]) {
        if (v) params.set(n, v);
        else params.delete(n);
      }
      const qs = params.toString();
      window.history.pushState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
      setValues(read());
    },
    [read]
  );

  return [values, set] as const;
}
