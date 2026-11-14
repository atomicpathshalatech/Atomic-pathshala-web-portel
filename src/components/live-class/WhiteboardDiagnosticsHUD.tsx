"use client";

import React, { useEffect, useState } from "react";
import { whiteboardPerf, type WhiteboardPerfMetrics } from "@/lib/whiteboard/whiteboard-perf";

export function WhiteboardDiagnosticsHUD({ isTeacher = false }: { isTeacher?: boolean }) {
  const [metrics, setMetrics] = useState<WhiteboardPerfMetrics | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only available to teachers or dev mode
    if (!isTeacher && process.env.NODE_ENV !== "development") return;

    whiteboardPerf.start();
    const unsub = whiteboardPerf.subscribe(setMetrics);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      unsub();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTeacher]);

  if (!visible || !metrics) return null;

  const fpsColor =
    metrics.fps >= 55 ? "text-emerald-400" : metrics.fps >= 30 ? "text-amber-400" : "text-rose-400";
  const frameColor =
    metrics.avgFrameTimeMs <= 17
      ? "text-emerald-400"
      : metrics.avgFrameTimeMs <= 33
      ? "text-amber-400"
      : "text-rose-400";

  return (
    <div className="fixed top-14 right-4 z-[9999] pointer-events-auto bg-slate-950/90 border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs font-mono text-slate-200 w-72 select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-slate-100">Stylus & Board HUD</span>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="text-slate-400 hover:text-white px-1 rounded hover:bg-slate-800 text-xs"
          title="Close (Ctrl+Shift+D)"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <div>
          <span className="text-slate-400 text-[10px] block">FPS</span>
          <span className={`font-bold text-base ${fpsColor}`}>{metrics.fps}</span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block">Avg Frame Time</span>
          <span className={`font-bold text-sm ${frameColor}`}>{metrics.avgFrameTimeMs} ms</span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block">P95 / Max Frame</span>
          <span className="text-slate-200">
            {metrics.p95FrameTimeMs} / {metrics.maxFrameTimeMs} ms
          </span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block">Pointer Rate</span>
          <span className="text-blue-400 font-semibold">{metrics.pointerEventsPerSec} / sec</span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block">Pointer Process</span>
          <span className="text-slate-300">{metrics.lastPointerProcessMs} ms</span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block">Stroke Render</span>
          <span className="text-slate-300">{metrics.lastRenderDurationMs} ms</span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block">Strokes / Points</span>
          <span className="text-slate-300">
            {metrics.activeStrokesCount} / {metrics.activePointsCount}
          </span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block">React Renders</span>
          <span className="text-amber-300 font-semibold">{metrics.reactRenderCount}</span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block">Autosave Queue</span>
          <span className="text-slate-300">{metrics.autosaveQueueSize} dirty</span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block">Save Latency</span>
          <span className="text-slate-300">{metrics.lastAutosaveDurationMs} ms</span>
        </div>

        {metrics.memoryUsedMb !== null && (
          <div className="col-span-2 border-t border-slate-800/80 pt-1 mt-0.5">
            <span className="text-slate-400 text-[10px] block">JS Heap</span>
            <span className="text-slate-300">
              {metrics.memoryUsedMb} MB / {metrics.memoryLimitMb} MB
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 pt-1 border-t border-slate-800 text-[10px] text-slate-500 text-center">
        Toggle HUD: <kbd className="bg-slate-800 px-1 rounded text-slate-300">Ctrl+Shift+D</kbd>
      </div>
    </div>
  );
}
