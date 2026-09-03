"use client";

import React, { useState } from "react";
import { ChapterStat, TopicStat } from "@/lib/test-engine/analysis-engine";

export function ChapterTopicAnalysisSection({
  chapterStats,
  topicStats,
}: {
  chapterStats: ChapterStat[];
  topicStats: TopicStat[];
}) {
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

  const getStatusBadge = (status: ChapterStat["status"]) => {
    switch (status) {
      case "STRONG":
        return { label: "Strong (≥80%)", class: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" };
      case "NEEDS_IMPROVEMENT":
        return { label: "Needs Improvement (60–79%)", class: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-800" };
      case "WEAK":
        return { label: "Weak (<60%)", class: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400 border-red-200 dark:border-red-800" };
      default:
        return { label: "Limited Sample Data", class: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700" };
    }
  };

  const filteredTopics = selectedChapter
    ? topicStats.filter((t) => t.chapter === selectedChapter)
    : topicStats;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600">account_tree</span>
            <span>Chapter &amp; Topic Drill-Down Analysis</span>
          </h3>
          <p className="text-xs text-slate-500">
            Performance evaluated per chapter and topic with configurable mastery thresholds
          </p>
        </div>
      </div>

      {/* Chapter Cards Grid */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Chapter Performance Hierarchy
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {chapterStats.map((ch) => {
            const isSelected = selectedChapter === ch.chapter;
            const badge = getStatusBadge(ch.status);

            return (
              <div
                key={`${ch.subject}-${ch.chapter}`}
                onClick={() => setSelectedChapter(isSelected ? null : ch.chapter)}
                className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border cursor-pointer transition-all shadow-sm flex flex-col justify-between ${
                  isSelected
                    ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {ch.subject}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.class}`}>
                      {badge.label}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                    {ch.chapter}
                  </h4>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800 mt-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">Accuracy</span>
                    <span className="font-mono text-slate-900 dark:text-white">{ch.accuracy}%</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-center text-[11px] py-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <span>Att: <b>{ch.attempted}</b></span>
                    <span className="text-emerald-600">Cor: <b>{ch.correct}</b></span>
                    <span className="text-red-500">Inc: <b>{ch.incorrect}</b></span>
                  </div>

                  <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center justify-between pt-1">
                    <span>{isSelected ? "Hide Topics" : "View Topics"}</span>
                    <span className="material-symbols-outlined text-sm">
                      {isSelected ? "expand_less" : "expand_more"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Topic Drill-Down Table / List */}
      <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {selectedChapter ? `Topics in "${selectedChapter}"` : "All Evaluated Topics"} ({filteredTopics.length})
          </h4>
          {selectedChapter && (
            <button
              type="button"
              onClick={() => setSelectedChapter(null)}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              Show All Topics
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3.5">Subject / Chapter</th>
                <th className="p-3.5">Topic</th>
                <th className="p-3.5 text-center">Attempted</th>
                <th className="p-3.5 text-center">Correct</th>
                <th className="p-3.5 text-center">Incorrect</th>
                <th className="p-3.5 text-right">Error Rate</th>
                <th className="p-3.5">Diagnostic Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {filteredTopics.map((top, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                  <td className="p-3.5">
                    <span className="text-[10px] font-mono text-slate-400 block">{top.subject}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{top.chapter}</span>
                  </td>
                  <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                    {top.topic}
                    {top.subTopic && <span className="text-slate-400 font-normal block text-[10px]">{top.subTopic}</span>}
                  </td>
                  <td className="p-3.5 text-center font-mono">{top.attempted}</td>
                  <td className="p-3.5 text-center font-mono text-emerald-600">{top.correct}</td>
                  <td className="p-3.5 text-center font-mono text-red-500">{top.incorrect}</td>
                  <td className="p-3.5 text-right font-mono font-bold">
                    {top.errorRate}%
                  </td>
                  <td className="p-3.5 text-slate-600 dark:text-slate-400 text-[11px]">
                    {top.recommendation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
