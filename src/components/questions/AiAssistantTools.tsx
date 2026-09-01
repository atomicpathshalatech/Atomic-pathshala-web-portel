"use client";

import React, { useState } from "react";
import { AiMetadataSuggestion } from "@/lib/questions/ai-service";

interface AiAssistantToolsProps {
  statementEn: string;
  statementHi: string;
  optionsEn: Record<string, string>;
  optionsHi: Record<string, string>;
  correctAnswer: string[];
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
  onApplyExtraction,
  onApplyTranslation,
  onApplySolution,
  onApplyMetadata,
}: AiAssistantToolsProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [suggestedMeta, setSuggestedMeta] = useState<AiMetadataSuggestion | null>(null);
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; message: string } | null>(null);
  const [rawExtractText, setRawExtractText] = useState("");
  const [showExtractModal, setShowExtractModal] = useState(false);

  // 1. OCR / Text Extraction
  const handleExtract = async () => {
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

  // 2. AI Translation
  const handleTranslate = async (toLang: "HINDI" | "ENGLISH") => {
    const textToTranslate = toLang === "HINDI" ? statementEn : statementHi;
    if (!textToTranslate?.trim()) return;
    setLoadingAction(`translate_${toLang}`);
    try {
      const res = await fetch("/api/team/questions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "translate",
          payload: {
            text: textToTranslate,
            sourceLanguage: toLang === "HINDI" ? "ENGLISH" : "HINDI",
          },
        }),
      });
      const json = await res.json();
      if (json.success && json.data.translation) {
        onApplyTranslation(json.data.translation, toLang);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  // 3. AI Solution Generation
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
            correctAnswer: correctAnswer[0] || "A",
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

  // 4. AI Metadata Classification
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
    <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/20 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-400 text-lg">psychology</span>
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            AI Assistant & Co-Pilot
          </h4>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
          Active
        </span>
      </div>

      {/* Quick AI Buttons Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <button
          type="button"
          onClick={() => setShowExtractModal(true)}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex flex-col items-center gap-1 border border-slate-700 transition"
        >
          <span className="material-symbols-outlined text-base text-amber-400">document_scanner</span>
          <span>OCR / Paste Extract</span>
        </button>

        <button
          type="button"
          onClick={() => handleTranslate(statementEn ? "HINDI" : "ENGLISH")}
          disabled={loadingAction?.startsWith("translate")}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex flex-col items-center gap-1 border border-slate-700 transition"
        >
          <span className="material-symbols-outlined text-base text-indigo-400">translate</span>
          <span>
            {loadingAction?.startsWith("translate") ? "Translating..." : "Auto Translate"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleGenerateSolution}
          disabled={loadingAction === "solution"}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex flex-col items-center gap-1 border border-slate-700 transition"
        >
          <span className="material-symbols-outlined text-base text-emerald-400">auto_awesome</span>
          <span>
            {loadingAction === "solution" ? "Generating..." : "Generate Solution"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleSuggestMetadata}
          disabled={loadingAction === "metadata"}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex flex-col items-center gap-1 border border-slate-700 transition"
        >
          <span className="material-symbols-outlined text-base text-rose-400">category</span>
          <span>
            {loadingAction === "metadata" ? "Analyzing..." : "Auto Taxonomy"}
          </span>
        </button>
      </div>

      {/* AI Metadata Suggestion Box with Confidence */}
      {suggestedMeta && (
        <div className="p-3.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-300 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">auto_fix_high</span>
              AI Suggested Classification
            </span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
              {suggestedMeta.confidence}% Confidence
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-slate-200">
            <div>
              <span className="text-slate-400 block text-[10px]">Subject</span>
              <span className="font-semibold">{suggestedMeta.subject}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Chapter ({suggestedMeta.chapterConfidence}%)</span>
              <span className="font-semibold line-clamp-1">{suggestedMeta.chapter}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Topic ({suggestedMeta.topicConfidence}%)</span>
              <span className="font-semibold line-clamp-1">{suggestedMeta.topic}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Difficulty ({suggestedMeta.difficultyConfidence}%)</span>
              <span className="font-semibold">{suggestedMeta.difficulty}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-900/60">
            <button
              type="button"
              onClick={() => setSuggestedMeta(null)}
              className="px-3 py-1 rounded-lg text-slate-400 hover:text-white text-[11px]"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => {
                onApplyMetadata(suggestedMeta);
                setSuggestedMeta(null);
              }}
              className="px-3.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] shadow"
            >
              Accept All
            </button>
          </div>
        </div>
      )}

      {/* Extract Modal */}
      {showExtractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400">document_scanner</span>
                Paste Question / OCR Raw Text
              </h4>
              <button
                type="button"
                onClick={() => setShowExtractModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Paste raw text with options (A, B, C, D) and answer/solution. AI will automatically structure it into bilingual fields.
            </p>

            <textarea
              rows={6}
              placeholder="e.g. Which of the following is correct for Bohr's model?\n(A) Angular momentum is quantized\n(B) Energy increases continuously\n(C) ...\nAnswer: (A)"
              value={rawExtractText}
              onChange={(e) => setRawExtractText(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl text-xs text-white focus:border-amber-500 font-mono leading-relaxed"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowExtractModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExtract}
                disabled={loadingAction === "extract"}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow transition"
              >
                {loadingAction === "extract" ? "Extracting..." : "Extract & Structure"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}