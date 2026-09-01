"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { toast } from "sonner";

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
  mySelection: string | null;
  timeSpentSec?: number;
};

export type ExamAttemptData = {
  attempt: { id: string; status: string; startedAt: string; deadlineAt: string };
  test: { id: string; title: string; instructions: string | null; durationMin: number; targetExam?: string };
  questions: QuestionData[];
  candidateName?: string;
};

type QStatus = "NOT_VISITED" | "NOT_ANSWERED" | "ANSWERED" | "MARKED" | "ANSWERED_MARKED";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function formatClock(totalSec: number) {
  const s = Math.max(0, totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
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

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string>>(new Set());

  const [remainingSec, setRemainingSec] = useState(0);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // High-End NTA Exam Features
  const [fontSize, setFontSize] = useState<"normal" | "large" | "xlarge">("normal");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>("All");

  // Anti-cheating & proctoring state
  const [tabSwitches, setTabSwitches] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Time tracking per question
  const questionEnteredAtRef = useRef<number>(Date.now());
  const timeSpentRef = useRef<Record<string, number>>({});
  const submittedRef = useRef(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
      const initialAnswers: Record<string, string | null> = {};
      d.questions.forEach((q) => {
        initialAnswers[q.id] = q.mySelection;
      });
      setAnswers(initialAnswers);
      if (d.questions[0]) {
        setVisited(new Set([d.questions[0].id]));
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
    } else if (initialData.questions[0]) {
      const initialAnswers: Record<string, string | null> = {};
      initialData.questions.forEach((q) => {
        initialAnswers[q.id] = q.mySelection;
      });
      setAnswers(initialAnswers);
      setVisited(new Set([initialData.questions[0].id]));
    }
  }, [loadData, initialData]);

  // Flush time spent on current question when jumping
  function flushTime(qId: string) {
    const elapsed = Math.round((Date.now() - questionEnteredAtRef.current) / 1000);
    if (elapsed > 0) {
      timeSpentRef.current[qId] = (timeSpentRef.current[qId] || 0) + elapsed;
    }
    questionEnteredAtRef.current = Date.now();
  }

  // Change question handler
  function navigateToQuestion(idx: number) {
    if (!data?.questions) return;
    const currentQ = data.questions[currentIndex];
    if (currentQ) flushTime(currentQ.id);

    const targetQ = data.questions[idx];
    if (targetQ) {
      setVisited((prev) => new Set(prev).add(targetQ.id));
    }
    setCurrentIndex(idx);
  }

  // Submit test handler
  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    if (data?.questions[currentIndex]) {
      flushTime(data.questions[currentIndex].id);
    }

    try {
      const res = await fetch(`/api/tests/${testId}/attempts/my/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeSpent: timeSpentRef.current }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setSubmitError(json.error ?? "Could not submit exam. Please try again.");
        submittedRef.current = false;
        return;
      }
      toast.success("Exam submitted successfully!");
      router.replace(`/tests/${testId}/result`);
    } catch {
      setSubmitError("Could not reach the server. Please try again.");
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [testId, data, currentIndex, router]);

  // Countdown timer
  useEffect(() => {
    if (!data) return;
    const deadlineMs = new Date(data.attempt.deadlineAt).getTime();
    const tick = () => {
      const secLeft = Math.round((deadlineMs - Date.now()) / 1000);
      setRemainingSec(Math.max(0, secLeft));
      if (secLeft <= 0) {
        toast.info("Time is up! Submitting exam automatically...");
        doSubmit();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data, doSubmit]);

  // Reports a proctoring violation to the backend — best-effort, never
  // blocks the exam flow on the network call succeeding or failing.
  const reportViolation = useCallback(
    (type: "TAB_SWITCH" | "FULLSCREEN_EXIT" | "COPY_PASTE" | "CONTEXT_MENU") => {
      fetch(`/api/tests/${testId}/attempts/my/violations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      }).catch(() => {
        // best-effort — client-side warning already shown regardless
      });
    },
    [testId]
  );

  // Anti-cheating & tab switch listener
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && !submittedRef.current) {
        setTabSwitches((prev) => {
          const next = prev + 1;
          setShowWarningModal(true);
          return next;
        });
        reportViolation("TAB_SWITCH");
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [reportViolation]);

  // Forced fullscreen exit (Esc key, OS gesture, etc.) — distinct from the
  // in-app toggleFullscreen button, which never fires this as a violation
  // since isFullscreen already reflects the user's own intentional toggle.
  useEffect(() => {
    function handleFullscreenChange() {
      const nowFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen((wasFullscreen) => {
        if (wasFullscreen && !nowFullscreen && !submittedRef.current) {
          setTabSwitches((prev) => prev + 1);
          setShowWarningModal(true);
          reportViolation("FULLSCREEN_EXIT");
        }
        return nowFullscreen;
      });
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [reportViolation]);

  // Save answer to backend
  function scheduleSave(questionId: string, value: string | null) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (saveTimers.current[questionId]) clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = setTimeout(() => saveAnswer(questionId, value), 400);
  }

  async function saveAnswer(questionId: string, value: string | null) {
    setSavingIds((prev) => new Set(prev).add(questionId));
    try {
      await fetch(`/api/tests/${testId}/attempts/my/answers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, selectedOption: value }),
      });
    } catch {
      // best-effort autosave
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
    }
  }

  // Fullscreen toggle
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }

  // Derive unique subjects from question set
  const subjects = useMemo(() => {
    if (!data?.questions) return ["All"];
    const set = new Set<string>();
    data.questions.forEach((q) => {
      if (q.subject) set.add(q.subject);
    });
    return set.size > 0 ? ["All", ...Array.from(set)] : ["All"];
  }, [data]);

  // Filter questions by selected subject tab
  const filteredQuestions = useMemo(() => {
    if (!data?.questions) return [];
    if (selectedSubject === "All") return data.questions;
    return data.questions.filter((q) => q.subject === selectedSubject);
  }, [data, selectedSubject]);

  // Question state calculator for NTA Palette
  function getQuestionStatus(q: QuestionData): QStatus {
    const isAns = answers[q.id] !== null && answers[q.id] !== undefined && answers[q.id] !== "";
    const isMarked = markedForReview.has(q.id);
    const isVis = visited.has(q.id);

    if (isAns && isMarked) return "ANSWERED_MARKED";
    if (isMarked) return "MARKED";
    if (isAns) return "ANSWERED";
    if (isVis) return "NOT_ANSWERED";
    return "NOT_VISITED";
  }

  // Palette counts summary
  const counts = useMemo(() => {
    let answered = 0;
    let notAnswered = 0;
    let marked = 0;
    let answeredMarked = 0;
    let notVisited = 0;

    data?.questions.forEach((q) => {
      const st = getQuestionStatus(q);
      if (st === "ANSWERED") answered++;
      else if (st === "NOT_ANSWERED") notAnswered++;
      else if (st === "MARKED") marked++;
      else if (st === "ANSWERED_MARKED") answeredMarked++;
      else notVisited++;
    });

    return { answered, notAnswered, marked, answeredMarked, notVisited };
  }, [data, answers, markedForReview, visited]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="font-bold text-sm">Launching High-Yield NTA CBT Exam Interface...</p>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-4 text-white">
          <span className="material-symbols-outlined text-5xl text-error">error</span>
          <h2 className="text-xl font-bold">Exam Access Notice</h2>
          <p className="text-xs text-slate-400">{loadError ?? "Could not load this test."}</p>
          <button
            type="button"
            onClick={() => router.replace("/tests")}
            className="px-6 py-2.5 bg-primary text-white font-bold text-xs rounded-xl hover:opacity-90 transition-all"
          >
            Back to Test Series
          </button>
        </div>
      </div>
    );
  }

  const currentQ = data.questions[currentIndex];
  const totalQ = data.questions.length;
  const currentQStatus = currentQ ? getQuestionStatus(currentQ) : "NOT_VISITED";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* 1. TOP NTA CBT BAR */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 md:px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-cyan-400 flex items-center justify-center font-bold text-white shadow-md">
            ⚛
          </div>
          <div>
            <h1 className="font-bold text-xs md:text-sm text-white line-clamp-1">{data.test.title}</h1>
            <span className="text-[10px] text-slate-400 font-mono">
              Atomic Pathshala CBT Engine &middot; {data.test.targetExam || "NEET UG"}
            </span>
          </div>
        </div>

        {/* Right Status Controls */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Language Switcher */}
          <div className="hidden sm:flex items-center bg-slate-800 rounded-xl p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                language === "en" ? "bg-primary text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage("hi")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                language === "hi" ? "bg-primary text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              हिंदी
            </button>
          </div>

          {/* Font Size Adjuster */}
          <div className="hidden md:flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-xl text-xs">
            <span className="text-[10px] text-slate-400 mr-1">Font:</span>
            <button
              type="button"
              onClick={() => setFontSize("normal")}
              className={`px-1.5 py-0.5 rounded ${fontSize === "normal" ? "bg-primary text-white" : "text-slate-400"}`}
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontSize("large")}
              className={`px-1.5 py-0.5 rounded font-bold ${fontSize === "large" ? "bg-primary text-white" : "text-slate-400"}`}
            >
              A+
            </button>
          </div>

          {/* Live Countdown Timer */}
          <div
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-mono font-bold text-xs md:text-sm border transition-all ${
              remainingSec <= 300
                ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
                : "bg-primary/10 border-primary/30 text-cyan-400"
            }`}
          >
            <span className="material-symbols-outlined text-base">timer</span>
            <span>{formatClock(remainingSec)}</span>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">
              {isFullscreen ? "fullscreen_exit" : "fullscreen"}
            </span>
          </button>
        </div>
      </header>

      {/* 2. SUBJECT / SECTION TABS */}
      <nav className="h-11 bg-slate-900/60 border-b border-slate-800 px-4 md:px-6 flex items-center justify-between shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2">
          {subjects.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => {
                setSelectedSubject(sub);
                const firstSubIdx = data.questions.findIndex((q) => sub === "All" || q.subject === sub);
                if (firstSubIdx !== -1) navigateToQuestion(firstSubIdx);
              }}
              className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedSubject === sub
                  ? "bg-primary text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(!paletteOpen)}
          className="text-xs text-primary font-bold hover:underline flex items-center gap-1 shrink-0 ml-2"
        >
          <span className="material-symbols-outlined text-sm">
            {paletteOpen ? "visibility_off" : "grid_view"}
          </span>
          <span className="hidden sm:inline">{paletteOpen ? "Hide Palette" : "Show Palette"}</span>
        </button>
      </nav>

      {/* 3. MAIN EXAM BODY (Question Pane + Collapsible NTA Palette) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Question Viewer & Options */}
        <main className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 space-y-5">
          {currentQ ? (
            <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full space-y-5">
              {/* Question Header Status */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs md:text-sm text-cyan-400">
                    Question {currentIndex + 1} of {totalQ}
                  </span>
                  {currentQ.subject && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {currentQ.subject}
                    </span>
                  )}
                  {savingIds.has(currentQ.id) && (
                    <span className="text-[10px] text-slate-500 animate-pulse">Saving response...</span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-emerald-400 font-bold">+4 Marks</span>
                  <span className="text-red-400 font-bold">-1 Mark</span>
                </div>
              </div>

              {/* Question Statement with KaTeX & Formula Rendering */}
              <div
                className={`text-slate-100 leading-relaxed font-sans ${
                  fontSize === "xlarge" ? "text-lg" : fontSize === "large" ? "text-base" : "text-sm"
                }`}
              >
                <FormulaText text={currentQ.body} />
              </div>

              {/* Options Section */}
              <div className="space-y-3 pt-2">
                {currentQ.type === "MCQ" ? (
                  OPTION_KEYS.map((key) => {
                    const optionText = (currentQ as unknown as Record<string, string | null>)[`option${key}`];
                    if (!optionText) return null;
                    const isSelected = answers[currentQ.id] === key;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => scheduleSave(currentQ.id, key)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-3.5 group ${
                          isSelected
                            ? "border-primary bg-primary/15 text-white shadow-md ring-1 ring-primary"
                            : "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                            isSelected
                              ? "bg-primary text-white"
                              : "bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-white"
                          }`}
                        >
                          {key}
                        </span>
                        <div className="flex-1 text-xs md:text-sm pt-0.5">
                          <FormulaText text={optionText} />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="space-y-2 max-w-xs">
                    <label className="text-xs text-slate-400">Enter Numeric Answer:</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 42"
                      value={answers[currentQ.id] ?? ""}
                      onChange={(e) => scheduleSave(currentQ.id, e.target.value === "" ? null : e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white font-mono outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-500">No question available.</div>
          )}
        </main>

        {/* Right: Collapsible NTA Style Question Palette */}
        {paletteOpen && (
          <aside className="w-80 md:w-96 bg-slate-900/95 border-l border-slate-800 flex flex-col shrink-0 z-20 overflow-y-auto">
            {/* Candidate & Palette Header */}
            <div className="p-4 border-b border-slate-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-primary">
                  {data.candidateName ? data.candidateName[0] : "S"}
                </div>
                <div>
                  <p className="font-bold text-xs text-white">{data.candidateName || "Atomic Student"}</p>
                  <p className="text-[10px] text-slate-400 font-mono">Reg: {data.attempt.id.slice(-8).toUpperCase()}</p>
                </div>
              </div>

              {/* Status Legend */}
              <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-300 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
                  <span>Answered ({counts.answered})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-red-500" />
                  <span>Not Answered ({counts.notAnswered})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-purple-500" />
                  <span>Review ({counts.marked})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-slate-600" />
                  <span>Not Visited ({counts.notVisited})</span>
                </div>
              </div>
            </div>

            {/* Question Grid */}
            <div className="p-4 flex-1 space-y-2">
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                Question Palette ({filteredQuestions.length})
              </h4>
              <div className="grid grid-cols-5 gap-2 max-h-96 overflow-y-auto pr-1">
                {data.questions.map((q, idx) => {
                  const st = getQuestionStatus(q);
                  const isCurrent = idx === currentIndex;

                  let style = "bg-slate-800 text-slate-400 hover:bg-slate-700";
                  if (st === "ANSWERED") style = "bg-emerald-600 text-white shadow";
                  else if (st === "NOT_ANSWERED") style = "bg-red-600 text-white shadow";
                  else if (st === "MARKED") style = "bg-purple-600 text-white shadow";
                  else if (st === "ANSWERED_MARKED")
                    style = "bg-purple-600 text-white ring-2 ring-emerald-400";

                  if (isCurrent) {
                    style += " ring-2 ring-cyan-400 scale-105";
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => navigateToQuestion(idx)}
                      className={`h-9 rounded-xl font-bold text-xs transition-all flex items-center justify-center ${style}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Action in Palette */}
            <div className="p-4 border-t border-slate-800 bg-slate-900">
              <button
                type="button"
                onClick={() => setConfirmingSubmit(true)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Submit Full Test
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* 4. BOTTOM ACTION TOOLBAR */}
      <footer className="h-16 bg-slate-900 border-t border-slate-800 px-4 md:px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-2">
          {/* Mark for Review Button */}
          <button
            type="button"
            onClick={() => {
              if (!currentQ) return;
              setMarkedForReview((prev) => {
                const next = new Set(prev);
                if (next.has(currentQ.id)) next.delete(currentQ.id);
                else next.add(currentQ.id);
                return next;
              });
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
              currentQ && markedForReview.has(currentQ.id)
                ? "border-purple-500 bg-purple-500/20 text-purple-300"
                : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {currentQ && markedForReview.has(currentQ.id) ? "Unmark Review" : "Mark for Review"}
          </button>

          {/* Clear Response Button */}
          {currentQ && answers[currentQ.id] && (
            <button
              type="button"
              onClick={() => scheduleSave(currentQ.id, null)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Clear Response
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => navigateToQuestion(Math.max(0, currentIndex - 1))}
            className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs font-bold hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            &larr; Previous
          </button>

          {currentIndex < totalQ - 1 ? (
            <button
              type="button"
              onClick={() => navigateToQuestion(currentIndex + 1)}
              className="px-6 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1"
            >
              <span>Save &amp; Next</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingSubmit(true)}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition-all"
            >
              Review &amp; Submit
            </button>
          )}
        </div>
      </footer>

      {/* 5. SUBMIT CONFIRMATION MODAL */}
      {confirmingSubmit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full space-y-5 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">Confirm Test Submission</h3>
              <span className="material-symbols-outlined text-slate-400">task_alt</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                <span className="text-[10px] text-emerald-400 block font-bold">Answered</span>
                <span className="text-xl font-bold text-emerald-300">{counts.answered + counts.answeredMarked}</span>
              </div>
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <span className="text-[10px] text-red-400 block font-bold">Unanswered</span>
                <span className="text-xl font-bold text-red-300">{counts.notAnswered + counts.notVisited}</span>
              </div>
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                <span className="text-[10px] text-purple-400 block font-bold">Marked for Review</span>
                <span className="text-xl font-bold text-purple-300">{counts.marked}</span>
              </div>
              <div className="p-3 bg-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-400 block font-bold">Time Left</span>
                <span className="text-xl font-bold font-mono text-cyan-400">{formatClock(remainingSec)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to submit? Once submitted, you cannot change your responses. Your comprehensive AI analysis and score will be generated immediately.
            </p>

            {submitError && <p className="text-xs font-bold text-red-400">{submitError}</p>}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmingSubmit(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Keep Attempting
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={doSubmit}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg transition-all disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Yes, Submit Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ANTI-CHEATING TAB SWITCH WARNING MODAL */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-3xl p-6 md:p-8 max-w-sm w-full text-center space-y-4 text-white shadow-2xl">
            <span className="material-symbols-outlined text-5xl text-red-400 animate-bounce">warning</span>
            <h3 className="font-bold text-base text-red-400">Proctoring Warning</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Tab switch, app unfocus, or fullscreen exit detected (Warning #{tabSwitches}). Please remain on the exam screen in fullscreen. Violations reduce your test integrity score.
            </p>
            <button
              type="button"
              onClick={() => setShowWarningModal(false)}
              className="w-full py-2.5 bg-red-600 hover:bg-red-500 font-bold text-xs text-white rounded-xl shadow transition-all"
            >
              I Understand &amp; Return to Exam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
