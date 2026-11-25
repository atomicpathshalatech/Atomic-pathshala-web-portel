"use client";

import { useEffect, useRef, useState } from "react";

interface VoicePlayerProps {
  url: string;
  durationSec?: number | null;
  title?: string;
  className?: string;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export function VoicePlayer({
  url,
  durationSec,
  title = "Voice Explanation",
  className = "",
}: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(durationSec || 0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const validUrl = url?.trim() || "";

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setErrorMsg(validUrl ? null : "Audio explanation is not available.");
    const audio = audioRef.current;
    if (!audio || !validUrl) return;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(Math.round(audio.duration));
      }
      setIsLoading(false);
      setErrorMsg(null);
    };

    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onPlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
      setErrorMsg(null);
    };
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onError = () => {
      setIsPlaying(false);
      setIsLoading(false);
      setErrorMsg("Unable to load audio. The file may be missing, expired, or unsupported on this browser.");
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [validUrl]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !validUrl) {
      setErrorMsg("Audio explanation is not available.");
      return;
    }
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    try {
      setErrorMsg(null);
      setIsLoading(true);
      if (audio.error) {
        audio.load();
      }
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      setIsPlaying(false);
      const name = err instanceof Error ? err.name : "";
      setErrorMsg(
        name === "NotAllowedError"
          ? "Playback blocked by browser. Tap Play again to listen."
          : "Could not play audio explanation."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Number(e.target.value);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const cycleSpeed = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length] || 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`rounded-2xl border border-blue-500/20 bg-blue-950/20 dark:bg-slate-900/80 p-3.5 sm:p-4 backdrop-blur-xs transition-all shadow-sm ${className}`}
    >
      {validUrl && <audio ref={audioRef} src={validUrl} preload="metadata" playsInline />}

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400">
            <span className="material-symbols-outlined text-lg">mic</span>
          </span>
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
              {title}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {isLoading ? "Loading audio…" : `Audio Answer • ${formatTime(duration)}`}
            </p>
          </div>
        </div>

        {/* Speed toggle */}
        <button
          type="button"
          onClick={cycleSpeed}
          disabled={!validUrl}
          className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition disabled:opacity-40"
          title="Playback speed"
        >
          {playbackRate}x
        </button>
      </div>

      {errorMsg && (
        <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-[11px] font-medium text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Controls & Waveform Progress */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={!validUrl || isLoading}
          className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 shrink-0 disabled:opacity-50"
          title={isPlaying ? "Pause" : "Play Voice Answer"}
        >
          {isLoading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="material-symbols-outlined text-2xl">
              {isPlaying ? "pause" : "play_arrow"}
            </span>
          )}
        </button>

        {/* Scrubber and Time */}
        <div className="flex-1 space-y-1">
          {/* Animated Wave Bars Representation */}
          <div className="flex items-center gap-0.5 h-4 px-0.5 overflow-hidden opacity-60">
            {Array.from({ length: 28 }).map((_, i) => {
              const active = (i / 28) * 100 <= progressPercent;
              const barHeight = 25 + ((i * 19) % 75);
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-all duration-150 ${
                    active
                      ? "bg-blue-500 dark:bg-blue-400"
                      : "bg-slate-300 dark:bg-slate-700"
                  } ${isPlaying ? "animate-pulse" : ""}`}
                  style={{
                    height: `${barHeight}%`,
                    animationDelay: `${(i % 5) * 80}ms`,
                  }}
                />
              );
            })}
          </div>

          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
