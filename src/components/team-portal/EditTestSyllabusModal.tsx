"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { BookOpen, Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { getMasterNcertChapters, getMasterNcertTopics } from "@/lib/academic/master-ncert-catalog";

/**
 * Edit the syllabus of an existing test: add / remove chapters, switch a
 * chapter between "complete chapter" and chosen topics, add custom chapters
 * and topics. Saves only the syllabus (PATCH /api/team/tests/:id/syllabus) —
 * the test's questions, schedule and sections are not touched. The syllabus
 * PDF is built from the saved syllabus, so it updates by itself.
 */

type Chapter = {
  id: string;
  subject: string;
  chapterTitle: string;
  isComplete: boolean;
  /** Topics included when the chapter is not complete. */
  topics: string[];
  /** Topics the team typed themselves. */
  customTopics: string[];
  /** Every topic that can be chosen for this chapter. */
  allTopics: string[];
};

const SUBJECTS = ["Physics", "Chemistry", "Biology", "Mathematics", "Botany", "Zoology"];
const uid = () => `ch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const uniq = (list: string[]) => Array.from(new Set(list.map((t) => t.trim()).filter(Boolean)));

function toChapter(raw: unknown): Chapter | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const chapterTitle = typeof r.chapterTitle === "string" ? r.chapterTitle.trim() : typeof r.title === "string" ? r.title.trim() : "";
  if (!chapterTitle) return null;
  const subject = typeof r.subject === "string" && r.subject.trim() ? r.subject.trim() : "General";
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const topics = uniq(list(r.topics));
  const customTopics = uniq(list(r.customTopics));
  const official = getMasterNcertTopics(subject, chapterTitle).map((t) => t.title);
  return {
    id: typeof r.id === "string" && r.id ? r.id : uid(),
    subject,
    chapterTitle,
    isComplete: r.isComplete !== false,
    topics,
    customTopics,
    allTopics: uniq([...official, ...customTopics, ...topics]),
  };
}

const inputClass =
  "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30";

export function EditTestSyllabusModal({ testId, testName, onClose }: { testId: string; testName: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [dirty, setDirty] = useState(false);

  const [subject, setSubject] = useState("Physics");
  const [classFilter, setClassFilter] = useState<number | null>(null);
  const [pickId, setPickId] = useState("");
  const [customChapter, setCustomChapter] = useState("");
  const [topicDraft, setTopicDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    fetch(`/api/team/tests/${testId}/syllabus`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        if (!json?.success) {
          setLoadError(json?.error || "Could not load this test's syllabus.");
          return;
        }
        const loaded = (json.data.chapters as unknown[]).map(toChapter).filter((c): c is Chapter => c !== null);
        setChapters(loaded);
        if (loaded[0] && SUBJECTS.includes(loaded[0].subject)) setSubject(loaded[0].subject);
      })
      .catch(() => alive && setLoadError("Could not load this test's syllabus."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [testId]);

  const available = useMemo(() => {
    const all = getMasterNcertChapters(subject);
    return classFilter ? all.filter((c) => c.classNumber === classFilter) : all;
  }, [subject, classFilter]);

  useEffect(() => {
    if (!available.some((c) => c.id === pickId)) setPickId(available[0]?.id ?? "");
  }, [available, pickId]);

  const has = (title: string, subj: string) =>
    chapters.some((c) => c.subject.toLowerCase() === subj.toLowerCase() && c.chapterTitle.toLowerCase() === title.toLowerCase());

  function change(next: Chapter[]) {
    setChapters(next);
    setDirty(true);
  }

  function addPicked() {
    const ch = available.find((c) => c.id === pickId);
    if (!ch) return;
    const title = ch.displayTitle || ch.title;
    if (has(title, subject)) return toast.error("This chapter is already in the syllabus.");
    const official = getMasterNcertTopics(subject, ch.title).map((t) => t.title);
    change([...chapters, { id: uid(), subject, chapterTitle: title, isComplete: true, topics: official, customTopics: [], allTopics: official }]);
  }

  function addAll() {
    const add: Chapter[] = [];
    for (const ch of available) {
      const title = ch.displayTitle || ch.title;
      if (has(title, subject) || add.some((a) => a.chapterTitle === title)) continue;
      const official = getMasterNcertTopics(subject, ch.title).map((t) => t.title);
      add.push({ id: uid(), subject, chapterTitle: title, isComplete: true, topics: official, customTopics: [], allTopics: official });
    }
    if (add.length === 0) return toast.info(`All ${subject} chapters shown are already in the syllabus.`);
    change([...chapters, ...add]);
  }

  function addCustomChapter() {
    const title = customChapter.trim();
    if (!title) return;
    if (has(title, subject)) return toast.error("This chapter is already in the syllabus.");
    change([...chapters, { id: uid(), subject, chapterTitle: title, isComplete: true, topics: [], customTopics: [], allTopics: [] }]);
    setCustomChapter("");
  }

  const update = (id: string, fn: (c: Chapter) => Chapter) => change(chapters.map((c) => (c.id === id ? fn(c) : c)));

  function toggleComplete(id: string) {
    update(id, (c) => ({ ...c, isComplete: !c.isComplete, topics: c.isComplete ? (c.topics.length ? c.topics : c.allTopics) : c.allTopics }));
  }

  function toggleTopic(id: string, topic: string) {
    update(id, (c) => ({ ...c, topics: c.topics.includes(topic) ? c.topics.filter((t) => t !== topic) : [...c.topics, topic] }));
  }

  function addTopic(id: string) {
    const topic = (topicDraft[id] || "").trim();
    if (!topic) return;
    update(id, (c) => ({
      ...c,
      customTopics: uniq([...c.customTopics, topic]),
      allTopics: uniq([...c.allTopics, topic]),
      topics: uniq([...c.topics, topic]),
    }));
    setTopicDraft((d) => ({ ...d, [id]: "" }));
  }

  async function save() {
    const empty = chapters.find((c) => !c.isComplete && c.topics.length === 0);
    if (empty) return toast.error(`Choose at least one topic for "${empty.chapterTitle}", or mark it as complete chapter.`);
    setSaving(true);
    try {
      const res = await fetch(`/api/team/tests/${testId}/syllabus`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapters: chapters.map((c) => ({
            id: c.id,
            subject: c.subject,
            chapterTitle: c.chapterTitle,
            isComplete: c.isComplete,
            topics: c.isComplete ? [] : c.topics,
            customTopics: c.customTopics,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "Could not save the syllabus.");
        return;
      }
      toast.success("Syllabus updated. The syllabus PDF now shows the new syllabus.");
      onClose();
    } catch {
      toast.error("Network error while saving the syllabus.");
    } finally {
      setSaving(false);
    }
  }

  function close() {
    if (dirty && !window.confirm("Close without saving the syllabus changes?")) return;
    onClose();
  }

  const subjectsInUse = Array.from(new Set(chapters.map((c) => c.subject)));

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Edit Syllabus
            </h3>
            <p className="text-xs text-slate-500 truncate">{testName}</p>
          </div>
          <button type="button" onClick={close} className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
            Loading syllabus…
          </div>
        ) : loadError ? (
          <div className="p-10 text-center text-sm text-rose-600">{loadError}</div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Add chapters */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Add chapters</p>
              <div className="flex flex-wrap gap-1.5">
                {SUBJECTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSubject(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      subject === s ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {s}
                    {chapters.some((c) => c.subject === s) ? ` (${chapters.filter((c) => c.subject === s).length})` : ""}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select className={`${inputClass} w-auto`} value={classFilter ?? ""} onChange={(e) => setClassFilter(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">All classes</option>
                  <option value="11">Class 11</option>
                  <option value="12">Class 12</option>
                </select>
                <select className={`${inputClass} flex-1 min-w-[12rem]`} value={pickId} onChange={(e) => setPickId(e.target.value)} disabled={available.length === 0}>
                  {available.length === 0 && <option value="">No syllabus chapters for this subject — add a custom chapter</option>}
                  {available.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayTitle || c.title}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={addPicked} disabled={!pickId} className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold inline-flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
                <button type="button" onClick={addAll} disabled={available.length === 0} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40">
                  Add all ({available.length})
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className={inputClass}
                  placeholder={`Custom chapter name (${subject})`}
                  value={customChapter}
                  onChange={(e) => setCustomChapter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomChapter();
                    }
                  }}
                />
                <button type="button" onClick={addCustomChapter} disabled={!customChapter.trim()} className="shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40">
                  Add custom
                </button>
              </div>
            </div>

            {/* Current syllabus */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Syllabus of this test — {chapters.length} chapter{chapters.length === 1 ? "" : "s"}
              </p>
              {chapters.length === 0 && (
                <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs text-slate-500">
                  No chapters yet — the syllabus PDF will read &quot;Full Syllabus&quot;. Add chapters above.
                </p>
              )}
              {subjectsInUse.map((s) => (
                <div key={s} className="space-y-2">
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{s}</p>
                  {chapters
                    .filter((c) => c.subject === s)
                    .map((c) => (
                      <div key={c.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{c.chapterTitle}</p>
                          <button
                            type="button"
                            onClick={() => change(chapters.filter((x) => x.id !== c.id))}
                            className="shrink-0 w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center"
                            title="Remove this chapter from the syllabus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                          <input type="checkbox" checked={c.isComplete} onChange={() => toggleComplete(c.id)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/30" />
                          Complete chapter (all topics)
                        </label>
                        {!c.isComplete && (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1.5">
                              {c.allTopics.length === 0 && <span className="text-[11px] text-slate-500">No topics listed — add the topics below.</span>}
                              {c.allTopics.map((t) => {
                                const on = c.topics.includes(t);
                                return (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => toggleTopic(c.id, t)}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition inline-flex items-center gap-1 ${
                                      on
                                        ? "bg-blue-600 border-blue-600 text-white"
                                        : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400"
                                    }`}
                                  >
                                    {on && <Check className="w-3 h-3" />}
                                    {t}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                className={inputClass}
                                placeholder="Add a topic"
                                value={topicDraft[c.id] || ""}
                                onChange={(e) => setTopicDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addTopic(c.id);
                                  }
                                }}
                              />
                              <button type="button" onClick={() => addTopic(c.id)} className="shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                                Add topic
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 dark:border-slate-800">
          <a href={`/api/tests/${testId}/syllabus-pdf`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600 hover:underline">
            View saved syllabus PDF
          </a>
          <div className="flex items-center gap-2">
            <button type="button" onClick={close} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={loading || saving || Boolean(loadError) || !dirty} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold inline-flex items-center gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save syllabus
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
