"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StorageBanner } from "./RecordedLecturesManager";

type ChapterRow = {
  id: string;
  code: string | null;
  title: string;
  subject: string;
  course: string;
  batches: { id: string; name: string }[];
  lectures: number;
  published: number;
};
type Subject = { id: string; title: string; course: string };
type Batch = { id: string; name: string };

const field = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm";
const labelText = "text-xs font-bold text-slate-500 uppercase tracking-wide";

/**
 * Recorded lectures are organised chapter-first: create a chapter (or open
 * an existing one), add it to batches, then add lectures inside it.
 */
export function RecordedChaptersManager() {
  const router = useRouter();
  const [chapters, setChapters] = useState<ChapterRow[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [ncertNames, setNcertNames] = useState<Record<string, string[]>>({});
  const [storage, setStorage] = useState<any>();
  const [q, setQ] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (subjectFilter) sp.set("subjectId", subjectFilter);
    try {
      const res = await fetch(`/api/team/recorded-lectures/chapters?${sp}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not load chapters.");
      setChapters(json.data.chapters);
      setSubjects(json.data.subjects);
      setBatches(json.data.batches);
      setNcertNames(json.data.ncertNames ?? {});
      setStorage(json.data.storage);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      setChapters([]);
    }
  }, [q, subjectFilter]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Recorded Lectures</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create a chapter, add it to batches, then add its recorded lectures one by one. Students see the chapter with all its published lectures.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-bold"
        >
          <span className="material-symbols-outlined text-base">{creating ? "close" : "create_new_folder"}</span>
          {creating ? "Close" : "Create chapter"}
        </button>
      </header>

      <StorageBanner storage={storage} />

      {creating && (
        <CreateChapterForm
          subjects={subjects}
          batches={batches}
          ncertNames={ncertNames}
          onCreated={(id) => {
            toast.success("Chapter created. Now add its lectures.");
            router.push(`/team/recorded-lectures/chapters/${id}`);
          }}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
        <label className="flex-1 min-w-0">
          <span className="sr-only">Search chapters</span>
          <input id="rc-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any chapter by name (to use an existing one)" className={field} />
        </label>
        <label>
          <span className="sr-only">Subject</span>
          <select id="rc-subject" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className={`${field} sm:w-64`}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.course} › {s.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {chapters === null ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : chapters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500">
          {q ? "No chapter with that name." : "No recorded-lecture chapters yet. Create the first chapter."}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {chapters.map((c) => (
            <li key={c.id}>
              <Link
                href={`/team/recorded-lectures/chapters/${c.id}`}
                className="flex h-full flex-col gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-blue-300 dark:hover:border-blue-700 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-blue-600">
                      {c.course} › {c.subject}
                    </p>
                    <p className="font-extrabold text-slate-900 dark:text-white break-words">{c.title}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                    {c.lectures} lecture{c.lectures === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {c.published} published · {c.lectures - c.published} draft
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {c.batches.length ? (
                    c.batches.map((b) => (
                      <span key={b.id} className="rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-[11px] font-bold">
                        {b.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Not in any batch yet — students cannot see it</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateChapterForm({
  subjects,
  batches,
  ncertNames,
  onCreated,
}: {
  subjects: Subject[];
  batches: Batch[];
  ncertNames: Record<string, string[]>;
  onCreated: (id: string) => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [medium, setMedium] = useState("HINGLISH");
  const [description, setDescription] = useState("");
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Standard NCERT chapter names of the chosen subject, as suggestions.
  const suggestions = useMemo(() => {
    const s = subjects.find((x) => x.id === subjectId);
    return s ? ncertNames[s.title] ?? [] : [];
  }, [subjects, subjectId, ncertNames]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/team/recorded-lectures/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, title, medium, description: description || null, batchIds }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not create the chapter.");
      onCreated(json.data.chapterId);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 p-4 space-y-4">
      <h2 className="font-bold text-slate-900 dark:text-white">New chapter</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelText}>Subject *</span>
          <select id="rc-new-subject" required value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={`${field} mt-1`}>
            <option value="">Choose subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.course} › {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelText}>Chapter name *</span>
          <input id="rc-new-title" required minLength={2} maxLength={200} list="rc-ncert-names" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Evolution" className={`${field} mt-1`} />
          <datalist id="rc-ncert-names">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className={labelText}>Medium</span>
          <select id="rc-new-medium" value={medium} onChange={(e) => setMedium(e.target.value)} className={`${field} mt-1`}>
            <option value="HINGLISH">Hinglish</option>
            <option value="HINDI">Hindi</option>
            <option value="ENGLISH">English</option>
          </select>
        </label>
        <label className="block">
          <span className={labelText}>Description (optional)</span>
          <input id="rc-new-desc" value={description} onChange={(e) => setDescription(e.target.value)} className={`${field} mt-1`} />
        </label>
      </div>
      <fieldset>
        <legend className={labelText}>Add to batches</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {batches.map((b) => {
            const on = batchIds.includes(b.id);
            return (
              <button
                key={b.id}
                type="button"
                aria-pressed={on}
                onClick={() => setBatchIds((cur) => (on ? cur.filter((x) => x !== b.id) : [...cur, b.id]))}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition ${on ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}
              >
                {on ? "✓ " : ""}
                {b.name}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-500 mt-1">You can also add or remove batches later on the chapter page.</p>
      </fieldset>
      <div className="flex justify-end">
        <button type="submit" disabled={saving || !subjectId || title.trim().length < 2} className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold px-5 py-2">
          {saving ? "Creating…" : "Create chapter"}
        </button>
      </div>
    </form>
  );
}
