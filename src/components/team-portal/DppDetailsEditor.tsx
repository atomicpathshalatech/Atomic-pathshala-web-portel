"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DPP_CLASSES, DPP_EXAMS } from "@/lib/dpp/hierarchy";

type Details = {
  dppNumber: number | null;
  className: string | null;
  exam: string | null;
  chapter: string;
  topic: string | null;
  subTopic: string | null;
  facultyName: string | null;
};

/** Edit the front-page details (DPP No, Class, Exam, Chapter, Topic, Sub-topic, Teacher) of an existing DPP. */
export function DppDetailsEditor({ dppId, subject, initial }: { dppId: string; subject: string; initial: Details }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    dppNumber: initial.dppNumber ? String(initial.dppNumber) : "",
    className: initial.className ?? "",
    exam: initial.exam ?? "",
    chapterName: initial.chapter === "Unclassified" ? "" : initial.chapter,
    topic: initial.topic ?? "",
    subTopic: initial.subTopic ?? "",
    facultyName: initial.facultyName ?? "",
  });
  const [chapters, setChapters] = useState<string[]>([]);
  const [topics, setTopics] = useState<{ title: string; subtopics: string[] }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const qs = new URLSearchParams({ subject, className: f.className });
    fetch(`/api/team/dpp/taxonomy?${qs}`)
      .then((r) => r.json())
      .then((b) => b?.success && setChapters((b.data.chapters ?? []).map((c: { title: string }) => c.title)))
      .catch(() => {});
  }, [open, subject, f.className]);

  useEffect(() => {
    if (!open || !f.chapterName.trim()) return setTopics([]);
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ subject, chapter: f.chapterName.trim() });
      fetch(`/api/team/dpp/taxonomy?${qs}`)
        .then((r) => r.json())
        .then((b) => b?.success && setTopics(b.data.topics ?? []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [open, subject, f.chapterName]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/dpp/${dppId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          dppNumber: f.dppNumber ? Number(f.dppNumber) : undefined,
          chapterName: f.chapterName || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        setError(body?.error ?? "Could not save.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not save. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const subtopics = topics.find((t) => t.title === f.topic)?.subtopics ?? [];

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1"
      >
        <span className="material-symbols-outlined text-[16px]">edit</span>
        Edit details
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3">
      <h3 className="text-sm font-black text-slate-900 dark:text-white">Front page details</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="DPP No.">
          <input type="number" min={1} className={input} value={f.dppNumber} onChange={set("dppNumber")} placeholder="—" />
        </Field>
        <Field label="Class">
          <select className={input} value={f.className} onChange={set("className")}>
            <option value="">—</option>
            {DPP_CLASSES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Exam">
          <input className={input} list="dpp-exams" value={f.exam} onChange={set("exam")} placeholder="NEET" />
        </Field>
        <Field label="Teacher">
          <input className={input} value={f.facultyName} onChange={set("facultyName")} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Chapter">
          <input className={input} list="dpp-chapters" value={f.chapterName} onChange={set("chapterName")} />
        </Field>
        <Field label="Topic">
          <input className={input} list="dpp-topics" value={f.topic} onChange={set("topic")} />
        </Field>
        <Field label="Sub-topic">
          <input className={input} list="dpp-subtopics" value={f.subTopic} onChange={set("subTopic")} />
        </Field>
      </div>
      <datalist id="dpp-exams">{DPP_EXAMS.map((e) => <option key={e} value={e} />)}</datalist>
      <datalist id="dpp-chapters">{chapters.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="dpp-topics">{topics.map((t) => <option key={t.title} value={t.title} />)}</datalist>
      <datalist id="dpp-subtopics">{subtopics.map((s) => <option key={s} value={s} />)}</datalist>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={saving} className="h-8 px-4 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

const input =
  "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-400/40";
