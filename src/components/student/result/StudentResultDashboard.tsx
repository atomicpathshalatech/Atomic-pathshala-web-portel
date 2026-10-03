"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { FullTestAnalysisResult } from "@/lib/test-engine/analysis-engine";
import { ResultOverviewCard } from "./ResultOverviewCard";
import { QuestionReviewSection } from "./QuestionReviewSection";
import {
  ExamPatternInsights,
  ImprovementPlanView,
  NcertRevisionPlan,
  QuestionTypeInsights,
  SubjectInsights,
} from "./ResultInsightSections";
import { buildResultInsights } from "@/lib/test-engine/result-insights";
import { LeaderboardModal } from "./LeaderboardModal";
import { TestPdfDownloadModal } from "@/components/test-portal/TestPdfDownloadModal";

type ActiveTab = "SUBJECTS" | "QUESTION_TYPES" | "EXAM_PATTERN" | "NCERT_PLAN" | "QUESTION_REVIEW" | "ACTION_PLAN";

// Overview and Chapters & Topics were removed: the first repeated the other
// tabs, the second was mostly noise.
const TABS: { id: ActiveTab; label: string; icon: string }[] = [
  { id: "SUBJECTS", label: "Subject Analysis", icon: "donut_large" },
  { id: "QUESTION_TYPES", label: "Question Types", icon: "category" },
  { id: "EXAM_PATTERN", label: "Exam Pattern", icon: "insights" },
  { id: "NCERT_PLAN", label: "NCERT Revision", icon: "menu_book" },
  { id: "QUESTION_REVIEW", label: "Question Review", icon: "fact_check" },
  { id: "ACTION_PLAN", label: "Improvement Plan", icon: "rocket_launch" },
];

export function StudentResultDashboard({
  analysis,
}: {
  analysis: FullTestAnalysisResult;
}) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("SUBJECTS");
  const insights = useMemo(() => buildResultInsights(analysis.questionReviews ?? []), [analysis.questionReviews]);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/tests" className="hover:text-blue-600 transition font-bold">
            Test Series Arena
          </Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="font-bold text-slate-900 dark:text-white truncate max-w-xs">
            {analysis.testName}
          </span>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="text-blue-600 dark:text-blue-400 font-bold">AIR Analytics</span>
        </div>

        <div className="flex items-center gap-2">
          <TestPdfDownloadModal
            testId={analysis.testId}
            testName={analysis.testName}
            triggerButton={
              <button
                type="button"
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                <span>Download PDF</span>
              </button>
            }
          />

          <Link
            href="/tests"
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>Back to Test Arena</span>
          </Link>
        </div>
      </div>

      {/* Main Score & Top Metric Card */}
      <ResultOverviewCard
        analysis={analysis}
        onOpenLeaderboard={() => setLeaderboardOpen(true)}
      />

      {/* Interactive Tabs Navigation */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-1.5 border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span className="material-symbols-outlined text-base">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab Content Area */}
      <div className="transition-all duration-200">
        {activeTab === "SUBJECTS" && <SubjectInsights insights={insights} />}

        {activeTab === "QUESTION_TYPES" && <QuestionTypeInsights insights={insights} />}

        {activeTab === "EXAM_PATTERN" && <ExamPatternInsights insights={insights} />}

        {activeTab === "NCERT_PLAN" && (
          <NcertRevisionPlan ncertPlan={analysis.ncertPlan ?? []} insights={insights} storageKey={`ncert-done:${analysis.attemptId}`} />
        )}

        {activeTab === "QUESTION_REVIEW" && (
          <QuestionReviewSection questions={analysis.questionReviews} />
        )}

        {activeTab === "ACTION_PLAN" && <ImprovementPlanView insights={insights} />}
      </div>

      {/* Leaderboard Modal */}
      <LeaderboardModal
        testId={analysis.testId}
        isOpen={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
      />
    </div>
  );
}
