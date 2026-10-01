"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoubtForm } from "@/components/student-portal/DoubtForm";
import { AiDoubtSolver } from "@/components/student/AiDoubtSolver";
import { SUBJECT_OPTIONS } from "@/lib/validation/doubt";
import type { MyDoubtItem } from "@/lib/doubts/my-doubts";

const SUBJECT_STYLE: Record<string, { icon: string; tone: string }> = {
  Physics: { icon: "bolt", tone: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" },
  Chemistry: { icon: "science", tone: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" },
  Biology: { icon: "biotech", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  Mathematics: { icon: "functions", tone: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300" },
};
const styleOf = (s: string) => SUBJECT_STYLE[s] ?? { icon: "help", tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" };

const STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "Pending", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  ASKED: { label: "Asked", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  RESOLVED: { label: "Answered", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  ANSWERED: { label: "Answered", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  FLAGGED: { label: "Under review", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
};

const SOURCES = [
  { id: "all", label: "All" },
  { id: "class", label: "From classes" },
  { id: "asked", label: "Asked by me" },
] as const;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

export function MyDoubtsView({ items: initial }: { items: MyDoubtItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [subject, setSubject] = useState<string>("All");
  const [source, setSource] = useState<(typeof SOURCES)[number]["id"]>("all");
  const [asking, setAsking] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const subjects = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of items) counts.set(d.subject, (counts.get(d.subject) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const shown = items.filter(
    (d) =>
      (subject === "All" || d.subject === subject) &&
      (source === "all" || (source === "class" ? d.kind !== "ASKED" : d.kind === "ASKED"))
  );

  async function remove(id: string) {
    setDeleteError(null);
    try {
      const res = await fetch(`/api/doubts/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        setDeleteError(body.error || "Could not delete this doubt.");
        return;
      }
      setItems((prev) => prev.filter((d) => d.id !== id));
      setConfirmDelete(null);
      router.refresh();
    } catch {
      setDeleteError("Network error. Please try again.");
    }
  }

  const formSubject = (SUBJECT_OPTIONS as readonly string[]).includes(subject) ? (subject as (typeof SUBJECT_OPTIONS)[number]) : undefined;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">My Doubts</h1>
          <p className="text-xs text-slate-500">Doubts you asked here and in your classes</p>
        </div>
        <button
          type="button"
          onClick={() => setAsking((v) => !v)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-black shadow-sm transition ${
            asking ? "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100" : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          <span className="material-symbols-outlined text-base">{asking ? "close" : "add"}</span>
          {asking ? "Close" : "Ask doubt"}
        </button>
      </div>

      {asking && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <DoubtForm key={formSubject ?? "none"} defaultSubject={formSubject} />
          <button
            type="button"
            onClick={() => setShowAi((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100"
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-violet-600">auto_awesome</span>
              Get an instant answer from Atomic AI Tutor
            </span>
            <span className="material-symbols-outlined text-slate-400">{showAi ? "expand_less" : "expand_more"}</span>
          </button>
          {showAi && <AiDoubtSolver />}
        </div>
      )}

      {/* Subject chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]">
        {[["All", items.length] as [string, number], ...subjects].map(([s, n]) => {
          const active = subject === s;
          const st = s === "All" ? { icon: "apps", tone: "" } : styleOf(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSubject(s)}
              className={`shrink-0 inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full text-xs font-bold border transition ${
                active
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                  : "bg-white text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{st.icon}</span>
              {s}
              <span className={`min-w-[18px] px-1 rounded-full text-[10px] ${active ? "bg-white/20 dark:bg-slate-900/10" : "bg-slate-100 dark:bg-slate-800"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 w-fit">
        {SOURCES.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setSource(o.id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
              source === o.id ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {deleteError && <p className="text-xs font-semibold text-rose-600">{deleteError}</p>}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-3">
          <p className="text-sm text-slate-500">
            {items.length === 0 ? "You haven't asked any doubts yet." : "No doubts here."}
          </p>
          {!asking && (
            <button type="button" onClick={() => setAsking(true)} className="text-xs font-black text-blue-600">
              Ask a doubt
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map((d) => {
            const st = styleOf(d.subject);
            const status = STATUS[d.status] ?? { label: d.status, cls: "bg-slate-100 text-slate-600" };
            const source =
              d.kind === "LIVE_CLASS"
                ? { icon: "sensors", label: "Asked in live class" }
                : d.kind === "RECORDED_CLASS"
                ? { icon: "smart_display", label: `Asked in recorded class${d.videoTimestampSec != null ? ` · at ${mmss(d.videoTimestampSec)}` : ""}` }
                : null;
            const content = (
              <>
                <div className="flex items-start gap-3">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${st.tone}`}>
                    <span className="material-symbols-outlined text-[20px]">{st.icon}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">{d.subject}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${status.cls}`}>{status.label}</span>
                    </div>
                    {source && (
                      <p className="mt-0.5 text-[11px] text-slate-500 flex items-center gap-1 min-w-0">
                        <span className="material-symbols-outlined text-[13px]">{source.icon}</span>
                        <span className="truncate">
                          {source.label}
                          {d.classTitle ? ` · ${d.classTitle}` : ""}
                        </span>
                      </p>
                    )}
                    <p className="mt-1.5 text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap line-clamp-4">{d.body}</p>
                    {d.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- user upload
                      <img src={d.imageUrl} alt="" className="mt-2 max-h-40 rounded-xl border border-slate-200 dark:border-slate-700 object-contain" />
                    )}
                    {d.answer && (
                      <div className="mt-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900 px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          {d.answeredBy ? `${d.answeredBy} replied` : "Answer"}
                        </p>
                        <p className="text-xs text-slate-800 dark:text-slate-100 whitespace-pre-wrap line-clamp-4">{d.answer}</p>
                      </div>
                    )}
                    <p className="mt-1.5 text-[10px] text-slate-400">{when(d.createdAt)}</p>
                  </div>
                </div>
              </>
            );
            return (
              <div key={d.id} className="relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 hover:border-blue-300 transition">
                {d.href ? <Link href={d.href} className="block">{content}</Link> : content}
                {d.deletable &&
                  (confirmDelete === d.id ? (
                    <div className="mt-2 flex items-center justify-end gap-2 text-xs">
                      <span className="text-slate-500">Delete this doubt?</span>
                      <button type="button" onClick={() => setConfirmDelete(null)} className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-bold">
                        No
                      </button>
                      <button type="button" onClick={() => remove(d.id)} className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold">
                        Delete
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(d.id)}
                      className="absolute top-2.5 right-2.5 p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      aria-label="Delete doubt"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
