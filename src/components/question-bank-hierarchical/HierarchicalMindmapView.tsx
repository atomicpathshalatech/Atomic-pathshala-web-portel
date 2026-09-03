"use client";

import React, { useState } from "react";
import { HierarchyNode } from "@/lib/question-bank-hierarchical/types";

interface HierarchicalMindmapViewProps {
  nodes: HierarchyNode[];
  totalQuestions: number;
  onToggleRevision: (node: HierarchyNode) => void;
  onSelectNode?: (node: HierarchyNode) => void;
}

export function HierarchicalMindmapView({
  nodes,
  totalQuestions,
  onToggleRevision,
  onSelectNode,
}: HierarchicalMindmapViewProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>(nodes[0]?.id || "");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");

  const activeClass = nodes.find((n) => n.id === selectedClassId) || nodes[0];
  const activeSubject = activeClass?.children?.find((s) => s.id === selectedSubjectId) || activeClass?.children?.[0];
  const activeChapter = activeSubject?.children?.find((c) => c.id === selectedChapterId) || activeSubject?.children?.[0];

  return (
    <div className="p-6 rounded-3xl bg-[#fbf9f4] dark:bg-slate-950 border border-amber-200/60 dark:border-slate-800 shadow-inner overflow-x-auto min-h-[600px] flex items-center">
      <div className="flex items-center gap-12 min-w-max py-8 px-4">
        {/* ROOT: All Taxonomy */}
        <div className="flex flex-col items-center gap-2">
          <div className="px-5 py-3 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 shadow-lg text-center">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
              Curriculum Root
            </span>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              All Taxonomy
            </h3>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {totalQuestions.toLocaleString()} Qs
            </span>
          </div>
        </div>

        <div className="w-8 h-0.5 bg-slate-300 dark:bg-slate-700" />

        {/* COLUMN 1: Classes */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider text-center">
            Classes
          </span>
          {nodes.map((cls) => {
            const isSelected = cls.id === activeClass?.id;
            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => {
                  setSelectedClassId(cls.id);
                  setSelectedSubjectId("");
                  setSelectedChapterId("");
                }}
                className={`px-4 py-2.5 rounded-2xl border text-left transition flex items-center justify-between gap-4 ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20"
                    : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-blue-300"
                }`}
              >
                <div>
                  <span className="text-xs font-black block">{cls.name}</span>
                  <span className={`text-[10px] ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                    {cls.counts.total} Qs • {cls.children?.length || 0} subs
                  </span>
                </div>
                <span className="material-symbols-outlined text-sm">
                  {isSelected ? "arrow_forward" : "chevron_right"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="w-8 h-0.5 bg-slate-300 dark:bg-slate-700" />

        {/* COLUMN 2: Subjects */}
        {activeClass && (
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider text-center">
              Subjects
            </span>
            {(activeClass.children || []).map((sub) => {
              const isSelected = sub.id === activeSubject?.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    setSelectedSubjectId(sub.id);
                    setSelectedChapterId("");
                  }}
                  className={`px-4 py-2.5 rounded-2xl border text-left transition flex items-center justify-between gap-4 ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
                      : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-indigo-300"
                  }`}
                >
                  <div>
                    <span className="text-xs font-black block">{sub.name}</span>
                    <span className={`text-[10px] ${isSelected ? "text-indigo-100" : "text-slate-400"}`}>
                      {sub.counts.total} Qs • {sub.children?.length || 0} chs
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-sm">
                    {isSelected ? "arrow_forward" : "chevron_right"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="w-8 h-0.5 bg-slate-300 dark:bg-slate-700" />

        {/* COLUMN 3: Chapters */}
        {activeSubject && (
          <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-2">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider text-center sticky top-0 bg-[#fbf9f4] dark:bg-slate-950 py-1">
              Chapters ({activeSubject.children?.length || 0})
            </span>
            {(activeSubject.children || []).map((chap) => {
              const isSelected = chap.id === activeChapter?.id;
              return (
                <div
                  key={chap.id}
                  className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 min-w-[240px] ${
                    isSelected
                      ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20"
                      : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-purple-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedChapterId(chap.id)}
                    className="text-left flex-1 min-w-0"
                  >
                    <span className="text-xs font-bold block truncate">{chap.name}</span>
                    <span className={`text-[10px] ${isSelected ? "text-purple-100" : "text-slate-400"}`}>
                      {chap.counts.total} Qs • {chap.children?.length || 0} topics
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleRevision(chap)}
                    title={chap.inRevision ? "In Revision" : "Add Chapter to Revision"}
                    className={`p-1.5 rounded-xl text-xs font-bold transition ${
                      chap.inRevision
                        ? "bg-emerald-500 text-white"
                        : isSelected
                        ? "bg-purple-700 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-600"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {chap.inRevision ? "check" : "playlist_add"}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="w-8 h-0.5 bg-slate-300 dark:bg-slate-700" />

        {/* COLUMN 4: Topics & Subtopics */}
        {activeChapter && (
          <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-2">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider text-center sticky top-0 bg-[#fbf9f4] dark:bg-slate-950 py-1">
              Topics &amp; Subtopics
            </span>
            {(activeChapter.children || []).length > 0 ? (
              activeChapter.children!.map((top) => (
                <div
                  key={top.id}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 min-w-[260px] shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        {top.name}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        {top.counts.total} Questions ({top.counts.reviewed} Reviewed)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleRevision(top)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                        top.inRevision
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-emerald-600"
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">
                        {top.inRevision ? "check" : "playlist_add"}
                      </span>
                      <span>{top.inRevision ? "In Revision" : "Revise"}</span>
                    </button>
                  </div>

                  {/* Subtopics */}
                  {top.children && top.children.length > 0 && (
                    <div className="pl-3 border-l-2 border-slate-100 dark:border-slate-800 space-y-1">
                      {top.children.map((st) => (
                        <div
                          key={st.id}
                          className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400"
                        >
                          <span className="truncate">{st.name}</span>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                            {st.counts.total} Qs
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-400 text-center">
                No topics created under this chapter yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
