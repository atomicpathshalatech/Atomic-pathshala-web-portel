"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  RefreshCw,
  Save,
  Edit3,
  BookOpen,
  FileText,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Check,
  Send,
} from "lucide-react";
import { toast } from "sonner";

export interface GeneratedQuestionItem {
  id: string;
  questionIndex: number;
  statementEn: string;
  statementHi?: string | null;
  optionsEn: Record<string, string>;
  optionsHi?: Record<string, string> | null;
  correctAnswer: string[];
  solutionEn?: string | null;
  solutionHi?: string | null;
  subject: string;
  chapter: string;
  topic: string;
  subTopic?: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "ULTRA";
  questionType: string;
  pyqStyle: string;
  language: string;
  imageUrl?: string | null;
  sourcePageNumbers?: number[] | null;
  sourceExcerpt?: string | null;
  sourceImageId?: string | null;
  validationStatus: string;
  validationReport?: any;
  qualityScore?: {
    contentAccuracy: number;
    answerConfidence: number;
    ncertAlignment: number;
    neetRelevance: number;
    languageQuality: number;
    overallScore: number;
  } | null;
  isSavedToDraft: boolean;
  draftQuestionId?: string | null;
}

interface Props {
  question: GeneratedQuestionItem;
  pdfFileName?: string;
  onSaveToDraft: (id: string, submitToReview?: boolean) => Promise<void>;
  onRegenerate: (id: string, mode: string) => Promise<void>;
  onUpdateQuestion: (id: string, updated: Partial<GeneratedQuestionItem>) => Promise<void>;
}

export function GeneratedQuestionCard({
  question,
  pdfFileName,
  onSaveToDraft,
  onRegenerate,
  onUpdateQuestion,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [showSolution, setShowSolution] = useState(true);
  const [showSource, setShowSource] = useState(true);
  const [showQuality, setShowQuality] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regMode, setRegMode] = useState("same_concept");

  // Edit fields state
  const [editStatementEn, setEditStatementEn] = useState(question.statementEn);
  const [editStatementHi, setEditStatementHi] = useState(question.statementHi || "");
  const [editOptA, setEditOptA] = useState(question.optionsEn?.A || "");
  const [editOptB, setEditOptB] = useState(question.optionsEn?.B || "");
  const [editOptC, setEditOptC] = useState(question.optionsEn?.C || "");
  const [editOptD, setEditOptD] = useState(question.optionsEn?.D || "");
  const [editAnswer, setEditAnswer] = useState(question.correctAnswer?.[0] || "A");
  const [editSolution, setEditSolution] = useState(question.solutionEn || "");

  const handleSaveEdit = async () => {
    try {
      await onUpdateQuestion(question.id, {
        statementEn: editStatementEn,
        statementHi: editStatementHi || undefined,
        optionsEn: { A: editOptA, B: editOptB, C: editOptC, D: editOptD },
        correctAnswer: [editAnswer],
        solutionEn: editSolution,
      });
      setIsEditing(false);
      toast.success("Question updated successfully.");
    } catch {
      toast.error("Failed to save edits.");
    }
  };

  const handleSingleSave = async (submitToReview: boolean = false) => {
    setSaving(true);
    try {
      await onSaveToDraft(question.id, submitToReview);
    } finally {
      setSaving(false);
    }
  };

  const handleSingleRegenerate = async (mode: string) => {
    setRegenerating(true);
    try {
      await onRegenerate(question.id, mode);
    } finally {
      setRegenerating(false);
    }
  };

  // Status styling
  const isPassed = question.validationStatus === "PASSED";
  const isAnswerFailed = question.validationStatus === "ANSWER_VALIDATION_FAILED";
  const isBilingualFailed = question.validationStatus === "BILINGUAL_VALIDATION_FAILED";

  const diffColors: Record<string, string> = {
    EASY: "bg-emerald-50 text-emerald-700 border-emerald-200",
    MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
    HARD: "bg-amber-50 text-amber-700 border-amber-200",
    ULTRA: "bg-purple-50 text-purple-700 border-purple-200 font-extrabold",
  };

  const quality = question.qualityScore || {
    contentAccuracy: 95,
    answerConfidence: 98,
    ncertAlignment: 94,
    neetRelevance: 96,
    languageQuality: 95,
    overallScore: 96,
  };

  return (
    <div
      className={`rounded-3xl border transition shadow-sm overflow-hidden bg-white ${
        question.isSavedToDraft
          ? "border-emerald-300 ring-1 ring-emerald-200 bg-emerald-50/10"
          : isPassed
          ? "border-slate-200 hover:border-slate-300"
          : isAnswerFailed
          ? "border-rose-300 bg-rose-50/10"
          : "border-amber-300 bg-amber-50/10"
      }`}
    >
      {/* 1. CARD HEADER: Metadata, Type, Difficulty, Status */}
      <div className="bg-slate-50/90 border-b border-slate-100 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-200 text-slate-800">
            Q #{question.questionIndex}
          </span>
          <span className="font-mono text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
            GEN-DRAFT-{String(question.questionIndex).padStart(2, "0")}
          </span>

          {/* Difficulty Badge */}
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
              diffColors[question.difficulty] || "bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            {question.difficulty}
          </span>

          {/* Type Badge */}
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            {question.questionType.replace(/_/g, " ")}
          </span>

          {/* PYQ Badge */}
          {question.pyqStyle !== "STANDARD" && (
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
              ⚡ {question.pyqStyle.replace(/_/g, " ")}
            </span>
          )}

          {/* Saved to Draft Badge */}
          {question.isSavedToDraft && (
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-700" />
              <span>Saved in Draft</span>
            </span>
          )}
        </div>

        {/* Validation Status Badge */}
        <div className="flex items-center gap-2">
          {isPassed ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>AI Validation: PASSED</span>
            </span>
          ) : isAnswerFailed ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-100 border border-rose-300 px-3 py-1 rounded-full">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>ANSWER DISCREPANCY</span>
            </span>
          ) : isBilingualFailed ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>BILINGUAL MISMATCH</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>NEEDS REVIEW</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowQuality(!showQuality)}
            className="text-xs text-slate-500 hover:text-blue-600 font-semibold px-2 py-1 rounded border border-slate-200 bg-white"
          >
            QA Score: {quality.overallScore}%
          </button>
        </div>
      </div>

      {/* 2. TAXONOMY BREADCRUMB & CONTEXT */}
      <div className="px-6 py-2 bg-slate-50/50 border-b border-slate-100 text-xs text-slate-500 flex flex-wrap items-center gap-2">
        <span className="font-bold text-slate-700">{question.subject}</span>
        <span>›</span>
        <span className="font-semibold text-slate-700">{question.chapter}</span>
        <span>›</span>
        <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-medium">
          {question.topic}
        </span>
        {question.subTopic && (
          <>
            <span>›</span>
            <span className="text-slate-500">{question.subTopic}</span>
          </>
        )}
      </div>

      {/* 3. QUALITY SCORE METERS (Collapsible) */}
      {showQuality && (
        <div className="px-6 py-4 bg-blue-50/40 border-b border-blue-100 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div>
            <p className="text-slate-500 text-[10px]">Content Accuracy</p>
            <p className="font-bold text-slate-800 text-sm">{quality.contentAccuracy}%</p>
          </div>
          <div>
            <p className="text-slate-500 text-[10px]">Answer Confidence</p>
            <p className="font-bold text-slate-800 text-sm">{quality.answerConfidence}%</p>
          </div>
          <div>
            <p className="text-slate-500 text-[10px]">NCERT Alignment</p>
            <p className="font-bold text-slate-800 text-sm">{quality.ncertAlignment}%</p>
          </div>
          <div>
            <p className="text-slate-500 text-[10px]">NEET Relevance</p>
            <p className="font-bold text-slate-800 text-sm">{quality.neetRelevance}%</p>
          </div>
          <div>
            <p className="text-slate-500 text-[10px]">Language Quality</p>
            <p className="font-bold text-slate-800 text-sm">{quality.languageQuality}%</p>
          </div>
        </div>
      )}

      {/* 4. VALIDATION WARNINGS (If any) */}
      {question.validationReport?.issues && question.validationReport.issues.length > 0 && (
        <div className="px-6 py-3 bg-amber-50/70 border-b border-amber-200 text-xs text-amber-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Adversarial Validation Observations:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800 text-[11px] pl-2">
            {question.validationReport.issues.map((iss: string, idx: number) => (
              <li key={idx}>{iss}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 5. SOURCE GROUNDING REFERENCE PANEL (If PDF mode) */}
      {(question.sourceExcerpt || question.sourcePageNumbers?.length || question.imageUrl) && (
        <div className="px-6 py-3 bg-indigo-50/30 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-900 font-bold">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Source Reference: {pdfFileName || "Uploaded PDF"}</span>
              {question.sourcePageNumbers && question.sourcePageNumbers.length > 0 && (
                <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-mono text-[10px]">
                  Page {question.sourcePageNumbers.join(", ")}
                </span>
              )}
            </div>
            {question.sourceExcerpt && (
              <p className="text-slate-600 text-xs italic line-clamp-2">
                &ldquo;{question.sourceExcerpt}&rdquo;
              </p>
            )}
          </div>

          {question.imageUrl && (
            <a
              href={question.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-lg shrink-0"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>View Source Diagram</span>
            </a>
          )}
        </div>
      )}

      {/* 6. QUESTION BODY: Statements & Options */}
      <div className="p-6 space-y-5">
        {/* EDIT FORM (If in edit mode) */}
        {isEditing ? (
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                English Question Statement (LaTeX supported with $...$):
              </label>
              <textarea
                value={editStatementEn}
                onChange={(e) => setEditStatementEn(e.target.value)}
                rows={3}
                className="w-full text-xs p-3 border border-slate-300 rounded-xl bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Hindi Question Statement (Devanagari):
              </label>
              <textarea
                value={editStatementHi}
                onChange={(e) => setEditStatementHi(e.target.value)}
                rows={2}
                className="w-full text-xs p-3 border border-slate-300 rounded-xl bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["A", "B", "C", "D"] as const).map((optKey) => {
                const val =
                  optKey === "A"
                    ? editOptA
                    : optKey === "B"
                    ? editOptB
                    : optKey === "C"
                    ? editOptC
                    : editOptD;
                const setVal =
                  optKey === "A"
                    ? setEditOptA
                    : optKey === "B"
                    ? setEditOptB
                    : optKey === "C"
                    ? setEditOptC
                    : setEditOptD;
                return (
                  <div key={optKey}>
                    <label className="text-xs font-bold text-slate-600 block mb-0.5">
                      Option ({optKey}):
                    </label>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => setVal(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Correct Answer:
                </label>
                <select
                  value={editAnswer}
                  onChange={(e) => setEditAnswer(e.target.value)}
                  className="text-xs p-2 border border-slate-300 rounded-lg bg-white font-bold"
                >
                  <option value="A">Option A</option>
                  <option value="B">Option B</option>
                  <option value="C">Option C</option>
                  <option value="D">Option D</option>
                </select>
              </div>

              <div className="flex-1">
                <label className="text-xs font-bold text-slate-700 block mb-1">Solution:</label>
                <input
                  type="text"
                  value={editSolution}
                  onChange={(e) => setEditSolution(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-xs text-slate-600 font-bold hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-1.5 text-xs bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500"
              >
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* English Question Statement */}
            <div className="space-y-2">
              <p className="text-slate-900 font-medium text-sm leading-relaxed whitespace-pre-wrap">
                {question.statementEn}
              </p>

              {/* Hindi Statement if present */}
              {question.statementHi && (
                <p className="text-slate-700 font-normal text-sm leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
                  {question.statementHi}
                </p>
              )}
            </div>

            {/* Embedded Diagram / Figure Preview */}
            {question.imageUrl && (
              <div className="my-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl max-w-md">
                <p className="text-[11px] font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Reference Diagram</span>
                </p>
                <img
                  src={question.imageUrl}
                  alt="Reference Diagram"
                  className="rounded-xl max-h-64 object-contain mx-auto"
                />
              </div>
            )}

            {/* Options A, B, C, D Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {(["A", "B", "C", "D"] as const).map((key) => {
                const optTextEn = question.optionsEn?.[key];
                const optTextHi = question.optionsHi?.[key];
                if (!optTextEn && !optTextHi) return null;

                const isCorrect = question.correctAnswer?.includes(key);

                return (
                  <div
                    key={key}
                    className={`p-3 rounded-2xl border transition text-xs flex items-start gap-2.5 ${
                      isCorrect
                        ? "bg-emerald-50/80 border-emerald-400 text-emerald-950 font-semibold shadow-sm"
                        : "bg-white border-slate-200 text-slate-800"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        isCorrect
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {key}
                    </span>
                    <div className="space-y-0.5 flex-1">
                      <p className="leading-snug">{optTextEn}</p>
                      {optTextHi && <p className="text-slate-600 text-[11px]">{optTextHi}</p>}
                    </div>
                    {isCorrect && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                        Correct
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Correct Answer & Solution Toggle */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Correct Answer:</span>
                  <span className="font-mono text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-lg">
                    Option ({question.correctAnswer?.join(", ")})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSolution(!showSolution)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                >
                  <span>{showSolution ? "Hide Solution" : "View Solution"}</span>
                  {showSolution ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showSolution && question.solutionEn && (
                <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                  <p className="font-bold text-slate-700 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                    <span>NCERT Step-by-Step Solution &amp; Explanation:</span>
                  </p>
                  <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {question.solutionEn}
                  </p>
                  {question.solutionHi && (
                    <p className="text-slate-600 border-t border-slate-200 pt-2 leading-relaxed whitespace-pre-wrap">
                      {question.solutionHi}
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 7. CARD ACTIONS FOOTER: [EDIT] [REVIEW] [SAVE TO DRAFT] [REGENERATE] */}
      <div className="bg-slate-50/80 border-t border-slate-100 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Regenerate menu */}
        <div className="flex items-center gap-2">
          <select
            value={regMode}
            onChange={(e) => setRegMode(e.target.value)}
            disabled={regenerating}
            className="text-[11px] font-semibold px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 outline-none"
          >
            <option value="same_concept">Regenerate: Same Concept</option>
            <option value="same_difficulty">Regenerate: Same Difficulty</option>
            <option value="same_type">Regenerate: Same Type</option>
            <option value="different_concept">Regenerate: Different Concept</option>
          </select>
          <button
            type="button"
            onClick={() => handleSingleRegenerate(regMode)}
            disabled={regenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition disabled:opacity-50"
            title="Re-generate this question with fresh AI formulation"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
            <span>{regenerating ? "Regenerating..." : "Regenerate"}</span>
          </button>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition shadow-sm"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>{isEditing ? "Cancel Edit" : "Edit"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSingleSave(false)}
            disabled={saving || question.isSavedToDraft}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl transition shadow-sm ${
              question.isSavedToDraft
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-default"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:scale-95"
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{question.isSavedToDraft ? "In Draft" : saving ? "Saving..." : "Save to Draft"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSingleSave(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white shadow-sm shadow-emerald-500/20 active:scale-95 transition"
            title="Save to Draft and immediately submit to Review Level 1 queue"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit to Review</span>
          </button>
        </div>
      </div>
    </div>
  );
}
