"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function FloatingGuruWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [showSpeechBubble, setShowSpeechBubble] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [isAnswering, setIsAnswering] = useState(false);
  const [responseMessage, setResponseMessage] = useState<string | null>(null);

  // Position state (pixels from top-left)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });
  const hasMovedRef = useRef(false);

  // Hide on full Guru chat page itself to avoid duplication
  const isGuruPage =
    pathname === "/guru" ||
    pathname?.startsWith("/guru/") ||
    pathname === "/live-studio" ||
    pathname?.startsWith("/team/live-studio");

  // Initialize position to bottom-right safely on client
  useEffect(() => {
    if (typeof window !== "undefined" && !position) {
      const defaultX = Math.max(16, window.innerWidth - 120);
      const defaultY = Math.max(16, window.innerHeight - 56);
      setPosition({ x: defaultX, y: defaultY });
    }
  }, [position]);

  // Adjust on screen resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev || typeof window === "undefined") return null;
        const maxX = window.innerWidth - 110;
        const maxY = window.innerHeight - 56;
        return {
          x: Math.min(Math.max(12, prev.x), Math.max(12, maxX)),
          y: Math.min(Math.max(12, prev.y), Math.max(12, maxY)),
        };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (isGuruPage) return null;

  // Pointer/Touch Drag Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!position) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || typeof window === "undefined") return;
    const dx = e.clientX - dragStartRef.current.mouseX;
    const dy = e.clientY - dragStartRef.current.mouseY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasMovedRef.current = true;
    }

    const nextX = dragStartRef.current.startX + dx;
    const nextY = dragStartRef.current.startY + dy;

    const maxX = window.innerWidth - 110;
    const maxY = window.innerHeight - 56;

    setPosition({
      x: Math.min(Math.max(12, nextX), Math.max(12, maxX)),
      y: Math.min(Math.max(12, nextY), Math.max(12, maxY)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    // If it was a simple click (not dragged), toggle popup
    if (!hasMovedRef.current) {
      if (isOpen) {
        setIsOpen(false);
        setShowSpeechBubble(false);
      } else if (showSpeechBubble) {
        setShowSpeechBubble(false);
        setIsOpen(false);
      } else {
        setShowSpeechBubble(true);
      }
    }
  };

  const handleQuickAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim()) return;

    setIsAnswering(true);
    setResponseMessage(null);

    setTimeout(() => {
      setIsAnswering(false);
      setResponseMessage(
        `Guru AI: "${userQuery}" ka detailed concept & formula samajhne ke liye Atomic Guru studio open karein.`
      );
    }, 1000);
  };

  // Determine popup placement based on current widget position on screen
  const isNearTop = position ? position.y < 350 : false;
  const isNearLeft = position ? position.x < 320 : false;

  return (
    <aside
      aria-label="Atomic Guru Assistant"
      style={{
        position: "fixed",
        left: position ? `${position.x}px` : "auto",
        top: position ? `${position.y}px` : "auto",
        right: !position ? "1.25rem" : "auto",
        bottom: !position ? "1.25rem" : "auto",
        zIndex: 9999,
      }}
      className="select-none pointer-events-auto flex flex-col items-end"
    >
      {/* 1. SPEECH BUBBLE POPUP (CLICK TRIGGERED ONLY) */}
      {showSpeechBubble && !isOpen && (
        <div
          style={{
            position: "absolute",
            [isNearTop ? "top" : "bottom"]: "calc(100% + 8px)",
            [isNearLeft ? "left" : "right"]: "0px",
          }}
          className="w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 relative group"
        >
          <button
            type="button"
            onClick={() => setShowSpeechBubble(false)}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center text-[10px] shadow"
            title="Close"
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
                setShowSpeechBubble(false);
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
        </div>
      )}

      {/* 2. QUICK DOUBT DRAWER / MODAL */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            [isNearTop ? "top" : "bottom"]: "calc(100% + 8px)",
            [isNearLeft ? "left" : "right"]: "0px",
          }}
          className="w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col z-50 animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 p-3.5 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-xs">
                🤖
              </div>
              <div>
                <h3 className="font-bold text-xs tracking-wide">Atomic Guru</h3>
                <p className="text-[9px] text-white/80">24/7 AI Academic Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Link
                href="/guru"
                className="p-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs"
                title="Open Fullscreen Studio"
              >
                <span className="material-symbols-outlined text-xs">open_in_new</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-3.5 space-y-2.5 max-h-72 overflow-y-auto">
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/40 rounded-2xl p-2.5 text-xs text-orange-900 dark:text-orange-200 space-y-0.5">
              <p className="font-bold text-[11px]">👋 Kaise help kar sakta hu?</p>
              <p className="text-[10px] text-orange-700 dark:text-orange-300">
                Physics numericals, Chemistry mechanisms, Biology concepts ya NCERT line doubt poochiye!
              </p>
            </div>

            {/* Quick Prompts */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
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
                  className="w-full text-left p-1.5 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-[10px] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 transition truncate"
                >
                  ✨ {q}
                </button>
              ))}
            </div>

            {/* Simulated Response */}
            {responseMessage && (
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-2.5 text-xs text-slate-800 dark:text-slate-200 space-y-1.5">
                <p className="leading-relaxed text-[11px]">{responseMessage}</p>
                <Link
                  href="/guru"
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 hover:underline"
                >
                  <span>Open in Atomic Guru</span>
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </Link>
              </div>
            )}
          </div>

          {/* Input Footer */}
          <form onSubmit={handleQuickAsk} className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-2 py-1 shadow-sm">
              <Link
                href="/guru"
                className="text-slate-400 hover:text-orange-600 p-0.5"
                title="Attach photo / PDF"
              >
                <span className="material-symbols-outlined text-sm">add_photo_alternate</span>
              </Link>
              <input
                type="text"
                placeholder="Ask doubt in Hindi / English..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                className="flex-1 bg-transparent text-[11px] outline-none text-slate-900 dark:text-white placeholder-slate-400"
              />
              <button
                type="submit"
                disabled={!userQuery.trim() || isAnswering}
                className="w-6 h-6 rounded-lg bg-orange-600 text-white flex items-center justify-center hover:bg-orange-500 disabled:opacity-40 transition"
              >
                <span className="material-symbols-outlined text-[11px]">
                  {isAnswering ? "hourglass_top" : "send"}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. COMPACT & DRAGGABLE GURU MASCOT BUTTON */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white shadow-md shadow-orange-500/30 hover:shadow-lg hover:shadow-orange-500/50 cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95 transition-transform duration-200 touch-none"
        title="Click to open Guru / Drag to move anywhere"
      >
        {/* Animated Mascot Head (Compact 24px) */}
        <div className="relative flex items-center justify-center shrink-0">
          <div className="w-6 h-6 rounded-full bg-white text-slate-900 flex items-center justify-center text-xs shadow-inner group-hover:rotate-12 transition-transform">
            🤖
          </div>
          {/* Pulsing Online Dot */}
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-orange-500 animate-pulse" />
        </div>

        <span className="font-black text-[11px] tracking-wider uppercase pr-0.5">
          Guru
        </span>

        {/* Glow Ring */}
        <span className="absolute -inset-0.5 rounded-full bg-orange-400/30 blur-xs -z-10 group-hover:bg-orange-400/50 transition-colors" />
      </div>
    </aside>
  );
}
