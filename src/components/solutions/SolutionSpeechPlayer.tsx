"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface SolutionSpeechPlayerProps {
  text: string;
  language?: "ENGLISH" | "HINDI" | "EN" | "HI";
  className?: string;
}

type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

/**
 * Converts LaTeX / Markdown / HTML solution text into clean spoken text
 * so Web Speech API reads formulas and chemical notation naturally.
 */
function toSpeakableText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1 over $2")
    .replace(/\\sqrt\{([^}]*)\}/g, "square root of $1")
    .replace(/\\rightarrow|\\to/g, " gives ")
    .replace(/\\rightleftharpoons/g, " is in equilibrium with ")
    .replace(/\\times/g, " times ")
    .replace(/\\div/g, " divided by ")
    .replace(/\\pm/g, " plus or minus ")
    .replace(/\\approx/g, " approximately ")
    .replace(/\\neq/g, " not equal to ")
    .replace(/\\leq/g, " less than or equal to ")
    .replace(/\\geq/g, " greater than or equal to ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[$`*_#{}~^]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function SolutionSpeechPlayer({
  text,
  language = "ENGLISH",
  className = "",
}: SolutionSpeechPlayerProps) {
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speakable = useMemo(() => toSpeakableText(text), [text]);
  const isHindi = language === "HINDI" || language === "HI";

  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
  }, []);

  useEffect(() => {
    setStatus("idle");
    setErrorMsg(null);
    stopSpeech();
    return () => {
      stopSpeech();
    };
  }, [speakable, isHindi, stopSpeech]);

  const handlePlayPause = () => {
    if (!speakable) {
      setStatus("error");
      setErrorMsg("No solution text available to play.");
      return;
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setStatus("error");
      setErrorMsg("Audio playback is not supported in this browser.");
      return;
    }

    const synth = window.speechSynthesis;

    if (status === "playing") {
      synth.pause();
      setStatus("paused");
      return;
    }

    if (status === "paused") {
      synth.resume();
      setStatus("playing");
      return;
    }

    // Start or Replay
    try {
      setErrorMsg(null);
      setStatus("loading");
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(speakable);
      utterance.lang = isHindi ? "hi-IN" : "en-IN";
      utterance.rate = 0.98;

      const voices = synth.getVoices();
      const targetPrefix = isHindi ? "hi" : "en";
      const preferredVoice =
        voices.find((v) => v.lang.toLowerCase().startsWith(isHindi ? "hi-in" : "en-in")) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(targetPrefix));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => setStatus("playing");
      utterance.onpause = () => setStatus("paused");
      utterance.onresume = () => setStatus("playing");
      utterance.onend = () => setStatus("ended");
      utterance.onerror = (event) => {
        if (event.error === "canceled" || event.error === "interrupted") return;
        setStatus("error");
        setErrorMsg("Could not play explanation audio on this device.");
      };

      utteranceRef.current = utterance;
      synth.speak(utterance);

      // Fallback in case onstart is delayed or not fired immediately on some mobile WebViews
      setTimeout(() => {
        setStatus((prev) => (prev === "loading" ? "playing" : prev));
      }, 300);
    } catch {
      setStatus("error");
      setErrorMsg("Unable to start solution playback.");
    }
  };

  const handleReplay = () => {
    stopSpeech();
    setStatus("idle");
    setTimeout(() => {
      handlePlayPause();
    }, 30);
  };

  const label =
    status === "loading"
      ? "Loading…"
      : status === "playing"
      ? "Pause"
      : status === "paused"
      ? "Resume"
      : status === "ended"
      ? "Replay"
      : "Play Explanation";

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={handlePlayPause}
        disabled={!speakable}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold shadow-2xs transition active:scale-95 disabled:opacity-40 cursor-pointer"
        title={label}
      >
        {status === "loading" ? (
          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="material-symbols-outlined text-sm">
            {status === "playing" ? "pause" : status === "ended" ? "replay" : "play_arrow"}
          </span>
        )}
        <span>{label}</span>
      </button>

      {(status === "playing" || status === "paused") && (
        <button
          type="button"
          onClick={handleReplay}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition cursor-pointer"
          title="Replay from start"
        >
          <span className="material-symbols-outlined text-sm">replay</span>
          <span>Replay</span>
        </button>
      )}

      {errorMsg && (
        <span className="text-[11px] font-medium text-red-600 dark:text-red-400">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
