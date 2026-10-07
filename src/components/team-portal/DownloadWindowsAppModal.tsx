"use client";

import { useState } from "react";

export function DownloadWindowsAppModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [showCliInstructions, setShowCliInstructions] = useState(false);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Trigger download endpoint
      window.location.href = "/api/desktop/download";
    } catch {
      // Best effort
    } finally {
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface rounded-3xl max-w-lg w-full flex flex-col shadow-2xl border border-outline-variant/30 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-outline-variant/20 flex items-center justify-between bg-gradient-to-r from-orange-500/10 via-primary/5 to-transparent">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 p-0.5 shadow-md flex items-center justify-center shrink-0">
              <img
                src="/icon.png"
                alt="Atomic Pathshala"
                className="w-full h-full rounded-2xl object-cover bg-white"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-extrabold">
                  Atomic Pathshala Desktop
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 text-[10px] font-black uppercase tracking-wider">
                  v0.1.0
                </span>
              </div>
              <p className="text-label-sm text-on-surface-variant mt-0.5">
                Teacher Classroom &amp; Live Broadcast Studio for Windows
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-on-surface">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-orange-500 text-xl shrink-0 mt-0.5">
                youtube_activity
              </span>
              <div>
                <h4 className="text-xs font-bold">Built-in Encoder</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                  Streams direct to YouTube. Zero OBS setup or stream keys needed.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">
                draw
              </span>
              <div>
                <h4 className="text-xs font-bold">Hardware Whiteboard</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                  Ultra-low latency pen tablet drawing with dual-display support.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-green-600 text-xl shrink-0 mt-0.5">
                speed
              </span>
              <div>
                <h4 className="text-xs font-bold">Low Latency</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                  Smooth 1080p 60fps streaming powered by native FFmpeg.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-purple-600 text-xl shrink-0 mt-0.5">
                security
              </span>
              <div>
                <h4 className="text-xs font-bold">Locked Down</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                  Sandboxed environment with strict origin isolation.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-container-high/40 border border-outline-variant/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-on-surface-variant">
                laptop_windows
              </span>
              <span className="font-semibold text-on-surface">System Requirements:</span>
              <span className="text-on-surface-variant">Windows 10 / 11 (64-bit)</span>
            </div>
            <span className="text-[11px] font-bold text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
              Compatible
            </span>
          </div>

          {showCliInstructions && (
            <div className="p-3.5 rounded-2xl bg-slate-950 text-slate-200 text-xs font-mono space-y-1.5 border border-slate-800">
              <p className="text-slate-400 text-[11px] font-sans font-semibold">Local Run / Build Commands:</p>
              <p className="text-orange-400">cd desktop/teacher</p>
              <p className="text-green-400">npm install &amp;&amp; npm run fetch-ffmpeg</p>
              <p className="text-cyan-400">npm start</p>
              <p className="text-slate-400 text-[10px] font-sans pt-1">To generate standalone installer: <code className="text-white">npm run dist</code></p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-outline-variant/20 bg-surface-container-lowest flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowCliInstructions((prev) => !prev)}
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-base">terminal</span>
            <span>{showCliInstructions ? "Hide Developer Instructions" : "Developer Run Instructions"}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-outline-variant/30 text-label-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-full px-6 py-2.5 font-label-md text-label-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-lg">{downloading ? "sync" : "download"}</span>
              <span>{downloading ? "Starting Download…" : "Download Windows App (.exe)"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
