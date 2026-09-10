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
    <section
      className={`rounded-2xl border bg-white p-3.5 ${
        isLive ? "border-red-200 bg-red-50/30" : "border-blue-200/80"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${isLive ? "animate-ping bg-red-500" : "bg-blue-500"}`}
            />
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                isLive ? "text-red-600" : "text-blue-600"
              }`}
            >
              {headerLabel}
            </span>
          </div>
          <h3 className="truncate text-[15px] font-semibold text-slate-900">{title}</h3>
          <p className="truncate text-xs text-slate-500">
            {teacherName ? <>{teacherName} · </> : null}
            {timeLabel ??
              (isLive
                ? "Live now"
                : status === "STARTING_SOON"
                ? "Starting soon"
                : `Starts at ${formatAbsoluteTime(startsAtIso)}`)}
          </p>
          {hintLabel && !isLive && <p className="text-[11px] text-slate-400">{hintLabel}</p>}
        </div>

        {buttonDisabled ? (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="shrink-0 cursor-not-allowed rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-400"
          >
            {buttonLabel}
          </button>
        ) : (
          <Link
            href={href}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all active:scale-95 ${
              isLive ? "bg-red-500 hover:bg-red-600" : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            {buttonLabel}
          </Link>
        )}
      </div>
    </section>
  );
}
