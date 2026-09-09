"use client";

import { useEffect } from "react";

/**
 * Lightweight full-screen PDF reader. Embeds the file via the browser's
 * native PDF viewer (`<iframe>` of the `inline` file URL) — smooth scroll
 * and pinch-zoom on mobile, nothing to load. "Download" hits the same route
 * with `?download=1`, which redirects to a presigned URL served as
 * `attachment`, so the file is saved to the device with no print dialog.
 */
export function PdfViewerModal({
  materialId,
  title,
  allowDownload,
  onClose,
}: {
  materialId: string;
  title: string;
  allowDownload: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const src = `/api/study-material/${materialId}/file`;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10 text-white">
        <span className="material-symbols-outlined text-red-400">picture_as_pdf</span>
        <h2 className="text-sm font-bold truncate flex-1">{title}</h2>
        {allowDownload && (
          <a
            href={`${src}?download=1`}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 transition"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Save to device
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/20 hover:bg-white/10 text-white text-xs font-bold px-3 py-1.5"
        >
          Close
        </button>
      </div>
      <iframe src={src} title={title} className="flex-1 w-full bg-white" />
    </div>
  );
}
