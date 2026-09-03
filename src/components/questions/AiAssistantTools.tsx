"use client";

import React, { useState, useRef } from "react";
import { AiMetadataSuggestion, TranslationVerificationResult } from "@/lib/questions/ai-service";

interface AiAssistantToolsProps {
  statementEn: string;
  statementHi: string;
  optionsEn: Record<string, string>;
  optionsHi: Record<string, string>;
  correctAnswer: string[];
  questionId?: string;
  onApplyExtraction: (extracted: any) => void;
  onApplyTranslation: (translatedText: string, targetLang: "ENGLISH" | "HINDI") => void;
  onApplySolution: (solution: any) => void;
  onApplyMetadata: (metadata: AiMetadataSuggestion) => void;
}

export function AiAssistantTools({
  statementEn,
  statementHi,
  optionsEn,
  optionsHi,
  correctAnswer,
  questionId,
  onApplyExtraction,
  onApplyTranslation,
  onApplySolution,
  onApplyMetadata,
}: AiAssistantToolsProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [suggestedMeta, setSuggestedMeta] = useState<AiMetadataSuggestion | null>(null);
  const [verificationReport, setVerificationReport] = useState<TranslationVerificationResult | null>(null);
  const [rawExtractText, setRawExtractText] = useState("");
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [ocrImagePreview, setOcrImagePreview] = useState<string | null>(null);
  const [ocrImageFile, setOcrImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. OCR / Text Extraction
  const handleExtract = async () => {
    if (ocrImagePreview) {
      setLoadingAction("ocr_image");
      try {
        const res = await fetch("/api/team/questions/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "ocr_image",
            payload: {
              imageBase64: ocrImagePreview,
              mimeType: ocrImageFile?.type || "image/png",
            },
          }),
        });
        const json = await res.json();
        if (json.success && json.data.result) {
          onApplyExtraction(json.data.result);
          setShowExtractModal(false);
          setOcrImagePreview(null);
          setOcrImageFile(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingAction(null);
      }
      return;
    }

    if (!rawExtractText.trim()) return;
    setLoadingAction("extract");
    try {
      const res = await fetch("/api/team/questions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract",
          payload: { rawText: rawExtractText },
        }),
      });
      const json = await res.json();
      if (json.success && json.data.result) {
        onApplyExtraction(json.data.result);
        setShowExtractModal(false);
        setRawExtractText("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setOcrImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 2. Translation (English -> Hindi or Hindi -> English)
  const handleTranslate = async (targetLang: "ENGLISH" | "HINDI") => {
    const textToTranslate = targetLang === "HINDI" ? statementEn : statementHi;
    if (!textToTranslate.trim()) return;

    setLoadingAction(`translate_${targetLang}`);
    try {
      const res = await fetch("/api/team/questions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "translate",
          payload: {
            text: textToTranslate,
            targetLang,
            type: "STATEMENT",
          },
        }),
      });
      const json = await res.json();
      if (json.success && json.data.translated) {
        onApplyTranslation(json.data.translated, targetLang);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  // 3. Translation Verification
  const handleVerifyTranslation = async () => {
    if (!statementEn.trim() || !statementHi.trim()) return;
    setLoadingAction("verify_translation");
    try {
      const res = await fetch("/api/team/questions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_translation",
          payload: {
            statementEn,
            statementHi,
            optionsEn,
            optionsHi,
          },
        }),
      });
      const json = await res.json();
      if (json.success && json.data.verification) {
        setVerificationReport(json.data.verification);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  // 4. AI Detailed Solution Generation
  const handleGenerateSolution = async () => {
    const activeStatement = statementEn || statementHi;
    if (!activeStatement?.trim()) return;
    setLoadingAction("solution");
    try {
      const res = await fetch("/api/team/questions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "solution",
          payload: {
            statement: activeStatement,
            options: optionsEn,
            correctAnswer,
          },
        }),
      });
      const json = await res.json();
      if (json.success && json.data.solution) {
        onApplySolution(json.data.solution);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  // 5. AI Metadata Classification
  const handleSuggestMetadata = async () => {
    const activeStatement = statementEn || statementHi;
    if (!activeStatement?.trim()) return;
    setLoadingAction("metadata");
    try {
      const res = await fetch("/api/team/questions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "metadata",
          payload: {
            statement: activeStatement,
            options: optionsEn,
          },
        }),
      });
      const json = await res.json();
      if (json.success && json.data.metadata) {
        setSuggestedMeta(json.data.metadata);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-base">psychology</span>
          </div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            AI Assistant &amp; OCR Co-Pilot
          </h4>
        </div>
        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-bold">
          Gemini Multimodal
        </span>
      </div>

      {/* Quick AI Buttons Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
        <button
          type="button"
          onClick={() => setShowExtractModal(true)}
          className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold flex flex-col items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition shadow-sm"
        >
          <span className="material-symbols-outlined text-lg text-amber-500">document_scanner</span>
          <span>OCR / Extract</span>
        </button>

        <button
          type="button"
          onClick={() => handleTranslate(statementEn ? "HINDI" : "ENGLISH")}
          disabled={Boolean(loadingAction?.startsWith("translate"))}
          className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold flex flex-col items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition shadow-sm disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg text-indigo-500">translate</span>
          <span>
            {loadingAction?.startsWith("translate") ? "Translating..." : "Auto Translate"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleVerifyTranslation}
          disabled={!statementEn || !statementHi || loadingAction === "verify_translation"}
          className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold flex flex-col items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition shadow-sm disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-lg text-cyan-600">verified</span>
          <span>
            {loadingAction === "verify_translation" ? "Checking..." : "Verify Hindi"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleGenerateSolution}
          disabled={loadingAction === "solution"}
          className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold flex flex-col items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition shadow-sm"
        >
          <span className="material-symbols-outlined text-lg text-emerald-600">auto_awesome</span>
          <span>
            {loadingAction === "solution" ? "Generating..." : "AI Solution"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleSuggestMetadata}
          disabled={loadingAction === "metadata"}
          className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold flex flex-col items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition shadow-sm"
        >
          <span className="material-symbols-outlined text-lg text-rose-500">category</span>
          <span>
            {loadingAction === "metadata" ? "Analyzing..." : "Auto Taxonomy"}
          </span>
        </button>
      </div>

      {/* Translation Verification Report */}
      {verificationReport && (
        <div className="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-cyan-900 dark:text-cyan-300 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              Bilingual Translation Audit
            </span>
            <span
              className={`font-mono text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                verificationReport.isConsistent
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
              }`}
            >
              Score: {verificationReport.semanticScore}/100
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-700 dark:text-slate-300 pt-1">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-emerald-600 dark:text-emerald-400">
                {verificationReport.numericalMatch ? "check_circle" : "cancel"}
              </span>
              <span>Numbers Match</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-emerald-600 dark:text-emerald-400">
                {verificationReport.formulasPreserved ? "check_circle" : "cancel"}
              </span>
              <span>Formulas Preserved</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-emerald-600 dark:text-emerald-400">
                {verificationReport.terminologyCorrect ? "check_circle" : "cancel"}
              </span>
              <span>NCERT Terms</span>
            </div>
          </div>

          {verificationReport.warnings.length > 0 && (
            <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800">
              {verificationReport.warnings.map((w, i) => (
                <div key={i}>• {w}</div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setVerificationReport(null)}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* AI Metadata Suggestion Box with Confidence */}
      {suggestedMeta && (
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">auto_fix_high</span>
              AI Suggested Classification
            </span>
            <span className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold">
              {suggestedMeta.confidence}% Confidence
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-[11px] pt-1 text-slate-800 dark:text-slate-200">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">Subject</span>
              <span className="font-bold">{suggestedMeta.subject}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">Chapter ({suggestedMeta.chapterConfidence}%)</span>
              <span className="font-bold line-clamp-1">{suggestedMeta.chapter}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">Topic ({suggestedMeta.topicConfidence}%)</span>
              <span className="font-bold line-clamp-1">{suggestedMeta.topic}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">Difficulty ({suggestedMeta.difficultyConfidence}%)</span>
              <span className="font-bold">{suggestedMeta.difficulty}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-200 dark:border-indigo-800">
            <button
              type="button"
              onClick={() => setSuggestedMeta(null)}
              className="px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white text-[11px] font-bold"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => {
                onApplyMetadata(suggestedMeta);
                setSuggestedMeta(null);
              }}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] shadow-sm"
            >
              Accept All
            </button>
          </div>
        </div>
      )}

      {/* Extract Modal with Image OCR and Raw Text */}
      {showExtractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">document_scanner</span>
                Question OCR &amp; Ingestion Pipeline
              </h4>
              <button
                type="button"
                onClick={() => {
                  setShowExtractModal(false);
                  setOcrImagePreview(null);
                  setOcrImageFile(null);
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            {/* Image Upload Option */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-2xl p-5 text-center bg-slate-50 dark:bg-slate-800/50 cursor-pointer transition">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelected}
                className="hidden"
              />
              {ocrImagePreview ? (
                <div className="space-y-2">
                  <img
                    src={ocrImagePreview}
                    alt="OCR Target"
                    className="max-h-36 mx-auto rounded-xl border border-slate-200 dark:border-slate-700 object-contain shadow-sm"
                  />
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">Image Loaded</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOcrImagePreview(null);
                        setOcrImageFile(null);
                      }}
                      className="text-[10px] text-red-500 underline font-bold"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div onClick={() => fileInputRef.current?.click()} className="space-y-1">
                  <span className="material-symbols-outlined text-3xl text-blue-600">add_photo_alternate</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-white">Click or Drop Question Image</p>
                  <p className="text-[10px] text-slate-500">Upload screenshot, printed exam photo, or textbook crop</p>
                </div>
              )}
            </div>

            {!ocrImagePreview && (
              <>
                <div className="flex items-center gap-2 my-2">
                  <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                  <span className="text-[10px] uppercase font-bold text-slate-400">or paste text</span>
                  <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                </div>

                <textarea
                  rows={4}
                  placeholder="Paste question text with options A, B, C, D and answer..."
                  value={rawExtractText}
                  onChange={(e) => setRawExtractText(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:bg-white outline-none font-mono leading-relaxed"
                />
              </>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowExtractModal(false);
                  setOcrImagePreview(null);
                  setOcrImageFile(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExtract}
                disabled={Boolean(loadingAction) || (!ocrImagePreview && !rawExtractText.trim())}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition disabled:opacity-50"
              >
                {loadingAction ? "Processing with AI..." : "Run AI Extraction"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}