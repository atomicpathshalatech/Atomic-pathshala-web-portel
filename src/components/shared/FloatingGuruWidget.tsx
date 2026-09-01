"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function FloatingGuruWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [isAnswering, setIsAnswering] = useState(false);
  const [responseMessage, setResponseMessage] = useState<string | null>(null);

  // Hide on full Guru chat page itself to avoid duplication
  const isGuruPage = pathname === "/guru" || pathname?.startsWith("/guru/") || pathname === "/live-studio" || pathname?.startsWith("/team/live-studio");

  // Show welcome speech bubble after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      // Keep bubble visible initially
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (isGuruPage) return null;

  const handleQuickAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim()) return;

    setIsAnswering(true);
    setResponseMessage(null);

    // Simulate instant AI answer / or route to guru
    setTimeout(() => {
      setIsAnswering(false);
      setResponseMessage(
        `Guru AI: "${userQuery}" ka detailed concept & formula samajhne ke liye Atomic Guru studio open karein.`
      );
    }, 1000);
  };

  return (
    <aside aria-label="Atomic Guru Assistant" className="fixed bottom-5 right-5 z-50 flex flex-col items-end pointer-events-auto">
      {/* 1. SPEECH BUBBLE (DISMISSABLE) */}
      {!bubbleDismissed && !isOpen && (
        <div className="mb-3 max-w-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-3.5 shadow-2xl animate-bounce-short relative group">
          <button
            type="button"
            onClick={() => setBubbleDismissed(true)}
            className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center text-[10px] shadow"
            title="Dismiss"
          >
            ✕
          </button>

          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-sm">psychology</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                Hi, I&apos;m Guru! 🤖
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                Ask any doubt in NEET, JEE &amp; Boards or solve problems instantly!
              </p>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setIsOpen(true);
                setBubbleDismissed(true);
              }}
              className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
            >
              <span>Ask Doubt</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </button>
            <Link
              href="/guru"
              className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
            >
              Open Studio
            </Link>
          </div>

          {/* Bubble Pointer Arrow */}
          <div className="absolute -bottom-2 right-6 w-3.5 h-3.5 bg-white dark:bg-slate-900 border-r border-b border-slate-200 dark:border-slate-800 rotate-45 transform" />
        </div>
      )}

      {/* 2. QUICK DOUBT DRAWER / MODAL */}
      {isOpen && (
        <div className="mb-3 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col z-50 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-sm">
                🤖
              </div>
              <div>
                <h3 className="font-bold text-xs tracking-wide">Atomic Guru</h3>
                <p className="text-[10px] text-white/80">24/7 AI Academic Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Link
                href="/guru"
                className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs"
                title="Open Fullscreen Studio"
              >
                <span className="material-symbols-outlined text-sm">open_in_new</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/40 rounded-2xl p-3 text-xs text-orange-900 dark:text-orange-200 space-y-1">
              <p className="font-bold text-[11px]">👋 Kaise help kar sakta hu?</p>
              <p className="text-[10px] text-orange-700 dark:text-orange-300">
                Physics numericals, Chemistry mechanisms, Biology concepts ya NCERT line doubt poochiye!
              </p>
            </div>

            {/* Quick Prompts */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Quick Prompts
              </span>
              {[
                "Calculate pH of 0.01M HCl solution",
                "Explain Newton's Third Law with example",
                "Differences between Mitosis and Meiosis",
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setUserQuery(q)}
                  className="w-full text-left p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 transition truncate"
                >
                  ✨ {q}
                </button>
              ))}
            </div>

            {/* Simulated Response */}
            {responseMessage && (
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-3 text-xs text-slate-800 dark:text-slate-200 space-y-2">
                <p className="leading-relaxed">{responseMessage}</p>
                <Link
                  href="/guru"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:underline"
                >
                  <span>Open in Atomic Guru</span>
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </Link>
              </div>
            )}
          </div>

          {/* Input Footer */}
          <form onSubmit={handleQuickAsk} className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-2.5 py-1.5 shadow-sm">
              <Link
                href="/guru"
                className="text-slate-400 hover:text-orange-600 p-1"
                title="Attach photo / PDF"
              >
                <span className="material-symbols-outlined text-base">add_photo_alternate</span>
              </Link>
              <input
                type="text"
                placeholder="Ask doubt in Hindi / English..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                className="flex-1 bg-transparent text-xs outline-none text-slate-900 dark:text-white placeholder-slate-400"
              />
              <button
                type="submit"
                disabled={!userQuery.trim() || isAnswering}
                className="w-7 h-7 rounded-xl bg-orange-600 text-white flex items-center justify-center hover:bg-orange-500 disabled:opacity-40 transition"
              >
                <span className="material-symbols-outlined text-xs">
                  {isAnswering ? "hourglass_top" : "send"}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. MAIN FLOATING GURU MASCOT BUTTON */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setBubbleDismissed(true);
        }}
        className="group relative flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white shadow-[0_8px_25px_rgba(249,115,22,0.45)] hover:shadow-[0_12px_32px_rgba(249,115,22,0.6)] hover:scale-105 active:scale-95 transition-all duration-300"
        title="Atomic Guru — 24/7 AI Doubt Assistant"
      >
        {/* Animated Mascot Head */}
        <div className="relative flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-white text-slate-900 flex items-center justify-center text-lg shadow-inner group-hover:rotate-12 transition-transform">
            🤖
          </div>
          {/* Pulsing Online Dot */}
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-orange-500 animate-pulse" />
        </div>

        <span className="font-extrabold text-xs tracking-wider uppercase pr-1">
          Guru
        </span>

        {/* Glow Ring */}
        <span className="absolute -inset-1 rounded-full bg-orange-400/30 blur-sm -z-10 group-hover:bg-orange-400/50 transition-colors" />
      </button>
    </aside>
  );
}
