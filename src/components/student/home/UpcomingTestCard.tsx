"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, Clock, Award, FileQuestion, ArrowRight, Radio } from "lucide-react";

export interface UpcomingTestItem {
  id: string;
  name: string;
  openTimeIso: string;
  closeTimeIso?: string | null;
  durationMin: number;
  questionCount: number;
  totalMarks: number;
  isLive: boolean;
  statusLabel: string;
}

function formatCountdown(targetDate: Date, now: Date) {
  const diff = targetDate.getTime() - now.getTime();
  if (diff <= 0) return "Starting now";

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

export function UpcomingTestCard({ test }: { test: UpcomingTestItem }) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const openDate = new Date(test.openTimeIso);
  const isLive = test.isLive || now >= openDate;
  const countdown = isLive ? "LIVE NOW" : formatCountdown(openDate, now);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 p-4 sm:p-5 text-white shadow-lg transition-all duration-300">
      {/* Background Decorative Glow */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-indigo-500/20 blur-2xl" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Test Details */}
        <div className="space-y-2">
          {/* Top Pill: Upcoming or Live badge */}
          <div className="flex items-center gap-2">
            {isLive ? (
              <span className="flex items-center gap-1.5 rounded-full bg-rose-500/90 px-3 py-0.5 text-[11px] font-black uppercase text-white shadow-sm animate-pulse">
                <Radio className="w-3.5 h-3.5" />
                <span>Test Live Now</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/30 px-3 py-0.5 text-[11px] font-bold text-amber-300">
                <Calendar className="w-3.5 h-3.5" />
                <span>Upcoming Test</span>
              </span>
            )}

            <span className="text-xs font-semibold text-slate-300">
              {test.statusLabel}
            </span>
          </div>

          {/* Test Title */}
          <h3 className="text-base sm:text-xl font-black tracking-tight text-white drop-shadow-sm">
            {test.name}
          </h3>

          {/* Metadata Badges: Questions, Time, Marks */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-300 bg-white/10 px-2.5 py-1 rounded-lg backdrop-blur-xs">
              <FileQuestion className="w-3.5 h-3.5 text-blue-400" />
              <span>{test.questionCount} Questions</span>
            </span>

            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-300 bg-white/10 px-2.5 py-1 rounded-lg backdrop-blur-xs">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{test.durationMin} Mins</span>
            </span>

            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-300 bg-white/10 px-2.5 py-1 rounded-lg backdrop-blur-xs">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              <span>{test.totalMarks} Marks</span>
            </span>
          </div>
        </div>

        {/* Right: Countdown & CTA Link */}
        <div className="flex md:flex-col items-center md:items-end justify-between gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
          <div className="text-left md:text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              {isLive ? "Status" : "Starts In"}
            </span>
            <span className="font-mono text-sm sm:text-base font-black text-amber-300 tracking-wider">
              {countdown}
            </span>
          </div>

          <Link
            href="/tests"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md ${
              isLive
                ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
          >
            <span>{isLive ? "Attempt Test" : "View Test Series"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
