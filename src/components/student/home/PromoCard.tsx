"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "ag_home_promo_dismissed";

/**
 * Compact ~64px upgrade card that sits IN the page flow (not fixed over the
 * bottom nav like the old banner). Dismissible — stays hidden for 14 days.
 * Renders nothing when the student already has an active subscription
 * (the parent decides whether to mount it).
 */
export function PromoCard() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      const at = Number(localStorage.getItem(KEY) || 0);
      setHidden(at > 0 && Date.now() - at < 14 * 24 * 60 * 60 * 1000);
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-blue-200/70 bg-gradient-to-r from-blue-50 to-indigo-50 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 ring-1 ring-blue-100">
        <span className="material-symbols-outlined text-[20px]">bolt</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-slate-900">Unlock all batches</p>
        <p className="truncate text-[11px] text-slate-500">100+ NEET courses &amp; test series</p>
      </div>
      <Link
        href="/subscription"
        className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
      >
        Upgrade
      </Link>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          try {
            localStorage.setItem(KEY, String(Date.now()));
          } catch {
            /* ignore */
          }
          setHidden(true);
        }}
        className="-mr-1 shrink-0 rounded-lg p-1 text-slate-400 hover:text-slate-600"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}
