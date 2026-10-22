"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type AttemptPill = { n: number; score: number | null; inProgress?: boolean };

/**
 * Slim bar above a result: Attempt 1 | Attempt 2 | … (switch which attempt's
 * analysis and review is shown, like the Hindi/English toggle) and a small
 * Re-attempt button. Attempt 1 is the ranked one; later ones are practice.
 */
export function AttemptSwitcher({
  testId,
  attempts,
  current,
  reattemptsLeft,
}: {
  testId: string;
  attempts: AttemptPill[];
  current: number;
  reattemptsLeft: number;
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const open = attempts.find((a) => a.inProgress);
  const done = attempts.filter((a) => !a.inProgress);

  async function startReattempt() {
    setStarting(true);
    try {
      const res = await fetch(`/api/tests/${testId}/reattempts`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Could not start a re-attempt.");
      router.push(`/tests/${testId}/attempt?re=${json.data.attemptNumber}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start a re-attempt.");
      setStarting(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 h-10 flex items-center gap-2 overflow-x-auto">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 shrink-0">
          {done.map((a) => (
            <button
              key={a.n}
              type="button"
              onClick={() => router.push(a.n === 1 ? `/tests/${testId}/result` : `/tests/${testId}/result?attempt=${a.n}`)}
              className={`px-2.5 h-7 rounded-md text-[11px] font-bold whitespace-nowrap transition ${
                a.n === current
                  ? "bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              title={a.n === 1 ? "First attempt — counted for rank" : "Practice attempt — not ranked"}
            >
              Attempt {a.n}
              {a.score !== null && <span className="ml-1 font-mono font-medium opacity-70">{Math.round(a.score * 100) / 100}</span>}
            </button>
          ))}
        </div>

        <span className="text-[10px] text-slate-400 whitespace-nowrap hidden sm:inline">
          {current === 1 ? "Rank counts Attempt 1" : "Practice attempt · rank shown is where this score would place"}
        </span>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {open ? (
            <button
              type="button"
              onClick={() => router.push(`/tests/${testId}/attempt?re=${open.n}`)}
              className="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold"
            >
              <span className="material-symbols-outlined text-[15px]">play_arrow</span>
              Continue Attempt {open.n}
            </button>
          ) : reattemptsLeft > 0 ? (
            <button
              type="button"
              disabled={starting}
              onClick={startReattempt}
              className="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold disabled:opacity-60"
              title={`${reattemptsLeft} re-attempt${reattemptsLeft === 1 ? "" : "s"} left`}
            >
              <span className="material-symbols-outlined text-[15px]">replay</span>
              {starting ? "Starting…" : "Re-attempt"}
            </button>
          ) : (
            <span className="text-[10px] text-slate-400">No re-attempts left</span>
          )}
        </div>
      </div>
    </div>
  );
}
