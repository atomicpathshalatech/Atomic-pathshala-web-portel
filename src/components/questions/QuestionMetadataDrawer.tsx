"use client";

import React, { useState } from "react";
import {
  Sliders,
  X,
  BookOpen,
  CheckCircle2,
  Sparkles,
  Layers,
  HelpCircle,
  Award,
  Tag,
} from "lucide-react";

export interface QuestionMetadataDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  setSubject: (sub: string) => void;
  chapter: string;
  setChapter: (chap: string) => void;
  topic: string;
  setTopic: (top: string) => void;
  subTopic: string;
  setSubTopic: (subTop: string) => void;
  questionType: string;
  setQuestionType: (t: string) => void;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "ULTRA";
  setDifficulty: (d: "EASY" | "MEDIUM" | "HARD" | "ULTRA") => void;
  category: string;
  setCategory: (c: string) => void;
  pyqExam: string;
  setPyqExam: (e: string) => void;
  pyqYear: string;
  setPyqYear: (y: string) => void;
  pyqMonth: string;
  setPyqMonth: (m: string) => void;
  pyqQuestionNumber: string;
  setPyqQuestionNumber: (n: string) => void;
  marks: number;
  setMarks: (m: number) => void;
  negativeMarks: number;
  setNegativeMarks: (m: number) => void;
  subjectsList: Array<{ id: string; name: string }>;
  chaptersList: Array<{ id: string; title: string; displayTitle?: string }>;
  topicsList: Array<{ id: string; title: string; subtopics?: string[] }>;
  missingFieldErrors: Record<string, boolean>;
  onSaveNewTopic: (name: string) => Promise<void>;
  onSaveNewSubtopic: (name: string) => Promise<void>;
  isSavingTaxonomy: boolean;
}

export function QuestionMetadataDrawer({
  isOpen,
  onClose,
  subject,
  setSubject,
  chapter,
  setChapter,
  topic,
  setTopic,
  subTopic,
  setSubTopic,
  questionType,
  setQuestionType,
  difficulty,
  setDifficulty,
  category,
  setCategory,
  pyqExam,
  setPyqExam,
  pyqYear,
  setPyqYear,
  pyqMonth,
  setPyqMonth,
  pyqQuestionNumber,
  setPyqQuestionNumber,
  marks,
  setMarks,
  negativeMarks,
  setNegativeMarks,
  subjectsList,
  chaptersList,
  topicsList,
  missingFieldErrors,
  onSaveNewTopic,
  onSaveNewSubtopic,
  isSavingTaxonomy,
}: QuestionMetadataDrawerProps) {
  const [isAddingCustomTopic, setIsAddingCustomTopic] = useState(false);
  const [customTopicInput, setCustomTopicInput] = useState("");
  const [isAddingCustomSubtopic, setIsAddingCustomSubtopic] = useState(false);
  const [customSubtopicInput, setCustomSubtopicInput] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 tracking-tight">
                  Question Metadata &amp; Taxonomy
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  NCERT alignment, syllabus tagging &amp; scoring rules
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Fields */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs">
            {/* Subject */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700">
                Subject <span className="text-rose-500">*</span>
              </label>
              <select
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setChapter("");
                  setTopic("");
                }}
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-2xl font-bold text-slate-800 outline-none transition focus:bg-white focus:border-blue-500 ${
                  missingFieldErrors.subject ? "border-rose-500 bg-rose-50" : "border-slate-200"
                }`}
              >
                {subjectsList.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Chapter */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700">
                NCERT Chapter <span className="text-rose-500">*</span>
              </label>
              <select
                value={chapter}
                onChange={(e) => {
                  setChapter(e.target.value);
                  setTopic("");
                }}
                disabled={!subject}
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-2xl font-semibold text-slate-800 outline-none transition focus:bg-white focus:border-blue-500 disabled:opacity-50 ${
                  missingFieldErrors.chapter ? "border-rose-500 bg-rose-50" : "border-slate-200"
                }`}
              >
                <option value="">-- Select Chapter --</option>
                {chaptersList.map((c) => (
                  <option key={c.id} value={c.title}>
                    {c.displayTitle || c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Topic */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700">
                  Topic <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingCustomTopic(!isAddingCustomTopic)}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition flex items-center gap-0.5 cursor-pointer"
                >
                  {isAddingCustomTopic ? "✕ Cancel" : "+ Custom Topic"}
                </button>
              </div>

              {isAddingCustomTopic ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="New Topic name..."
                    value={customTopicInput}
                    onChange={(e) => setCustomTopicInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onSaveNewTopic(customTopicInput);
                        setCustomTopicInput("");
                        setIsAddingCustomTopic(false);
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-blue-400 rounded-xl font-semibold text-slate-900 outline-none text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onSaveNewTopic(customTopicInput);
                      setCustomTopicInput("");
                      setIsAddingCustomTopic(false);
                    }}
                    disabled={isSavingTaxonomy}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shrink-0 transition cursor-pointer"
                  >
                    {isSavingTaxonomy ? "..." : "Save"}
                  </button>
                </div>
              ) : (
                <select
                  value={topic}
                  onChange={(e) => {
                    if (e.target.value === "__NEW_TOPIC__") {
                      setIsAddingCustomTopic(true);
                    } else {
                      setTopic(e.target.value);
                    }
                  }}
                  disabled={!chapter}
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-2xl font-semibold text-slate-800 outline-none transition focus:bg-white focus:border-blue-500 disabled:opacity-50 ${
                    missingFieldErrors.topic ? "border-rose-500 bg-rose-50" : "border-slate-200"
                  }`}
                >
                  <option value="">-- Select Topic --</option>
                  {topicsList.map((t) => (
                    <option key={t.id || t.title} value={t.title}>
                      {t.title}
                    </option>
                  ))}
                  <option value="__NEW_TOPIC__">+ Add Custom Topic to Catalog...</option>
                </select>
              )}
            </div>

            {/* Sub-Topic (Optional) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700">Sub-Topic (Optional)</label>
                <button
                  type="button"
                  onClick={() => setIsAddingCustomSubtopic(!isAddingCustomSubtopic)}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition flex items-center gap-0.5 cursor-pointer"
                >
                  {isAddingCustomSubtopic ? "✕ Cancel" : "+ Custom Subtopic"}
                </button>
              </div>

              {isAddingCustomSubtopic ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="New Subtopic name..."
                    value={customSubtopicInput}
                    onChange={(e) => setCustomSubtopicInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onSaveNewSubtopic(customSubtopicInput);
                        setCustomSubtopicInput("");
                        setIsAddingCustomSubtopic(false);
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-blue-400 rounded-xl font-medium text-slate-900 outline-none text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onSaveNewSubtopic(customSubtopicInput);
                      setCustomSubtopicInput("");
                      setIsAddingCustomSubtopic(false);
                    }}
                    disabled={isSavingTaxonomy}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shrink-0 transition cursor-pointer"
                  >
                    {isSavingTaxonomy ? "..." : "Save"}
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    list="subtopics-drawer-datalist"
                    placeholder="Select or enter sub-topic..."
                    value={subTopic}
                    onChange={(e) => setSubTopic(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-slate-800 outline-none transition focus:bg-white focus:border-blue-500"
                  />
                  <datalist id="subtopics-drawer-datalist">
                    {topicsList
                      .find((t) => t.title.toLowerCase() === topic.toLowerCase())
                      ?.subtopics?.map((st) => (
                        <option key={st} value={st} />
                      ))}
                  </datalist>
                </div>
              )}
            </div>

            {/* Difficulty & Type Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Question Type */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Question Type</label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none transition focus:bg-white focus:border-blue-500"
                >
                  <option value="SINGLE_CORRECT">Single Correct (MCQ)</option>
                  <option value="MULTIPLE_CORRECT">Multiple Correct</option>
                  <option value="ASSERTION_REASON">Assertion &amp; Reason</option>
                  <option value="STATEMENT_BASED">Statement-Based</option>
                  <option value="MATCH_COLUMN">Match The Columns</option>
                  <option value="NUMERICAL">Numerical / Integer</option>
                </select>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Category</label>
                <select
                  value={category}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCategory(val);
                    if (val === "NEET_PYQ") setPyqExam("NEET");
                    else if (val === "JEE_MAINS_PYQ") setPyqExam("JEE_MAINS");
                    else if (val === "JEE_ADVANCED_PYQ") setPyqExam("JEE_ADVANCED");
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-slate-800 outline-none transition focus:bg-white focus:border-blue-500"
                >
                  <option value="NCERT Canonical">NCERT Canonical</option>
                  <option value="NEET_PYQ">NEET PYQ</option>
                  <option value="JEE_MAINS_PYQ">JEE Mains PYQ</option>
                  <option value="JEE_ADVANCED_PYQ">JEE Advanced PYQ</option>
                  <option value="PYQ Inspired">PYQ Inspired</option>
                  <option value="Exemplar">NCERT Exemplar</option>
                  <option value="High-Yield Concept">High-Yield Concept</option>
                </select>
              </div>
            </div>

            {/* Difficulty Selector */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700">Difficulty Level</label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 text-center font-black text-xs">
                {(["EASY", "MEDIUM", "HARD", "ULTRA"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`py-2 rounded-xl transition ${
                      difficulty === d
                        ? d === "EASY"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : d === "MEDIUM"
                          ? "bg-blue-600 text-white shadow-sm"
                          : d === "HARD"
                          ? "bg-amber-600 text-white shadow-sm"
                          : "bg-purple-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Marking Scheme */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700">Marking Scheme</label>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-2xl">
                  <span className="text-emerald-700 font-bold mr-1.5">+</span>
                  <input
                    type="number"
                    value={marks}
                    onChange={(e) => setMarks(Number(e.target.value))}
                    className="w-full bg-transparent font-black text-emerald-800 outline-none"
                  />
                  <span className="text-[10px] font-bold text-emerald-600 uppercase ml-1">Correct</span>
                </div>
                <div className="flex-1 flex items-center bg-rose-50 border border-rose-200 px-3.5 py-2 rounded-2xl">
                  <span className="text-rose-700 font-bold mr-1.5">-</span>
                  <input
                    type="number"
                    value={negativeMarks}
                    onChange={(e) => setNegativeMarks(Number(e.target.value))}
                    className="w-full bg-transparent font-black text-rose-800 outline-none"
                  />
                  <span className="text-[10px] font-bold text-rose-600 uppercase ml-1">Wrong</span>
                </div>
              </div>
            </div>

            {/* PYQ Details if Applicable */}
            {(category === "NEET_PYQ" ||
              category === "JEE_MAINS_PYQ" ||
              category === "JEE_ADVANCED_PYQ" ||
              pyqExam) && (
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black tracking-wide text-amber-900 uppercase">
                    PYQ Exam &amp; Session
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 font-mono text-[10px] font-bold">
                    {pyqExam || "PYQ"} {pyqYear}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Exam</label>
                    <select
                      value={pyqExam}
                      onChange={(e) => setPyqExam(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl font-medium text-slate-800 outline-none"
                    >
                      <option value="NEET">NEET</option>
                      <option value="JEE_MAINS">JEE Mains</option>
                      <option value="JEE_ADVANCED">JEE Advanced</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Year</label>
                    <select
                      value={pyqYear}
                      onChange={(e) => setPyqYear(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl font-medium text-slate-800 outline-none"
                    >
                      {Array.from({ length: 20 }, (_, i) => 2026 - i).map((y) => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Question #</label>
                  <input
                    type="text"
                    value={pyqQuestionNumber}
                    onChange={(e) => setPyqQuestionNumber(e.target.value)}
                    placeholder="e.g. Question 01"
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl font-mono text-xs text-slate-800 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold text-xs shadow-lg shadow-blue-600/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply &amp; Close Metadata</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
