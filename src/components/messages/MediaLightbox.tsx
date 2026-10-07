"use client";

import React, { useState } from "react";

export function MediaLightbox({
  mediaUrl,
  mediaType,
  mediaName,
  onClose,
}: {
  mediaUrl: string;
  mediaType: string;
  mediaName?: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);

  const zoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const resetZoom = () => setZoom(1);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      {/* Top Controls */}
      <div
        className="h-16 px-4 flex items-center justify-between text-white bg-black/40 backdrop-blur-sm z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate max-w-xs">{mediaName || "Media Preview"}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={zoomOut}
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center transition"
            title="Zoom out"
          >
            <span className="material-symbols-outlined">zoom_out</span>
          </button>

          <button
            type="button"
            onClick={zoomIn}
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center transition"
            title="Zoom in"
          >
            <span className="material-symbols-outlined">zoom_in</span>
          </button>

          <button
            type="button"
            onClick={resetZoom}
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center transition"
            title="Reset zoom"
          >
            <span className="material-symbols-outlined">restart_alt</span>
          </button>

          <a
            href={mediaUrl}
            download={mediaName || "media"}
            target="_blank"
            rel="noreferrer"
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center transition"
            title="Download"
          >
            <span className="material-symbols-outlined">download</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center transition"
            title="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {mediaType === "VIDEO" ? (
          <video
            src={mediaUrl}
            controls
            autoPlay
            className="max-h-[85vh] max-w-[90vw] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl}
            alt={mediaName || "Preview"}
            style={{ transform: `scale(${zoom})`, transition: "transform 0.15s ease-out" }}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl cursor-grab"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </div>
  );
}
