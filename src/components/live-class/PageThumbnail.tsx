"use client";

import { useEffect, useRef } from "react";
import type { StrokeObject } from "@/lib/canvas/canvas-engine";
import { renderPageThumbnail } from "@/lib/canvas/thumbnail-renderer";

/** Fixed 16:9 thumbnail size (CSS px) — matches the virtual canvas's own
 * aspect ratio so nothing is stretched. Small enough that rendering every
 * thumbnail in an open preview panel (capped at 50 pages, see
 * MAX_PAGES_PER_SESSION) is cheap; each is a handful of ctx calls on this
 * small a canvas, not a full-resolution re-render. */
const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 90;

export function PageThumbnail({ background, objects }: { background: string; objects: StrokeObject[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    renderPageThumbnail(ctx, { background, objects }, THUMB_WIDTH, THUMB_HEIGHT);
    // objects is a fresh array reference on every autosave/page-switch (see
    // TeacherLiveClassRoom's wbSession state), so a plain dependency on the
    // array itself (not a stringified diff) is exactly the right amount of
    // re-rendering — once per real content change, not once per keystroke
    // inside an unrelated part of the app.
  }, [background, objects]);

  return (
    <canvas
      ref={canvasRef}
      width={THUMB_WIDTH}
      height={THUMB_HEIGHT}
      className="w-full h-full rounded border border-[#2d2e3b] bg-white block"
    />
  );
}
