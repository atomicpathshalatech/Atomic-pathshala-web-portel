"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FullTestAnalysisResult } from "@/lib/test-engine/analysis-engine";
import { ResultOverviewCard } from "./ResultOverviewCard";
import { SubjectAnalysisSection } from "./SubjectAnalysisSection";
import { QuestionTypeAnalysisSection } from "./QuestionTypeAnalysisSection";
import { ErrorTaxonomySection } from "./ErrorTaxonomySection";
import { ChapterTopicAnalysisSection } from "./ChapterTopicAnalysisSection";
import { NcertRevisionSection } from "./NcertRevisionSection";
import { QuestionReviewSection } from "./QuestionReviewSection";
import { PersonalizedActionPlan } from "./PersonalizedActionPlan";
import { LeaderboardModal } from "./LeaderboardModal";

type ActiveTab =
  | "OVERVIEW"
  | "SUBJECTS"
  | "QUESTION_TYPES"
  | "ERROR_TAXONOMY"
  | "CHAPTERS_TOPICS"
  | "NCERT_PLAN"
  | "QUESTION_REVIEW"
  | "ACTION_PLAN";

const TABS: { id: ActiveTab; label: string; icon: string }[] = [
  { id: "OVERVIEW", label: "Overview", icon: "dashboard" },
  { id: "SUBJECTS", label: "Subject Analysis", icon: "donut_large" },
  { id: "QUESTION_TYPES", label: "Question Types", icon: "category" },
  { id: "ERROR_TAXONOMY", label: "Error Patterns", icon: "bug_report" },
  { id: "CHAPTERS_TOPICS", label: "Chapters & Topics", icon: "account_tree" },
  { id: "NCERT_PLAN", label: "NCERT Revision", icon: "menu_book" },
  { id: "QUESTION_REVIEW", label: "Question Review", icon: "fact_check" },
  { id: "ACTION_PLAN", label: "Improvement Plan", icon: "rocket_launch" },
];

export function StudentResultDashboard({
  analysis,
}: {
  analysis: FullTestAnalysisResult;
}) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("OVERVIEW");
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

        <Link
          href="/tests"
          className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          <span>Back to Test Arena</span>
        </Link>
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
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
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
        {activeTab === "OVERVIEW" && (
          <div className="space-y-8">
            <SubjectAnalysisSection subjects={analysis.subjectStats} />
            <ErrorTaxonomySection
              errorBreakdown={analysis.errorBreakdown}
              losingMarkAreas={analysis.losingMarkAreas}
            />
            <NcertRevisionSection ncertPlan={analysis.ncertPlan} />
            <PersonalizedActionPlan actionPlan={analysis.actionPlan} />
          </div>
        )}

        {activeTab === "SUBJECTS" && (
          <SubjectAnalysisSection subjects={analysis.subjectStats} />
        )}

        {activeTab === "QUESTION_TYPES" && (
          <QuestionTypeAnalysisSection questionTypes={analysis.questionTypeStats} />
        )}

        {activeTab === "ERROR_TAXONOMY" && (
          <ErrorTaxonomySection
            errorBreakdown={analysis.errorBreakdown}
            losingMarkAreas={analysis.losingMarkAreas}
          />
        )}

        {activeTab === "CHAPTERS_TOPICS" && (
          <ChapterTopicAnalysisSection
            chapterStats={analysis.chapterStats}
            topicStats={analysis.topicStats}
          />
        )}

        {activeTab === "NCERT_PLAN" && (
          <NcertRevisionSection ncertPlan={analysis.ncertPlan} />
        )}

        {activeTab === "QUESTION_REVIEW" && (
          <QuestionReviewSection questions={analysis.questionReviews} />
        )}

        {activeTab === "ACTION_PLAN" && (
          <PersonalizedActionPlan actionPlan={analysis.actionPlan} />
        )}
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
