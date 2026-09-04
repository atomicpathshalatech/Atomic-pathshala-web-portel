"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Layers, Plus, Sparkles, CheckCircle2, ArrowRight, Download } from "lucide-react";
import { TemplateBuilder } from "@/components/team-portal/TemplateBuilder";
import { TemplateSummaryCard } from "@/components/team-portal/TemplateSummaryCard";
import { TestQuestionPicker } from "@/components/team-portal/TestQuestionPicker";
import { PublishTestButton } from "@/components/team-portal/PublishTestButton";
import { TestPdfDownloadModal } from "@/components/test-portal/TestPdfDownloadModal";

interface TestDetailClientProps {
  test: {
    id: string;
    name: string;
    durationMin: number;
    correctMarks: number;
    status: string;
    templateId: string | null;
    template?: {
      id: string;
      name: string;
    } | null;
    batchSchedule?: {
      batch: { id: string; name: string };
      startsAt: string | Date;
      endsAt: string | Date;
    } | null;
    sections: Array<{
      id: string;
      name: string;
      subject: string;
      targetCount: number;
      marksPerQuestion: number | null;
      negativeMarks: number | null;
      order: number;
      questions: Array<{
        id: string;
        order: number;
        marksOverride: number | null;
        question: {
          id: string;
          translations: Array<{ language: string; statement: string }>;
        };
      }>;
    }>;
  };
  isDraft: boolean;
  canPublish: boolean;
}

export function TestDetailClient({ test, isDraft, canPublish }: TestDetailClientProps) {
  const router = useRouter();
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const hasTemplate = Boolean(test.templateId || (test.sections.length > 0 && test.sections[0]?.name !== "General"));
  const sectionQuestions = test.sections.flatMap((s) => s.questions.map((sq) => ({ ...sq, section: s })));
  const totalQuestions = sectionQuestions.length;

  const sectionsFormatted = test.sections.map((s) => ({
    id: s.id,
    name: s.name,
    subject: s.subject,
    targetCount: s.targetCount || 30,
    marksPerQuestion: s.marksPerQuestion,
    negativeMarks: s.negativeMarks,
    order: s.order,
    _count: { questions: s.questions.length },
  }));

  function handleTemplateApplied() {
    setShowTemplateModal(false);
    router.refresh();
  }

  function questionStatement(translations: { language: string; statement: string }[]) {
    return translations.find((t) => t.language === "ENGLISH")?.statement ?? translations[0]?.statement ?? "";
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{test.name}</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                test.status === "PUBLISHED"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {test.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {test.batchSchedule && `${test.batchSchedule.batch.name} · `}
            {test.durationMin} mins · {totalQuestions} questions assigned
          </p>
        </div>

        <div className="flex items-center gap-2">
          <TestPdfDownloadModal
            testId={test.id}
            testName={test.name}
            triggerButton={
              <button
                type="button"
                className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <Download className="w-4 h-4" /> Export Test PDF
              </button>
            }
          />

          {isDraft && !hasTemplate && (
            <button
              type="button"
              onClick={() => setShowTemplateModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            >
              <Layers className="w-4 h-4" /> Add Template
            </button>
          )}

          {isDraft && hasTemplate && (
            <Link
              href={`/team/tests/${test.id}/author`}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> Add / Author Questions
            </Link>
          )}

          {isDraft && canPublish && <PublishTestButton testId={test.id} />}
        </div>
      </div>

      {/* State 1: No Template Applied */}
      {!hasTemplate && isDraft && (
        <div className="bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 border-2 border-dashed border-indigo-200 rounded-3xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Layers className="w-7 h-7" />
          </div>

          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">Step 1: Apply Assessment Template</h3>
            <p className="text-xs text-slate-500 mt-1">
              Configure multi-subject sections (e.g. NEET: Physics, Chemistry, Biology) and question counts to establish this test&apos;s blueprint.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowTemplateModal(true)}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-500/20 flex items-center gap-2 transition"
            >
              <Sparkles className="w-4 h-4" /> Choose or Build Template
            </button>
          </div>
        </div>
      )}

      {/* State 2: Template is Active */}
      {hasTemplate && (
        <TemplateSummaryCard
          templateName={test.template?.name || "Exam Blueprint"}
          sections={sectionsFormatted}
          onChangeTemplate={isDraft ? () => setShowTemplateModal(true) : undefined}
          isReadOnly={!isDraft}
        />
      )}

      {/* Question Management Picker */}
      {hasTemplate && (
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Assigned Questions</h3>
              <p className="text-xs text-slate-500">Pick from Question Bank or open Author Studio</p>
            </div>
            {isDraft && (
              <Link
                href={`/team/tests/${test.id}/author`}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                Open Dual-Column Question Studio <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <TestQuestionPicker
            testId={test.id}
            editable={isDraft}
            current={sectionQuestions.map((sq) => ({
              id: sq.id,
              order: sq.order,
              question: {
                id: sq.question.id,
                statement: questionStatement(sq.question.translations),
              },
            }))}
          />
        </section>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <TemplateBuilder
            testId={test.id}
            initialTemplateId={test.templateId}
            onTemplateApplied={handleTemplateApplied}
            onClose={() => setShowTemplateModal(false)}
          />
        </div>
      )}
    </div>
  );
}
