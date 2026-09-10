import Link from "next/link";

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
}

/**
 * Compact personalised header — one subtle gradient card, ~150px. Real
 * signals only: greeting, target exam, streak, and today's completed-vs-
 * scheduled ratio (no invented "78%").
 */
export function ProgressCard({
  greeting,
  firstName,
  targetExam,
  streakDays,
  todayDone,
  todayTotal,
  continueHref,
  continueLabel,
}: ProgressCardProps) {
  const pct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-blue-50 via-white to-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-500">
            {greeting}, <span className="font-semibold text-slate-800">{firstName}</span> 👋
          </p>
          <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">
            {targetExam} Prep
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-600 ring-1 ring-orange-100">
          <span className="material-symbols-outlined text-[15px]">local_fire_department</span>
          {streakDays}d
        </span>
      </div>

      {todayTotal > 0 ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
            <span>Today&apos;s plan</span>
            <span>
              {todayDone} of {todayTotal} done
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-[width] duration-500"
              style={{ width: `${Math.max(pct, 4)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-2 truncate text-[12px] text-slate-500">
          Nothing scheduled today — keep your streak alive.
        </p>
      )}

      <Link
        href={continueHref}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 active:scale-[0.98]"
      >
        {continueLabel}
        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
      </Link>
    </section>
  );
}
