"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileQuestion,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
  Calendar,
  User,
  ChevronRight,
  Sparkles,
  Layers,
  HelpCircle,
} from "lucide-react";
import { FormulaText } from "@/components/test-portal/FormulaText";

export interface AssignedQuestionItem {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  subTopic: string | null;
  type: string;
  difficulty: string;
  status: string;
  correctionStatus: string | null;
  correctionNotes: string | null;
  correctionSubmittedAt: string | Date | null;
  assignedAt: string | Date | null;
  createdAt: string | Date;
  review1Status: string | null;
  review2Status: string | null;
  assignedTo?: { id: string; name: string | null; email: string | null } | null;
  assignedBy?: { id: string; name: string | null } | null;
  translations: Array<{
    id: string;
    language: string;
    statement: string;
    options: any;
    correctOptionIds: any;
    solution?: string | null;
  }>;
}

interface MyAssignedQuestionsDashboardProps {
  initialQuestions: AssignedQuestionItem[];
  initialTotalAssigned: number;
  initialPendingCount: number;
  initialCompletedCount: number;
  currentUserId: string;
}

export function MyAssignedQuestionsDashboard({
  initialQuestions,
  initialTotalAssigned,
  initialPendingCount,
  initialCompletedCount,
  currentUserId,
}: MyAssignedQuestionsDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"PENDING" | "COMPLETED">("PENDING");
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [questions, setQuestions] = useState<AssignedQuestionItem[]>(
    Array.isArray(initialQuestions) ? initialQuestions : []
  );
  const [totalAssigned, setTotalAssigned] = useState<number>(initialTotalAssigned || 0);
  const [pendingCount, setPendingCount] = useState<number>(initialPendingCount || 0);
  const [completedCount, setCompletedCount] = useState<number>(initialCompletedCount || 0);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedLanguageMap, setSelectedLanguageMap] = useState<Record<string, string>>({});

  const subjects = ["ALL", "BIOLOGY", "PHYSICS", "CHEMISTRY", "MATHEMATICS"];

  const fetchQuestions = async (tabToFetch = activeTab, subjectToFetch = selectedSubject, searchToFetch = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("tab", tabToFetch);
      if (subjectToFetch !== "ALL") params.set("subject", subjectToFetch);
      if (searchToFetch.trim()) params.set("search", searchToFetch.trim());

      const res = await fetch(`/api/team/questions/my-assigned?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setQuestions(Array.isArray(json.data.questions) ? json.data.questions : []);
        setTotalAssigned(json.data.totalAssigned || 0);
        setPendingCount(json.data.pendingCount || 0);
        setCompletedCount(json.data.completedCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch assigned questions:", err);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions(activeTab, selectedSubject, search);
  }, [activeTab, selectedSubject]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchQuestions(activeTab, selectedSubject, search);
  };

  const getSubjectColor = (subj: string) => {
    const s = subj?.toUpperCase();
    if (s === "BIOLOGY") return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
    if (s === "PHYSICS") return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
    if (s === "CHEMISTRY") return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    if (s === "MATHEMATICS") return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800";
    return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  };

  const getDifficultyColor = (diff: string) => {
    const d = diff?.toUpperCase();
    if (d === "EASY") return "bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
    if (d === "HARD") return "bg-rose-100/70 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300";
    return "bg-amber-100/70 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
  };

  const formatDate = (dateVal: string | Date | null | undefined) => {
    if (!dateVal) return null;
    try {
      const d = new Date(dateVal);
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-200/40 dark:border-blue-900/50">
            <FileQuestion className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              My Assigned Questions
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Review and verify the questions assigned to you.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <button
            type="button"
            onClick={() => fetchQuestions()}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh assignments"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. SUMMARY METRIC PILLS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Assigned</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">{totalAssigned}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-blue-200/60 dark:border-blue-900/40 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Pending Questions</p>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 font-mono">{pendingCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Completed Questions</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">{completedCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. TABS: PENDING QUESTIONS vs COMPLETED QUESTIONS */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("PENDING")}
          className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === "PENDING"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Questions</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
              activeTab === "PENDING" ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            {pendingCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("COMPLETED")}
          className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === "COMPLETED"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Completed Questions</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
              activeTab === "COMPLETED" ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            {completedCount}
          </span>
        </button>
      </div>

      {/* 4. FILTERS & SEARCH BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search question text, chapter, topic, code..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-xs"
          />
        </form>

        {/* Subject Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {subjects.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSelectedSubject(s)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                selectedSubject === s
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 5. MAIN QUESTIONS LIST */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center shadow-xs">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Loading your assigned questions...</p>
        </div>
      ) : (!questions || questions.length === 0) ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            {activeTab === "PENDING" ? "No pending questions found" : "No completed questions found"}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {activeTab === "PENDING"
              ? "All your assigned questions are up to date! New assignments will appear here once allocated."
              : "You have not submitted any reviewed questions yet in this category."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {(questions || []).map((q, idx) => {
            const defaultTrans = q.translations?.[0];
            const activeLang = selectedLanguageMap[q.id] || defaultTrans?.language || "HINDI";
            const currentTrans =
              q.translations?.find((t) => t.language.toUpperCase() === activeLang.toUpperCase()) || defaultTrans;

            const isCompleted =
              activeTab === "COMPLETED" ||
              q.correctionStatus === "SUBMITTED" ||
              q.correctionStatus === "APPROVED" ||
              q.correctionStatus === "COMPLETED" ||
              q.status === "PUBLISHED";

            const assignedDateStr = formatDate(q.assignedAt || q.createdAt);
            const completedDateStr = formatDate(q.correctionSubmittedAt);

            return (
              <div
                key={q.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs hover:border-blue-400/60 dark:hover:border-blue-700/60 transition group"
              >
                {/* Top Metadata Row */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Subject badge */}
                    <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${getSubjectColor(q.subject)}`}>
                      {q.subject}
                    </span>

                    {/* Question Code / ID */}
                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl">
                      {q.questionCode || `Q-${q.id.slice(0, 8)}`}
                    </span>

                    {/* Question Type */}
                    <span className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {q.type.replace(/_/g, " ")}
                    </span>

                    {/* Difficulty */}
                    <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold ${getDifficultyColor(q.difficulty)}`}>
                      {q.difficulty}
                    </span>
                  </div>

                  {/* Review Status & Dates */}
                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </span>
                    ) : q.correctionStatus === "REWORK" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Rework Required</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Pending Review</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Chapter & Topic */}
                <div className="pt-3 pb-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span className="font-bold text-slate-800 dark:text-slate-200">{q.chapter || "General Chapter"}</span>
                    {q.topic && (
                      <>
                        <span>•</span>
                        <span className="text-slate-600 dark:text-slate-400 font-medium">Topic: {q.topic}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Question Statement & Translations Preview */}
                <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-4 my-2">
                  {/* Language Switcher if bilingual */}
                  {q.translations && q.translations.length > 1 && (
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/40 dark:border-slate-700/40">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Translations Available</span>
                      <div className="flex items-center gap-1">
                        {q.translations.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() =>
                              setSelectedLanguageMap((prev) => ({
                                ...prev,
                                [q.id]: t.language,
                              }))
                            }
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition ${
                              activeLang.toUpperCase() === t.language.toUpperCase()
                                ? "bg-blue-600 text-white"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300"
                            }`}
                          >
                            {t.language}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed max-h-36 overflow-y-auto">
                    {currentTrans?.statement ? (
                      <FormulaText text={currentTrans.statement} />
                    ) : (
                      <span className="italic text-slate-400">Statement not provided.</span>
                    )}
                  </div>

                  {/* Options Preview Pills */}
                  {currentTrans?.options && typeof currentTrans.options === "object" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200/40 dark:border-slate-700/40">
                      {Object.entries(currentTrans.options).map(([optKey, optVal]) => {
                        const isCorrect = Array.isArray(currentTrans.correctOptionIds)
                          ? currentTrans.correctOptionIds.includes(optKey)
                          : currentTrans.correctOptionIds === optKey;

                        return (
                          <div
                            key={optKey}
                            className={`flex items-start gap-2 text-xs p-2 rounded-xl border ${
                              isCorrect
                                ? "bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                isCorrect
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {optKey}
                            </span>
                            <div className="line-clamp-2">
                              <FormulaText text={String(optVal || "")} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Bottom Row: Assignee Info & Review Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 mt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    {q.assignedBy?.name && (
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Assigned by {q.assignedBy.name}</span>
                      </div>
                    )}
                    {assignedDateStr && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{assignedDateStr}</span>
                      </div>
                    )}
                    {completedDateStr && (
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Submitted on {completedDateStr}</span>
                      </div>
                    )}
                  </div>

                  {/* Open Review Action */}
                  <Link
                    href={`/team/questions/${q.id}/review?assignedToId=ME&fromDashboard=my-assigned-questions`}
                    className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                      isCompleted
                        ? "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
                    }`}
                  >
                    <span>{isCompleted ? "View Review" : "Review Question"}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
