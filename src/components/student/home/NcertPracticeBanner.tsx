"use client";

import React from "react";
import Link from "next/link";

interface NcertPracticeBannerProps {
  className?: string;
}

export function NcertPracticeBanner({ className = "" }: NcertPracticeBannerProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/80 via-slate-900 to-teal-950/70 p-5 text-white shadow-lg transition-all hover:border-emerald-500/30 ${className}`}
    >
      {/* Background glow & decorative elements */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-emerald-500/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-teal-500/10 blur-xl" />

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-300 border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              NEW FEATURE
            </span>
            <span className="text-[11px] font-medium text-emerald-200/80">NEET Page-by-Page Mastery</span>
          </div>

          <h3 className="text-lg font-bold tracking-tight text-white sm:text-xl">
            NCERT Question Practice
          </h3>

          <p className="text-xs text-slate-300 sm:text-sm max-w-xl leading-relaxed">
            Read NCERT page by page and practice strictly page-locked, verified NCERT questions with instant solutions in Hindi or English.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/practice/ncert"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-emerald-500/20 transition-all hover:brightness-110 active:scale-95 sm:text-sm"
          >
            <span>Start NCERT Practice</span>
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
