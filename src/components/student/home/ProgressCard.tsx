"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, Flame, Radio, ArrowRight, Calendar, CheckCircle2 } from "lucide-react";

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

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `In ${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `In ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `In ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
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
    <section className="relative overflow-hidden rounded-2xl border border-amber-900/20 bg-gradient-to-br from-amber-700 via-orange-800 to-stone-900 p-5 text-white shadow-lg transition-all duration-300 hover:shadow-xl">
      {/* Background Decorative Glow Mesh */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-orange-600/20 blur-3xl" />

      {/* Top Row: Greeting & Target Exam & Streak */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-amber-200/90 tracking-wide uppercase">
            {greeting}, <span className="text-white font-bold">{firstName}</span> 👋
          </p>
          <h2 className="mt-0.5 text-2xl font-black tracking-tight text-white drop-shadow-sm">
            {targetExam} Prep
          </h2>
        </div>

        {/* Streak Counter */}
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 px-3 py-1 text-xs font-extrabold text-amber-300 backdrop-blur-md shadow-inner">
          <Flame className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
          <span>{streakDays}d streak</span>
        </div>
      </div>

      {/* Next Upcoming Event Countdown Box */}
      {nextEvent && (
        <div className="relative z-10 mt-4 rounded-xl border border-white/15 bg-black/35 backdrop-blur-md p-3.5 transition hover:bg-black/45">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isEventLive ? (
                <span className="flex items-center gap-1 rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-black uppercase text-white animate-pulse">
                  <Radio className="w-3 h-3" />
                  Live Now
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-amber-400/20 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  <Clock className="w-3 h-3" />
                  Upcoming
                </span>
              )}
              <span className="truncate text-xs font-semibold text-slate-100">
                {nextEvent.title}
              </span>
            </div>

            {/* Live Countdown Clock */}
            {!isEventLive && countdownText && (
              <span className="shrink-0 font-mono text-xs font-extrabold text-amber-300 tracking-wider">
                {countdownText}
              </span>
            )}
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-300">
              {isEventLive ? "Interactive Class in session" : "Join starts 15 mins before time"}
            </span>
            <Link
              href={nextEvent.href}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold transition ${
                isEventLive
                  ? "bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-900/50"
                  : "bg-white/90 text-slate-900 hover:bg-white"
              }`}
            >
              {isEventLive ? "Join Class" : "View Details"}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Today's Plan Progress */}
      <div className="relative z-10 mt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-amber-100/90">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
            Today&apos;s plan
          </span>
          <span className="font-mono text-amber-200">
            {todayTotal > 0 ? `${todayDone} of ${todayTotal} done` : "0 scheduled"}
          </span>
        </div>

        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/40 border border-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300 transition-[width] duration-700 shadow-sm"
            style={{ width: `${Math.max(pct, todayTotal > 0 ? 5 : 0)}%` }}
          />
        </div>
      </div>

      {/* Action Button */}
      <div className="relative z-10 mt-4 flex items-center justify-between gap-2">
        <Link
          href={continueHref}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-md transition-all duration-200 hover:from-amber-300 hover:to-amber-400 hover:shadow-amber-500/20 active:scale-95"
        >
          {continueLabel}
          <ArrowRight className="w-4 h-4" />
        </Link>

        <Link
          href="/schedule"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200/90 hover:text-white transition"
        >
          <Calendar className="w-3.5 h-3.5" />
          Full Schedule
        </Link>
      </div>
    </section>
  );
}
