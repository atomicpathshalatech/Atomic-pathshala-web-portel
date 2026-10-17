"use client";

import React, { useEffect, useRef, useState } from "react";

/** A small picture of a source page, drawn only when it scrolls into the page list. */
export function PageThumb({ pdfDocProxy, sourcePage, rotation, width = 150 }: { pdfDocProxy: any; sourcePage: number; rotation: number; width?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [ratio, setRatio] = useState(1.414);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return setVisible(true);
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !pdfDocProxy || sourcePage === 0) return;
    let cancelled = false;
    let task: any = null;
    (async () => {
      try {
        const page = await pdfDocProxy.getPage(sourcePage);
        const turn = (((page.rotate ?? 0) + rotation) % 360 + 360) % 360;
        const base = page.getViewport({ scale: 1, rotation: turn });
        const viewport = page.getViewport({ scale: (width * 1.5) / base.width, rotation: turn });
        if (cancelled || !ref.current) return;
        setRatio(base.height / base.width);
        ref.current.width = Math.ceil(viewport.width);
        ref.current.height = Math.ceil(viewport.height);
        task = page.render({ canvasContext: ref.current.getContext("2d")!, viewport });
        await task.promise;
      } catch {
        // a thumbnail that fails to draw just stays blank
      }
    })();
    return () => {
      cancelled = true;
      try {
        task?.cancel();
      } catch {}
    };
  }, [visible, pdfDocProxy, sourcePage, rotation, width]);

  return (
    <div ref={boxRef} className="w-full bg-white rounded overflow-hidden" style={{ aspectRatio: `1 / ${ratio}` }}>
      {sourcePage === 0 ? (
        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">Blank page</div>
      ) : (
        <canvas ref={ref} className="w-full h-full block" aria-hidden="true" />
      )}
    </div>
  );
}
