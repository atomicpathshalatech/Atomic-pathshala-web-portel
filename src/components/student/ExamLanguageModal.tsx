"use client";

import React from "react";

interface ExamLanguageModalProps {
  onSelectLanguage: (lang: "en" | "hi") => void;
}

export function ExamLanguageModal({ onSelectLanguage }: ExamLanguageModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-10 max-w-lg w-full text-center shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Choose Your Default Language
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
            अपनी डिफ़ॉल्ट भाषा चुनें। आप परीक्षा के दौरान किसी भी प्रश्न की भाषा अलग से बदल सकते हैं।
          </p>
          <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 leading-normal">
            You can still switch language for individual questions during the exam.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={() => onSelectLanguage("en")}
            className="w-full py-3.5 px-6 rounded-2xl border-2 border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-black text-sm transition shadow-sm hover:shadow active:scale-[0.99]"
          >
            English
          </button>

          <button
            type="button"
            onClick={() => onSelectLanguage("hi")}
            className="w-full py-3.5 px-6 rounded-2xl border-2 border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-black text-sm transition shadow-sm hover:shadow active:scale-[0.99]"
          >
            हिंदी (Hindi)
          </button>
        </div>
      </div>
    </div>
  );
}
