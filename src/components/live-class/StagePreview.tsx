"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { StageCompositor, type CameraShape } from "@/lib/live-class/stage-compositor";

/**
 * Live preview of the composed class video — exactly what the desktop
 * app's encoder sends to YouTube: board, slide background and camera in one
 * 1920×1080 frame. Floating, closable panel inside the teacher room.
 */
export function StagePreview({
  baseCanvas,
  activeCanvas,
  stageContainer,
  background,
  cameraShape,
  cameraPosition,
  onClose,
}: {
  baseCanvas: RefObject<HTMLCanvasElement>;
  activeCanvas: RefObject<HTMLCanvasElement>;
  stageContainer: RefObject<HTMLDivElement>;
  background: string | undefined;
  cameraShape: string | null | undefined;
  cameraPosition: string | null | undefined;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const compositorRef = useRef<StageCompositor | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let compositor: StageCompositor | null = null;
    try {
      compositor = new StageCompositor({ width: 1920, height: 1080, fps: 30 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stage preview is not supported here.");
      return;
    }
    compositorRef.current = compositor;
    compositor
      .start({ camera: true, microphone: false })
      .then((stream) => {
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => undefined);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    const warn = setInterval(() => {
      if (compositor) setWarnings([...compositor.warnings]);
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(warn);
      compositor?.stop();
      compositorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const compositor = compositorRef.current;
    if (!compositor) return;
    const layers = [baseCanvas.current, activeCanvas.current].filter((c): c is HTMLCanvasElement => Boolean(c));
    const container = stageContainer.current;
    const bgColor = container ? getComputedStyle(container).backgroundColor : null;
    compositor.setSources({
      boardLayers: layers,
      backgroundColor: bgColor && bgColor !== "rgba(0, 0, 0, 0)" ? bgColor : "#ffffff",
      backgroundImageUrl: background && /^https?:\/\//.test(background) ? background : null,
      cameraShape: (cameraShape === "SQUARE" ? "SQUARE" : "CIRCULAR") as CameraShape,
      cameraPosition: cameraPosition || "UPPER_RIGHT",
      showCamera: true,
    });
  });

  return (
    <div className="fixed bottom-24 right-6 z-40 w-[400px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-700 bg-[#0d0e17]/95 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-white">Stage preview</p>
          <p className="text-[10px] text-slate-400">What YouTube receives (1920×1080, 30 fps)</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Close stage preview"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
      <div className="p-2">
        {error ? (
          <p className="p-3 text-xs text-rose-300">{error}</p>
        ) : (
          <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-md bg-black" data-testid="stage-preview-video" />
        )}
        {warnings.length > 0 && (
          <ul className="mt-2 space-y-1 text-[10px] text-amber-300">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
