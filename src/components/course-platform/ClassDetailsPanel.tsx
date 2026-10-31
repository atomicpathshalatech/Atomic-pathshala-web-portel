"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WhiteboardPdfDownloadButton } from "@/components/whiteboard/WhiteboardPdfDownloadButton";

type Podium = { rank: number; name: string; photoUrl: string | null; responseTimeMs: number; source: "APP" | "YOUTUBE" };
type Poll = {
  id: string;
  question: string | null;
  options: { key: string; label: string }[];
  correctOption: string | null;
  totalAnswers: number;
  podium: Podium[];
  me: { answered: boolean; selectedOption: string | null; correct: boolean; marks: number; rank: number | null };
};
type Ranked = { studentId: string; name: string; photoUrl: string | null; correctCount: number; totalAttempted: number; accuracyPct: number; rank: number; source?: "APP" | "YOUTUBE" };
type Details = {
  id: string;
  title: string;
  chapter: { id: string; title: string } | null;
  teacher: string | null;
  scheduledStart: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  whiteboardSessionId: string | null;
  hasRecording: boolean;
  polls: Poll[];
  overall: { totalParticipants: number; totalPolls: number; top: Ranked[]; me: { rank: number | null; correctCount: number; totalAttempted: number; marks: number } } | null;
};

function hms(sec: number | null): string {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

const MEDAL = ["🥇", "🥈", "🥉"];

function Avatar({ name, photoUrl, size }: { name: string; photoUrl: string | null; size: number }) {
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoUrl} alt="" width={size} height={size} className="rounded-full object-cover border-2 border-white shadow" style={{ width: size, height: size }} />
  ) : (
    <span
      className="rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center border-2 border-white shadow"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** Prize-stage podium: 1st in the middle (tallest), 2nd left, 3rd right. */
function PodiumView({ podium }: { podium: Podium[] }) {
  if (podium.length === 0) return <p className="text-xs text-slate-500">Nobody got this one right.</p>;
  const order = [podium[1], podium[0], podium[2]];
  const height = { 1: "h-20", 2: "h-14", 3: "h-10" } as Record<number, string>;
  return (
    <div className="flex items-end justify-center gap-2 pt-2">
      {order.map((p, i) =>
        p ? (
          <div key={p.rank} className="flex flex-col items-center w-24 min-w-0">
            <Avatar name={p.name} photoUrl={p.photoUrl} size={p.rank === 1 ? 44 : 36} />
            <span className="mt-1 text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate max-w-full text-center">{p.name}</span>
            <span className="text-[10px] text-slate-500">{(p.responseTimeMs / 1000).toFixed(1)}s{p.source === "YOUTUBE" ? " · YouTube" : ""}</span>
            <div
              className={`mt-1 w-full ${height[p.rank]} rounded-t-lg flex items-start justify-center pt-1 text-lg ${
                p.rank === 1 ? "bg-amber-300/80" : p.rank === 2 ? "bg-slate-300/80" : "bg-orange-300/70"
              }`}
            >
              {MEDAL[p.rank - 1]}
            </div>
          </div>
        ) : (
          <div key={`empty-${i}`} className="w-24" />
        )
      )}
    </div>
  );
}

/**
 * A finished class for the student: duration, the board PDF, the recording,
 * and the result of every poll — podium + the student's own marks — and the
 * class top 10 with the student's own rank. Read from what was saved during
 * the class, so it opens any time later.
 */
export function ClassDetailsPanel({ scheduleId, onClose }: { scheduleId: string; onClose: () => void }) {
  const [data, setData] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/student/classes/${scheduleId}/details`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        if (json?.success) setData(json.data);
        else setError(typeof json?.error === "string" ? json.error : "Could not load this class.");
      })
      .catch(() => alive && setError("Could not load this class."));
    return () => {
      alive = false;
    };
  }, [scheduleId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl max-h-[92dvh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Class details"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600 truncate">{data?.chapter?.title ?? "Class details"}</p>
            <h2 className="text-base font-extrabold text-[#031635] dark:text-white truncate">{data?.title ?? "Loading…"}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {!data && !error && <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />}

          {data && (
            <>
              {/* Class facts + actions */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-slate-500">Duration</p>
                  <p className="font-extrabold text-slate-900 dark:text-white text-sm">{hms(data.durationSec)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-slate-500">Date</p>
                  <p className="font-extrabold text-slate-900 dark:text-white text-sm">
                    {new Date(data.startedAt ?? data.scheduledStart).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 col-span-2 sm:col-span-1">
                  <p className="text-slate-500">Teacher</p>
                  <p className="font-extrabold text-slate-900 dark:text-white text-sm truncate">{data.teacher ?? "—"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.hasRecording && (
                  <Link href={`/watch/${data.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs px-3.5 py-2">
                    <span className="material-symbols-outlined text-[16px]">play_circle</span>
                    Watch recording
                  </Link>
                )}
                {data.whiteboardSessionId && (
                  <WhiteboardPdfDownloadButton
                    sessionId={data.whiteboardSessionId}
                    format="pdf"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold px-3.5 py-2 disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[16px] text-rose-500">picture_as_pdf</span>
                    Class PDF
                  </WhiteboardPdfDownloadButton>
                )}
              </div>

              {/* Whole-class result */}
              {data.overall && data.overall.totalPolls > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-500 text-lg">military_tech</span>
                    Class leaderboard · {data.overall.totalPolls} poll{data.overall.totalPolls === 1 ? "" : "s"}
                  </h3>
                  <div className="rounded-2xl border-2 border-blue-500/60 bg-blue-50 dark:bg-blue-950/40 px-3 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-200">Your rank</span>
                    <span className="text-sm font-black text-blue-900 dark:text-white">
                      {data.overall.me.rank ? `#${data.overall.me.rank} of ${data.overall.totalParticipants}` : "Not ranked"} · {data.overall.me.marks}/{data.overall.totalPolls} marks
                    </span>
                  </div>
                  <ol className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                    {data.overall.top.map((r) => (
                      <li key={r.studentId} className="flex items-center gap-2.5 px-3 py-2 text-xs">
                        <span className="w-6 text-center font-black text-slate-500">{r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}</span>
                        <Avatar name={r.name} photoUrl={r.photoUrl} size={26} />
                        <span className="flex-1 min-w-0 truncate font-semibold text-slate-800 dark:text-slate-100">
                          {r.name}
                          {r.source === "YOUTUBE" && <span className="ml-1 text-[10px] text-red-500">YouTube</span>}
                        </span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {r.correctCount}/{r.totalAttempted}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* Every poll */}
              <section className="space-y-3">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-blue-600 text-lg">quiz</span>
                  Polls in this class
                </h3>
                {data.polls.length === 0 ? (
                  <p className="text-xs text-slate-500">No polls were asked in this class.</p>
                ) : (
                  data.polls.map((p, i) => (
                    <div key={p.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          Q{i + 1}. {p.question?.trim() || "Poll"}
                        </p>
                        <span className="text-[10px] text-slate-500 shrink-0">{p.totalAnswers} answered</span>
                      </div>
                      {p.correctOption && (
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                          Right answer: {p.correctOption}
                          {(() => {
                            const label = p.options.find((o) => o.key === p.correctOption)?.label;
                            return label && label !== p.correctOption ? ` — ${label}` : "";
                          })()}
                        </p>
                      )}
                      <PodiumView podium={p.podium} />
                      <div
                        className={`rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-between ${
                          p.me.correct
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                        }`}
                      >
                        <span>
                          You:{" "}
                          {p.me.answered ? `answered ${p.me.selectedOption}${p.me.correct ? " ✓" : " ✗"}` : "did not answer"}
                          {p.me.rank ? ` · #${p.me.rank}` : ""}
                        </span>
                        <span>{p.me.marks} mark{p.me.marks === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                  ))
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
