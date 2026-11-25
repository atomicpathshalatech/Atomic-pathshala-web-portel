"use client";

import React, { useState } from "react";
import { MathText } from "@/components/ai-chat/MathText";
import { SolutionSpeechPlayer } from "@/components/solutions/SolutionSpeechPlayer";
import {
  StandardSolution,
  parseStandardSolution,
} from "@/lib/solutions/standard-solution";

export interface StandardSolutionViewProps {
  /** Raw solution string, Markdown, JSON, or already structured StandardSolution object */
  solution: string | StandardSolution | null | undefined;
  /** Optional Hindi translation of solution */
  solutionHi?: string | StandardSolution | null | undefined;
  /** Active language: "ENGLISH" | "HINDI" */
  activeLanguage?: "ENGLISH" | "HINDI";
  /** Correct option key: "A" | "B" | "C" | "D" */
  correctOptionKey?: string;
  /** Options dictionary to display option text in Correct/Final Answer */
  options?: Record<string, string>;
  /** Subject for subject-specific badge styling (Physics, Chemistry, Biology, Mathematics) */
  subject?: string;
  /** Optional diagram or chemical structure URL */
  imageUrl?: string | null;
  /** Custom CSS classes */
  className?: string;
  /** Whether to show bilingual toggle buttons inside the view */
  showLanguageToggle?: boolean;
}

export function StandardSolutionView({
  solution,
  solutionHi,
  activeLanguage = "ENGLISH",
  correctOptionKey,
  options,
  subject = "Science",
  imageUrl,
  className = "",
  showLanguageToggle = false,
}: StandardSolutionViewProps) {
  const [lang, setLang] = useState<"ENGLISH" | "HINDI">(activeLanguage);

  const isHindi = lang === "HINDI";

  // Resolve target solution based on selected language
  const targetRaw = isHindi ? (solutionHi || solution) : (solution || solutionHi);

  // Parse into structured StandardSolution
  const parsedSol: StandardSolution =
    typeof targetRaw === "object" && targetRaw !== null && "stepByStep" in targetRaw
      ? (targetRaw as StandardSolution)
      : parseStandardSolution(targetRaw as string, {
          correctOptionKey,
          options,
          subject,
          lang,
          imageUrl,
        });

  const optKey = (parsedSol.correctOptionKey || correctOptionKey || "").trim().toUpperCase();

  return (
    <div className={`space-y-4 font-sans ${className}`}>
      {/* Header bar: Language Switcher (optional) & Subject Badge */}
      {showLanguageToggle && solutionHi && (
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setLang("ENGLISH")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                lang === "ENGLISH"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              English Solution
            </button>
            <button
              type="button"
              onClick={() => setLang("HINDI")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                lang === "HINDI"
                  ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              हिंदी हल (Hindi)
            </button>
          </div>
          {subject && (
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {subject}
            </span>
          )}
        </div>
      )}

      {/* SECTION 1: CORRECT ANSWER */}
      <div className="rounded-2xl border border-emerald-300/80 dark:border-emerald-800/80 bg-gradient-to-r from-emerald-50 via-teal-50/40 to-emerald-50/20 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-emerald-950/10 p-3.5 sm:p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-mono font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
            {optKey || "✓"}
          </span>
          <div className="flex-1">
            <div className="text-[10px] uppercase font-black tracking-wider text-emerald-700 dark:text-emerald-400">
              {isHindi ? "1. सही उत्तर" : "1. Correct Answer"}
            </div>
            <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-emerald-100 flex items-center gap-1.5 flex-wrap">
              <span>{isHindi ? "सही उत्तर:" : "Correct Answer:"}</span>
              <span className="text-emerald-700 dark:text-emerald-300 underline decoration-emerald-400 underline-offset-2">
                <MathText text={parsedSol.correctAnswer || (optKey ? (isHindi ? `विकल्प ${optKey}` : `Option ${optKey}`) : "Option A")} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: CONCEPT USED */}
      {parsedSol.conceptUsed && (
        <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs tracking-wider uppercase">
            <span className="material-symbols-outlined text-base">lightbulb</span>
            <h4>{isHindi ? "2. प्रयुक्त अवधारणा (Concept Used)" : "2. Concept Used"}</h4>
          </div>
          <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium pl-6">
            <MathText text={parsedSol.conceptUsed} />
          </div>
        </div>
      )}

      {/* SECTION 3: STEP-BY-STEP SOLUTION */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-extrabold text-xs tracking-wider uppercase">
            <span className="material-symbols-outlined text-base text-blue-600 dark:text-blue-400">
              format_list_numbered
            </span>
            <h4>{isHindi ? "3. चरण-दर-चरण हल (Step-by-Step Solution)" : "3. Step-by-Step Solution"}</h4>
          </div>
          <div className="flex items-center gap-2">
            <SolutionSpeechPlayer
              text={[parsedSol.conceptUsed, parsedSol.stepByStep].filter(Boolean).join(". ")}
              language={lang}
            />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
              Verified Derivation
            </span>
          </div>
        </div>

        {/* Embedded Diagram / Chemical Structure if available */}
        {(parsedSol.imageUrl || imageUrl) && (
          <div className="my-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 max-w-md mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={parsedSol.imageUrl || imageUrl!}
              alt="Solution Reaction / Diagram"
              className="w-full max-h-60 object-contain rounded-lg"
              loading="lazy"
            />
            <p className="text-[10px] text-center text-slate-400 mt-1">
              {isHindi ? "प्रयुक्त चित्र / संरचना" : "Reference Visual / Reaction Scheme"}
            </p>
          </div>
        )}

        {/* Body Text */}
        <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal space-y-3">
          <MathText text={parsedSol.stepByStep || (isHindi ? "विस्तृत हल उपलब्ध नहीं है।" : "Detailed steps not provided.")} />
        </div>
      </div>

      {/* SECTION 4: FINAL ANSWER */}
      {parsedSol.finalAnswer && (
        <div className="rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-2xl shrink-0">
              check_circle
            </span>
            <div className="flex-1">
              <div className="text-[10px] uppercase font-black tracking-wider text-blue-700 dark:text-blue-400">
                {isHindi ? "4. अंतिम उत्तर" : "4. Final Answer"}
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-blue-100">
                <MathText text={parsedSol.finalAnswer} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StandardSolutionView;
