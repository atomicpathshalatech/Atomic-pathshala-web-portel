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
 * variation) and bucket-fill raster patches are skipped entirely — both
 * deliberate simplifications for a small identification thumbnail, not
 * fidelity bugs. Shapes reuse the exact same SHAPE_RENDERERS the real
 * canvas uses, so shape thumbnails are pixel-accurate at any scale.
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

export function renderPageThumbnail(
  ctx: CanvasRenderingContext2D,
  page: { background: string; objects: StrokeObject[] },
  canvasWidth: number,
  canvasHeight: number
): void {
  const scaleX = canvasWidth / VIRTUAL_WIDTH;
  const scaleY = canvasHeight / VIRTUAL_HEIGHT;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = isImageUrl(page.background) ? "#ffffff" : BACKGROUND_COLORS[page.background] ?? "#ffffff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

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
    }
    // RasterObject (bucket-fill patches) intentionally skipped — see file
    // header comment.
  }

  ctx.restore();
}
