"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  BookOpen,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Props {
  documentId: string;
  fileUrl?: string;
  pageNumber: number;
  totalPages: number;
  onPageChange?: (newPage: number) => void;
}

export function NcertOriginalPageViewer({
  documentId,
  fileUrl,
  pageNumber,
  totalPages,
  onPageChange,
}: Props) {
  const [scale, setScale] = useState<number>(1.25);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Transition state
  const [displayedPage, setDisplayedPage] = useState<number>(pageNumber);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [turnDirection, setTurnDirection] = useState<"next" | "prev">("next");

  // Dual canvas refs for seamless double buffering
  const activeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bufferCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // PDF.js references
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const prevPageRef = useRef<number>(pageNumber);

  // In-memory page image cache for instant flip
  const pageCacheRef = useRef<Map<string, { canvas: HTMLCanvasElement; width: number; height: number }>>(new Map());

  // Effective PDF stream endpoint
  const pdfUrl =
    fileUrl && (fileUrl.startsWith("http://") || fileUrl.startsWith("https://"))
      ? fileUrl
      : `/api/ncert/document/${documentId}/pdf`;

  // Helper to render a specific page directly to a canvas
  const renderDirect = useCallback(
    async (doc: any, pageNum: number, currentScale: number, targetCanvas: HTMLCanvasElement | null) => {
      if (!doc || !targetCanvas) return;

      const page = await doc.getPage(pageNum);
      const ctx = targetCanvas.getContext("2d");
      if (!ctx) return;

      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const viewport = page.getViewport({ scale: currentScale * dpr });

      targetCanvas.width = viewport.width;
      targetCanvas.height = viewport.height;
      targetCanvas.style.width = `${viewport.width / dpr}px`;
      targetCanvas.style.height = `${viewport.height / dpr}px`;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
    },
    []
  );

  // Background Preloader
  const preloadPage = useCallback(async (doc: any, pageNum: number, currentScale: number) => {
    if (!doc || pageNum < 1 || pageNum > doc.numPages) return;
    const cacheKey = `${pageNum}_${currentScale}`;
    if (pageCacheRef.current.has(cacheKey)) return;

    try {
      const page = await doc.getPage(pageNum);
      const offscreen = document.createElement("canvas");
      const ctx = offscreen.getContext("2d");
      if (!ctx) return;

      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const viewport = page.getViewport({ scale: currentScale * dpr });
      offscreen.width = viewport.width;
      offscreen.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;
      pageCacheRef.current.set(cacheKey, {
        canvas: offscreen,
        width: viewport.width,
        height: viewport.height,
      });
    } catch {
      // Preloading error ignored
    }
  }, []);

  // Calculate optimal fit-to-screen scale so the whole A4 page is visible cleanly
  const calculateFitScale = useCallback((page: any) => {
    if (!containerRef.current || !page) return 1.0;
    const container = containerRef.current;
    const availWidth = Math.max(280, container.clientWidth - 28);
    const availHeight = Math.max(380, container.clientHeight - 72);
    const unscaled = page.getViewport({ scale: 1.0 });
    const scaleX = availWidth / unscaled.width;
    const scaleY = availHeight / unscaled.height;
    const fit = Math.min(scaleX, scaleY);
    return Math.max(0.6, Math.min(2.0, Number(fit.toFixed(2))));
  }, []);

  // 1. Initial Load of PDF Document
  useEffect(() => {
    let isCancelled = false;
    setInitialLoading(true);
    setError(null);

    async function loadPdfDocument() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: "https://unpkg.com/pdfjs-dist@4.0.0/cmaps/",
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (!isCancelled) {
          pdfDocRef.current = doc;
          const page = await doc.getPage(pageNumber);
          const autoScale = calculateFitScale(page);
          setScale(autoScale);

          await renderDirect(doc, pageNumber, autoScale, activeCanvasRef.current);
          setDisplayedPage(pageNumber);
          setInitialLoading(false);

          // Preload next page in background
          if (pageNumber < (totalPages || doc.numPages)) {
            preloadPage(doc, pageNumber + 1, autoScale);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn("[NcertOriginalPageViewer] PDF Load error:", err);
          setError("Could not load original NCERT PDF file.");
          setInitialLoading(false);
        }
      }
    }

    loadPdfDocument();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfUrl, documentId, calculateFitScale]);

  // 2. Handle Smooth Page Transitions when pageNumber changes
  useEffect(() => {
    if (!pdfDocRef.current || initialLoading) return;
    if (pageNumber === displayedPage) return;

    const direction = pageNumber > prevPageRef.current ? "next" : "prev";
    setTurnDirection(direction);
    prevPageRef.current = pageNumber;

    let isSubscribed = true;

    async function executePageTurn() {
      const doc = pdfDocRef.current;
      if (!doc) return;

      try {
        const bufferCanvas = bufferCanvasRef.current;
        const activeCanvas = activeCanvasRef.current;
        if (!bufferCanvas || !activeCanvas) return;

        // Render target page on buffer canvas first while active canvas remains visible
        await renderDirect(doc, pageNumber, scale, bufferCanvas);

        if (!isSubscribed) return;

        // Trigger smooth hardware-accelerated page turn animation
        setIsTransitioning(true);

        setTimeout(() => {
          if (!isSubscribed) return;
          // Copy buffer canvas contents to active canvas seamlessly
          const activeCtx = activeCanvas.getContext("2d");
          if (activeCtx) {
            activeCanvas.width = bufferCanvas.width;
            activeCanvas.height = bufferCanvas.height;
            activeCanvas.style.width = bufferCanvas.style.width;
            activeCanvas.style.height = bufferCanvas.style.height;
            activeCtx.drawImage(bufferCanvas, 0, 0);
          }

          setDisplayedPage(pageNumber);
          setIsTransitioning(false);

          // Preload adjacent page
          const nextTarget = direction === "next" ? pageNumber + 1 : pageNumber - 1;
          if (nextTarget >= 1 && nextTarget <= (totalPages || doc.numPages)) {
            preloadPage(doc, nextTarget, scale);
          }
        }, 320); // 320ms matching CSS transition
      } catch (err) {
        console.error("[NcertOriginalPageViewer] Page turn error:", err);
        setIsTransitioning(false);
        setDisplayedPage(pageNumber);
      }
    }

    executePageTurn();

    return () => {
      isSubscribed = false;
    };
  }, [pageNumber, scale, initialLoading, renderDirect, totalPages, preloadPage, displayedPage]);

  // 3. Handle Zoom / Scale changes on the current active page
  useEffect(() => {
    if (pdfDocRef.current && !initialLoading && !isTransitioning) {
      renderDirect(pdfDocRef.current, displayedPage, scale, activeCanvasRef.current);
    }
  }, [scale, displayedPage, initialLoading, isTransitioning, renderDirect]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full bg-slate-900 overflow-hidden select-none relative ${
        isFullscreen ? "p-0" : ""
      }`}
    >
      {/* 1. TOP VIEWER TOOLBAR */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-3 text-xs text-slate-300">
        {/* Left: Book Badge */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 font-semibold text-[11px]">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>Official NCERT Textbook</span>
          </span>
          <span className="hidden sm:inline-block text-[11px] text-slate-400 font-medium">
            Page {displayedPage} of {totalPages || 1}
          </span>
        </div>

        {/* Center / Right: Zoom & Navigation Controls */}
        <div className="flex items-center gap-1">
          {/* Quick Page Prev/Next inside Toolbar */}
          {onPageChange && (
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 mr-2">
              <button
                type="button"
                disabled={displayedPage <= 1 || isTransitioning}
                onClick={() => onPageChange(displayedPage - 1)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
                title="Previous Page (Smooth Flip)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono text-[11px] font-bold text-slate-300">
                {displayedPage} / {totalPages || 1}
              </span>
              <button
                type="button"
                disabled={displayedPage >= (totalPages || 1) || isTransitioning}
                onClick={() => onPageChange(displayedPage + 1)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
                title="Next Page (Smooth Flip)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.75, Number((s - 0.2).toFixed(2))))}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="font-mono text-[11px] font-semibold px-1 text-slate-400 w-11 text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2.5, Number((s + 0.2).toFixed(2))))}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={async () => {
              if (pdfDocRef.current) {
                try {
                  const page = await pdfDocRef.current.getPage(displayedPage);
                  const fit = calculateFitScale(page);
                  setScale(fit);
                } catch {
                  setScale(1.0);
                }
              }
            }}
            className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Fit to page"
          >
            Fit
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Open Original PDF in New Window */}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Open Original PDF in New Tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. MAIN BOOK VIEWING WORKSPACE WITH SMOOTH 3D PAGE-FLIP CONTAINER */}
      <div className="flex-1 overflow-auto flex justify-center items-start p-3 sm:p-6 bg-slate-900/90 relative">
        {/* Initial PDF Loading State */}
        {initialLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm space-y-3">
            <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
              <span className="material-symbols-outlined animate-spin text-2xl">
                progress_activity
              </span>
              <span>Loading Original NCERT Book...</span>
            </div>
            <p className="text-xs text-slate-400">Loading high-resolution textbook pages</p>
          </div>
        )}

        {/* Error Fallback */}
        {error && !initialLoading && (
          <div className="p-8 text-center max-w-md bg-slate-950 rounded-2xl border border-rose-900/60 shadow-xl space-y-3 my-12 text-slate-200">
            <span className="material-symbols-outlined text-rose-500 text-4xl">
              warning
            </span>
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={() => {
                if (pdfDocRef.current) {
                  renderDirect(pdfDocRef.current, pageNumber, scale, activeCanvasRef.current);
                }
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
            >
              Retry Loading PDF
            </button>
          </div>
        )}

        {/* Dual-Canvas Page-Turn Stage */}
        <div
          className="relative max-w-full perspective-1000 transition-all duration-300 flex flex-col items-center"
          style={{ perspective: "1200px" }}
        >
          {/* Active / Current Page Canvas Container */}
          <div
            className={`bg-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-sm border border-slate-700/80 overflow-hidden transition-all duration-300 ease-out origin-center ${
              isTransitioning
                ? turnDirection === "next"
                  ? "opacity-40 scale-[0.98] -translate-x-3 rotate-y-[-6deg]"
                  : "opacity-40 scale-[0.98] translate-x-3 rotate-y-[6deg]"
                : "opacity-100 scale-100 translate-x-0 rotate-y-0"
            }`}
          >
            {/* Book Spine Shadow Overlay for authentic textbook depth */}
            <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/10 via-black/5 to-transparent pointer-events-none z-10" />
            <div className="absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-black/10 via-black/5 to-transparent pointer-events-none z-10" />

            <canvas ref={activeCanvasRef} className="block mx-auto" />
          </div>

          {/* Buffer Canvas (Hidden offscreen during render, used for seamless double buffering) */}
          <canvas ref={bufferCanvasRef} className="hidden" />

          {/* Bottom Page Indicator Badge */}
          <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-400 bg-slate-950/90 px-3.5 py-1.5 rounded-full border border-slate-800 shadow-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Original NCERT Page {displayedPage} of {totalPages || 1}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
