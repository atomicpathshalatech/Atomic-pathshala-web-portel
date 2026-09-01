"use client";

import { useState } from "react";
import Link from "next/link";
import { ScrollReveal } from "./ScrollReveal";

type Language = "english" | "hindi" | "hinglish";

const WELCOME_SUGGESTIONS = [
  {
    icon: "calculate",
    text: "Solve: If x^2 + 5x + 6 = 0, find the values of x",
    category: "Maths",
  },
  {
    icon: "science",
    text: "प्रकाश संश्लेषण क्या है? सरल भाषा में समझाइए",
    category: "Biology",
  },
  {
    icon: "menu_book",
    text: "Explain Newton's Third Law with a real-life example",
    category: "Physics",
  },
  {
    icon: "biotech",
    text: "H2SO4 ka chemical name, preparation aur uses batao",
    category: "Chemistry",
  },
  {
    icon: "person",
    text: "Who is the founder & Chemistry teacher at Atomic Pathshala?",
    category: "Faculty",
  },
  {
    icon: "groups",
    text: "List all expert faculty members at Atomic Pathshala",
    category: "Faculty",
  },
];

export function AtomicGuruLiveSection() {
  const [language, setLanguage] = useState<Language>("english");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "guru"; text: string }>>([
    {
      role: "guru",
      text: "👋 **Welcome to Atomic Guru!**\n\nI am your 24/7 AI mentor for NEET, JEE, and Board exams (Physics, Chemistry, Biology & Mathematics). Ask any question in **English**, **हिंदी**, or **Hinglish** — no login required!",
    },
  ]);
  const [loading, setLoading] = useState(false);

  async function handleSend(questionText?: string) {
    const textToSend = (questionText || query).trim();
    if (!textToSend || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: textToSend }]);
    setQuery("");
    setLoading(true);

    try {
      const res = await fetch("/api/atomic-guru/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, language }),
      });
      const data = await res.json();

      if (data.reply) {
        setMessages((prev) => [...prev, { role: "guru", text: data.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "guru", text: "I couldn't process that query right now. Please try again!" },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "guru", text: "Network connection error. Please check your internet and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="atomic-guru" className="py-stack-lg bg-surface px-margin-mobile md:px-margin-desktop">
      <ScrollReveal className="max-w-container-max mx-auto space-y-8">
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-wider shadow-sm">
            <span className="material-symbols-outlined text-sm">psychology</span>
            Atomic Guru &middot; AI Doubt Solver
          </div>
          <h2 className="font-display-lg text-display-lg text-on-surface">
            Ask <span className="text-primary">Atomic Guru</span> Live (Free &middot; No Login)
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Official 24/7 AI mentor for Atomic Pathshala. Ask doubts, NCERT concepts, formulas, and faculty info in your preferred language.
          </p>
        </div>

        {/* Live Chat Box Container */}
        <div className="max-w-4xl mx-auto glass-card rounded-3xl border-2 border-purple-200/70 dark:border-purple-900/50 shadow-2xl overflow-hidden bg-gradient-to-br from-purple-50/15 via-surface to-surface flex flex-col h-[600px]">
          {/* Top Bar with Language Selector */}
          <div className="px-6 py-3.5 bg-purple-500/10 border-b border-purple-200/40 dark:border-purple-900/30 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-2xl">psychology</span>
              </div>
              <div>
                <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
                  Atomic Guru AI
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </h3>
                <p className="text-[11px] text-on-surface-variant">by Atomic Pathshala &middot; 24/7 Live</p>
              </div>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-1.5 bg-surface-container-lowest p-1 rounded-xl border border-outline-variant/30 text-xs">
              <button
                type="button"
                onClick={() => setLanguage("english")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  language === "english"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage("hindi")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  language === "hindi"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                हिंदी
              </button>
              <button
                type="button"
                onClick={() => setLanguage("hinglish")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  language === "hinglish"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Hinglish
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "guru" && (
                  <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-sm">
                    <span className="material-symbols-outlined text-base">smart_toy</span>
                  </div>
                )}
                <div
                  className={`p-4 rounded-2xl text-xs md:text-sm max-w-[88%] leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-on-primary rounded-tr-none shadow-md"
                      : "bg-surface-container-lowest border border-outline-variant/30 text-on-surface rounded-tl-none shadow-sm space-y-2 whitespace-pre-wrap font-sans"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-base">smart_toy</span>
                </div>
                <div className="bg-surface-container-lowest p-3 rounded-2xl border border-outline-variant/30 flex items-center gap-2 shadow-sm">
                  <span className="material-symbols-outlined text-purple-600 animate-spin text-sm">
                    progress_activity
                  </span>
                  <span className="font-semibold text-purple-700 dark:text-purple-300">
                    Atomic Guru is analyzing with NCERT knowledge...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Prompt Suggestions Grid & Input */}
          <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/20 space-y-3">
            {/* Quick Suggestion Chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {WELCOME_SUGGESTIONS.map((sq) => (
                <button
                  key={sq.text}
                  type="button"
                  onClick={() => handleSend(sq.text)}
                  className="px-3.5 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-all shrink-0 border border-purple-200/50 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-xs">{sq.icon}</span>
                  <span className="truncate max-w-[200px]">{sq.text}</span>
                </button>
              ))}
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask any question in English, हिंदी, or Hinglish (e.g. Firoz Sir, Photosynthesis, Newton's law)..."
                className="flex-1 px-4 py-3 rounded-2xl border border-outline-variant/40 bg-surface text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-6 py-3 bg-purple-600 text-white rounded-2xl font-semibold text-xs hover:bg-purple-700 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0 shadow-md"
              >
                <span>Ask Guru</span>
                <span className="material-symbols-outlined text-sm">send</span>
              </button>
            </form>

            <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1">
              <span>Free instant access &middot; Powered by Atomic Pathshala Knowledge Engine</span>
              <Link href="/register" className="text-purple-600 dark:text-purple-400 font-bold hover:underline">
                Explore Full Batch Programs &rarr;
              </Link>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
