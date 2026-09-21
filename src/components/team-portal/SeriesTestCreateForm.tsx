"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Save,
  Sparkles,
  Layers,
  ArrowRight,
  Clock,
  Calendar,
  HelpCircle,
  BookOpen,
  CheckSquare,
  Square,
  Tag,
  Check,
  X,
} from "lucide-react";
import {
  getMasterNcertSubjects,
  getMasterNcertChapters,
  getMasterNcertTopics,
  type MasterNcertChapter,
} from "@/lib/academic/master-ncert-catalog";

export interface CustomSectionItem {
  id: string;
  name: string;
  subject: string;
  targetCount: number;
  marksPerQuestion?: number | null;
}

export interface SyllabusChapterSelection {
  id: string;
  subject: string;
  chapterTitle: string;
  isComplete: boolean;
  topics: string[];
  allChapterTopics: string[];
  customTopics: string[];
}

const DEFAULT_NEET_SECTIONS: CustomSectionItem[] = [
  { id: "sec-1", name: "Physics", subject: "Physics", targetCount: 45, marksPerQuestion: 4 },
  { id: "sec-2", name: "Chemistry", subject: "Chemistry", targetCount: 45, marksPerQuestion: 4 },
  { id: "sec-3", name: "Biology", subject: "Biology", targetCount: 90, marksPerQuestion: 4 },
];

const DEFAULT_JEE_SECTIONS: CustomSectionItem[] = [
  { id: "sec-1", name: "Physics", subject: "Physics", targetCount: 30, marksPerQuestion: 4 },
  { id: "sec-2", name: "Chemistry", subject: "Chemistry", targetCount: 30, marksPerQuestion: 4 },
  { id: "sec-3", name: "Mathematics", subject: "Mathematics", targetCount: 30, marksPerQuestion: 4 },
];

const DEFAULT_CHAPTER_SECTIONS: CustomSectionItem[] = [
  { id: "sec-1", name: "Physics", subject: "Physics", targetCount: 30, marksPerQuestion: 4 },
];

export function SeriesTestCreateForm({ testSeriesId }: { testSeriesId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [testType, setTestType] = useState("Full Syllabus Test");
  const [examType, setExamType] = useState("NEET");
  const [title, setTitle] = useState("Minor Test : 01");
  const [durationMin, setDurationMin] = useState<number>(180);
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  // Syllabus State
  const [selectedChapters, setSelectedChapters] = useState<SyllabusChapterSelection[]>([]);
  const [syllabusSubject, setSyllabusSubject] = useState<string>("Physics");
  const [availableChapters, setAvailableChapters] = useState<MasterNcertChapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [customTopicInput, setCustomTopicInput] = useState<Record<string, string>>({});

  // Sync available chapters when syllabusSubject changes
  useEffect(() => {
    const chs = getMasterNcertChapters(syllabusSubject);
    setAvailableChapters(chs);
    if (chs.length > 0 && chs[0]?.id) {
      setSelectedChapterId(chs[0].id);
    } else {
      setSelectedChapterId("");
    }
  }, [syllabusSubject]);

  function handleAddChapterToSyllabus() {
    const ch = availableChapters.find((c) => c.id === selectedChapterId);
    if (!ch) return;

    const displayTitle = ch.displayTitle || ch.title;
    if (selectedChapters.some((sc) => sc.chapterTitle === displayTitle)) {
      toast.error("This chapter is already added to the syllabus.");
      return;
    }

    const officialTopics = getMasterNcertTopics(syllabusSubject, ch.title).map((t) => t.title);

    setSelectedChapters((prev) => [
      ...prev,
      {
        id: `ch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        subject: syllabusSubject,
        chapterTitle: displayTitle,
        isComplete: true, // Default: Complete Chapter selected at top
        topics: officialTopics,
        allChapterTopics: officialTopics,
        customTopics: [],
      },
    ]);
  }

  function handleToggleCompleteChapter(id: string) {
    setSelectedChapters((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              isComplete: !c.isComplete,
              topics: !c.isComplete ? c.allChapterTopics : c.topics,
            }
          : c
      )
    );
  }

  function handleToggleTopic(chapterId: string, topic: string) {
    setSelectedChapters((prev) =>
      prev.map((c) => {
        if (c.id !== chapterId) return c;
        const exists = c.topics.includes(topic);
        const nextTopics = exists
          ? c.topics.filter((t) => t !== topic)
          : [...c.topics, topic];
        return {
          ...c,
          topics: nextTopics,
          isComplete: nextTopics.length === c.allChapterTopics.length,
        };
      })
    );
  }

  function handleAddCustomTopic(chapterId: string) {
    const text = (customTopicInput[chapterId] || "").trim();
    if (!text) return;
    setSelectedChapters((prev) =>
      prev.map((c) =>
        c.id === chapterId ? { ...c, customTopics: [...c.customTopics, text] } : c
      )
    );
    setCustomTopicInput((prev) => ({ ...prev, [chapterId]: "" }));
  }

  function handleRemoveCustomTopic(chapterId: string, idx: number) {
    setSelectedChapters((prev) =>
      prev.map((c) =>
        c.id === chapterId
          ? { ...c, customTopics: c.customTopics.filter((_, i) => i !== idx) }
          : c
      )
    );
  }

  function handleRemoveChapter(id: string) {
    setSelectedChapters((prev) => prev.filter((c) => c.id !== id));
  }

  // Sections State
  const [sections, setSections] = useState<CustomSectionItem[]>(DEFAULT_NEET_SECTIONS);
  const [selectedTemplatePreset, setSelectedTemplatePreset] = useState<string>("NEET");
  const [savedTemplates, setSavedTemplates] = useState<Array<{ id: string; name: string; sections: any[] }>>([]);

  // Auto-calculated End Time
  const calculatedEndTime = useMemo(() => {
    if (!startDate) return "";
    try {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) return "";
      const end = new Date(start.getTime() + (durationMin || 0) * 60000);
      return end.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });
    } catch {
      return "";
    }
  }, [startDate, durationMin]);

  // Total Questions
  const totalQuestions = useMemo(() => {
    return sections.reduce((sum, s) => sum + (Number(s.targetCount) || 0), 0);
  }, [sections]);

  // Load Saved Templates
  useEffect(() => {
    if (open) {
      fetch("/api/team/test-templates")
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data.templates) {
            setSavedTemplates(json.data.templates);
          }
        })
        .catch(() => {});
    }
  }, [open]);

  // Handle Template Preset Change
  function handlePresetChange(preset: string) {
    setSelectedTemplatePreset(preset);
    if (preset === "NEET") {
      setSections(DEFAULT_NEET_SECTIONS);
      setDurationMin(180);
      setExamType("NEET");
    } else if (preset === "JEE") {
      setSections(DEFAULT_JEE_SECTIONS);
      setDurationMin(180);
      setExamType("JEE Main");
    } else if (preset === "CHAPTER") {
      setSections(DEFAULT_CHAPTER_SECTIONS);
      setDurationMin(60);
      setTestType("Chapter Test");
    } else {
      const customT = savedTemplates.find((t) => t.id === preset);
      if (customT && customT.sections) {
        setSections(
          customT.sections.map((sec, idx) => ({
            id: `sec-${idx + 1}`,
            name: sec.name,
            subject: sec.subject,
            targetCount: sec.targetCount,
            marksPerQuestion: sec.marksPerQuestion,
          }))
        );
      }
    }
  }

  // Add Section Row
  function handleAddSection() {
    setSections((prev) => [
      ...prev,
      {
        id: `sec-${Date.now()}`,
        name: `Section ${prev.length + 1}`,
        subject: "Physics",
        targetCount: 30,
        marksPerQuestion: 4,
      },
    ]);
  }

  // Update Section
  function handleUpdateSection(id: string, field: keyof CustomSectionItem, val: any) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  }

  // Remove Section
  function handleRemoveSection(id: string) {
    if (sections.length <= 1) {
      toast.error("At least one section is required.");
      return;
    }
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  // Save as Template
  async function handleSaveAsTemplate() {
    const templateName = prompt("Enter a name for this template blueprint:", title || "Custom Blueprint");
    if (!templateName?.trim()) return;

    try {
      const res = await fetch("/api/team/test-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          sections: sections.map((s, idx) => ({
            name: s.name,
            subject: s.subject,
            targetCount: Number(s.targetCount) || 30,
            marksPerQuestion: Number(s.marksPerQuestion) || 4,
            negativeMarks: -1,
            order: idx,
          })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Template saved successfully!");
        setSavedTemplates((prev) => [...prev, json.data.template]);
      } else {
        toast.error(json.error || "Failed to save template.");
      }
    } catch {
      toast.error("Error saving template.");
    }
  }

  // Submit and Create Test
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a test title.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create Test with Syllabus & Schedule
      const res = await fetch(`/api/team/test-series/${testSeriesId}/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          durationMin: Number(durationMin) || 180,
          testType,
          examType,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          syllabus: {
            chapters: selectedChapters.map((ch) => ({
              id: ch.id,
              subject: ch.subject,
              chapterTitle: ch.chapterTitle,
              isComplete: ch.isComplete,
              topics: ch.isComplete ? [] : ch.topics,
              customTopics: ch.customTopics,
            })),
          },
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error || "Could not create the test.");
        setSubmitting(false);
        return;
      }

      const testId = json.data.test.id;

      // 2. Clone custom sections into test
      await fetch(`/api/team/tests/${testId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: sections.map((s, idx) => ({
            name: s.name,
            subject: s.subject,
            targetCount: Number(s.targetCount) || 30,
            marksPerQuestion: Number(s.marksPerQuestion) || 4,
            negativeMarks: -1,
            order: idx,
          })),
        }),
      });

      toast.success("Test created! Syllabus synced and batch folders updated.");
      setOpen(false);
      router.push(`/team/tests/${testId}/author`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-[#0c3ea4] hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all"
      >
        <Plus className="w-4 h-4" />
        <span>Create Test</span>
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Create Test in Series</h3>
          <p className="text-xs text-slate-500">Configure exam blueprints, syllabus scope, scheduling, and section targets.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Test Type & Exam Type Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              Test Type
            </label>
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value)}
              className="w-full rounded-xl border border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 bg-white dark:bg-slate-800 py-2.5 px-3.5 text-sm text-slate-900 dark:text-white outline-none"
            >
              <option value="Full Syllabus Test">Full Syllabus Test</option>
              <option value="Chapter Test">Chapter Test</option>
              <option value="Minor Test">Minor Test</option>
              <option value="Major Test">Major Test</option>
              <option value="Mock Test">Mock Test</option>
              <option value="Practice Test">Practice Test</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              Exam Type
            </label>
            <select
              value={examType}
              onChange={(e) => {
                setExamType(e.target.value);
                if (e.target.value === "NEET") handlePresetChange("NEET");
                if (e.target.value === "JEE Main") handlePresetChange("JEE");
              }}
              className="w-full rounded-xl border border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 bg-white dark:bg-slate-800 py-2.5 px-3.5 text-sm text-slate-900 dark:text-white outline-none"
            >
              <option value="NEET">NEET</option>
              <option value="JEE Main">JEE Main</option>
              <option value="JEE Advanced">JEE Advanced</option>
              <option value="Boards">Boards</option>
            </select>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
            Test Title *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Minor Test : 01"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 focus:border-blue-500 bg-white dark:bg-slate-800 py-2.5 px-3.5 text-sm text-slate-900 dark:text-white outline-none"
          />
        </div>

        {/* Schedule & Auto Calculated Time */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Start Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Duration (minutes)
            </label>
            <input
              type="number"
              min={15}
              step={5}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              End Date &amp; Time (Auto-calculated)
            </label>
            <div className="w-full rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 py-2 px-3 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center h-[38px]">
              {calculatedEndTime || "Auto-calculated on start"}
            </div>
          </div>
        </div>

        {/* TEST SYLLABUS SELECTION BLOCK */}
        <div className="bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">Test Syllabus Scope</h4>
                <span className="text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-0.5 rounded-full">
                  {selectedChapters.length} Chapter{selectedChapters.length === 1 ? "" : "s"} Selected
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Select chapters &amp; topics for this test. An official Syllabus PDF and batch announcement will be created automatically.
              </p>
            </div>
          </div>

          {/* Chapter Selector Dropdown Row */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <div className="w-full sm:w-44">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Subject</label>
              <select
                value={syllabusSubject}
                onChange={(e) => setSyllabusSubject(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-white outline-none"
              >
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Biology">Biology</option>
                <option value="Mathematics">Mathematics</option>
              </select>
            </div>

            <div className="flex-1 min-w-[220px]">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Select Chapter</label>
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-white outline-none"
              >
                {availableChapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayTitle || c.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleAddChapterToSyllabus}
              className="mt-5 sm:mt-5 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Chapter</span>
            </button>
          </div>

          {/* Selected Chapters List & Topic Selection */}
          {selectedChapters.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-4 text-xs text-slate-400">
              No chapters added yet. Use the selector above to add chapters to this test&apos;s syllabus.
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              {selectedChapters.map((ch, idx) => (
                <div
                  key={ch.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3"
                >
                  {/* Chapter Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-extrabold text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <h5 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {ch.chapterTitle}
                      </h5>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {ch.subject}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveChapter(ch.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      title="Remove Chapter"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Complete Chapter Option at Top */}
                  <div
                    onClick={() => handleToggleCompleteChapter(ch.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition ${
                      ch.isComplete
                        ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200"
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center border transition ${
                          ch.isComplete
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-slate-400 bg-white dark:bg-slate-900"
                        }`}
                      >
                        {ch.isComplete && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div>
                        <p className="font-extrabold text-xs">Complete Chapter</p>
                        <p className="text-[11px] opacity-75">
                          Includes the entire chapter syllabus and all subtopics
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-200/60 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
                      {ch.isComplete ? "All Topics Active" : "Custom Topic Selection"}
                    </span>
                  </div>

                  {/* Subtopics List (Shown if not complete chapter or for inspection) */}
                  {!ch.isComplete && ch.allChapterTopics.length > 0 && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2 border border-slate-200/70 dark:border-slate-800">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                        <span>Select Individual Topics:</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedChapters((prev) =>
                                prev.map((c) =>
                                  c.id === ch.id
                                    ? { ...c, topics: c.allChapterTopics, isComplete: true }
                                    : c
                                )
                              )
                            }
                            className="text-blue-600 hover:underline"
                          >
                            Select All
                          </button>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedChapters((prev) =>
                                prev.map((c) =>
                                  c.id === ch.id ? { ...c, topics: [], isComplete: false } : c
                                )
                              )
                            }
                            className="text-slate-500 hover:underline"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {ch.allChapterTopics.map((topic) => {
                          const isChecked = ch.topics.includes(topic);
                          return (
                            <label
                              key={topic}
                              className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-blue-400 text-xs text-slate-800 dark:text-slate-200 transition"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleTopic(ch.id, topic)}
                                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                              />
                              <span className="truncate">{topic}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Custom Topics Area */}
                  <div className="space-y-2 pt-1">
                    {ch.customTopics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {ch.customTopics.map((ct, ctIdx) => (
                          <span
                            key={ctIdx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold"
                          >
                            <span>{ct}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomTopic(ch.id, ctIdx)}
                              className="text-amber-500 hover:text-amber-800 ml-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Add Custom Topic Input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Add custom topic (e.g. Special Numerical Set, Lab Practical)..."
                        value={customTopicInput[ch.id] || ""}
                        onChange={(e) =>
                          setCustomTopicInput((prev) => ({ ...prev, [ch.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomTopic(ch.id);
                          }
                        }}
                        className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 px-3 text-xs text-slate-900 dark:text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCustomTopic(ch.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition"
                      >
                        + Add Topic
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTIONS BUILDER BLOCK */}
        <div className="bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">Sections &amp; Blueprints</h4>
                <span className="text-xs font-medium text-slate-500">
                  {totalQuestions} questions total (defined now, added later)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Define how many questions each section needs — you&apos;ll fill them in on the next screen. No question selection happens here.
              </p>
            </div>
          </div>

          {/* Template Selector Bar */}
          <div className="flex items-center gap-3">
            <select
              value={selectedTemplatePreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="flex-1 rounded-xl border border-blue-500/50 bg-white dark:bg-slate-900 py-2 px-3.5 text-xs text-slate-900 dark:text-white outline-none"
            >
              <option value="">Start from a saved template...</option>
              <option value="NEET">NEET UG Blueprint (Physics 45, Chemistry 45, Biology 90)</option>
              <option value="JEE">JEE Main Blueprint (Physics 30, Chemistry 30, Math 30)</option>
              <option value="CHAPTER">Chapter Assessment Blueprint (30 Questions)</option>
              {savedTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.sections?.length || 0} sections)
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleSaveAsTemplate}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-100 hover:bg-blue-200 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-bold text-xs transition shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save as Template</span>
            </button>
          </div>

          {/* Sections List */}
          <div className="space-y-3 pt-1">
            {sections.map((s) => (
              <div
                key={s.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-wrap sm:flex-nowrap items-center gap-3 shadow-sm"
              >
                <div className="w-full sm:w-1/3">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Section Name</label>
                  <input
                    type="text"
                    value={s.name}
                    onChange={(e) => handleUpdateSection(s.id, "name", e.target.value)}
                    placeholder="e.g. Physics"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 px-3 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div className="w-full sm:w-1/4">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Subject</label>
                  <select
                    value={s.subject}
                    onChange={(e) => handleUpdateSection(s.id, "subject", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 px-3 text-xs text-slate-900 dark:text-white outline-none"
                  >
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div className="w-1/2 sm:w-28">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Questions</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={s.targetCount}
                    onChange={(e) => handleUpdateSection(s.id, "targetCount", Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 px-3 text-xs text-slate-900 dark:text-white outline-none font-bold"
                  />
                </div>

                <div className="w-1/2 sm:w-28">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Marks/Q (opt)</label>
                  <input
                    type="text"
                    value={s.marksPerQuestion || "uses test"}
                    onChange={(e) => handleUpdateSection(s.id, "marksPerQuestion", Number(e.target.value) || 4)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 px-3 text-xs text-slate-700 dark:text-slate-300 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveSection(s.id)}
                  disabled={sections.length <= 1}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition self-end sm:self-center disabled:opacity-30"
                  title="Remove section"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddSection}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold text-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Section</span>
          </button>
        </div>

        {/* Submit Action Button */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-5 py-2.5 rounded-full border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="px-7 py-3 rounded-full bg-[#0c3ea4] hover:bg-blue-700 text-white font-extrabold text-sm shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
          >
            <span>{submitting ? "Creating..." : "Create Test → Open for Question Entry"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
