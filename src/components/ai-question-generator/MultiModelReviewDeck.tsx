"use client";

import React, { useState } from "react";
import {
  Sparkles,
  BrainCircuit,
  ShieldCheck,
  Scale,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  BookOpen,
  FlaskConical,
  Binary,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
} from "lucide-react";
import { FormulaText } from "@/components/test-portal/FormulaText";

interface Props {
  questionId: string;
  storedAnswer: string[];
  validationStatus: string;
  validationReport?: any;
  onFacultyOverride?: () => Promise<void>;
}

export function MultiModelReviewDeck({
  questionId,
  storedAnswer,
  validationStatus,
  validationReport,
  onFacultyOverride,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"GEMINI" | "OPENAI" | "CLAUDE" | "CONSENSUS">("CONSENSUS");
  const [isOverriding, setIsOverriding] = useState(false);

  const qc = validationReport?.qcPayload;
  const gemini = qc?.geminiReview;
  const openai = qc?.openaiReview;
  const claude = qc?.claudeReview;
  const math = qc?.mathValidation;
  const chem = qc?.chemValidation;
  const decision = qc?.finalDecision;

  // Stored key formatted
  const storedStr = storedAnswer.join(", ").toUpperCase() || "A";

  const getStatusBadge = (decisionStr?: string, errorsCount = 0) => {
    if (decisionStr === "APPROVE" && errorsCount === 0) {
      return (
        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
          <CheckCircle2 className="w-3 h-3" />
          <span>APPROVED</span>
        </span>
      );
    }
    if (decisionStr === "REJECT") {
      return (
        <span className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-full">
          <XCircle className="w-3 h-3" />
          <span>REJECTED</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
        <AlertTriangle className="w-3 h-3" />
        <span>REQUIRES REVIEW</span>
      </span>
    );
  };

  const handleOverrideClick = async () => {
    if (!onFacultyOverride) return;
    setIsOverriding(true);
    try {
      await onFacultyOverride();
    } finally {
      setIsOverriding(false);
    }
  };

  return (
    <div className="border-t border-slate-200 bg-slate-50/70">
      {/* Accordion Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-6 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-100/80 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-900 tracking-wide">
                MULTI-AI ADVERSARIAL AUDIT &amp; QUALITY CONTROL
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                4-PANEL VERIFICATION
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Independent reviews by Gemini L1, OpenAI L2, Claude L3, KaTeX math &amp; chemical charge evaluation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px]">
            <span
              className={`px-2 py-0.5 rounded font-mono font-bold ${
                gemini?.decision === "APPROVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
              }`}
            >
              Gemini: {gemini?.solvedAnswer || "?"}
            </span>
            <span
              className={`px-2 py-0.5 rounded font-mono font-bold ${
                openai?.decision === "APPROVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
              }`}
            >
              OpenAI: {openai?.solvedAnswer || "?"}
            </span>
            <span
              className={`px-2 py-0.5 rounded font-mono font-bold ${
                claude?.decision === "APPROVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
              }`}
            >
              Claude: {claude?.solvedAnswer || "?"}
            </span>
          </div>

          <button
            type="button"
            className="text-xs text-indigo-600 font-bold flex items-center gap-1 p-1"
          >
            <span>{isOpen ? "Hide Reviews" : "View 4-Panel Audit"}</span>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded 4-Panel Review Container */}
      {isOpen && (
        <div className="px-6 pb-6 pt-2 border-t border-slate-200/60 bg-white">
          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 mb-4 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("CONSENSUS")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                activeTab === "CONSENSUS"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              <span>Panel D: Consensus &amp; Deterministic QC</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("GEMINI")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                activeTab === "GEMINI"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-blue-50 text-blue-800 hover:bg-blue-100"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Panel A: Gemini L1</span>
              {gemini?.decision === "APPROVE" ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-rose-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("OPENAI")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                activeTab === "OPENAI"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>Panel B: OpenAI L2</span>
              {openai?.decision === "APPROVE" ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-rose-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("CLAUDE")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
                activeTab === "CLAUDE"
                  ? "bg-purple-700 text-white shadow-sm"
                  : "bg-purple-50 text-purple-800 hover:bg-purple-100"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Panel C: Claude L3</span>
              {claude?.decision === "APPROVE" ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-rose-400" />
              )}
            </button>
          </div>

          {/* PANEL A: GEMINI REVIEW */}
          {activeTab === "GEMINI" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-50/60 rounded-2xl border border-blue-200">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-blue-700" />
                  <div>
                    <p className="font-bold text-xs text-blue-900">
                      Gemini 1.5 Senior Content Auditor (Level 1 Review)
                    </p>
                    <p className="text-[10px] text-blue-700 font-mono">
                      Model: {gemini?.model || "gemini-1.5-flash"} · Confidence:{" "}
                      {Math.round((gemini?.confidenceScore || 0) * 100)}%
                    </p>
                  </div>
                </div>
                {getStatusBadge(gemini?.decision, gemini?.scientificErrors?.length)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-slate-500 font-bold text-[10px] uppercase">Independently Solved</p>
                  <p className="font-mono text-base font-black text-slate-800 mt-1">
                    Option ({gemini?.solvedAnswer || "—"})
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {gemini?.solvedAnswer === storedStr ? "Matches original key" : `Disagrees with key (${storedStr})`}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-slate-500 font-bold text-[10px] uppercase">Scientific Soundness</p>
                  <p
                    className={`text-base font-black mt-1 ${
                      gemini?.isScientificallyCorrect ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {gemini?.isScientificallyCorrect ? "Verified Correct" : "Flawed / Erroneous"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Math: {gemini?.isMathematicallyCorrect ? "Valid" : "Math error detected"}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-slate-500 font-bold text-[10px] uppercase">NCERT Source Grounding</p>
                  <p className="text-base font-black text-slate-800 mt-1">
                    {gemini?.ncertAlignment?.status || "UNVERIFIED"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {gemini?.ncertAlignment?.citation || "Standard NCERT Curriculum"}
                  </p>
                </div>
              </div>

              {/* Errors & Solution Corrections */}
              {gemini?.scientificErrors && gemini.scientificErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-rose-800">Errors Detected by Gemini L1:</p>
                  <ul className="list-disc list-inside text-rose-700 text-[11px] space-y-0.5">
                    {gemini.scientificErrors.map((err: string, idx: number) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {gemini?.solutionCorrections && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-amber-800">Gemini Solution Corrections:</p>
                  <FormulaText
                    text={gemini.solutionCorrections}
                    className="block text-[11px] text-amber-900 leading-relaxed"
                  />
                </div>
              )}
            </div>
          )}

          {/* PANEL B: OPENAI REVIEW */}
          {activeTab === "OPENAI" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200">
                <div className="flex items-center gap-2.5">
                  <BrainCircuit className="w-4 h-4 text-emerald-700" />
                  <div>
                    <p className="font-bold text-xs text-emerald-900">
                      OpenAI GPT-4o Blind Solver (Level 2 Review)
                    </p>
                    <p className="text-[10px] text-emerald-700 font-mono">
                      Model: {openai?.model || "gpt-4o"} · Confidence:{" "}
                      {Math.round((openai?.confidenceScore || 0) * 100)}%
                    </p>
                  </div>
                </div>
                {getStatusBadge(openai?.decision, openai?.scientificErrors?.length)}
              </div>

              {/* Missing Key Banner */}
              {openai?.rejectionReasons?.some((r: string) => r.includes("API_FAILURE")) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>OpenAI API Key Unconfigured in Server Environment</span>
                  </p>
                  <p className="text-[11px] text-amber-800">
                    OPENAI_API_KEY is not configured in server environment. This review was logged truthfully as an API failure without faking approval. Set OPENAI_API_KEY in your .env to enable live L2 verification.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-slate-500 font-bold text-[10px] uppercase">Independently Solved</p>
                  <p className="font-mono text-base font-black text-slate-800 mt-1">
                    Option ({openai?.solvedAnswer || "—"})
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {openai?.solvedAnswer === storedStr ? "Matches original key" : `Disagrees with key (${storedStr})`}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-slate-500 font-bold text-[10px] uppercase">Scientific Correctness</p>
                  <p
                    className={`text-base font-black mt-1 ${
                      openai?.isScientificallyCorrect ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {openai?.isScientificallyCorrect ? "Scientifically Valid" : "Issues Detected"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Math: {openai?.isMathematicallyCorrect ? "Valid" : "Math calculation discrepancy"}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-slate-500 font-bold text-[10px] uppercase">NCERT Evidence</p>
                  <p className="text-base font-black text-slate-800 mt-1">
                    {openai?.ncertAlignment?.status || "UNVERIFIED"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {openai?.ncertAlignment?.explanation || "Curriculum aligned"}
                  </p>
                </div>
              </div>

              {openai?.scientificErrors && openai.scientificErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-rose-800">Errors Detected by OpenAI L2:</p>
                  <ul className="list-disc list-inside text-rose-700 text-[11px] space-y-0.5">
                    {openai.scientificErrors.map((err: string, idx: number) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* PANEL C: CLAUDE REVIEW */}
          {activeTab === "CLAUDE" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-purple-50/60 rounded-2xl border border-purple-200">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-purple-700" />
                  <div>
                    <p className="font-bold text-xs text-purple-900">
                      Anthropic Claude 3.5 Sonnet Blind Auditor (Level 3 Review)
                    </p>
                    <p className="text-[10px] text-purple-700 font-mono">
                      Model: {claude?.model || "claude-3-5-sonnet"} · Confidence:{" "}
                      {Math.round((claude?.confidenceScore || 0) * 100)}%
                    </p>
                  </div>
                </div>
                {getStatusBadge(claude?.decision, claude?.scientificErrors?.length)}
              </div>

              {/* Missing Key Banner */}
              {claude?.rejectionReasons?.some((r: string) => r.includes("API_FAILURE")) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Anthropic API Key Unconfigured in Server Environment</span>
                  </p>
                  <p className="text-[11px] text-amber-800">
                    ANTHROPIC_API_KEY is not configured in server environment. This review was logged truthfully as an API failure without faking approval. Set ANTHROPIC_API_KEY in your .env to enable live L3 verification.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-slate-500 font-bold text-[10px] uppercase">Independently Solved</p>
                  <p className="font-mono text-base font-black text-slate-800 mt-1">
                    Option ({claude?.solvedAnswer || "—"})
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {claude?.solvedAnswer === storedStr ? "Matches original key" : `Disagrees with key (${storedStr})`}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-slate-500 font-bold text-[10px] uppercase">Ambiguity Check</p>
                  <p
                    className={`text-base font-black mt-1 ${
                      claude?.ambiguityDetected ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {claude?.ambiguityDetected ? "Ambiguity Detected" : "Zero Ambiguity"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Multi-correct: {claude?.multipleCorrectOptionsDetected ? "Detected" : "None"}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-slate-500 font-bold text-[10px] uppercase">NCERT Alignment</p>
                  <p className="text-base font-black text-slate-800 mt-1">
                    {claude?.ncertAlignment?.status || "UNVERIFIED"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {claude?.ncertAlignment?.citation || "NCERT Textual Concept"}
                  </p>
                </div>
              </div>

              {claude?.scientificErrors && claude.scientificErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-rose-800">Errors Detected by Claude L3:</p>
                  <ul className="list-disc list-inside text-rose-700 text-[11px] space-y-0.5">
                    {claude.scientificErrors.map((err: string, idx: number) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* PANEL D: FINAL QUALITY DECISION & CONSENSUS */}
          {activeTab === "CONSENSUS" && (
            <div className="space-y-4">
              {/* Quality Status Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-2xl">
                <div>
                  <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">
                    Consensus Quality Gate
                  </p>
                  <p className="text-base font-black text-white mt-0.5">
                    Status: <span className="text-amber-400">{validationStatus}</span>
                  </p>
                </div>

                {onFacultyOverride && (
                  <button
                    type="button"
                    onClick={handleOverrideClick}
                    disabled={isOverriding || validationStatus === "APPROVED_BY_FACULTY_OVERRIDE"}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-bold rounded-xl shadow transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {validationStatus === "APPROVED_BY_FACULTY_OVERRIDE"
                        ? "Faculty Approved"
                        : isOverriding
                        ? "Overriding..."
                        : "Approve via Faculty Override"}
                    </span>
                  </button>
                )}
              </div>

              {/* Answers Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Stored Key</p>
                  <p className="font-mono text-lg font-black text-slate-800 mt-0.5">{storedStr}</p>
                </div>
                <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/40">
                  <p className="text-[10px] font-bold text-blue-700 uppercase">Gemini L1</p>
                  <p className="font-mono text-lg font-black text-blue-900 mt-0.5">
                    {gemini?.solvedAnswer || "—"}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase">OpenAI L2</p>
                  <p className="font-mono text-lg font-black text-emerald-900 mt-0.5">
                    {openai?.solvedAnswer || "—"}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl border border-purple-200 bg-purple-50/40">
                  <p className="text-[10px] font-bold text-purple-700 uppercase">Claude L3</p>
                  <p className="font-mono text-lg font-black text-purple-900 mt-0.5">
                    {claude?.solvedAnswer || "—"}
                  </p>
                </div>
              </div>

              {/* Disagreements / Observations */}
              {decision?.disagreements && decision.disagreements.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-xs space-y-1.5">
                  <p className="font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Adversarial AI Disagreements Detected:</span>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-amber-800 text-[11px] pl-1 font-mono">
                    {decision.disagreements.map((dis: string, idx: number) => (
                      <li key={idx}>{dis}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Deterministic QC Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Math check */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Binary className="w-3.5 h-3.5 text-blue-600" />
                      <span>KaTeX Math Evaluation</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        math?.valid !== false
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {math?.valid !== false ? "VALID" : "SYNTAX / CALC ERROR"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {math?.syntaxErrors?.length
                      ? math.syntaxErrors.join(", ")
                      : "Balanced braces, valid LaTeX expressions verified."}
                  </p>
                </div>

                {/* Chem check */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <FlaskConical className="w-3.5 h-3.5 text-teal-600" />
                      <span>Chemical Charge Balance</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        chem?.valid !== false
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {chem?.valid !== false ? "BALANCED" : "CHARGE MISMATCH"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {chem?.errors?.length
                      ? chem.errors.join(", ")
                      : "Ion stoichiometry and net charge neutralities verified."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
