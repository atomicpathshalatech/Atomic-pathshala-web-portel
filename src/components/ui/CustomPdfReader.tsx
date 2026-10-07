"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

export interface CustomPdfReaderProps {
  title: string;
  pdfUrl: string;
  fileName?: string;
  allowDownload?: boolean;
  isOpen: boolean;
  onClose: () => void;
  totalPages?: number | null;
}

export function CustomPdfReader({
  title,
  pdfUrl,
  fileName,
  allowDownload = true,
  isOpen,
  onClose,
  totalPages,
}: CustomPdfReaderProps) {
  const [zoom, setZoom] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset state when opening a new document
  useEffect(() => {
    if (isOpen) {
      setZoom(100);
      setPage(1);
      setLoading(true);
      const timer = setTimeout(() => setLoading(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isOpen, pdfUrl]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        if (isFullscreen) {
          document.exitFullscreen?.().catch(() => {});
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isFullscreen, onClose]);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  }, []);

  if (!isOpen) return null;

  // Append hash parameters to guide built-in PDF renderer
  const formattedUrl = `${pdfUrl}${pdfUrl.includes("#") ? "" : "#toolbar=0&navpanes=0&scrollbar=1"}`;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[100] flex flex-col bg-slate-950/95 backdrop-blur-md animate-fade-in select-none text-white ${
        isFullscreen ? "w-screen h-screen" : ""
      }`}
    >
      {/* Top Navigation & Controls Bar */}
      <header className="h-14 sm:h-16 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 shadow-lg">
        {/* Left: Back / Close button & Document Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition shrink-0"
            title="Close document (Esc)"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white truncate">{title}</h2>
            <p className="text-[11px] text-slate-400 truncate">
              {fileName || "Atomic Document"}
              {totalPages ? ` · ${totalPages} pages` : ""}
            </p>
          </div>
        </div>

        {/* Center: Zoom Controls */}
        <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(50, z - 15))}
            className="w-7 h-7 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition"
            title="Zoom out"
          >
            <span className="material-symbols-outlined text-base">remove</span>
          </button>
          <span className="text-xs font-mono font-bold px-1 min-w-[48px] text-center text-slate-200">
            {zoom}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(200, z + 15))}
            className="w-7 h-7 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition"
            title="Zoom in"
          >
            <span className="material-symbols-outlined text-base">add</span>
          </button>
          <button
            type="button"
            onClick={() => setZoom(100)}
            className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded hover:bg-slate-700/60"
            title="Reset to 100%"
          >
            Reset
          </button>
        </div>

        {/* Right: Actions (Open New Tab, Download if permitted, Fullscreen, Close) */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition flex items-center gap-1.5 border border-slate-700/60"
            title="Open in new browser tab"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            <span className="hidden sm:inline">Open in Tab</span>
          </a>

          {allowDownload ? (
            <a
              href={pdfUrl}
              download={fileName || "document.pdf"}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Download PDF"
            >
              <span className="material-symbols-outlined text-base">download</span>
              <span className="hidden sm:inline">Download</span>
            </a>
          ) : (
            <span
              className="px-2.5 py-1 rounded-xl bg-slate-800/60 border border-slate-700/40 text-slate-400 text-[10px] font-semibold flex items-center gap-1"
              title="Download is disabled for this material"
            >
              <span className="material-symbols-outlined text-xs">lock</span>
              <span className="hidden sm:inline">View Only</span>
            </span>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition shrink-0"
            title="Toggle fullscreen"
          >
            <span className="material-symbols-outlined text-lg">
              {isFullscreen ? "fullscreen_exit" : "fullscreen"}
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition shrink-0"
            title="Close viewer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      </header>

      {/* Main Document Display Canvas Area */}
      <main className="flex-1 relative overflow-auto flex items-center justify-center p-2 sm:p-4 bg-slate-950">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 gap-3">
            <div className="w-10 h-10 border-4 border-blue-600/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-300">Loading document…</p>
          </div>
        )}

        <div
          className="w-full h-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl bg-white border border-slate-800 flex items-center justify-center transition-transform duration-150"
          style={{
            transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
            transformOrigin: "top center",
          }}
        >
          <object
            data={formattedUrl}
            type="application/pdf"
            className="w-full h-full rounded-2xl"
            onLoad={() => setLoading(false)}
          >
            <iframe
              src={formattedUrl}
              title={title}
              className="w-full h-full border-0 rounded-2xl"
              onLoad={() => setLoading(false)}
            >
              <div className="p-8 text-center text-slate-800 flex flex-col items-center justify-center gap-4">
                <span className="material-symbols-outlined text-5xl text-blue-600">picture_as_pdf</span>
                <p className="font-bold text-base">{title}</p>
                <div className="flex items-center gap-3">
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow"
                  >
                    Open PDF in New Tab
                  </a>
                  {allowDownload && (
                    <a
                      href={pdfUrl}
                      download={fileName || "document.pdf"}
                      className="px-4 py-2 bg-slate-100 text-slate-800 rounded-xl text-sm font-bold border border-slate-300"
                    >
                      Download PDF
                    </a>
                  )}
                </div>
              </div>
            </iframe>
          </object>
        </div>
      </main>

      {/* Bottom Floating Information Bar */}
      <footer className="h-10 px-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Atomic Pathshala PDF Engine</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Protected Educational Material</span>
          {allowDownload ? (
            <span className="text-emerald-400">Download Permitted</span>
          ) : (
            <span className="text-amber-400">Download Restricted</span>
          )}
        </div>
      </footer>
    </div>
  );
}
