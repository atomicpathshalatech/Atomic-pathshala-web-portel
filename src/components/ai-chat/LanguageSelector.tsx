"use client";

import type { Language } from "@/types/ai-chat";

const LANGUAGES: { value: Language; label: string; shortLabel: string }[] = [
  { value: "english", label: "English", shortLabel: "Eng" },
  { value: "hindi", label: "हिंदी", shortLabel: "हिं" },
  { value: "hinglish", label: "Hinglish", shortLabel: "Mix" },
];

interface LanguageSelectorProps {
  value: Language;
  onChange: (lang: Language) => void;
  disabled?: boolean;
}

export function LanguageSelector({
  value,
  onChange,
  disabled,
}: LanguageSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.value}
          onClick={() => onChange(lang.value)}
          disabled={disabled}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all sm:px-3 sm:text-sm ${
            value === lang.value
              ? "bg-atomic-orange text-white shadow-sm"
              : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          } disabled:opacity-50`}
        >
          <span className="hidden sm:inline">{lang.label}</span>
          <span className="sm:hidden">{lang.shortLabel}</span>
        </button>
      ))}
    </div>
  );
}
