"use client";

import { useState } from "react";
import Link from "next/link";
import { FormulaText } from "@/components/test-portal/FormulaText";

export interface TranslationItem {
  language: string; // "ENGLISH" | "HINDI" | ...
  statement: string;
  options: any;
  correctOptionIds?: any;
  solution?: string | null;
}

export interface InteractiveQuestionQuizProps {
  questionId: string;
  slug?: string | null;
  questionCode?: string | null;
  examName?: string | null;
  pyqYear?: number | null;
  session?: string | null;
  shift?: string | null;
  questionNumber?: string | null;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  statement?: string;
  imageUrl?: string | null;
  options?: Record<string, string>;
  correctOptionIds?: string[];
  solution?: string | null;
  translations?: TranslationItem[];
  isAuthorized?: boolean;
  currentUrl?: string;
  compact?: boolean;
  initialLanguage?: "ENGLISH" | "HINDI";
}

export function InteractiveQuestionQuiz({
  questionId,
  slug,
  questionCode,
  examName,
  pyqYear,
  session,
  shift,
  questionNumber,
  subject,
  chapter,
  topic,
  statement = "",
  imageUrl,
  options = {},
  correctOptionIds = [],
  solution,
  translations = [],
  isAuthorized = false,
  currentUrl,
  compact = false,
  initialLanguage,
}: InteractiveQuestionQuizProps) {
  // Identify available translations
  const enTrans = translations.find((t) => t.language?.toUpperCase() === "ENGLISH");
  const hiTrans = translations.find(
    (t) => t.language?.toUpperCase() === "HINDI" || /[ऀ-ॿ]/.test(t.statement || "")
  );

  const hasHindi = Boolean(hiTrans || /[ऀ-ॿ]/.test(statement));
  const hasEnglish = Boolean(enTrans || (!/[ऀ-ॿ]/.test(statement) && statement.length > 0));
  const isBilingual = hasHindi && hasEnglish;

  // Determine starting language
  const defaultLang: "ENGLISH" | "HINDI" =
    initialLanguage ||
    (hasHindi && !hasEnglish
      ? "HINDI"
      : /[ऀ-ॿ]/.test(statement)
      ? "HINDI"
      : "ENGLISH");

  const [activeLang, setActiveLang] = useState<"ENGLISH" | "HINDI">(defaultLang);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Active translation resolution
  const activeTranslation =
    activeLang === "HINDI" ? hiTrans || enTrans : enTrans || hiTrans;

  const curStatement = activeTranslation?.statement || statement || "";
  const curOptions = ((activeTranslation?.options || options) || {}) as Record<string, string>;
  const curSolution = activeTranslation?.solution || solution;
  const rawCorrect = activeTranslation?.correctOptionIds || correctOptionIds || [];
  const cleanCorrect = (Array.isArray(rawCorrect) ? rawCorrect : []).map((k) =>
    String(k).trim().toUpperCase()
  );

  const hasAnswered = selectedOption !== null;
  const isSelectedCorrect = selectedOption ? cleanCorrect.includes(selectedOption) : false;

  const targetSlug = slug || questionId;
  const redirectUrl = currentUrl || `/pyq/question/${targetSlug}`;

  const handleSelect = (key: string) => {
    if (hasAnswered) return;
    setSelectedOption(key);
  };

  const handleReset = () => {
    setSelectedOption(null);
  };

  return (
    <div className={`space-y-5 ${compact ? "" : "max-w-4xl mx-auto"}`}>
      {/* Prominent Header with Exam, Subject, Chapter, Language Switcher and Question Code */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {examName && (
            <span className="inline-flex items-center gap-1 font-black text-xs text-blue-700 bg-blue-50 dark:bg-blue-950/70 dark:text-blue-300 px-3 py-1 rounded-xl border border-blue-200/60 dark:border-blue-900/40 shadow-xs">
              <span className="material-symbols-outlined text-sm">school</span>
              {examName} {pyqYear || ""} {session ? `(${session})` : ""} {shift ? `[${shift}]` : ""}
            </span>
          )}

          {subject && (
            <span className="font-extrabold text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-1 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40">
              {subject}
            </span>
          )}

          {chapter && (
            <span className="font-bold text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl">
              {chapter}
            </span>
          )}

          {questionNumber && (
            <span className="font-mono text-xs text-slate-500 font-semibold">
              Q.{questionNumber}
            </span>
          )}
        </div>

        {/* Right Header Actions: Bilingual Toggle & Code */}
        <div className="flex items-center gap-2">
          {/* Language Switcher Button (English | हिन्दी) */}
          {isBilingual && (
            <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200/80 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveLang("ENGLISH")}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                  activeLang === "ENGLISH"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="View in English"
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setActiveLang("HINDI")}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                  activeLang === "HINDI"
                    ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="हिन्दी में देखें"
              >
                हिन्दी
              </button>
            </div>
          )}

          {questionCode && (
            <span className="font-mono text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
              {questionCode}
            </span>
          )}

          {hasAnswered && (
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-0.5 transition"
              title="Try again"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Question Statement */}
      <div
        className={`${
          compact ? "text-sm" : "text-base sm:text-lg"
        } font-medium text-slate-900 dark:text-slate-100 leading-relaxed`}
      >
        <FormulaText text={curStatement || "(Question text not available)"} />
      </div>

      {/* Diagram / Image */}
      {imageUrl && (
        <div className="my-3 max-w-md rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white">
          <img src={imageUrl} alt="Question figure" className="w-full object-contain" />
        </div>
      )}

      {/* Interactive Options - Quiz Mode */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-blue-600">touch_app</span>
            {activeLang === "HINDI"
              ? "उत्तर जांचने के लिए किसी एक विकल्प पर क्लिक करें:"
              : "Select an Option to Check Your Answer:"}
          </span>

          {hasAnswered && (
            <span
              className={`text-xs font-black uppercase tracking-wider flex items-center gap-1 ${
                isSelectedCorrect ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {isSelectedCorrect ? "check_circle" : "cancel"}
              </span>
              {isSelectedCorrect
                ? activeLang === "HINDI"
                  ? "सही उत्तर (+4 अंक)"
                  : "Correct (+4 Marks)"
                : activeLang === "HINDI"
                ? "गलत उत्तर (-1 अंक)"
                : "Incorrect (-1 Mark)"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {["A", "B", "C", "D"].map((key) => {
            const optText = curOptions[key];
            if (!optText) return null;

            const isThisSelected = selectedOption === key;
            const isThisCorrect = cleanCorrect.includes(key);

            let buttonStyle =
              "border-slate-200 dark:border-slate-800 bg-slate-50/70 hover:bg-blue-50/50 hover:border-blue-300 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200";
            let badgeStyle = "bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

            if (hasAnswered) {
              if (isThisCorrect) {
                // Correct answer is always highlighted green once answered
                buttonStyle =
                  "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-bold shadow-xs";
                badgeStyle = "bg-emerald-600 text-white";
              } else if (isThisSelected && !isThisCorrect) {
                // Student picked wrong option
                buttonStyle =
                  "border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100 font-medium";
                badgeStyle = "bg-rose-600 text-white";
              } else {
                // Other options muted
                buttonStyle =
                  "border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-950/40 text-slate-400 dark:text-slate-600 opacity-60";
                badgeStyle = "bg-slate-100 dark:bg-slate-900 text-slate-400";
              }
            }

            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelect(key)}
                className={`w-full text-left flex items-start gap-3 p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer ${buttonStyle}`}
              >
                <span
                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-colors ${badgeStyle}`}
                >
                  {key}
                </span>

                <div className="flex-1 pt-0.5 text-xs sm:text-sm">
                  <FormulaText text={optText} />
                </div>

                {hasAnswered && isThisCorrect && (
                  <span className="shrink-0 text-xs font-black uppercase text-emerald-600 flex items-center gap-1 self-center bg-emerald-100/70 dark:bg-emerald-900/50 px-2.5 py-1 rounded-lg">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {activeLang === "HINDI" ? "सही विकल्प" : "Correct"}
                  </span>
                )}

                {hasAnswered && isThisSelected && !isThisCorrect && (
                  <span className="shrink-0 text-xs font-black uppercase text-rose-600 flex items-center gap-1 self-center bg-rose-100/70 dark:bg-rose-900/50 px-2.5 py-1 rounded-lg">
                    <span className="material-symbols-outlined text-sm">cancel</span>
                    {activeLang === "HINDI" ? "आपका उत्तर" : "Your Answer"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback Banner on Answering */}
      {hasAnswered && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 animate-in fade-in duration-200 flex-wrap ${
            isSelectedCorrect
              ? "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
              : "bg-rose-50/80 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800 text-rose-900 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl shrink-0">
              {isSelectedCorrect ? "emoji_events" : "info"}
            </span>
            <div className="text-xs sm:text-sm">
              <p className="font-extrabold">
                {isSelectedCorrect
                  ? activeLang === "HINDI"
                    ? "शानदार! आपका उत्तर बिल्कुल सही है।"
                    : "Brilliant! Your answer is correct."
                  : activeLang === "HINDI"
                  ? `गलत उत्तर। सही विकल्प है: (${cleanCorrect.join(", ")}).`
                  : `Incorrect. The correct answer is Option (${cleanCorrect.join(", ")}).`}
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                {isAuthorized
                  ? activeLang === "HINDI"
                    ? "नीचे चरण-दर-चरण विस्तृत हल देखें।"
                    : "Review the detailed step-by-step derivation below."
                  : activeLang === "HINDI"
                  ? "विस्तृत हल व सूत्र देखने के लिए नीचे अनलॉक करें।"
                  : "Unlock the complete step-by-step verified derivation below."}
              </p>
            </div>
          </div>

          {!isAuthorized && (
            <Link
              href={`/login?redirect=${encodeURIComponent(redirectUrl)}`}
              className="text-xs font-black bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">lock_open</span>
              {activeLang === "HINDI" ? "हल अनलॉक करें" : "Unlock Solution"}
            </Link>
          )}
        </div>
      )}

      {/* Solution Section */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
        {isAuthorized ? (
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-black text-sm">
                <span className="material-symbols-outlined">lightbulb</span>
                <h4>
                  {activeLang === "HINDI"
                    ? "विस्तृत चरण-दर-चरण सत्यापित हल"
                    : "Detailed Step-by-Step Verified Solution"}
                </h4>
              </div>
              <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded">
                Verified Expert Derivation
              </span>
            </div>
            <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed pt-1">
              <FormulaText
                text={
                  curSolution ||
                  (activeLang === "HINDI"
                    ? "इस प्रश्न का विस्तृत हल शीघ्र ही अपडेट किया जाएगा।"
                    : "Detailed step-by-step mathematical explanation has been verified for this PYQ.")
                }
              />
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border border-blue-200/70 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div className="space-y-1.5 max-w-xl">
                <div className="inline-flex items-center gap-1.5 text-xs font-black text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950/80 px-2.5 py-0.5 rounded-lg mb-1">
                  <span className="material-symbols-outlined text-sm">lock</span>
                  {activeLang === "HINDI" ? "विस्तृत हल लॉक है" : "Detailed Solution Locked"}
                </div>
                <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  {activeLang === "HINDI"
                    ? "चरण-दर-चरण व्याख्या एवं शॉर्टकट सूत्र अनलॉक करें"
                    : "Unlock Step-by-Step Derivation & Shortcut Formulas"}
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {activeLang === "HINDI"
                    ? "हस्तलिखित व्याख्या, आवश्यक सूत्र, मुख्य अवधारणाएं एवं शिक्षक टिप्स देखने के लिए साइन-इन करें।"
                    : "Sign in to view complete handwritten derivations, formula summaries, educator tips, and related practice questions."}
                </p>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 flex-wrap">
                <Link
                  href={`/login?redirect=${encodeURIComponent(redirectUrl)}`}
                  className="w-full sm:w-auto text-center font-black text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition shadow-sm hover:shadow flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">login</span>
                  {activeLang === "HINDI" ? "लॉगिन कर अनलॉक करें" : "Login to Unlock"}
                </Link>

                <Link
                  href={`/register?redirect=${encodeURIComponent(redirectUrl)}`}
                  className="w-full sm:w-auto text-center font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:text-blue-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl transition"
                >
                  {activeLang === "HINDI" ? "मुफ्त पंजीकरण" : "Register Free"}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
