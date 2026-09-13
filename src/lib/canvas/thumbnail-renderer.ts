/**
 * Lightweight, standalone renderer for the slide-preview panel's thumbnails
 * (Live Board spec Parts 16-19). Deliberately NOT a reuse of CanvasEngine's
 * own draw methods — those are private instance methods on a class that
 * expects a real, pointer-listening DOM canvas, not a cheap one-shot render
 * target. This renders straight from the same StrokeObject[] data every
 * page already has, at whatever small size the thumbnail canvas is, so it
 * never touches the live engine, never risks a stale/duplicate pointer
 * listener, and is cheap enough to run for every visible thumbnail without
 * a caching layer (a handful of simple ctx calls on a ~160x90 canvas).
 *
 * Freehand strokes render as a plain polyline (no pressure/pen-style
 * variation) — a deliberate simplification for a small identification
 * thumbnail, not a fidelity bug. Shapes reuse the exact same
 * SHAPE_RENDERERS the real canvas uses, so shape thumbnails are
 * pixel-accurate at any scale.
 *
 * Image content (an uploaded/rendered-PDF background, or a pasted/
 * bucket-fill RasterObject) can't be drawn synchronously — the browser has
 * to load it first. A module-level cache keyed by URL means a background
 * shared across many pages (the common "Load Presentation" case) only ever
 * loads once; `renderPageThumbnail` draws whatever's already cached
 * immediately, and calls `onAsyncContentReady` once per newly-loaded image
 * so the caller can re-render with it included instead of leaving a
 * permanently blank thumbnail.
 */
import type { StrokeObject } from "./canvas-engine";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from "./canvas-engine";
import { SHAPE_RENDERERS } from "./shapes/registry";

const BACKGROUND_COLORS: Record<string, string> = {
  blank: "#ffffff",
  white: "#ffffff",
  dark: "#12131c",
  light: "#f8f9fb",
  grid: "#ffffff",
  ruled: "#ffffff",
  dotted: "#ffffff",
  coordinate: "#ffffff",
};

function isImageUrl(background: string): boolean {
  return /^https?:\/\//.test(background) || background.startsWith("data:image");
}

type CachedImage = { status: "loading" | "loaded" | "failed"; img: HTMLImageElement };
const imageCache = new Map<string, CachedImage>();

/** Returns the image immediately if already loaded/failed, and kicks off
 * loading (once per URL, cached) otherwise — `onReady` fires exactly once
 * when a load this call triggered (or was already in flight) settles. */
function getOrLoadImage(src: string, onReady: () => void): CachedImage {
  const existing = imageCache.get(src);
  if (existing) {
    if (existing.status !== "loading") return existing;
    existing.img.addEventListener("load", onReady, { once: true });
    existing.img.addEventListener("error", onReady, { once: true });
    return existing;
  }

  const img = new Image();
  const entry: CachedImage = { status: "loading", img };
  imageCache.set(src, entry);
  img.addEventListener(
    "load",
    () => {
      entry.status = "loaded";
      onReady();
    },
    { once: true }
  );
  img.addEventListener(
    "error",
    () => {
      entry.status = "failed";
      onReady();
    },
    { once: true }
  );
  img.src = src;
  return entry;
}

/** Draws `img` scaled to fit inside [x,y,w,h] preserving aspect ratio and
 * centered — matches the live board's own `object-contain` treatment of an
 * image background (TeacherLiveClassRoom.tsx). */
function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  if (!img.naturalWidth || !img.naturalHeight) return;
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
}

export function renderPageThumbnail(
  ctx: CanvasRenderingContext2D,
  page: { background: string; objects: StrokeObject[] },
  canvasWidth: number,
  canvasHeight: number,
  onAsyncContentReady?: () => void
): void {
  const scaleX = canvasWidth / VIRTUAL_WIDTH;
  const scaleY = canvasHeight / VIRTUAL_HEIGHT;
  const backgroundIsImage = isImageUrl(page.background);

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = backgroundIsImage ? "#ffffff" : BACKGROUND_COLORS[page.background] ?? "#ffffff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  if (backgroundIsImage) {
    const entry = getOrLoadImage(page.background, () => onAsyncContentReady?.());
    if (entry.status === "loaded") drawContain(ctx, entry.img, 0, 0, canvasWidth, canvasHeight);
  }

  ctx.save();
  ctx.scale(scaleX, scaleY);

  for (const obj of page.objects) {
    if (obj.type === "stroke") {
      if (obj.points.length < 2) continue;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = Math.max(1 / Math.min(scaleX, scaleY), obj.tool === "highlighter" ? obj.size * 3.5 : obj.size);
      ctx.globalAlpha = obj.tool === "highlighter" ? 0.45 : 1;
      ctx.beginPath();
      ctx.moveTo(obj.points[0]!.x, obj.points[0]!.y);
      for (let i = 1; i < obj.points.length; i++) ctx.lineTo(obj.points[i]!.x, obj.points[i]!.y);
      ctx.stroke();
      ctx.restore();
    } else if (obj.type === "shape") {
      const renderer = SHAPE_RENDERERS[obj.shape];
      renderer?.({ ctx, start: obj.start, end: obj.end, color: obj.color, size: obj.size, fill: obj.fill });
    } else if (obj.type === "text") {
      ctx.save();
      ctx.fillStyle = obj.color;
      ctx.font = `${obj.size}px "Segoe UI", system-ui, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(obj.text, obj.position.x, obj.position.y);
      ctx.restore();
    } else if (obj.type === "raster") {
      const entry = getOrLoadImage(obj.dataUrl, () => onAsyncContentReady?.());
      if (entry.status === "loaded") ctx.drawImage(entry.img, obj.x, obj.y, obj.width, obj.height);
    }
  }

  ctx.restore();
}
