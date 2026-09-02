"use client";

import { Layers, CheckCircle, AlertCircle, Edit3 } from "lucide-react";

interface SectionInfo {
  id: string;
  name: string;
  subject: string;
  targetCount: number;
  marksPerQuestion: number | null;
  negativeMarks: number | null;
  order: number;
  _count?: {
    questions: number;
  };
}

interface TemplateSummaryCardProps {
  templateName?: string | null;
  sections: SectionInfo[];
  onChangeTemplate?: () => void;
  isReadOnly?: boolean;
}

export function TemplateSummaryCard({
  templateName,
  sections,
  onChangeTemplate,
  isReadOnly = false,
}: TemplateSummaryCardProps) {
  const totalTargetQuestions = sections.reduce((sum, s) => sum + s.targetCount, 0);
  const totalCurrentQuestions = sections.reduce(
    (sum, s) => sum + (s._count?.questions || 0),
    0
  );
  const totalMaxMarks = sections.reduce(
    (sum, s) => sum + s.targetCount * (s.marksPerQuestion ?? 4),
    0
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Applied Assessment Template
              </span>
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                Active Blueprint
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              {templateName || "Custom Exam Structure"}
            </h3>
          </div>
        </div>

        {!isReadOnly && onChangeTemplate && (
          <button
            type="button"
            onClick={onChangeTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition"
          >
            <Edit3 className="w-3.5 h-3.5" /> Change Template
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 my-4">
        <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
          <span className="text-[11px] text-slate-500 block">Sections</span>
          <span className="text-lg font-bold text-slate-900">{sections.length}</span>
        </div>
        <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl">
          <span className="text-[11px] text-indigo-600 block">Questions Progress</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-indigo-950">{totalCurrentQuestions}</span>
            <span className="text-xs text-indigo-600">/ {totalTargetQuestions} Target</span>
          </div>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl">
          <span className="text-[11px] text-emerald-700 block">Total Maximum Marks</span>
          <span className="text-lg font-bold text-emerald-950">{totalMaxMarks}</span>
        </div>
      </div>

      {/* Sections breakdown grid */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-700 block mb-2">Section Blueprint Breakdown:</span>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {sections.map((sec) => {
            const addedCount = sec._count?.questions ?? 0;
            const isFilled = addedCount >= sec.targetCount;

            return (
              <div
                key={sec.id}
                className={`p-3 rounded-xl border transition-all ${
                  isFilled
                    ? "bg-emerald-50/30 border-emerald-200"
                    : "bg-slate-50/70 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-slate-900">{sec.name}</span>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                    {sec.subject}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200/60">
                  <div className="flex items-center gap-1">
                    {isFilled ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span className={isFilled ? "font-semibold text-emerald-700" : "text-slate-600"}>
                      {addedCount} / {sec.targetCount} Qs
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400">
                    +{sec.marksPerQuestion ?? 4} / {sec.negativeMarks ?? -1}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
