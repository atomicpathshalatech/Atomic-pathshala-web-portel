"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Layers,
  Sparkles,
  Plus,
  HelpCircle,
  FileSpreadsheet,
} from "lucide-react";

interface Subject {
  id: string;
  name: string;
  nameHindi?: string | null;
}

interface Chapter {
  id: string;
  title: string;
  titleHindi?: string | null;
  subject: string;
  classNumber?: number;
}

interface Topic {
  id: string;
  name: string;
  nameHindi?: string | null;
  topicNumber?: string | null;
  subtopics: {
    id: string;
    name: string;
    nameHindi?: string | null;
  }[];
}

interface ExistingExerciseItem {
  id: string;
  title: string;
  exerciseType: string;
  _count?: {
    questions: number;
    sections: number;
  };
}

const EXERCISE_NAME_PRESETS = [
  "Exercise 1 — Topic-wise Questions",
  "Exercise 2 — Basic Practice",
  "Exercise 3 — Advanced Questions",
  "Exercise 4 — NEET PYQs",
  "Exercise 5 — JEE Main PYQs",
  "Exercise 6 — Mixed Practice",
];

function NewExerciseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSubject = searchParams.get("subject");
  const urlChapter = searchParams.get("chapter");

  // Step state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(urlSubject && urlChapter ? 4 : 1);

  // Hierarchy state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  // Existing sibling exercises in this chapter
  const [existingChapterExercises, setExistingChapterExercises] = useState<ExistingExerciseItem[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);

  // Selection state
  const [selectedSubject, setSelectedSubject] = useState<string>(urlSubject || "");
  const [selectedChapter, setSelectedChapter] = useState<string>(urlChapter || "");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [selectedSubTopic, setSelectedSubTopic] = useState<string>("");

  // Configuration state
  const [title, setTitle] = useState("Exercise 1 — Topic-wise Questions");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState(
    "Read each question carefully. Select the most appropriate option. Avoid negative marking."
  );
  const [exerciseType, setExerciseType] = useState("TOPIC_WISE");
  const [organizationMode, setOrganizationMode] = useState("TOPIC_WISE");
  const [languageMode, setLanguageMode] = useState("BILINGUAL");
  const [defaultMarks, setDefaultMarks] = useState(4.0);
  const [defaultNegativeMarks, setDefaultNegativeMarks] = useState(1.0);

  // Creating new topic inline state
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [savingNewTopic, setSavingNewTopic] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Helper to load sibling exercises for a given chapter
  const loadExistingExercises = async (subj: string, chap: string) => {
    try {
      setLoadingExisting(true);
      const res = await fetch(
        `/api/team/exercises/chapter?subject=${encodeURIComponent(subj)}&chapter=${encodeURIComponent(chap)}`
      );
      const json = await res.json();
      if (json.success && json.data?.exercises) {
        const exs: ExistingExerciseItem[] = json.data.exercises;
        setExistingChapterExercises(exs);
        const count = exs.length;
        if (count === 1) {
          setTitle("Exercise 2 — Advanced Questions");
          setExerciseType("ADVANCED");
        } else if (count === 2) {
          setTitle("Exercise 3 — NEET PYQs");
          setExerciseType("NEET_PYQ");
          setOrganizationMode("YEAR_WISE");
        } else if (count === 3) {
          setTitle("Exercise 4 — JEE Main PYQs");
          setExerciseType("JEE_PYQ");
          setOrganizationMode("YEAR_WISE");
        } else if (count >= 4) {
          setTitle(`Exercise ${count + 1} — Mixed Practice`);
          setExerciseType("MIXED");
        }
      }
    } catch (err) {
      console.warn("Failed to load existing chapter exercises", err);
    } finally {
      setLoadingExisting(false);
    }
  };

  // On mount: fetch subjects, and if URL params provided, load existing chapter exercises
  useEffect(() => {
    async function init() {
      try {
        setLoadingSubjects(true);
        const res = await fetch("/api/team/questions/academic-hierarchy");
        const json = await res.json();
        if (json.success && json.data?.subjects) {
          setSubjects(json.data.subjects);
        }
      } catch (err) {
        console.error("Failed to load subjects", err);
      } finally {
        setLoadingSubjects(false);
      }

      if (urlSubject && urlChapter) {
        loadExistingExercises(urlSubject, urlChapter);
      }
    }
    init();
  }, [urlSubject, urlChapter]);

  // Fetch chapters when subject changes
  const handleSelectSubject = async (subj: string) => {
    setSelectedSubject(subj);
    setSelectedChapter("");
    setSelectedTopic("");
    setSelectedSubTopic("");
    setExistingChapterExercises([]);
    setChapters([]);
    setTopics([]);
    setLoadingChapters(true);
    setCurrentStep(2);

    try {
      const res = await fetch(`/api/team/questions/academic-hierarchy?subject=${encodeURIComponent(subj)}`);
      const json = await res.json();
      if (json.success && json.data?.chapters) {
        setChapters(json.data.chapters);
      }
    } catch (err) {
      console.error("Failed to load chapters", err);
    } finally {
      setLoadingChapters(false);
    }
  };

  // Fetch topics and existing exercises when chapter changes
  const handleSelectChapter = async (chap: string) => {
    setSelectedChapter(chap);
    setSelectedTopic("");
    setSelectedSubTopic("");
    setTopics([]);
    setLoadingTopics(true);
    setCurrentStep(3);

    // Also load existing exercises to suggest title in step 4
    loadExistingExercises(selectedSubject, chap);

    try {
      const res = await fetch(
        `/api/team/questions/academic-hierarchy?subject=${encodeURIComponent(
          selectedSubject
        )}&chapter=${encodeURIComponent(chap)}`
      );
      const json = await res.json();
      if (json.success && json.data?.topics) {
        setTopics(json.data.topics);
      }
    } catch (err) {
      console.error("Failed to load topics", err);
    } finally {
      setLoadingTopics(false);
    }
  };

  // Add inline topic if chapter has no topics
  const handleCreateNewTopic = async () => {
    if (!newTopicName.trim()) return;
    setSavingNewTopic(true);
    try {
      const res = await fetch("/api/team/questions/academic-hierarchy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "TOPIC",
          subject: selectedSubject,
          chapter: selectedChapter,
          name: newTopicName.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        // Reload topics
        const refRes = await fetch(
          `/api/team/questions/academic-hierarchy?subject=${encodeURIComponent(
            selectedSubject
          )}&chapter=${encodeURIComponent(selectedChapter)}`
        );
        const refJson = await refRes.json();
        if (refJson.success && refJson.data?.topics) {
          setTopics(refJson.data.topics);
          setSelectedTopic(newTopicName.trim());
        }
        setShowAddTopic(false);
        setNewTopicName("");
      }
    } catch (err) {
      console.error("Failed to add topic", err);
    } finally {
      setSavingNewTopic(false);
    }
  };

  // Submit exercise creation
  const handleCreateExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedSubject || !selectedChapter) {
      setErrorMsg("Please ensure Title, Subject, and Chapter are selected.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/team/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          subject: selectedSubject,
          chapter: selectedChapter,
          topic: selectedTopic || null,
          subTopic: selectedSubTopic || null,
          description: description.trim() || null,
          instructions: instructions.trim() || null,
          exerciseType,
          organizationMode,
          languageMode,
          defaultMarks: Number(defaultMarks),
          defaultNegativeMarks: Number(defaultNegativeMarks),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create exercise.");
      }

      // Redirect directly to the builder workspace to import questions
      router.push(`/team/exercises/${json.data.id}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Back button & Heading */}
      <div>
        <Link
          href="/team/exercises"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Exercise Dashboard
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Create New Exercise Practice Sheet
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Follow the academic taxonomy flow: Subject &rarr; Chapter &rarr; Topic &rarr; Subtopic.
            </p>
          </div>
        </div>
      </div>

      {/* Stepper Indicator */}
      <div className="grid grid-cols-4 gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
        {[
          { num: 1, label: "Subject", active: currentStep >= 1, val: selectedSubject },
          { num: 2, label: "Chapter", active: currentStep >= 2, val: selectedChapter },
          { num: 3, label: "Topic & Subtopic", active: currentStep >= 3, val: selectedTopic || "Optional" },
          { num: 4, label: "Configuration", active: currentStep >= 4, val: title },
        ].map((s) => (
          <button
            key={s.num}
            type="button"
            onClick={() => s.active && setCurrentStep(s.num as any)}
            className={`flex flex-col text-left transition-opacity ${
              s.active ? "opacity-100 cursor-pointer" : "opacity-40 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  currentStep === s.num
                    ? "bg-amber-600 text-white"
                    : s.active
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                {s.num < currentStep ? "✓" : s.num}
              </span>
              <span className={currentStep === s.num ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"}>
                {s.label}
              </span>
            </div>
            <span className="mt-0.5 text-[11px] text-slate-400 truncate max-w-[180px]">
              {s.val || "Select..."}
            </span>
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800">
          {errorMsg}
        </div>
      )}

      {/* STEP 1: SELECT SUBJECT */}
      {currentStep === 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
              1
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Select Subject
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Choose the canonical academic subject from the Question Bank and NCERT curriculum.
          </p>

          {loadingSubjects ? (
            <div className="py-8 text-center text-sm text-slate-400">Loading academic subjects...</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {subjects.map((subj) => {
                const isSelected = selectedSubject.toLowerCase() === subj.name.toLowerCase();
                return (
                  <button
                    key={subj.id}
                    type="button"
                    onClick={() => handleSelectSubject(subj.name)}
                    className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
                      isSelected
                        ? "border-amber-500 bg-amber-50/50 shadow-sm dark:border-amber-500 dark:bg-amber-950/30"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <BookOpen
                      className={`h-5 w-5 ${
                        isSelected ? "text-amber-600" : "text-slate-400"
                      }`}
                    />
                    <span className="mt-2 font-bold text-slate-900 text-sm dark:text-white">
                      {subj.name}
                    </span>
                    {subj.nameHindi && (
                      <span className="text-[11px] text-slate-400">{subj.nameHindi}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: SELECT CHAPTER */}
      {currentStep === 2 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                2
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Select Chapter under {selectedSubject}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-xs text-amber-600 hover:underline"
            >
              Change Subject
            </button>
          </div>

          {loadingChapters ? (
            <div className="py-8 text-center text-sm text-slate-400">Loading chapters...</div>
          ) : chapters.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No chapters found for {selectedSubject}.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-96 overflow-y-auto pr-1">
              {chapters.map((chap) => {
                const isSelected = selectedChapter.toLowerCase() === chap.title.toLowerCase();
                return (
                  <button
                    key={chap.id}
                    type="button"
                    onClick={() => handleSelectChapter(chap.title)}
                    className={`flex items-center justify-between rounded-lg border p-3 text-left transition-all ${
                      isSelected
                        ? "border-amber-500 bg-amber-50/50 dark:border-amber-500 dark:bg-amber-950/30"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div>
                      <span className="block text-xs font-bold text-slate-900 dark:text-white">
                        {chap.title}
                      </span>
                      {chap.titleHindi && (
                        <span className="block text-[11px] text-slate-400">{chap.titleHindi}</span>
                      )}
                    </div>
                    {chap.classNumber && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Class {chap.classNumber}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: TOPIC & SUBTOPIC */}
      {currentStep === 3 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                3
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Select Primary Topic (Optional for Chapter Modules)
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="text-xs text-slate-500 hover:underline"
              >
                Change Chapter
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:underline"
              >
                Skip / Continue to Config &rarr;
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            For chapter-wide practice sheets covering all topics, you can leave this empty. Or pick a specific topic/subtopic for focused sheets.
          </p>

          {loadingTopics ? (
            <div className="py-8 text-center text-sm text-slate-400">Loading topics...</div>
          ) : (
            <div className="space-y-4">
              {topics.length === 0 ? (
                <div className="rounded-lg bg-amber-50 p-4 text-xs text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                  <p className="font-semibold">No predefined topics found for this chapter.</p>
                  <p className="mt-1">
                    You can proceed to create a chapter-level exercise, or add custom topics below.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {topics.map((t) => {
                    const isSelected = selectedTopic.toLowerCase() === t.name.toLowerCase();
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedTopic(isSelected ? "" : t.name);
                          setSelectedSubTopic("");
                        }}
                        className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                          isSelected
                            ? "border-amber-500 bg-amber-50/50 dark:border-amber-500 dark:bg-amber-950/30"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {t.name}
                        </span>
                        {t.nameHindi && (
                          <span className="text-[11px] text-slate-400">{t.nameHindi}</span>
                        )}
                        {t.subtopics.length > 0 && (
                          <span className="mt-1 text-[10px] text-slate-400">
                            {t.subtopics.length} subtopics
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Subtopics selector if topic chosen */}
              {selectedTopic && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 space-y-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Subtopic under &quot;{selectedTopic}&quot; (Optional):
                  </span>
                  {(() => {
                    const curTopic = topics.find((t) => t.name.toLowerCase() === selectedTopic.toLowerCase());
                    if (!curTopic || curTopic.subtopics.length === 0) {
                      return <p className="text-xs text-slate-400">No subtopics defined for this topic.</p>;
                    }
                    return (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {curTopic.subtopics.map((st) => {
                          const isStSelected = selectedSubTopic.toLowerCase() === st.name.toLowerCase();
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => setSelectedSubTopic(isStSelected ? "" : st.name)}
                              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                                isStSelected
                                  ? "border-amber-600 bg-amber-600 text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              }`}
                            >
                              {st.name}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Add custom topic inline button */}
              <div>
                {!showAddTopic ? (
                  <button
                    type="button"
                    onClick={() => setShowAddTopic(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add a New Topic to Chapter
                  </button>
                ) : (
                  <div className="flex items-center gap-2 max-w-md pt-2">
                    <input
                      type="text"
                      value={newTopicName}
                      onChange={(e) => setNewTopicName(e.target.value)}
                      placeholder="Enter new topic name..."
                      className="h-8 flex-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={savingNewTopic || !newTopicName.trim()}
                      onClick={handleCreateNewTopic}
                      className="h-8 rounded-md bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                    >
                      {savingNewTopic ? "Adding..." : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddTopic(false)}
                      className="h-8 rounded-md bg-slate-100 px-2.5 text-xs text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Continue button */}
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 shadow-xs"
                >
                  Continue to Configuration &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 4: CONFIGURATION & TITLE */}
      {currentStep === 4 && (
        <form onSubmit={handleCreateExercise} className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                4
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Exercise Configuration & Details
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="text-slate-500 hover:underline"
              >
                Change Chapter
              </button>
            </div>
          </div>

          {/* Existing Chapter Exercises Notification */}
          {selectedSubject && selectedChapter && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                    Chapter Practice Module: {selectedSubject} &rarr; {selectedChapter}
                  </span>
                </div>
                {existingChapterExercises.length > 0 ? (
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-black text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {existingChapterExercises.length} {existingChapterExercises.length === 1 ? "Exercise" : "Exercises"} already created
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    First Exercise in this Chapter
                  </span>
                )}
              </div>

              {existingChapterExercises.length > 0 && (
                <div>
                  <p className="text-[11px] text-blue-800/80 dark:text-blue-300 mb-2">
                    Exercises already part of this chapter module (click to inspect in new tab):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {existingChapterExercises.map((ex, exIdx) => (
                      <Link
                        key={ex.id}
                        href={`/team/exercises/${ex.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-900 hover:border-blue-400 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200 shadow-2xs transition"
                      >
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          {exIdx + 1}
                        </span>
                        <span className="font-semibold">{ex.title}</span>
                        <span className="text-slate-400 text-[10px]">
                          ({ex._count?.questions || 0} Qs)
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Preset Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Quick Exercise Title Presets:
            </label>
            <div className="flex flex-wrap gap-2">
              {EXERCISE_NAME_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setTitle(p);
                    if (p.includes("NEET")) {
                      setExerciseType("NEET_PYQ");
                      setOrganizationMode("YEAR_WISE");
                    } else if (p.includes("JEE")) {
                      setExerciseType("JEE_PYQ");
                      setOrganizationMode("YEAR_WISE");
                    } else if (p.includes("Advanced")) {
                      setExerciseType("ADVANCED");
                      setOrganizationMode("TOPIC_WISE");
                    } else if (p.includes("Basic")) {
                      setExerciseType("BASIC_PRACTICE");
                      setOrganizationMode("TOPIC_WISE");
                    } else if (p.includes("Mixed")) {
                      setExerciseType("MIXED");
                      setOrganizationMode("TOPIC_WISE");
                    } else {
                      setExerciseType("TOPIC_WISE");
                      setOrganizationMode("TOPIC_WISE");
                    }
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    title === p
                      ? "border-amber-600 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Exercise Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Exercise 1 — Topic-wise Practice"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Subtitle (Optional)
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. Conceptual & Application Practice"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Exercise Type & Organization Mode */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Exercise Purpose / Category
              </label>
              <select
                value={exerciseType}
                onChange={(e) => {
                  const val = e.target.value;
                  setExerciseType(val);
                  if (val.includes("PYQ")) {
                    setOrganizationMode("YEAR_WISE");
                  }
                }}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="TOPIC_WISE">Topic-wise Questions</option>
                <option value="BASIC_PRACTICE">Basic Practice Sheet</option>
                <option value="ADVANCED">Advanced / High-Yield</option>
                <option value="NEET_PYQ">NEET Previous Year Questions (PYQs)</option>
                <option value="JEE_PYQ">JEE Main Previous Year Questions</option>
                <option value="MIXED">Mixed Chapter Practice</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Organization Arrangement
              </label>
              <select
                value={organizationMode}
                onChange={(e) => setOrganizationMode(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="TOPIC_WISE">Mode A: Automatic Topic-wise Grouping (Syllabus Topics)</option>
                <option value="YEAR_WISE">Mode B: Year-wise Grouping (for PYQs: 2024, 2023, 2022...)</option>
                <option value="CUSTOM">Mode C: Custom / Mixed Sections</option>
              </select>
            </div>
          </div>

          {/* Language Mode & Marks */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Default Output Language
              </label>
              <select
                value={languageMode}
                onChange={(e) => setLanguageMode(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="BILINGUAL">Bilingual (Hindi above English)</option>
                <option value="HINDI_ONLY">Hindi Only</option>
                <option value="ENGLISH_ONLY">English Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Default Marks per Question
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={defaultMarks}
                onChange={(e) => setDefaultMarks(Number(e.target.value))}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Default Negative Marking
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={defaultNegativeMarks}
                onChange={(e) => setDefaultNegativeMarks(Number(e.target.value))}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Instructions for Students (Appears on Cover / Top Banner)
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* Summary Box */}
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 dark:border-slate-800 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="text-xs space-y-1">
              <p className="font-semibold text-slate-900 dark:text-white">
                Summary: {title}
              </p>
              <p className="text-slate-500">
                Subject: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedSubject}</span> &bull; Chapter:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">{selectedChapter}</span>
                {selectedTopic ? ` • Topic: ${selectedTopic}` : ""}
              </p>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-amber-500 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create & Start Adding Questions →"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function NewExercisePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-slate-400">
          Loading exercise builder...
        </div>
      }
    >
      <NewExerciseContent />
    </Suspense>
  );
}
