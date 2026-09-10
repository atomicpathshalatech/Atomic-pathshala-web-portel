import Link from "next/link";

export interface RecommendedCourse {
  id: string;
  name: string;
  code: string;
  targetExam: string | null;
  courseTitle: string | null;
}

/**
 * Horizontally scrolling strip of compact course cards. No fake product
 * imagery — a branded gradient band with the exam badge stands in for the
 * missing Batch thumbnail, so the information leads, not a giant banner
 * (spec §9).
 */
export function RecommendedCourses({ courses }: { courses: RecommendedCourse[] }) {
  if (courses.length === 0) return null;

  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {courses.map((c) => (
        <Link
          key={c.id}
          href={`/courses/${c.id}`}
          className="w-[248px] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition-all active:scale-[0.99] hover:border-slate-300 hover:shadow-sm"
        >
          <div className="relative flex h-[92px] items-end bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 p-3">
            <span className="absolute right-2.5 top-2.5 rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
              {c.code}
            </span>
            <p className="line-clamp-2 text-[13px] font-bold leading-tight text-white">{c.name}</p>
          </div>
          <div className="p-3">
            <p className="truncate text-[11px] font-medium text-slate-500">
              {[c.targetExam, c.courseTitle].filter(Boolean).join(" · ") || "Full curriculum"}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600">
              View batch
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
