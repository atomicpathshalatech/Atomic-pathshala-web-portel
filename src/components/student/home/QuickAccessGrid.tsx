import Link from "next/link";

type Accent = "blue" | "violet" | "orange" | "emerald" | "teal" | "indigo" | "rose" | "amber";

const ACCENT: Record<Accent, string> = {
  blue: "bg-blue-50 text-blue-600 ring-blue-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  orange: "bg-orange-50 text-orange-600 ring-orange-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  teal: "bg-teal-50 text-teal-600 ring-teal-100",
  indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  rose: "bg-rose-50 text-rose-600 ring-rose-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
};

export interface QuickAccessItem {
  label: string;
  icon: string;
  href: string;
  accent: Accent;
  /** small real count / status, e.g. "3 assigned" — omit when there's nothing true to say */
  badge?: string | null;
}

/**
 * Compact 2-column grid of ~96px tiles. Soft tinted icon chip, one label,
 * an optional real badge. No "Explore →" footer, no per-tile bright block —
 * 90% neutral, 10% accent (spec §6/§11).
 */
export function QuickAccessGrid({ items }: { items: QuickAccessItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {items.map((it) => (
        <Link
          key={it.label}
          href={it.href}
          className="group flex min-h-[92px] flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-3 transition-all active:scale-[0.98] hover:border-slate-300 hover:shadow-sm"
        >
          <div className="flex items-start justify-between">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${ACCENT[it.accent]}`}
            >
              <span className="material-symbols-outlined text-[20px]">{it.icon}</span>
            </span>
            {it.badge ? (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {it.badge}
              </span>
            ) : null}
          </div>
          <span className="mt-2 text-[13px] font-semibold leading-tight text-slate-800">
            {it.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
