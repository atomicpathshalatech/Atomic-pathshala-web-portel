"use client";

import React, { forwardRef, useState } from "react";
import { CheckCircle2, Sparkles, Sliders, Plus } from "lucide-react";

type Difficulty = "EASY" | "MEDIUM" | "HARD" | "ULTRA";

export interface QuestionMetadataPanelProps {
  slotLabel?: string;
  subject: string;
  chapter: string;
  setChapter: (v: string) => void;
  topic: string;
  setTopic: (v: string) => void;
  subTopic: string;
  setSubTopic: (v: string) => void;
  difficulty: Difficulty;
  setDifficulty: (v: Difficulty) => void;
  questionType: string;
  setQuestionType: (v: string) => void;
  marks: number;
  setMarks: (v: number) => void;
  negativeMarks: number;
  setNegativeMarks: (v: number) => void;
  chapterOptions: string[];
  topicOptions: Array<{ title: string; subtopics?: string[] }>;
  /** The test/DPP syllabus limits the chapters (shown as a note). */
  syllabusLocked: boolean;
  /** Filled in by the AI and not yet checked by the teacher. */
  fromAi: boolean;
  confirmed: boolean;
  onConfirm: () => void;
  missing: Record<string, boolean>;
  onMore: () => void;
  onAddTopic: (title: string) => void;
  isSavingTaxonomy?: boolean;
}

const selectCls =
  "w-full h-8 px-2 rounded-lg border bg-white text-xs font-semibold text-slate-800 outline-none focus:border-blue-500";

/**
 * The question's metadata, at the bottom of the editor just above Save —
 * after writing the question and its solution the teacher checks it here
 * instead of scrolling back to the top. Saving needs the "checked" click.
 */
export const QuestionMetadataPanel = forwardRef<HTMLDivElement, QuestionMetadataPanelProps>(function QuestionMetadataPanel(
  {
    slotLabel,
    subject,
    chapter,
    setChapter,
    topic,
    setTopic,
    subTopic,
    setSubTopic,
    difficulty,
    setDifficulty,
    questionType,
    setQuestionType,
    marks,
    setMarks,
    negativeMarks,
    setNegativeMarks,
    chapterOptions,
    topicOptions,
    syllabusLocked,
    fromAi,
    confirmed,
    onConfirm,
    missing,
    onMore,
    onAddTopic,
    isSavingTaxonomy,
  },
  ref
) {
  const [addingTopic, setAddingTopic] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const subtopics = topicOptions.find((t) => t.title === topic)?.subtopics ?? [];
  const border = (bad?: boolean) => (bad ? "border-rose-400 bg-rose-50" : "border-slate-200");
  const needsCheck = !confirmed;

  return (
    <div
      ref={ref}
      data-section="metadata"
      className={`rounded-2xl border p-3 sm:p-4 bg-white shadow-xs transition ${
        needsCheck ? "border-amber-300 ring-2 ring-amber-400/20" : "border-emerald-300"
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Metadata{slotLabel ? ` · ${slotLabel}` : ""}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 text-[11px] font-black border border-blue-200">{subject}</span>
          {fromAi && needsCheck && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[10px] font-bold border border-violet-200">
              <Sparkles className="w-3 h-3" /> AI filled — please check
            </span>
          )}
          {syllabusLocked && (
            <span className="text-[10px] text-slate-500">Chapters limited to this paper&apos;s syllabus</span>
          )}
        </div>
        <button
          type="button"
          onClick={onMore}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-100"
          title="Category, PYQ details and more"
        >
          <Sliders className="w-3.5 h-3.5" /> More
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <label className="space-y-0.5 col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Chapter *</span>
          <select value={chapter} onChange={(e) => { setChapter(e.target.value); setTopic(""); setSubTopic(""); }} className={`${selectCls} ${border(missing.chapter)}`}>
            <option value="">Select chapter</option>
            {chapter && !chapterOptions.includes(chapter) && <option value={chapter}>{chapter}</option>}
            {chapterOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="space-y-0.5 col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
            Topic *
            {chapter && !addingTopic && (
              <button type="button" onClick={() => setAddingTopic(true)} className="inline-flex items-center text-blue-600 hover:text-blue-800 normal-case" title="Add a topic to the catalog">
                <Plus className="w-3 h-3" />new
              </button>
            )}
          </span>
          {addingTopic ? (
            <div className="flex gap-1">
              <input
                autoFocus
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder="New topic name"
                className={`${selectCls} border-blue-300`}
              />
              <button
                type="button"
                disabled={!newTopic.trim() || isSavingTaxonomy}
                onClick={() => {
                  onAddTopic(newTopic.trim());
                  setNewTopic("");
                  setAddingTopic(false);
                }}
                className="px-2 rounded-lg bg-blue-600 text-white text-[11px] font-bold disabled:opacity-50"
              >
                Add
              </button>
              <button type="button" onClick={() => setAddingTopic(false)} className="px-1.5 text-slate-400 text-xs">✕</button>
            </div>
          ) : (
            <select value={topic} onChange={(e) => { setTopic(e.target.value); setSubTopic(""); }} disabled={!chapter} className={`${selectCls} ${border(missing.topic)} disabled:opacity-50`}>
              <option value="">{chapter ? "Select topic" : "Pick chapter first"}</option>
              {topic && !topicOptions.some((t) => t.title === topic) && <option value={topic}>{topic}</option>}
              {topicOptions.map((t) => (
                <option key={t.title} value={t.title}>{t.title}</option>
              ))}
            </select>
          )}
        </label>

        <label className="space-y-0.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Sub-topic</span>
          {subtopics.length > 0 ? (
            <select value={subTopic} onChange={(e) => setSubTopic(e.target.value)} className={`${selectCls} border-slate-200`}>
              <option value="">—</option>
              {subTopic && !subtopics.includes(subTopic) && <option value={subTopic}>{subTopic}</option>}
              {subtopics.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ) : (
            <input value={subTopic} onChange={(e) => setSubTopic(e.target.value)} placeholder="Optional" className={`${selectCls} border-slate-200`} />
          )}
        </label>

        <label className="space-y-0.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Type</span>
          <select value={questionType} onChange={(e) => setQuestionType(e.target.value)} className={`${selectCls} border-slate-200`}>
            <option value="SINGLE_CORRECT">Single correct</option>
            <option value="MULTIPLE_CORRECT">Multiple correct</option>
            <option value="ASSERTION_REASON">Assertion &amp; Reason</option>
            <option value="STATEMENT_BASED">Statement based</option>
            <option value="MATCH_COLUMN">Match the columns</option>
            <option value="NUMERICAL">Numerical</option>
          </select>
        </label>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            {(["EASY", "MEDIUM", "HARD", "ULTRA"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`px-2 h-7 rounded-lg text-[10px] font-black border transition ${
                  difficulty === d ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold">
            <span className="text-emerald-600">+</span>
            <input type="number" value={marks} onChange={(e) => setMarks(Number(e.target.value))} className="w-12 h-7 px-1.5 rounded-lg border border-slate-200 text-xs font-black" />
            <span className="text-rose-600 ml-1">−</span>
            <input type="number" value={negativeMarks} onChange={(e) => setNegativeMarks(Number(e.target.value))} className="w-12 h-7 px-1.5 rounded-lg border border-slate-200 text-xs font-black" />
          </div>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-black transition ${
            confirmed
              ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
              : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          {confirmed ? "Metadata checked" : "Confirm metadata"}
        </button>
      </div>
    </div>
  );
});
