"use client";

import { useEffect, useRef } from "react";
import { CanvasEngine, VIRTUAL_HEIGHT, VIRTUAL_WIDTH, type StrokeObject } from "@/lib/canvas/canvas-engine";

/**
 * Internal render surface for the whiteboard PDF export (not a page for
 * people). The server opens it in its headless browser and asks it to draw a
 * slide's objects with the SAME engine the live board uses, then takes the
 * result as a transparent PNG — so the PDF shows exactly what was on the
 * board (every pen style, highlighter, shape, text, fill), instead of a
 * second, incomplete re-implementation of the drawing code.
 *
 * It holds no data of its own: it only draws what is handed to it.
 */
declare global {
  interface Window {
    __boardRenderReady?: boolean;
    __renderBoardInk?: (objects: StrokeObject[]) => Promise<{ png: string; drawn: number }>;
  }
}

export default function BoardRenderPage() {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

    window.__renderBoardInk = async (objects: StrokeObject[]) => {
      const base = baseRef.current!;
      const active = activeRef.current!;
      // Images used by fill / pasted objects must be decoded before drawing.
      await Promise.all(
        objects
          .filter((o) => o.type === "raster" && typeof (o as { dataUrl?: string }).dataUrl === "string")
          .map(
            (o) =>
              new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = img.onerror = () => resolve();
                img.src = (o as unknown as { dataUrl: string }).dataUrl;
              })
          )
      );
      const engine = new CanvasEngine(base, active, undefined, undefined, { readOnly: true });
      try {
        engine.loadObjects(objects);
        engine.syncSize();
        await nextFrame();
        await nextFrame();
        // Raster objects draw once their image has loaded inside the engine.
        if (objects.some((o) => o.type === "raster")) await new Promise((r) => setTimeout(r, 150));
        engine.renderBase();
        return { png: base.toDataURL("image/png"), drawn: objects.length };
      } finally {
        engine.destroy();
      }
    };

    // Text on the board may be Hindi: wait for the fonts before saying "ready".
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    Promise.race([fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 4000))]).then(() => {
      window.__boardRenderReady = true;
    });
    return () => {
      window.__renderBoardInk = undefined;
      window.__boardRenderReady = false;
    };
  }, []);

  const size = { width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT };
  return (
    <div style={{ position: "fixed", left: 0, top: 0, ...size, background: "transparent" }}>
      {/* Warm the fonts board text uses, Devanagari included. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&display=swap" />
      <span style={{ position: "absolute", opacity: 0, fontFamily: "'Noto Sans Devanagari', sans-serif" }}>अ a</span>
      <canvas ref={baseRef} style={{ position: "absolute", left: 0, top: 0, ...size }} />
      <canvas ref={activeRef} style={{ position: "absolute", left: 0, top: 0, ...size }} />
    </div>
  );
}
