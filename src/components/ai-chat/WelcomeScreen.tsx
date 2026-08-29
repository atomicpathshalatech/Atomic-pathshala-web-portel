"use client";

import { BookOpen, Calculator, FlaskConical, Languages } from "lucide-react";
import Image from "next/image";

const SUGGESTIONS = [
  {
    icon: Calculator,
    text: "Solve: If x^2 + 5x + 6 = 0, find the values of x",
    lang: "english" as const,
  },
  {
    icon: FlaskConical,
    text: "प्रकाश संश्लेषण क्या है? सरल भाषा में समझाइए",
    lang: "hindi" as const,
  },
  {
    icon: BookOpen,
    text: "Explain Newton's Third Law with a real-life example",
    lang: "english" as const,
  },
  {
    icon: Languages,
    text: "H2SO4 ka chemical name aur uses batao",
    lang: "hinglish" as const,
  },
];

interface WelcomeScreenProps {
  onSuggestionClick: (text: string) => void;
}

export function WelcomeScreen({ onSuggestionClick }: WelcomeScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="mb-6">
        <Image
          src="/atomic-logo.png"
          alt="Atomic Pathshala"
          width={90}
          height={90}
          className="rounded-2xl shadow-lg"
          priority
        />
      </div>

      <h1 className="mb-2 text-center text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
        Atomic Guru
      </h1>
      <p className="mb-1 text-center font-medium text-atomic-orange">
        by Atomic Pathshala
      </p>
      <p className="mb-8 max-w-md text-center text-sm text-slate-500 dark:text-slate-400">
        Ask any academic doubt in English, Hindi, or Hinglish. Paste screenshots,
        upload notes, drop PDFs, or use your camera on mobile.
      </p>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.text}
            onClick={() => onSuggestionClick(suggestion.text)}
            className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm transition-all hover:border-atomic-orange/50 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-atomic-orange/50"
          >
            <suggestion.icon className="mt-0.5 h-5 w-5 shrink-0 text-atomic-orange" />
            <span className="text-slate-700 dark:text-slate-200">
              {suggestion.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
