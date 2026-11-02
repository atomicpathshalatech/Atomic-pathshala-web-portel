"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const FRAME_W = 220;
const FRAME_H = 275; // 4:5 portrait, the card's photo frame
const OUT_W = 720;
const OUT_H = 900;
const MIN_SOURCE_W = 240; // the visible part of the original must be at least this many pixels wide
const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

type Loaded = { img: HTMLImageElement; url: string };

/**
 * Choose a photo, position and zoom it inside the card's portrait frame, and
 * upload the cropped result (a fresh JPEG — which also drops the original's
 * EXIF data, e.g. GPS location) to /api/profile/photo.
 */
export function IdPhotoUploader({ label = "Upload Profile Photo", compact = false }: { label?: string; compact?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => () => {
    if (loaded) URL.revokeObjectURL(loaded.url);
  }, [loaded]);

  const scale = loaded ? Math.max(FRAME_W / loaded.img.naturalWidth, FRAME_H / loaded.img.naturalHeight) * zoom : 1;

  const clamp = useCallback(
    (o: { x: number; y: number }, z = zoom) => {
      if (!loaded) return o;
      const s = Math.max(FRAME_W / loaded.img.naturalWidth, FRAME_H / loaded.img.naturalHeight) * z;
      const mx = Math.max(0, (loaded.img.naturalWidth * s - FRAME_W) / 2);
      const my = Math.max(0, (loaded.img.naturalHeight * s - FRAME_H) / 2);
      return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
    },
    [loaded, zoom]
  );

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setDone(false);
    if (!TYPES.includes(file.type)) return setError("Please choose a JPG, PNG or WEBP photo.");
    if (file.size > 15 * 1024 * 1024) return setError("This file is too large.");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth < MIN_SOURCE_W || img.naturalHeight < 300) {
        URL.revokeObjectURL(url);
        setError(`This photo is too small (${img.naturalWidth}×${img.naturalHeight}). Please use a clearer photo.`);
        return;
      }
      setLoaded({ img, url });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("This image could not be opened. Please try another photo.");
    };
    img.src = url;
  }

  async function upload() {
    if (!loaded) return;
    const visibleSourceW = FRAME_W / scale;
    if (visibleSourceW < MIN_SOURCE_W) return setError("Zoomed in too far — the photo would be blurry. Zoom out a little.");
    setBusy(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUT_W;
      canvas.height = OUT_H;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, OUT_W, OUT_H);
      const k = OUT_W / FRAME_W;
      const w = loaded.img.naturalWidth * scale;
      const h = loaded.img.naturalHeight * scale;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(loaded.img, (FRAME_W / 2 + offset.x - w / 2) * k, (FRAME_H / 2 + offset.y - h / 2) * k, w * k, h * k);
      let quality = 0.9;
      let blob: Blob | null = null;
      while (quality >= 0.6) {
        blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
        if (blob && blob.size <= MAX_BYTES) break;
        quality -= 0.1;
      }
      if (!blob) throw new Error("encode");
      const form = new FormData();
      form.append("photo", new File([blob], "id-photo.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/profile/photo", { method: "POST", body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error ?? "Could not upload this photo. Please try again.");
        return;
      }
      setLoaded(null);
      setDone(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "" : "space-y-3"}>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />

      {!loaded && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={
            compact
              ? "inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:opacity-80"
              : "inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-[#0f3a9e] hover:bg-[#0a2463] text-white shadow-md transition active:scale-95"
          }
        >
          <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
          {label}
        </button>
      )}

      {loaded && (
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 space-y-3 max-w-sm">
          <p className="text-sm font-bold text-on-surface">Position your photo</p>
          <p className="text-xs text-on-surface-variant">Drag to move, use the slider to zoom. Keep your face in the centre, like a passport photo.</p>
          <div
            className="relative mx-auto overflow-hidden rounded-xl border-[3px] border-[#1d4ed8] bg-slate-100 touch-none cursor-grab active:cursor-grabbing select-none"
            style={{ width: FRAME_W, height: FRAME_H }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              setOffset(clamp({ x: drag.current.ox + e.clientX - drag.current.x, y: drag.current.oy + e.clientY - drag.current.y }));
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL being cropped */}
            <img
              src={loaded.url}
              alt=""
              draggable={false}
              className="absolute max-w-none pointer-events-none"
              style={{
                width: loaded.img.naturalWidth * scale,
                height: loaded.img.naturalHeight * scale,
                left: FRAME_W / 2 + offset.x - (loaded.img.naturalWidth * scale) / 2,
                top: FRAME_H / 2 + offset.y - (loaded.img.naturalHeight * scale) / 2,
              }}
            />
            {/* face guide */}
            <div className="absolute left-1/2 top-[14%] -translate-x-1/2 w-[58%] h-[56%] rounded-[50%] border-2 border-dashed border-white/80 pointer-events-none" />
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => {
              const z = Number(e.target.value);
              setZoom(z);
              setOffset((o) => clamp(o, z));
            }}
            className="w-full accent-[#1d4ed8]"
            aria-label="Zoom"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={upload}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#0f3a9e] hover:bg-[#0a2463] text-white disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-[18px] ${busy ? "animate-spin" : ""}`}>{busy ? "progress_activity" : "check"}</span>
              {busy ? "Uploading…" : "Save photo"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl text-sm font-bold border border-outline-variant text-on-surface hover:bg-surface-container disabled:opacity-60"
            >
              Choose another
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setLoaded(null)}
              className="px-3 py-2.5 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-error font-semibold">{error}</p>}
      {done && !error && <p className="text-sm text-emerald-700 font-semibold">Photo saved.</p>}
    </div>
  );
}
