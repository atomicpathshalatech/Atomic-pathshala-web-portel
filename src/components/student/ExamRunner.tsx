"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { ExamLanguageModal } from "./ExamLanguageModal";
import { ExamInstructionsView } from "./ExamInstructionsView";
import { TestPdfDownloadModal } from "@/components/test-portal/TestPdfDownloadModal";

export type QuestionData = {
  id: string;
  order: number;
  subject?: string | null;
  body: string;
  type: "MCQ" | "INTEGER";
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  bodyHi?: string | null;
  optionAHi?: string | null;
  optionBHi?: string | null;
  optionCHi?: string | null;
  optionDHi?: string | null;
  mySelection: string | null;
};

export type ExamAttemptData = {
  attempt: { id: string; status: string; startedAt: string; deadlineAt: string };
  test: { id: string; title: string; instructions: string | null; durationMin: number; targetExam?: string };
  questions: QuestionData[];
  candidateName?: string;
  candidatePhoto?: string | null;
};

type QuestionState = "NOT_VISITED" | "NOT_ANSWERED" | "ANSWERED" | "MARKED_FOR_REVIEW" | "ANSWERED_AND_MARKED";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function formatClock(totalSec: number) {
  const s = Math.max(0, totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function ExamRunner({
  testId,
  initialData,
}: {
  testId: string;
  initialData?: ExamAttemptData;
}) {
  const router = useRouter();
  const [data, setData] = useState<ExamAttemptData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Exam Phases: 1. LANGUAGE_MODAL -> 2. INSTRUCTIONS -> 3. RUNNING
  const [phase, setPhase] = useState<"LANGUAGE_MODAL" | "INSTRUCTIONS" | "RUNNING">("LANGUAGE_MODAL");
  const [defaultLanguage, setDefaultLanguage] = useState<"en" | "hi">("en");
  const [currentQuestionLang, setCurrentQuestionLang] = useState<"en" | "hi">("en");

  // Navigation & Active Subject
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeSubject, setActiveSubject] = useState<string>("");

  // Question States & Answers
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [questionStates, setQuestionStates] = useState<Record<string, QuestionState>>({});

  // Mobile Palette Drawer
  const [paletteOpen, setPaletteOpen] = useState(true);

  // Timer & Submission
  const [remainingSec, setRemainingSec] = useState(0);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Anti-Cheating / Fullscreen Proctoring
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const [violationsCount, setViolationsCount] = useState(0);
  const submittedRef = useRef(false);

  // 1. Fetch or initialize attempt data
  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/tests/${testId}/attempts/my`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setLoadError(json.error ?? "Could not load exam data.");
        return;
      }
      const d: ExamAttemptData = json.data;
      if (d.attempt.status !== "IN_PROGRESS") {
        router.replace(`/tests/${testId}/result`);
        return;
      }
      setData(d);

      // Initialize answers and states
      const initialAns: Record<string, string | null> = {};
      const initialStates: Record<string, QuestionState> = {};

      d.questions.forEach((q, idx) => {
        initialAns[q.id] = q.mySelection;
        if (q.mySelection) {
          initialStates[q.id] = "ANSWERED";
        } else if (idx === 0) {
          initialStates[q.id] = "NOT_ANSWERED";
        } else {
          initialStates[q.id] = "NOT_VISITED";
        }
      });

      setAnswers(initialAns);
      setQuestionStates(initialStates);

      if (d.questions[0]?.subject) {
        setActiveSubject(d.questions[0].subject);
      }
    } catch {
      setLoadError("Could not connect to the exam server. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  }, [testId, router]);

  useEffect(() => {
    if (!initialData) {
      loadData();
    } else {
      const initialAns: Record<string, string | null> = {};
      const initialStates: Record<string, QuestionState> = {};

      initialData.questions.forEach((q, idx) => {
        initialAns[q.id] = q.mySelection;
        if (q.mySelection) {
          initialStates[q.id] = "ANSWERED";
        } else if (idx === 0) {
          initialStates[q.id] = "NOT_ANSWERED";
        } else {
          initialStates[q.id] = "NOT_VISITED";
        }
      });

      setAnswers(initialAns);
      setQuestionStates(initialStates);

      if (initialData.questions[0]?.subject) {
        setActiveSubject(initialData.questions[0].subject);
      }
    }
  }, [initialData, loadData]);

  // 2. Compute Subjects with Question Counts
  const subjectsList = useMemo(() => {
    if (!data?.questions) return [];
    const map = new Map<string, { subject: string; count: number; firstIndex: number }>();
    data.questions.forEach((q, idx) => {
      const sub = q.subject || "General";
      if (!map.has(sub)) {
        map.set(sub, { subject: sub, count: 1, firstIndex: idx });
      } else {
        map.get(sub)!.count += 1;
      }
    });
    return Array.from(map.values());
  }, [data?.questions]);

  // Ensure active subject is set
  useEffect(() => {
    if (subjectsList.length > 0 && !activeSubject && subjectsList[0]?.subject) {
      setActiveSubject(subjectsList[0].subject);
    }
  }, [subjectsList, activeSubject]);

  // Filter questions for active subject in palette
  const activeSubjectQuestions = useMemo(() => {
    if (!data?.questions) return [];
    return data.questions
      .map((q, globalIdx) => ({ ...q, globalIdx }))
      .filter((q) => (q.subject || "General") === activeSubject);
  }, [data?.questions, activeSubject]);

  // 3. Question Palette Counts
  const paletteCounts = useMemo(() => {
    let notVisited = 0;
    let notAnswered = 0;
    let answered = 0;
    let marked = 0;
    let answeredMarked = 0;

    if (!data?.questions) return { notVisited, notAnswered, answered, marked, answeredMarked };

    data.questions.forEach((q) => {
      const st = questionStates[q.id] || "NOT_VISITED";
      if (st === "ANSWERED") answered += 1;
      else if (st === "ANSWERED_AND_MARKED") answeredMarked += 1;
      else if (st === "MARKED_FOR_REVIEW") marked += 1;
      else if (st === "NOT_ANSWERED") notAnswered += 1;
      else notVisited += 1;
    });

    return { notVisited, notAnswered, answered, marked, answeredMarked };
  }, [data?.questions, questionStates]);

  // 4. Server-Authoritative Timer & Auto-Submit
  useEffect(() => {
    if (phase !== "RUNNING" || !data?.attempt?.deadlineAt) return;

    const deadline = new Date(data.attempt.deadlineAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const sec = Math.max(0, Math.floor((deadline - now) / 1000));
      setRemainingSec(sec);

      if (sec <= 0 && !submittedRef.current) {
        handleFinalSubmit(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [phase, data?.attempt?.deadlineAt]);

  // 5. Anti-Cheating & Fullscreen Monitors
  const logViolation = useCallback(
    async (type: string) => {
      if (phase !== "RUNNING" || submittedRef.current) return;
      setViolationsCount((prev) => prev + 1);
      try {
        await fetch(`/api/tests/${testId}/attempts/my/violations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type }),
        });
      } catch {
        // Silently log
      }
    },
    [testId, phase]
  );

  useEffect(() => {
    if (phase !== "RUNNING") return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setFullscreenWarning(true);
        logViolation("FULLSCREEN_EXIT");
      } else {
        setFullscreenWarning(false);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation("TAB_SWITCH");
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [phase, logViolation]);

  // 6. Save Answer API Call
  const persistAnswerToServer = async (questionId: string, selectedOption: string | null) => {
    try {
      await fetch(`/api/tests/${testId}/attempts/my/answers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          selectedOption,
        }),
      });
    } catch {
      toast.error("Network sync issue. Retrying...", { duration: 2000 });
    }
  };

  // 7. Actions: Save & Next, Clear, Save & Mark, Mark & Next
  const currentQ = data?.questions[currentIndex];

  const handleSelectOption = (optKey: string) => {
    if (!currentQ) return;
    setAnswers((prev) => ({ ...prev, [currentQ.id]: optKey }));
    persistAnswerToServer(currentQ.id, optKey);

    // Update state to ANSWERED if not marked
    setQuestionStates((prev) => {
      const currentSt = prev[currentQ.id];
      if (currentSt === "MARKED_FOR_REVIEW" || currentSt === "ANSWERED_AND_MARKED") {
        return { ...prev, [currentQ.id]: "ANSWERED_AND_MARKED" };
      }
      return { ...prev, [currentQ.id]: "ANSWERED" };
    });
  };

  const navigateToQuestion = (targetIdx: number) => {
    if (!data?.questions || targetIdx < 0 || targetIdx >= data.questions.length) return;

    // Mark current question as NOT_ANSWERED if visited and un-answered
    if (currentQ && (!answers[currentQ.id] || answers[currentQ.id] === null)) {
      setQuestionStates((prev) => {
        if (prev[currentQ.id] === "NOT_VISITED") {
          return { ...prev, [currentQ.id]: "NOT_ANSWERED" };
        }
        return prev;
      });
    }

    const targetQ = data.questions[targetIdx];
    if (!targetQ) return;
    setCurrentIndex(targetIdx);

    // Revert question language to default language
    setCurrentQuestionLang(defaultLanguage);

    // Sync active subject tab
    if (targetQ.subject) {
      setActiveSubject(targetQ.subject);
    }

    // Mark target question as visited / not-answered if first time
    setQuestionStates((prev) => {
      if (!prev[targetQ.id] || prev[targetQ.id] === "NOT_VISITED") {
        return { ...prev, [targetQ.id]: "NOT_ANSWERED" };
      }
      return prev;
    });
  };

  const handleSaveAndNext = () => {
    if (!currentQ) return;
    const ans = answers[currentQ.id];
    if (ans) {
      setQuestionStates((prev) => ({ ...prev, [currentQ.id]: "ANSWERED" }));
    } else {
      setQuestionStates((prev) => ({ ...prev, [currentQ.id]: "NOT_ANSWERED" }));
    }
    if (currentIndex < (data?.questions.length || 1) - 1) {
      navigateToQuestion(currentIndex + 1);
    }
  };

  const handleClearResponse = () => {
    if (!currentQ) return;
    setAnswers((prev) => ({ ...prev, [currentQ.id]: null }));
    setQuestionStates((prev) => ({ ...prev, [currentQ.id]: "NOT_ANSWERED" }));
    persistAnswerToServer(currentQ.id, null);
  };

  const handleSaveAndMarkForReview = () => {
    if (!currentQ) return;
    const ans = answers[currentQ.id];
    if (ans) {
      setQuestionStates((prev) => ({ ...prev, [currentQ.id]: "ANSWERED_AND_MARKED" }));
    } else {
      setQuestionStates((prev) => ({ ...prev, [currentQ.id]: "MARKED_FOR_REVIEW" }));
    }
  };

  const handleMarkForReviewAndNext = () => {
    if (!currentQ) return;
    const ans = answers[currentQ.id];
    if (ans) {
      setQuestionStates((prev) => ({ ...prev, [currentQ.id]: "ANSWERED_AND_MARKED" }));
    } else {
      setQuestionStates((prev) => ({ ...prev, [currentQ.id]: "MARKED_FOR_REVIEW" }));
    }
    if (currentIndex < (data?.questions.length || 1) - 1) {
      navigateToQuestion(currentIndex + 1);
    }
  };

  // 8. Submit Final Exam Attempt
  const handleFinalSubmit = async (auto = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/tests/${testId}/attempts/my/submit`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setSubmitError(json.error ?? "Failed to submit exam.");
        submittedRef.current = false;
        setSubmitting(false);
        return;
      }

      toast.success(auto ? "Time expired. Test auto-submitted!" : "Test submitted successfully!");
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      router.replace(`/tests/${testId}/result`);
    } catch {
      setSubmitError("Network error while submitting. Please try again.");
      submittedRef.current = false;
      setSubmitting(false);
    }
  };

  // 9. Fullscreen Gatekeeper Transition from Instructions
  const handleProceedToFullscreenExam = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setPhase("RUNNING");
    } catch {
      toast.error("Please allow fullscreen mode to start the exam.");
      setPhase("RUNNING");
    }
  };

  // Color mapping helper for question palette buttons
  const getPaletteBtnClass = (qId: string, isCurrent: boolean) => {
    const st = questionStates[qId] || "NOT_VISITED";
    const base = "w-9 h-8 sm:w-10 sm:h-9 rounded-lg font-bold text-xs flex items-center justify-center transition shadow-sm ";

    if (isCurrent) {
      return base + "ring-2 ring-blue-600 ring-offset-2 " + getStatusColorClass(st);
    }
    return base + getStatusColorClass(st);
  };

  const getStatusColorClass = (st: QuestionState) => {
    switch (st) {
      case "ANSWERED":
        return "bg-[#22c55e] text-white hover:bg-emerald-600";
      case "ANSWERED_AND_MARKED":
        return "bg-[#9333ea] text-white border-2 border-[#22c55e] hover:bg-purple-700";
      case "MARKED_FOR_REVIEW":
        return "bg-[#9333ea] text-white hover:bg-purple-700";
      case "NOT_ANSWERED":
        return "bg-[#ef4444] text-white hover:bg-red-600";
      case "NOT_VISITED":
      default:
        return "bg-[#e2e8f0] dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-300";
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <span className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500">Preparing live CBT examination room...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-lg mx-auto p-8 my-12 bg-white dark:bg-slate-900 rounded-3xl border border-red-200 dark:border-red-800 text-center space-y-4 shadow-xl">
        <span className="material-symbols-outlined text-4xl text-red-500">error</span>
        <h3 className="text-base font-black text-slate-900 dark:text-white">Unable to Enter Exam Room</h3>
        <p className="text-xs text-slate-500">{loadError}</p>
        <button
          type="button"
          onClick={() => router.replace("/tests")}
          className="px-6 py-2.5 rounded-2xl bg-blue-600 text-white font-bold text-xs"
        >
          Return to Test Portal
        </button>
      </div>
    );
  }

  // ==========================================
  // PHASE 1: Default Language Selection Modal
  // ==========================================
  if (phase === "LANGUAGE_MODAL") {
    return (
      <ExamLanguageModal
        onSelectLanguage={(lang) => {
          setDefaultLanguage(lang);
          setCurrentQuestionLang(lang);
          setPhase("INSTRUCTIONS");
        }}
      />
    );
  }

  // ==========================================
  // PHASE 2: Bilingual Instructions Page
  // ==========================================
  if (phase === "INSTRUCTIONS") {
    return (
      <ExamInstructionsView
        testId={testId}
        testTitle={data?.test.title || "Test"}
        durationMin={data?.test.durationMin || 180}
        totalQuestions={data?.questions.length || 187}
        targetExam={data?.test.targetExam}
        defaultLanguage={defaultLanguage}
        onProceed={handleProceedToFullscreenExam}
      />
    );
  }

  // ==========================================
  // PHASE 3: Actual High-Stakes NTA CBT Exam
  // ==========================================
  const statement =
    currentQuestionLang === "hi" && currentQ?.bodyHi ? currentQ.bodyHi : currentQ?.body || "";

  const optionA =
    currentQuestionLang === "hi" && currentQ?.optionAHi ? currentQ.optionAHi : currentQ?.optionA;
  const optionB =
    currentQuestionLang === "hi" && currentQ?.optionBHi ? currentQ.optionBHi : currentQ?.optionB;
  const optionC =
    currentQuestionLang === "hi" && currentQ?.optionCHi ? currentQ.optionCHi : currentQ?.optionC;
  const optionD =
    currentQuestionLang === "hi" && currentQ?.optionDHi ? currentQ.optionDHi : currentQ?.optionD;

  const optionsObj: Record<string, string | null | undefined> = {
    A: optionA,
    B: optionB,
    C: optionC,
    D: optionD,
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col justify-between select-none">
      {/* 1. TOP HEADER (Matches Screenshot media_1788449327614.png) */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2.5 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Candidate Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shrink-0 flex items-center justify-center">
              {data?.candidatePhoto ? (
                <img src={data.candidatePhoto} alt="Candidate" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-2xl text-slate-400">person</span>
              )}
            </div>

            <div className="text-[11px] leading-tight space-y-0.5">
              <div>
                <span className="text-slate-400">Candidate Name : </span>
                <span className="font-black text-slate-800 dark:text-slate-100">{data?.candidateName}</span>
              </div>
              <div>
                <span className="text-slate-400">Exam Name : </span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{data?.test.targetExam || "NEET"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Test Name : </span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{data?.test.title}</span>
                <span className="px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold">
                  {formatClock(remainingSec)}
                </span>
                <span className="px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 text-[10px] font-bold">
                  🔋 98%
                </span>
              </div>
            </div>
          </div>

          {/* Right Controls: Independent Language Toggle, PDF Download & Time Left */}
          <div className="flex items-center gap-3">
            {/* Paper PDF Export */}
            <TestPdfDownloadModal
              testId={testId}
              testName={data?.test.title || "Exam Paper"}
              triggerButton={
                <button
                  type="button"
                  title="Download Paper PDF"
                  className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1 border border-slate-300 dark:border-slate-700 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm text-indigo-600 dark:text-indigo-400">picture_as_pdf</span>
                  <span className="hidden sm:inline">Paper PDF</span>
                </button>
              }
            />

            {/* Language Switcher Popover Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setCurrentQuestionLang((prev) => (prev === "en" ? "hi" : "en"))}
                className="px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">translate</span>
                <span>{currentQuestionLang === "hi" ? "🌐 हिंदी ▾" : "🌐 English ▾"}</span>
              </button>
            </div>

            {/* Time Left Clock */}
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                Time Left
              </span>
              <span className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white tracking-wider">
                {formatClock(remainingSec)}
              </span>
            </div>

            {/* Mobile Palette Drawer Toggle Button */}
            <button
              type="button"
              onClick={() => setPaletteOpen(!paletteOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">grid_view</span>
              <span>Palette</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN EXAM BODY */}
      <main className="max-w-7xl mx-auto w-full p-3 sm:p-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Question Display & Subject Tabs (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Question Counter & Subject Tabs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Q{currentIndex + 1}/{data?.questions.length || 187}</span>
            </div>

            {/* Subject Tabs (Biology 97, Chemistry 45, Physics 45) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {subjectsList.map((sub) => {
                const isActive = activeSubject === sub.subject;
                return (
                  <button
                    key={sub.subject}
                    type="button"
                    onClick={() => {
                      setActiveSubject(sub.subject);
                      navigateToQuestion(sub.firstIndex);
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-black transition whitespace-nowrap flex items-center gap-1.5 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-blue-300"
                    }`}
                  >
                    <span>{sub.subject}</span>
                    <span className={`text-[10px] ${isActive ? "text-blue-200" : "text-slate-400"}`}>
                      ({sub.count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 min-h-[380px]">
            {/* Statement */}
            <div className="space-y-2">
              <FormulaText
                text={statement || "No statement available."}
                className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-relaxed block"
              />
            </div>

            {/* Options List */}
            <div className="space-y-3 pt-2">
              {OPTION_KEYS.map((key) => {
                const optVal = optionsObj[key];
                if (!optVal && optVal !== "") return null;
                const isSelected = answers[currentQ?.id || ""] === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectOption(key)}
                    className={`w-full p-4 rounded-2xl border text-left transition flex items-center gap-3.5 group ${
                      isSelected
                        ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 hover:border-slate-300"
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 transition ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-slate-200"
                      }`}
                    >
                      {key}
                    </span>
                    <div className="flex-1 min-w-0">
                      <FormulaText
                        text={optVal || ""}
                        className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white block"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Save & Next (Green) */}
              <button
                type="button"
                onClick={handleSaveAndNext}
                className="px-5 py-2.5 rounded-xl bg-[#047857] hover:bg-[#065f46] text-white font-bold text-xs shadow transition active:scale-95"
              >
                Save &amp; Next
              </button>

              {/* Clear (White outline) */}
              <button
                type="button"
                onClick={handleClearResponse}
                className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition active:scale-95"
              >
                Clear
              </button>

              {/* Save & Mark for Review (Orange) */}
              <button
                type="button"
                onClick={handleSaveAndMarkForReview}
                className="px-5 py-2.5 rounded-xl bg-[#d97706] hover:bg-[#b45309] text-white font-bold text-xs shadow transition active:scale-95"
              >
                Save &amp; Mark for Review
              </button>

              {/* Mark for Review & Next (Dark Blue) */}
              <button
                type="button"
                onClick={handleMarkForReviewAndNext}
                className="px-5 py-2.5 rounded-xl bg-[#0369a1] hover:bg-[#075985] text-white font-bold text-xs shadow transition active:scale-95"
              >
                Mark for Review &amp; Next
              </button>
            </div>

            {/* Navigation & Submit */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => navigateToQuestion(currentIndex - 1)}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 disabled:opacity-40"
              >
                &lt;&lt; Back
              </button>

              <button
                type="button"
                disabled={currentIndex === (data?.questions.length || 1) - 1}
                onClick={() => navigateToQuestion(currentIndex + 1)}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 disabled:opacity-40"
              >
                Next &gt;&gt;
              </button>

              {/* Submit (Dark Red) */}
              <button
                type="button"
                onClick={() => setConfirmingSubmit(true)}
                className="px-6 py-2.5 rounded-xl bg-[#b91c1c] hover:bg-[#991b1b] text-white font-black text-xs shadow-md shadow-red-700/20 transition active:scale-95"
              >
                Submit
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Question Palette (4 Cols) */}
        <div
          className={`lg:col-span-4 space-y-4 ${
            paletteOpen ? "block" : "hidden lg:block"
          }`}
        >
          {/* Status Summary Box */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="grid grid-cols-2 gap-2.5 text-[11px] font-bold">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#e2e8f0] dark:bg-slate-700 border border-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                  {paletteCounts.notVisited}
                </span>
                <span className="text-slate-500">Not Visited</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#ef4444] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  {paletteCounts.notAnswered}
                </span>
                <span className="text-slate-500">Not Answered</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#22c55e] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  {paletteCounts.answered}
                </span>
                <span className="text-slate-500">Answered</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[#9333ea] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  {paletteCounts.marked}
                </span>
                <span className="text-slate-500">Marked for Review</span>
              </div>

              <div className="flex items-center gap-2 col-span-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="w-5 h-5 rounded-md bg-[#9333ea] border-2 border-[#22c55e] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  {paletteCounts.answeredMarked}
                </span>
                <span className="text-slate-500">Answered &amp; Marked (considered for evaluation)</span>
              </div>
            </div>
          </div>

          {/* Question Grid for Active Subject */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
              Question Palette — {activeSubject}
            </h4>

            <div className="grid grid-cols-5 sm:grid-cols-5 gap-2 max-h-[420px] overflow-y-auto pr-1">
              {activeSubjectQuestions.map((q) => {
                const isCurrent = q.globalIdx === currentIndex;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => navigateToQuestion(q.globalIdx)}
                    className={getPaletteBtnClass(q.id, isCurrent)}
                  >
                    {String(q.globalIdx + 1).padStart(2, "0")}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* 4. FULLSCREEN EXIT WARNING MODAL */}
      {fullscreenWarning && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl border border-red-300 dark:border-red-900 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-red-100 dark:bg-red-950 text-red-600 mx-auto flex items-center justify-center shadow-lg shadow-red-500/10">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                You&apos;ve left fullscreen mode
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                The exam must stay in fullscreen. This has been logged as a warning. Click below to continue.
              </p>
            </div>

            <button
              type="button"
              onClick={async () => {
                try {
                  await document.documentElement.requestFullscreen();
                  setFullscreenWarning(false);
                } catch {
                  setFullscreenWarning(false);
                }
              }}
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-lg shadow-blue-500/20 transition"
            >
              Return to Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* 5. SUBMIT CONFIRMATION MODAL */}
      {confirmingSubmit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Are you sure you want to submit the test?
              </h3>
              <p className="text-xs text-slate-500">
                Review your question attempt summary before final submission.
              </p>
            </div>

            {/* Attempt Summary Grid */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <div className="flex justify-between items-center p-2 rounded-xl bg-white dark:bg-slate-900">
                <span className="text-slate-500">Total Questions</span>
                <span className="text-slate-900 dark:text-white">{data?.questions.length}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-xl bg-white dark:bg-slate-900">
                <span className="text-emerald-600">Answered</span>
                <span className="text-emerald-600 font-black">{paletteCounts.answered}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-xl bg-white dark:bg-slate-900">
                <span className="text-red-500">Not Answered</span>
                <span className="text-red-500 font-black">{paletteCounts.notAnswered}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-xl bg-white dark:bg-slate-900">
                <span className="text-purple-600">Marked for Review</span>
                <span className="text-purple-600 font-black">{paletteCounts.marked + paletteCounts.answeredMarked}</span>
              </div>
            </div>

            {submitError && (
              <p className="text-xs text-red-500 font-bold text-center">{submitError}</p>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmingSubmit(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
              >
                Cancel &amp; Resume
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleFinalSubmit(false)}
                className="px-6 py-2.5 rounded-xl bg-[#b91c1c] hover:bg-[#991b1b] text-white font-black text-xs shadow-lg shadow-red-700/20 transition disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Test"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
