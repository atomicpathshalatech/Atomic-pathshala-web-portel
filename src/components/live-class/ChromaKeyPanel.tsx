"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChromaKeyer,
  DEFAULT_CHROMA,
  detectKeyColor,
  sanitizeChroma,
  type ChromaSettings,
} from "@/lib/live-class/chroma-key";

/**
 * Green-screen settings for the teacher, with a live preview of exactly what
 * students will see (the same GPU keyer the class video uses). Changes apply
 * to the class stream immediately.
 */
export function ChromaKeyPanel({
  value,
  onChange,
  onClose,
}: {
  value: ChromaSettings;
  onChange: (next: ChromaSettings) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [autoNote, setAutoNote] = useState<string | null>(null);

  // Live preview: this device's camera → keyer → over a board-like background.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    const keyer = new ChromaKeyer();
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 360 } }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play().catch(() => undefined);
        }
      })
      .catch((err) => setCameraError(err instanceof Error ? err.message : "Camera unavailable"));
    const draw = () => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (v && c && v.readyState >= 2 && v.videoWidth > 0) {
        const ctx = c.getContext("2d");
        if (ctx) {
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          // board-like background so edges and spill are easy to judge
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.fillStyle = "#e2e8f0";
          for (let y = 24; y < c.height; y += 24) ctx.fillRect(0, y, c.width, 1);
          const s = valueRef.current;
          if (s.enabled && keyer.supported) {
            keyer.setSettings(s);
            const keyed = keyer.process(v, v.videoWidth, v.videoHeight);
            if (keyed) ctx.drawImage(keyed, 0, 0);
          } else {
            ctx.drawImage(v, 0, 0);
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const set = (patch: Partial<ChromaSettings>) => onChange(sanitizeChroma({ ...value, ...patch }));

  const autoDetect = () => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    const color = detectKeyColor(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
    if (color) {
      set({ keyColor: color, enabled: true });
      setAutoNote(`Screen colour set to ${color}`);
    } else {
      setAutoNote("Couldn't find a coloured screen at the edges of the camera picture.");
    }
    setTimeout(() => setAutoNote(null), 3000);
  };

  const slider = (label: string, key: keyof ChromaSettings, min: number, max: number, step: number, hint: string) => (
    <label className="block" title={hint}>
      <div className="flex items-center justify-between text-[11px] text-slate-300">
        <span>{label}</span>
        <span className="font-mono text-slate-400">{Number(value[key]).toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number(value[key])}
        onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<ChromaSettings>)}
        className="w-full accent-emerald-500"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-3 bg-black/30" onClick={onClose}>
      <div
        className="w-[360px] max-w-full max-h-[92vh] overflow-y-auto rounded-xl border border-slate-700 bg-[#141620] p-3 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Green screen (chroma key)</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" title="Close">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-black aspect-video">
          <video ref={videoRef} muted playsInline className="hidden" />
          <canvas ref={canvasRef} className="w-full h-full object-contain -scale-x-100" />
          {cameraError && (
            <p className="absolute inset-0 flex items-center justify-center text-[11px] text-rose-300 p-3 text-center">
              Preview unavailable: {cameraError}
            </p>
          )}
        </div>
        <p className="mt-1 text-[10px] text-slate-500">Preview = what students see (over a white board).</p>

        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={value.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="accent-emerald-500" />
            Remove screen behind me
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={value.keyColor}
              onChange={(e) => set({ keyColor: e.target.value })}
              className="w-7 h-7 rounded border border-slate-600 bg-transparent cursor-pointer"
              title="Screen colour"
            />
            <button type="button" onClick={autoDetect} className="text-[11px] px-2 py-1 rounded border border-slate-600 hover:bg-slate-700">
              Auto-detect
            </button>
          </div>
        </div>
        {autoNote && <p className="mt-1 text-[11px] text-emerald-300">{autoNote}</p>}

        <div className="mt-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Key</p>
          {slider("Similarity", "similarity", 0, 1, 0.01, "How far from the screen colour still gets removed. Raise if patches of the screen remain.")}
          {slider("Smoothness", "smoothness", 0, 1, 0.01, "Softness of the edges (hair, shoulders).")}
          {slider("Spill removal", "spill", 0, 1, 0.01, "Removes the green glow on your skin and edges.")}
          {slider("Denoise", "denoise", 0, 3, 1, "For grainy / low-quality cameras: judges each pixel by its neighbours.")}
          <p className="pt-1 text-[10px] uppercase tracking-wider text-slate-500">Low light</p>
          {slider("Brightness", "brightness", -0.5, 0.5, 0.01, "Lift a dark room before keying.")}
          {slider("Contrast", "contrast", 0.5, 2, 0.01, "Separate you from a dull screen.")}
          {slider("Shadows (gamma)", "gamma", 0.5, 2.5, 0.01, "Above 1 brightens shadows without blowing out highlights.")}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={() => onChange({ ...DEFAULT_CHROMA, enabled: value.enabled })} className="text-[11px] text-slate-400 hover:text-white">
            Reset to defaults
          </button>
          <button type="button" onClick={onClose} className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
