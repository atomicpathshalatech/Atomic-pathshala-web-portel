"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  BookOpen,
  FileText,
  RotateCw,
  ExternalLink,
  Download,
} from "lucide-react";

interface Props {
  documentId: string;
  fileUrl?: string;
  pageNumber: number;
  totalPages: number;
  extractedText?: string;
  extractedElements?: Array<{ type: string; content: string }> | null;
}

export function NcertOriginalPageViewer({
  documentId,
  fileUrl,
  pageNumber,
  totalPages,
  extractedText,
  extractedElements,
}: Props) {
  const [viewMode, setViewMode] = useState<"original" | "text">("original");
  const [scale, setScale] = useState<number>(1.25);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  // Determine effective PDF source URL
  const pdfUrl =
    fileUrl && (fileUrl.startsWith("http://") || fileUrl.startsWith("https://"))
      ? fileUrl
      : `/api/ncert/document/${documentId}/pdf`;

  // 1. Load PDF Document (cached across page turns)
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    async function loadPdf() {
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
          renderPage(doc, pageNumber, scale);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn("[NcertOriginalPageViewer] PDF.js load error:", err);
          setError("Could not load original PDF file. You can switch to Text View.");
          setLoading(false);
        }
      }
    }

    if (!pdfDocRef.current) {
      loadPdf();
    } else {
      renderPage(pdfDocRef.current, pageNumber, scale);
    }

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfUrl, documentId]);

  // 2. Render Page on Canvas
  const renderPage = useCallback(
    async (doc: any, pageNum: number, currentScale: number) => {
      if (!doc || !canvasRef.current) return;

      try {
        setLoading(true);
        setError(null);

        // Cancel previous render task if active
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }

        const page = await doc.getPage(pageNum);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Use devicePixelRatio for Retina/crisp high-DPI rendering
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const viewport = page.getViewport({ scale: currentScale * dpr });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        setLoading(false);
      } catch (renderErr: any) {
        if (renderErr?.name !== "RenderingCancelledException") {
          console.error("[NcertOriginalPageViewer] Render error:", renderErr);
          setError("Failed to render this page.");
          setLoading(false);
        }
      }
    },
    []
  );

  // Re-render when pageNumber or scale changes
  useEffect(() => {
    if (pdfDocRef.current && viewMode === "original") {
      renderPage(pdfDocRef.current, pageNumber, scale);
    }
  }, [pageNumber, scale, viewMode, renderPage]);

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
      className={`flex flex-col h-full bg-slate-100 dark:bg-slate-950 overflow-hidden select-none ${
        isFullscreen ? "p-4" : ""
      }`}
    >
      {/* Viewer Header / Toolbar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs">
        {/* Left: View Mode Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode("original")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
              viewMode === "original"
                ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            title="View original NCERT book page with full illustrations"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
            <span>Original NCERT Page</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("text")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
              viewMode === "text"
                ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            title="Switch to extracted text view"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Text View</span>
          </button>
        </div>

        {/* Right: Zoom & Action Controls */}
        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
          {viewMode === "original" && (
            <>
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.75, Number((s - 0.2).toFixed(2))))}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <span className="font-mono text-[11px] font-semibold px-1 text-slate-500 w-12 text-center">
                {Math.round(scale * 100)}%
              </span>

              <button
                type="button"
                onClick={() => setScale((s) => Math.min(2.5, Number((s + 0.2).toFixed(2))))}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setScale(1.25)}
                className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                title="Fit to width"
              >
                Fit
              </button>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
            </>
          )}

          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            title="Open Original PDF in New Tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto flex justify-center items-start p-3 sm:p-6">
        {viewMode === "original" ? (
          <div className="relative flex flex-col items-center max-w-full">
            {/* Loading Overlay */}
            {loading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl py-20 min-w-[300px]">
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                  <span className="material-symbols-outlined animate-spin text-xl">
                    progress_activity
                  </span>
                  <span>Rendering Page {pageNumber}...</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Loading original NCERT textbook layout</p>
              </div>
            )}

            {/* Error Fallback */}
            {error && (
              <div className="p-8 text-center max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900 shadow-sm space-y-3 my-12">
                <span className="material-symbols-outlined text-rose-500 text-4xl">
                  warning
                </span>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{error}</p>
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      if (pdfDocRef.current) renderPage(pdfDocRef.current, pageNumber, scale);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                  >
                    Retry Render
                  </button>
                  <button
                    onClick={() => setViewMode("text")}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Switch to Text View
                  </button>
                </div>
              </div>
            )}

            {/* The Original Page Canvas */}
            <div className="bg-white shadow-2xl rounded-sm border border-slate-300/80 dark:border-slate-700 overflow-hidden transition-all">
              <canvas ref={canvasRef} className="block mx-auto" />
            </div>

            {/* Bottom Page Indicator Badge */}
            <div className="mt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm">
              Original NCERT Page {pageNumber} of {totalPages}
            </div>
          </div>
        ) : (
          /* Text View Fallback */
          <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm text-slate-800 dark:text-slate-200 font-serif leading-relaxed text-sm select-text space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <span className="font-sans font-bold text-xs uppercase tracking-wider text-emerald-600">
                Text View (Page {pageNumber})
              </span>
              <button
                onClick={() => setViewMode("original")}
                className="font-sans text-xs font-bold text-emerald-600 hover:underline"
              >
                Switch back to Original Page
              </button>
            </div>

            {extractedElements && extractedElements.length > 0 ? (
              extractedElements.map((el, idx) => {
                if (el.type === "heading") {
                  return (
                    <h3
                      key={idx}
                      className="font-sans font-bold text-base text-slate-900 dark:text-white pt-2 border-b border-slate-100 dark:border-slate-800 pb-1"
                    >
                      {el.content}
                    </h3>
                  );
                }
                if (el.type === "diagram_caption") {
                  return (
                    <div
                      key={idx}
                      className="my-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-emerald-950 dark:text-emerald-100 font-sans text-xs italic"
                    >
                      <span className="font-bold not-italic mr-1.5">Diagram / Caption:</span>
                      {el.content}
                    </div>
                  );
                }
                if (el.type === "formula") {
                  return (
                    <div
                      key={idx}
                      className="my-2 rounded bg-slate-100 dark:bg-slate-800 px-3 py-1.5 font-mono text-xs text-indigo-900 dark:text-indigo-200 overflow-x-auto"
                    >
                      {el.content}
                    </div>
                  );
                }
                if (el.type === "list") {
                  return (
                    <li key={idx} className="ml-4 list-disc pl-1 font-serif">
                      {el.content}
                    </li>
                  );
                }
                return (
                  <p key={idx} className="text-justify">
                    {el.content}
                  </p>
                );
              })
            ) : extractedText ? (
              extractedText.split("\n\n").map((para, idx) => (
                <p key={idx} className="text-justify">
                  {para}
                </p>
              ))
            ) : (
              <p className="text-slate-400 italic">No text content available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
