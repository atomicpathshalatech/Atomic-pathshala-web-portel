"use client";

import React from "react";
import Link from "next/link";
import { GraduationCap, ArrowRight, Sparkles } from "lucide-react";

interface BoardExamPracticeBannerProps {
  className?: string;
}

export function BoardExamPracticeBanner({ className = "" }: BoardExamPracticeBannerProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/80 via-slate-900 to-indigo-950/70 p-5 text-white shadow-lg transition-all hover:border-blue-500/30 ${className}`}
    >
      {/* Background glow & decorative elements */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-blue-500/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-indigo-500/10 blur-xl" />

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-blue-300 border border-blue-500/30">
              <Sparkles className="h-3 w-3 text-blue-400" />
              BOARD EXAM 2025-2026
            </span>
            <span className="text-[11px] font-medium text-blue-200/80">Class 10th & 12th PYQs & Model Papers</span>
          </div>

          <h3 className="text-lg font-bold tracking-tight text-white sm:text-xl flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-400" />
            Board Exam Hub
          </h3>

          <p className="text-xs text-slate-300 sm:text-sm max-w-xl leading-relaxed">
            Practice CBSE, UP, Bihar, MP, Rajasthan & all State Board official-style question papers with MCQs, Assertion-Reason, Short & Long Answer choices with model solutions.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/practice/board-exam"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/25 transition-all hover:brightness-110 active:scale-95 sm:text-sm"
          >
            <span>Start Board Practice</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
