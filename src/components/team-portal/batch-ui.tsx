"use client";

/** Shared box look for the batch tabs (same cards as the DPP / chapter boards). */

export function subjectTone(title: string) {
  const t = (title || "").toLowerCase();
  if (t.includes("phys")) return { chip: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300", solid: "bg-blue-600", ring: "hover:border-blue-300 dark:hover:border-blue-800" };
  if (t.includes("chem")) return { chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300", solid: "bg-amber-500", ring: "hover:border-amber-300 dark:hover:border-amber-800" };
  if (t.includes("bio") || t.includes("bot") || t.includes("zoo"))
    return { chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300", solid: "bg-emerald-600", ring: "hover:border-emerald-300 dark:hover:border-emerald-800" };
  if (t.includes("math")) return { chip: "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300", solid: "bg-violet-600", ring: "hover:border-violet-300 dark:hover:border-violet-800" };
  return { chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", solid: "bg-slate-600", ring: "hover:border-slate-300 dark:hover:border-slate-700" };
}

export const BOX =
  "rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition";

export const BOX_GRID = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3";

/** A subject tile: initial, name, a line of counts. */
export function SubjectBox({
  subject,
  lines,
  onClick,
  active,
}: {
  subject: string;
  lines: string[];
  onClick: () => void;
  active?: boolean;
}) {
  const tone = subjectTone(subject);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${BOX} ${tone.ring} text-left hover:shadow-md flex items-center gap-3 ${active ? "ring-2 ring-blue-500/40" : ""}`}
    >
      <span className={`w-11 h-11 rounded-xl ${tone.solid} text-white flex items-center justify-center font-black text-lg shrink-0`}>
        {(subject || "?")[0]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-sm text-slate-900 dark:text-white truncate">{subject}</span>
        <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{lines.join(" · ")}</span>
      </span>
      <span className="material-symbols-outlined text-slate-400">chevron_right</span>
    </button>
  );
}

export function BackToSubjects({ subject, onBack }: { subject: string; onBack: () => void }) {
  const tone = subjectTone(subject);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        All subjects
      </button>
      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${tone.chip}`}>{subject}</span>
    </div>
  );
}

export function EmptyBox({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-1.5">
      <span className="material-symbols-outlined text-3xl text-slate-400">{icon}</span>
      <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{title}</p>
      <p className="text-xs text-slate-500 max-w-md mx-auto">{body}</p>
    </div>
  );
}

/** Avatar + name + department line + subject chip of a faculty card. */
export function FacultyCardBody({ name, department, code, subject }: { name: string; department: string; code: string; subject: string | null }) {
  const tone = subjectTone(subject || department || "");
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className={`w-11 h-11 rounded-full ${tone.solid} text-white flex items-center justify-center font-black text-base shrink-0`}>
        {(name || "?").trim().charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{name}</p>
        <p className="text-[11px] text-slate-500 truncate">
          {department} · {code}
        </p>
        {subject && <span className={`mt-1 inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${tone.chip}`}>{subject}</span>}
      </div>
    </div>
  );
}
