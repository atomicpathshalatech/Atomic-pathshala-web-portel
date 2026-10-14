"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from "@/lib/canvas/canvas-engine";

export interface CanvasCursorHandle {
  /** Pointer position in board (1920x1080) units, or null to hide the cursor. */
  move: (pos: { x: number; y: number } | null) => void;
}

/**
 * The pen dot / eraser circle that follows the pointer over the board, drawn
 * at the real size of what the tool will leave behind.
 *
 * It moves by writing its own style, not through React state: a state update
 * per pointer move re-rendered the whole live-class room (thousands of lines,
 * the video tiles included) many times a second while the teacher wrote,
 * which is what made the pen feel slow. Never part of the board itself — not
 * in undo, the saved slide or the PDF.
 */
export const CanvasCursor = forwardRef<
  CanvasCursorHandle,
  { tool: string; size: number; color: string; eraserRadius: number }
>(function CanvasCursor({ tool, size, color, eraserRadius }, ref) {
  const dotRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    move(pos) {
      const el = dotRef.current;
      if (!el) return;
      if (!pos) {
        el.style.display = "none";
        return;
      }
      el.style.display = "block";
      el.style.left = `${(pos.x / VIRTUAL_WIDTH) * 100}%`;
      el.style.top = `${(pos.y / VIRTUAL_HEIGHT) * 100}%`;
    },
  }));

  const isEraser = tool === "stroke-eraser" || tool === "object-eraser";
  const isHighlighter = tool === "highlighter" || tool === "highlighter-fade";
  if (!isEraser && !isHighlighter && tool !== "pen") return null;

  // Same widths canvas-engine.ts draws with: pen = size, highlighter = max(8, 3.5 x size).
  const diameter = isEraser ? eraserRadius * 2 : isHighlighter ? Math.max(8, size * 3.5) : Math.max(0.5, size);
  const pct = (diameter / VIRTUAL_WIDTH) * 100;

  return (
    <div
      ref={dotRef}
      className="absolute rounded-full pointer-events-none"
      style={{
        display: "none",
        width: `${pct}%`,
        aspectRatio: "1 / 1",
        minWidth: isEraser ? 12 : 4,
        minHeight: isEraser ? 12 : 4,
        transform: "translate(-50%, -50%)",
        border: isEraser ? "1.5px solid rgba(30,30,30,0.7)" : "none",
        backgroundColor: isEraser ? "rgba(255,255,255,0.35)" : color,
        opacity: isHighlighter ? 0.5 : 1,
        boxShadow: isEraser
          ? "0 0 0 1px rgba(255,255,255,0.6)"
          : "0 0 0 0.75px rgba(0,0,0,0.7), 0 0 0 1.5px rgba(255,255,255,0.85)",
      }}
    />
  );
});
