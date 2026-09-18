"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, Flame, Radio, ArrowRight, CheckCircle2 } from "lucide-react";

export interface NextEventInfo {
  title: string;
  type: "LIVE_CLASS" | "TEST" | "SESSION" | "DPP" | string;
  startsAtIso: string;
  href: string;
  isLive?: boolean;
}

export interface ProgressCardProps {
  greeting: string;
  firstName: string;
  targetExam: string;
  streakDays: number;
  /** today's real plan, from scheduled classes/DPP vs what the student has done */
  todayDone: number;
  todayTotal: number;
  continueHref: string;
  continueLabel: string;
  nextEvent?: NextEventInfo | null;
}

function formatCountdown(targetDate: Date, now: Date) {
  const diff = targetDate.getTime() - now.getTime();
  if (diff <= 0) return "Starting now";

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

export function ProgressCard({
  greeting,
  firstName,
  targetExam,
  streakDays,
  todayDone,
  todayTotal,
  continueHref,
  continueLabel,
  nextEvent,
}: ProgressCardProps) {
  const pct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const eventStart = nextEvent ? new Date(nextEvent.startsAtIso) : null;
  const isEventLive = nextEvent?.isLive || (eventStart && eventStart.getTime() <= now.getTime());
  const countdownText = eventStart ? formatCountdown(eventStart, now) : null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-900/20 bg-gradient-to-br from-amber-700 via-orange-800 to-stone-900 p-3.5 sm:p-4 text-white shadow-md transition-all duration-300">
      {/* Background Decorative Glow Mesh */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-500/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-orange-600/15 blur-2xl" />

      {/* Header Row: Greeting + Target Exam + Streak */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-white drop-shadow-sm">
            {targetExam} Prep
          </h2>
          <span className="text-[11px] font-semibold text-amber-200/80 truncate">
            • {greeting}, {firstName} 👋
          </span>
        </div>

        {/* Streak Badge */}
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/30 px-2.5 py-0.5 text-xs font-bold text-amber-300 backdrop-blur-md">
          <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
          <span>{streakDays}d</span>
        </div>
      </div>

      {/* Compact Next Event Countdown Bar */}
      {nextEvent && (
        <div className="relative z-10 mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            {isEventLive ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase text-white animate-pulse">
                <Radio className="w-3 h-3" />
                Live
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-400/20 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                <Clock className="w-3 h-3" />
                Next
              </span>
            )}
            <span className="truncate text-xs font-semibold text-slate-100">
              {nextEvent.title}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!isEventLive && countdownText && (
              <span className="font-mono text-xs font-extrabold text-amber-300 tracking-wider">
                {countdownText}
              </span>
            )}
            <Link
              href={nextEvent.href}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition flex items-center gap-0.5 ${
                isEventLive
                  ? "bg-rose-600 text-white hover:bg-rose-500 shadow-sm"
                  : "bg-white/90 text-slate-900 hover:bg-white"
              }`}
            >
              {isEventLive ? "Join" : "View"}
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Today's Plan Progress & Continue Button Row */}
      <div className="relative z-10 mt-2.5 flex items-center justify-between gap-3 pt-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-[11px] font-semibold text-amber-100/90 mb-1">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-amber-400" />
              Today: {todayTotal > 0 ? `${todayDone}/${todayTotal} done` : "0 plan"}
            </span>
            <span className="text-amber-200 text-[10px]">{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40 border border-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-[width] duration-700"
              style={{ width: `${Math.max(pct, todayTotal > 0 ? 5 : 0)}%` }}
            />
          </div>
        </div>

        <Link
          href={continueHref}
          className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-1.5 text-xs font-black text-slate-950 shadow-sm transition hover:from-amber-300 hover:to-amber-400 active:scale-95"
        >
          {continueLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </section>
  );
}
