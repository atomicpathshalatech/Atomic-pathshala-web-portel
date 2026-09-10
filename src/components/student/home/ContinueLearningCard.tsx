import Link from "next/link";

export interface ContinueItem {
  id: string;
  /** e.g. "Physics" */
  primary: string;
  /** e.g. "Current Electricity" or the batch name */
  secondary: string;
  /** small real fact, e.g. "8 lectures done" or "12 faculty" */
  meta?: string | null;
  href: string;
  icon: string;
}

/**
 * Horizontal ~96px cards for "pick up where you left off". No fake
 * percentage bar (there is no per-lecture watch position in the data) —
 * just subject, topic/batch and a real count.
 */
export function ContinueLearningCard({ item }: { item: ContinueItem }) {
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 transition-all active:scale-[0.99] hover:border-slate-300 hover:shadow-sm"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
        <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-slate-900">{item.primary}</p>
        <p className="truncate text-xs text-slate-500">{item.secondary}</p>
        {item.meta ? <p className="mt-0.5 text-[11px] font-medium text-slate-400">{item.meta}</p> : null}
      </div>
      <span className="material-symbols-outlined shrink-0 text-slate-300">chevron_right</span>
    </Link>
  );
}
