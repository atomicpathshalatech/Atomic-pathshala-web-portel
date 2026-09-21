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

export const ALL_SYLLABUS_SUBJECTS = [
  { id: "Physics", name: "Physics", icon: "⚛️" },
  { id: "Chemistry", name: "Chemistry", icon: "🧪" },
  { id: "Biology", name: "Biology", icon: "🧬" },
  { id: "Mathematics", name: "Mathematics", icon: "📐" },
  { id: "Botany", name: "Botany", icon: "🌿" },
  { id: "Zoology", name: "Zoology", icon: "🐾" },
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

  // Syllabus State (Supports Multi-Subject selection across Physics, Chem, Bio, Math)
  const [selectedChapters, setSelectedChapters] = useState<SyllabusChapterSelection[]>([]);
  const [syllabusSubject, setSyllabusSubject] = useState<string>("Physics");
  const [selectedClassFilter, setSelectedClassFilter] = useState<number | null>(null); // null = All Classes, 11, 12
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [customTopicInput, setCustomTopicInput] = useState<Record<string, string>>({});

  // Computed chapters for current subject
  const subjectChapters = useMemo(() => {
    return getMasterNcertChapters(syllabusSubject);
  }, [syllabusSubject]);

  const filteredChapters = useMemo(() => {
    if (!selectedClassFilter) return subjectChapters;
    return subjectChapters.filter((c) => c.classNumber === selectedClassFilter);
  }, [subjectChapters, selectedClassFilter]);

  // Keep selectedChapterId valid whenever subject or class changes
  useEffect(() => {
    if (filteredChapters.length > 0) {
      if (!filteredChapters.some((c) => c.id === selectedChapterId)) {
        setSelectedChapterId(filteredChapters[0]?.id || "");
      }
    } else {
      setSelectedChapterId("");
    }
  }, [filteredChapters, selectedChapterId]);

  // Distinct subjects currently included in the syllabus
  const distinctSyllabusSubjects = useMemo(() => {
    return Array.from(new Set(selectedChapters.map((c) => c.subject)));
  }, [selectedChapters]);

  // Chapter count per subject
  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ch of selectedChapters) {
      counts[ch.subject] = (counts[ch.subject] || 0) + 1;
    }
    return counts;
  }, [selectedChapters]);

  // Group selected chapters by subject for multi-subject organized display
  const groupedSelectedChapters = useMemo(() => {
    const groups: Record<string, SyllabusChapterSelection[]> = {};
    for (const ch of selectedChapters) {
      if (!groups[ch.subject]) {
        groups[ch.subject] = [];
      }
      const list = groups[ch.subject];
      if (list) {
        list.push(ch);
      }
    }
    return groups;
  }, [selectedChapters]);

  function handleAddChapterToSyllabus() {
    const ch = filteredChapters.find((c) => c.id === selectedChapterId);
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
    toast.success(`Added "${ch.title}" (${syllabusSubject}) to syllabus.`);
  }

  function handleAddAllSubjectChapters() {
    const toAdd: SyllabusChapterSelection[] = [];
    for (const ch of filteredChapters) {
      const displayTitle = ch.displayTitle || ch.title;
      if (!selectedChapters.some((sc) => sc.chapterTitle === displayTitle)) {
        const officialTopics = getMasterNcertTopics(syllabusSubject, ch.title).map((t) => t.title);
        toAdd.push({
          id: `ch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          subject: syllabusSubject,
          chapterTitle: displayTitle,
          isComplete: true,
          topics: officialTopics,
          allChapterTopics: officialTopics,
          customTopics: [],
        });
      }
    }
    if (toAdd.length === 0) {
      toast.info(`All chapters for ${syllabusSubject} are already in syllabus.`);
      return;
    }
    setSelectedChapters((prev) => [...prev, ...toAdd]);
    toast.success(`Added ${toAdd.length} chapters to ${syllabusSubject} syllabus!`);
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

  function handleRemoveSubjectChapters(subjectName: string) {
    setSelectedChapters((prev) => prev.filter((c) => c.subject !== subjectName));
    toast.info(`Removed all ${subjectName} chapters.`);
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
        <div className="bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5">
          {/* Header & Multi-Subject Badges */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">Test Syllabus Scope</h4>
                <span className="text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-0.5 rounded-full">
                  {selectedChapters.length} Chapter{selectedChapters.length === 1 ? "" : "s"}
                </span>
                <span className="text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 px-2.5 py-0.5 rounded-full">
                  {distinctSyllabusSubjects.length} Subject{distinctSyllabusSubjects.length === 1 ? "" : "s"} Included
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Select chapters &amp; topics across multiple subjects (Physics, Chemistry, Biology, Mathematics). An official printable Syllabus PDF and batch announcement will be created automatically.
              </p>
            </div>

            {/* Live active subjects chips */}
            {distinctSyllabusSubjects.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {distinctSyllabusSubjects.map((sub) => {
                  const subObj = ALL_SYLLABUS_SUBJECTS.find((s) => s.id === sub);
                  return (
                    <span
                      key={sub}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs"
                    >
                      <span>{subObj?.icon || "📚"}</span>
                      <span>{sub}</span>
                      <span className="bg-blue-600 text-white rounded-full px-1.5 text-[10px] leading-tight">
                        {subjectCounts[sub] || 0}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Subject Switcher Bar (Clickable pills) */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Select Subject to Browse &amp; Add Chapters:
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {ALL_SYLLABUS_SUBJECTS.map((s) => {
                const isActive = syllabusSubject === s.id;
                const count = subjectCounts[s.id] || 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSyllabusSubject(s.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition shrink-0 select-none shadow-2xs ${
                      isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-2 ring-blue-500/40"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700"
                    }`}
                  >
                    <span className="text-sm">{s.icon}</span>
                    <span>{s.name}</span>
                    {count > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isActive
                            ? "bg-white/25 text-white"
                            : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                        }`}
                      >
                        {count} added
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Class Filter & Chapter Selector Row */}
          <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[11px] font-bold text-slate-500">Filter Class:</span>
                <div className="flex items-center gap-1">
                  {[
                    { label: "All Classes", val: null },
                    { label: "Class 11", val: 11 },
                    { label: "Class 12", val: 12 },
                  ].map((cf) => (
                    <button
                      key={cf.label}
                      type="button"
                      onClick={() => setSelectedClassFilter(cf.val)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        selectedClassFilter === cf.val
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                      }`}
                    >
                      {cf.label}
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-[11px] font-medium text-slate-400">
                {filteredChapters.length} chapter{filteredChapters.length === 1 ? "" : "s"} available in {syllabusSubject}
              </span>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
              <div className="flex-1 min-w-[220px]">
                <select
                  value={selectedChapterId}
                  onChange={(e) => setSelectedChapterId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 py-2.5 px-3 text-xs text-slate-900 dark:text-white outline-none font-medium"
                >
                  {filteredChapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayTitle || c.title}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleAddChapterToSyllabus}
                disabled={!selectedChapterId}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm shrink-0 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Chapter</span>
              </button>

              <button
                type="button"
                onClick={handleAddAllSubjectChapters}
                disabled={filteredChapters.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition shrink-0 disabled:opacity-50"
                title={`Add all ${filteredChapters.length} chapters to syllabus`}
              >
                <span>+ Add All ({filteredChapters.length})</span>
              </button>
            </div>
          </div>

          {/* Selected Chapters List Grouped by Subject */}
          {selectedChapters.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-4 text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-500">No chapters added yet.</p>
              <p>Click on any Subject tab above (Physics, Chemistry, Biology, Mathematics) and select chapters to build the test syllabus.</p>
            </div>
          ) : (
            <div className="space-y-6 pt-1">
              {Object.entries(groupedSelectedChapters).map(([subjectName, chapters]) => {
                const subObj = ALL_SYLLABUS_SUBJECTS.find((s) => s.id === subjectName);
                return (
                  <div
                    key={subjectName}
                    className="space-y-3 bg-white/70 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs"
                  >
                    {/* Subject Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{subObj?.icon || "📚"}</span>
                        <h5 className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {subjectName} Syllabus
                        </h5>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          {chapters.length} Chapter{chapters.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveSubjectChapters(subjectName)}
                        className="text-[11px] font-bold text-rose-500 hover:text-rose-700 hover:underline"
                      >
                        Clear {subjectName}
                      </button>
                    </div>

                    {/* Chapter Cards */}
                    <div className="space-y-3">
                      {chapters.map((ch, idx) => (
                        <div
                          key={ch.id}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs space-y-3"
                        >
                          {/* Chapter Item Row */}
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-extrabold text-[10px] flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <h6 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                                {ch.chapterTitle}
                              </h6>
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
                            className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer select-none transition ${
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

                          {/* Subtopics List (Shown if not complete chapter) */}
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
                          <div className="space-y-2 pt-0.5">
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
                  </div>
                );
              })}
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
