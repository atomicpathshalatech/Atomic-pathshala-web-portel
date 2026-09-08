"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { JOIN_WINDOW_MS, type NormalizedScheduleStatus } from "@/lib/schedule/access-rules";

type LiveCardStatus = NormalizedScheduleStatus;

interface NextClassCardProps {
  scheduleId: string;
  type: string;
  title: string;
  teacherName: string | null;
  startsAtIso: string;
  initialStatus: LiveCardStatus;
}

function formatAbsoluteTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function minutesUntil(targetMs: number, nowMs: number) {
  return Math.max(1, Math.ceil((targetMs - nowMs) / 60000));
}

const POLL_MS = 10000;

/**
 * "Next Scheduled Session" live-class card on the student dashboard.
 *
 * The T-15 boundary and the LIVE/ENDED transitions are NOT decided here -
 * they come from src/lib/schedule/access-rules.ts's getEffectiveScheduleStatus
 * (same authoritative function the join flow and the by-schedule status API
 * already use), so this card can never show LIVE early or let a student
 * think joining is open before the backend says so. The server passes the
 * initial status for the first paint; after mount this polls the same
 * by-schedule endpoint the "Join Class" flow already calls, so the card
 * advances SCHEDULED -> STARTING_SOON -> LIVE -> (hidden once ended)
 * without the student refreshing the page. The per-second effect below
 * only formats copy for whatever status the last poll (or the initial
 * server render) confirmed - it never derives LIVE from the local clock.
 */
export function NextClassCard({
  scheduleId,
  type,
  title,
  teacherName,
  startsAtIso,
  initialStatus,
}: NextClassCardProps) {
  const [status, setStatus] = useState<LiveCardStatus>(initialStatus);
  const [timeLabel, setTimeLabel] = useState<string | null>(null);
  const [hintLabel, setHintLabel] = useState<string | null>(null);

  const isLiveClassType = type === "LIVE_CLASS";
  const startsAtMs = new Date(startsAtIso).getTime();
  const opensAtMs = startsAtMs - JOIN_WINDOW_MS;

  // Tick the time-derived copy client-side only, after mount, so the first
  // paint matches the server-rendered markup exactly (no hydration
  // mismatch) - same technique as the countdown this replaces used.
  useEffect(() => {
    if (!isLiveClassType) return;

    const tick = () => {
      const nowMs = Date.now();
      if (status === "LIVE") {
        setTimeLabel("Live Now");
        setHintLabel(null);
      } else if (status === "STARTING_SOON" || status === "TEACHER_ENTRY_OPEN" || status === "READY") {
        setTimeLabel(
          nowMs >= startsAtMs ? "Starting any moment" : `Starts in ${minutesUntil(startsAtMs, nowMs)} min`
        );
        setHintLabel(null);
      } else {
        setTimeLabel(`Starts at ${formatAbsoluteTime(startsAtIso)}`);
        const minsToOpen = minutesUntil(opensAtMs, nowMs);
        setHintLabel(
          minsToOpen <= 60 ? `Available to join in ${minsToOpen} min` : "Join opens 15 minutes before class"
        );
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status, startsAtMs, opensAtMs, startsAtIso, isLiveClassType]);

  // Poll the existing by-schedule status endpoint (the same one the
  // live-class join flow uses) so this card learns about real state
  // changes - the T-15 window opening, the teacher actually starting the
  // class, the class ending - without a manual refresh.
  useEffect(() => {
    if (!isLiveClassType || status === "COMPLETED" || status === "CANCELLED" || status === "NOT_CONDUCTED") return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/whiteboard/sessions/by-schedule/${scheduleId}`);
        const json = await res.json();
        if (cancelled || !res.ok || !json.success) return;
        const nextStatus = json.data?.schedule?.status as LiveCardStatus | undefined;
        if (nextStatus) setStatus(nextStatus);
      } catch {
        // best effort - keep showing the last confirmed status
      }
    };

    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [scheduleId, status, isLiveClassType]);

  // A live class that has ended (or was cancelled for not starting in
  // time) must not keep showing as the next scheduled live class.
  if (isLiveClassType && (status === "COMPLETED" || status === "CANCELLED" || status === "NOT_CONDUCTED")) return null;

  const isLive = status === "LIVE";
  const canJoinNow = status === "LIVE" || status === "STARTING_SOON";

  const headerLabel = !isLiveClassType
    ? `Next Scheduled Session · ${type.replace("_", " ")}`
    : isLive
      ? "LIVE NOW · LIVE CLASS"
      : "NEXT SCHEDULED CLASS · LIVE CLASS";

  const buttonLabel = !isLiveClassType ? "View Classroom" : isLive ? "Join Live Class" : "Join Class";
  const href = isLiveClassType ? `/live-class/${scheduleId}` : "/schedule";
  const buttonDisabled = isLiveClassType && !canJoinNow;

  return (
    <section className="bg-white border border-blue-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full animate-ping ${isLive ? "bg-red-500" : "bg-blue-500"}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isLive ? "text-red-600" : "text-blue-600"}`}>
              {headerLabel}
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">{title}</h2>
          {teacherName && (
            <p className="text-xs text-slate-500">
              Educator: <b>{teacherName}</b>
            </p>
          )}
          {isLiveClassType && (
            <div className="pt-0.5 space-y-0.5">
              <div className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface tracking-tight tabular-nums">
                {timeLabel ?? (isLive ? "Live Now" : status === "STARTING_SOON" ? "Starting soon" : `Starts at ${formatAbsoluteTime(startsAtIso)}`)}
              </div>
              {hintLabel && <div className="text-[11px] text-slate-400">{hintLabel}</div>}
            </div>
          )}
        </div>

        {buttonDisabled ? (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="px-4 py-2 rounded-xl bg-slate-200 text-slate-400 font-bold text-xs shadow-2xs cursor-not-allowed text-center self-start sm:self-auto shrink-0"
          >
            {buttonLabel}
          </button>
        ) : (
          <Link
            href={href}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-2xs active:scale-95 transition-all text-center self-start sm:self-auto shrink-0"
          >
            {buttonLabel}
          </Link>
        )}
      </div>
    </section>
  );
}
