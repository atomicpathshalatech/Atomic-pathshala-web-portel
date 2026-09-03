"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { RevisionItemSummary } from "@/lib/question-bank-hierarchical/types";
import { EquationLivePreview } from "../questions/EquationLivePreview";

interface RevisionSessionModalProps {
  item: RevisionItemSummary;
  onClose: () => void;
  onSessionCompleted: () => void;
}

export function RevisionSessionModal({
  item,
  onClose,
  onSessionCompleted,
}: RevisionSessionModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<string>("ALL");
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);

  // Initialize session on mount
  useEffect(() => {
    initSession();
  }, [item.id, mode]);

  const initSession = async () => {
    setLoading(true);
    setResult(null);
    setAnswers({});
    setCurrentIndex(0);

    try {
      const res = await fetch("/api/team/revision/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          revisionItemId: item.id,
          mode,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSession(json.data.session);
        setQuestions(json.data.questions || []);
      } else {
        toast.error(json.error || "Failed to start revision session.");
      }
    } catch {
      toast.error("Network error while starting revision.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (questionId: string, optionKey: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionKey }));
  };

  const handleSubmitSession = async () => {
    if (!session?.id) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/team/revision/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          sessionId: session.id,
          answers,
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.result) {
        setResult(json.data.result);
        toast.success(`Revision session completed! Score: ${json.data.result.accuracy}%`);
        onSessionCompleted();
      } else {
        toast.error(json.error || "Failed to submit session.");
      }
    } catch {
      toast.error("Error submitting session.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentQ = questions[currentIndex];
  const enTrans = currentQ?.translations?.find((t: any) => t.language === "ENGLISH") || currentQ?.translations?.[0];
  const hiTrans = currentQ?.translations?.find((t: any) => t.language === "HINDI");
  const optionsObj = (enTrans?.options as Record<string, string>) || {};

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
                Revision Run #{session?.revisionNumber || item.revisionCount + 1}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {item.entityType}: {item.title}
              </span>
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white mt-1">
              {item.fullPath}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <span className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold text-slate-500">Preparing revision questions...</p>
            </div>
          ) : result ? (
            /* Result Summary Screen */
            <div className="space-y-6 text-center py-6">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <span className="material-symbols-outlined text-3xl">verified</span>
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Revision Session Completed!
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Historical session has been permanently saved to your progress profile.
                </p>
              </div>

              {/* Score Grid */}
              <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Accuracy</span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {result.accuracy}%
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Correct</span>
                  <span className="text-xl font-black text-emerald-600">{result.correct}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Incorrect</span>
                  <span className="text-xl font-black text-red-500">{result.incorrect}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Skipped</span>
                  <span className="text-xl font-black text-slate-400">{result.skipped}</span>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={initSession}
                  className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white font-bold text-xs transition"
                >
                  Revise Again
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <span className="material-symbols-outlined text-4xl text-slate-300">inventory_2</span>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No questions found under this portion yet.
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Add questions to this Chapter/Topic in the Question Bank to start revising it.
              </p>
            </div>
          ) : (
            /* Active Question Runner */
            <div className="space-y-5">
              {/* Question Progress Tracker */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="text-[11px] font-mono text-emerald-600 font-bold">
                  {Object.keys(answers).length} Attempted
                </span>
              </div>

              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all"
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                />
              </div>

              {/* Question Statement */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                  {enTrans?.statement || "No statement"}
                </p>
                {hiTrans?.statement && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    {hiTrans.statement}
                  </p>
                )}
                {/* Live Formula Preview if LaTeX present */}
                <EquationLivePreview content={enTrans?.statement || ""} label="Formula Preview" />
              </div>

              {/* Options */}
              <div className="space-y-2.5">
                {Object.entries(optionsObj).map(([key, optVal]) => {
                  const isSelected = answers[currentQ.id] === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectOption(currentQ.id, key)}
                      className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                        isSelected
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                          : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                          isSelected
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {key}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-slate-900 dark:text-white block">
                          {optVal}
                        </span>
                        <EquationLivePreview content={optVal} label="" className="p-1 mt-1 bg-transparent border-none" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!result && questions.length > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40"
            >
              Previous
            </button>

            <div className="flex items-center gap-2">
              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition"
                >
                  Next Question
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitSession}
                  className="px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
                >
                  {submitting ? "Grading..." : "Submit Revision"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
