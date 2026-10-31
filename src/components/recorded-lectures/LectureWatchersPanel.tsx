"use client";

import { useEffect, useState } from "react";

type Row = {
  studentId: string;
  name: string;
  code: string;
  allowed: boolean;
  watchedSec: number;
  percent: number;
  lastPositionSec: number;
  lastWatchedAt: string | null;
  completedAt: string | null;
};
type Data = {
  durationSec: number | null;
  summary: { students: number; watched: number; notStarted: number; completed: number; averagePercent: number };
  rows: Row[];
};

function mins(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}

/** Who watched this recorded lecture and how much (minutes really played, %, completed). */
export function LectureWatchersPanel({ lectureId }: { lectureId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/team/recorded-lectures/${lectureId}/watchers`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        if (json?.success) setData(json.data);
        else setError(typeof json?.error === "string" ? json.error : "Could not load who watched.");
      })
      .catch(() => alive && setError("Could not load who watched."));
    return () => {
      alive = false;
    };
  }, [lectureId]);

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <span className="material-symbols-outlined text-blue-600 text-xl">groups</span>
        Who watched
      </h3>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!data && !error && <div className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />}
      {data && (
        <>
          <ul className="flex flex-wrap gap-2 text-xs">
            <li className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 font-semibold">Students: {data.summary.students}</li>
            <li className="rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 font-semibold">
              Watched: {data.summary.watched}
            </li>
            <li className="rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 px-2.5 py-1 font-semibold">Completed: {data.summary.completed}</li>
            <li className="rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 px-2.5 py-1 font-semibold">
              Not started: {data.summary.notStarted}
            </li>
            <li className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 font-semibold">Average: {data.summary.averagePercent}%</li>
          </ul>
          {data.rows.length === 0 ? (
            <p className="text-sm text-slate-500">No student can watch this lecture yet (choose them in “Students who can watch” on the chapter).</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2">Student</th>
                    <th className="text-left px-3 py-2 w-44">Watched</th>
                    <th className="text-left px-3 py-2">Time</th>
                    <th className="text-left px-3 py-2">Last seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.rows.map((r) => (
                    <tr key={r.studentId}>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{r.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {r.code}
                          {!r.allowed && " · not on the list now"}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className={`h-full ${r.completedAt ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${r.percent}%` }} />
                          </div>
                          <span className="text-xs font-bold w-10 text-right">{r.percent}%</span>
                        </div>
                        {r.completedAt && <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">Completed</div>}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{r.watchedSec ? mins(r.watchedSec) : "—"}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {r.lastWatchedAt
                          ? new Date(r.lastWatchedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                          : "Not started"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-slate-400">Time counts only what was really played (skipping ahead does not count). Completed = 90% reached.</p>
        </>
      )}
    </div>
  );
}
