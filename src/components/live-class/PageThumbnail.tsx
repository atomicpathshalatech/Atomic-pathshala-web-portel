"use client";

import React, { useEffect, useRef } from "react";
import type { StrokeObject } from "@/lib/canvas/canvas-engine";
import { renderPageThumbnail } from "@/lib/canvas/thumbnail-renderer";

/** Fixed 16:9 thumbnail size (CSS px) */
const THUMB_WIDTH = 200;
const THUMB_HEIGHT = 112;

export const PageThumbnail = React.memo(
  function PageThumbnail({ background, objects }: { background: string; objects: StrokeObject[] }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawnRef = useRef<{ bg: string; count: number }>({ bg: "", count: -1 });

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      let cancelled = false;

      const draw = () => {
        if (cancelled || !canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        drawnRef.current = { bg: background, count: objects?.length ?? 0 };
        renderPageThumbnail(ctx, { background, objects }, THUMB_WIDTH, THUMB_HEIGHT, () => {
          if (!cancelled) {
            requestAnimationFrame(draw);
          }
        });
      };

      // Non-blocking animation frame schedule
      const raf = requestAnimationFrame(draw);
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }, [background, objects]);

    return (
      <canvas
        ref={canvasRef}
        width={THUMB_WIDTH}
        height={THUMB_HEIGHT}
        className="w-full aspect-[16/9] rounded-lg border border-[#2d2e3b] bg-white block shadow-sm pointer-events-none"
      />
    );
  },
  (prev, next) => {
    if (prev.background !== next.background) return false;
    if (prev.objects === next.objects) return true;
    if ((prev.objects?.length ?? 0) !== (next.objects?.length ?? 0)) return false;
    // Fast comparison when same length
    return JSON.stringify(prev.objects) === JSON.stringify(next.objects);
  }
);
