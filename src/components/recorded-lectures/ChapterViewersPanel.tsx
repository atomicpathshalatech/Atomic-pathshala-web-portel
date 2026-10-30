"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Student = { id: string; name: string; code: string; phone: string; selected: boolean };

/**
 * The students who may watch this chapter's recorded lectures, per batch:
 * tick them one by one. Nobody else sees the lectures — not the rest of the
 * batch, not the team — anywhere (batch page, chapter, schedule), and the
 * link does not open for them.
 */
export function ChapterViewersPanel({ chapterId, batches }: { chapterId: string; batches: { id: string; name: string }[] }) {
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [students, setStudents] = useState<Student[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/recorded-lectures/chapters/${chapterId}/viewers?batchId=${encodeURIComponent(batchId)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Could not load the students.");
      const list = json.data.students as Student[];
      setStudents(list);
      const ids = new Set(list.filter((s) => s.selected).map((s) => s.id));
      setChosen(ids);
      setSaved(new Set(ids));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [chapterId, batchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.phone.includes(q));
  }, [students, query]);

  const toggle = (id: string, on: boolean) =>
    setChosen((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const dirty = chosen.size !== saved.size || Array.from(chosen).some((id) => !saved.has(id));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/team/recorded-lectures/chapters/${chapterId}/viewers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, studentIds: Array.from(chosen) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Could not save.");
      setSaved(new Set(chosen));
      toast.success(json.data.count ? `Saved — ${json.data.count} student(s) can watch.` : "Saved — no student can watch now.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <span className="material-symbols-outlined text-blue-600 text-xl">lock_person</span>
        Students who can watch
      </h2>
      <p className="text-xs text-slate-500">
        Only the students ticked here see this chapter&apos;s recorded lectures — nobody else in the batch, and no team member. Others do not see them
        anywhere and the link does not open for them.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        {batches.length > 1 && (
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            aria-label="Batch"
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, ID or phone"
          className="w-full sm:max-w-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-3 text-xs font-bold sm:ml-auto">
          <span className="text-slate-600 dark:text-slate-300">
            {chosen.size} of {students.length} chosen
          </span>
          <button type="button" onClick={() => setChosen(new Set(students.map((s) => s.id)))} className="text-blue-600 hover:underline">
            All
          </button>
          <button type="button" onClick={() => setChosen(new Set())} className="text-slate-500 hover:underline">
            None
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {loading ? (
        <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      ) : students.length === 0 ? (
        <p className="text-sm text-slate-500">No active students in this batch.</p>
      ) : (
        <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
          {shown.map((s) => (
            <li key={s.id}>
              <label className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <input type="checkbox" className="w-4 h-4" checked={chosen.has(s.id)} onChange={(e) => toggle(s.id, e.target.checked)} />
                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{s.name}</span>
                <span className="text-xs text-slate-500 truncate">{[s.code, s.phone].filter(Boolean).join(" · ")}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Not saved yet</span>}
        <button type="button" onClick={save} disabled={saving || loading || !dirty} className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </section>
  );
}
