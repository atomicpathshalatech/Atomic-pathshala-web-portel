import Link from "next/link";

export type MyBatchShortcut = { id: string; name: string; todayClasses: number };

const ITEMS = [
  { tab: "classes", label: "Classes", icon: "smart_display", tone: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300" },
  { tab: "tests", label: "Tests", icon: "quiz", tone: "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300" },
  { tab: "material", label: "Study Material", icon: "folder_open", tone: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300" },
  { tab: "notices", label: "Announcements", icon: "campaign", tone: "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300" },
] as const;

/** Home → straight into the student's batch (classes, tests, material, notices). */
export function MyBatchShortcuts({ batches }: { batches: MyBatchShortcut[] }) {
  if (batches.length === 0) return null;
  return (
    <section className="space-y-2.5">
      {batches.map((b) => (
        <div key={b.id} className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4">
          <Link href={`/courses/${b.id}`} className="flex items-center justify-between gap-2 mb-3">
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">My Batch</span>
              <span className="block text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">{b.name}</span>
            </span>
            <span className="material-symbols-outlined text-slate-400 shrink-0">chevron_right</span>
          </Link>
          <div className="grid grid-cols-4 gap-2">
            {ITEMS.map((it) => (
              <Link
                key={it.tab}
                href={`/courses/${b.id}?tab=${it.tab}`}
                className="relative flex flex-col items-center gap-1.5 rounded-2xl p-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <span className={`w-10 h-10 rounded-2xl flex items-center justify-center ${it.tone}`}>
                  <span className="material-symbols-outlined text-[22px]">{it.icon}</span>
                </span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 text-center leading-tight">{it.label}</span>
                {it.tab === "classes" && b.todayClasses > 0 && (
                  <span className="absolute top-1 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {b.todayClasses}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
