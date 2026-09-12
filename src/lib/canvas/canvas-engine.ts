/**
 * Vector canvas engine for the live teaching whiteboard.
 *
 * Design notes (why it's built this way):
 * - Two stacked canvases: `base` holds every committed stroke, `active` holds
 *   only the in-progress stroke. Drawing only ever repaints `active` on
 *   pointermove — `base` repaints once per commit, not per pointer event.
 *   This is what keeps this smooth at high pointer-event rates instead of
 *   redrawing the whole board 100+ times a second.
 * - Strokes are stored as vector point arrays (StrokeObject), not pixels —
 *   this is what pages/autosave persist to Postgres as JSON, and it's what
 *   lets undo/redo, the eraser, and future export-to-PDF all work on
 *   structured data instead of bitmap diffing.
 * - No React state touches this per pointer event. React only re-renders
 *   when a stroke is *committed* (via the onCommit callback), which is at
 *   most once per pen-up, not per pixel of movement.
 * - Zoom/pan are deliberately NOT handled here — they're a CSS transform on
 *   the wrapping element in the React layer. Coordinates are read via
 *   getBoundingClientRect() ratios, which stay correct under any CSS
 *   transform or devicePixelRatio without this class needing to know about
 *   either.
 * - `StrokeObject` is a discriminated union: freehand ink (`type: "stroke"`,
 *   the original shape) plus `type: "shape"` for the line/rectangle/circle/
 *   triangle/arrow tools. Anything that used to assume every object had
 *   `.points` (hit-testing, drag-select, the partial eraser, cloning) is
 *   routed through the representativePoints()/translateObject()/
 *   firstPoint() helpers below so both variants work through one code path
 *   instead of two parallel systems.
 */

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface FreehandObject {
  id: string;
  type: "stroke";
  tool: "pen" | "highlighter";
  color: string;
  size: number;
  points: StrokePoint[];
  /** Which pen style this stroke was drawn with — kept per-stroke so
   * switching the active pen later never restyles old strokes. One of the
   * PEN_STYLES ids (hard | fountain | chisel | art | graphite | magic);
   * absent / unknown renders as "hard". Highlighter ignores this. */
  penStyle?: string;
}

export type ShapeKind = "line" | "rectangle" | "circle" | "triangle" | "arrow";

export interface ShapeObject {
  id: string;
  type: "shape";
  shape: ShapeKind;
  color: string;
  size: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
  fill?: string;
}

export interface TextObject {
  id: string;
  type: "text";
  text: string;
  color: string;
  /** Font size in virtual (1920x1080) pixels — independent of the pen
   * tool's stroke-width `currentSize`; see TEXT_FONT_SCALE below for how a
   * caller derives one from the other. */
  size: number;
  /** Top-left corner, virtual coordinates. */
  position: { x: number; y: number };
  /** Measured bounding box (virtual px) — cached at create/edit time via
   * measureText() so hit-testing/selection/eraser don't need a live 2D
   * context and stay in sync with whatever was actually rendered. */
  width: number;
  height: number;
}

/** A cropped, pre-rendered bitmap patch — currently produced only by the
 * bucket tool's flood fill (see fillAtPoint/floodFillImageData below). It's
 * a plain image overlay (PNG data URL + placement rect in virtual px), not
 * a vector shape, but it goes through the exact same objects/undo/onCommit
 * pipeline as every other object so fill/undo/redo/autosave/export all keep
 * working without special-casing it at the call sites. */
export interface RasterObject {
  id: string;
  type: "raster";
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type StrokeObject = FreehandObject | ShapeObject | TextObject | RasterObject;

export type CanvasTool =
  | "pen"
  | "highlighter"
  | "laser"
  | "stroke-eraser"
  | "object-eraser"
  | "select"
  | "text"
  | "fill"
  | ShapeKind;

/** Eraser brush radii (virtual px) for the S / M / L / XL presets. */
export const ERASER_SIZES: { id: "S" | "M" | "L" | "XL"; label: string; radius: number }[] = [
  { id: "S", label: "S", radius: 14 },
  { id: "M", label: "M", radius: 26 },
  { id: "L", label: "L", radius: 44 },
  { id: "XL", label: "XL", radius: 68 },
];

/** How long a laser stroke stays on screen before it has fully faded (ms) —
 * long enough for the blink-then-fade lifecycle in laserOpacityAt() below
 * to actually read as distinct phases rather than a single quick flash. */
export const LASER_DURATION_MS = 2800;

/**
 * Laser-pointer opacity over its lifetime, `t` in [0, 1] (age / DURATION):
 * visible → 1-2 sharp blinks → slower/lighter blinking → smooth fade → gone.
 * Piecewise so each phase is easy to retune independently:
 *   [0.00, 0.35) — 2 sharp on/off blinks (square wave, not a smooth fade —
 *                  these should read as distinct flashes).
 *   [0.35, 0.70) — continues blinking, but slower (one full cycle instead
 *                  of two) and lighter (bounded further from full opacity).
 *   [0.70, 1.00] — no more blinking, smooth quadratic fade to fully gone.
 */
function laserOpacityAt(t: number): number {
  if (t < 0.35) {
    const cyclePos = (t / 0.35) * 2; // 2 blinks across this phase
    return cyclePos % 1 < 0.5 ? 1 : 0.2;
  }
  if (t < 0.7) {
    const localT = (t - 0.35) / 0.35;
    const wave = (Math.sin(localT * Math.PI * 2 - Math.PI / 2) + 1) / 2; // 0..1, starts low
    return 0.35 + wave * 0.45; // stays within [0.35, 0.8] — lighter than phase 1
  }
  const fadeT = (t - 0.7) / 0.3;
  return Math.max(0, 1 - fadeT * fadeT) * 0.6; // tail off from phase 2's ceiling to 0
}

/** Font-size (virtual px) per unit of the shared pen `currentSize` control,
 * so the same S/M/L size preset used for pen width gives sensible, readable
 * text sizes on the 1920x1080 virtual canvas. */
export const TEXT_FONT_SCALE = 8;

const SHAPE_TOOLS: ShapeKind[] = ["line", "rectangle", "circle", "triangle", "arrow"];
function isShapeTool(tool: CanvasTool): tool is ShapeKind {
  return (SHAPE_TOOLS as string[]).includes(tool);
}

// Below this drag distance (px), a shape commit is treated as an accidental
// click rather than an intentional zero-size shape — mirrors the freehand
// path's `activePoints.length > 1` guard, just for the shape tools.
const MIN_SHAPE_DRAG = 3;

/** Standard 16:9 virtual canvas coordinate system so every device
 * (teacher, student desktop, student tablet/mobile) sees the exact same
 * slide size and stroke positioning. */
export const VIRTUAL_WIDTH = 1920;
export const VIRTUAL_HEIGHT = 1080;

const SELECT_HIT_RADIUS = 18;

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Ray-casting point-in-polygon test — used by the lasso to decide which
 * objects fall inside the drawn selection loop. */
function pointInPolygon(pt: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Points used for hit-testing, selection bounding boxes, and the partial
 * eraser. For freehand strokes this is every recorded point; for shapes it's
 * a small set of boundary samples — enough to click/erase near the outline,
 * though (like the freehand eraser) it's an outline test, not a fill test. */
function representativePoints(obj: StrokeObject): { x: number; y: number }[] {
  if (obj.type === "stroke") return obj.points;
  if (obj.type === "text" || obj.type === "raster") {
    const { x, y } = obj.type === "text" ? obj.position : obj;
    const { width, height } = obj;
    return [
      { x, y },
      { x: x + width, y },
      { x, y: y + height },
      { x: x + width, y: y + height },
      { x: x + width / 2, y: y + height / 2 },
    ];
  }
  const { start, end, shape } = obj;
  switch (shape) {
    case "line":
    case "arrow":
      return [start, end, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }];
    case "rectangle": {
      const { x: x1, y: y1 } = start;
      const { x: x2, y: y2 } = end;
      return [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x1, y: y2 },
        { x: x2, y: y2 },
        { x: (x1 + x2) / 2, y: y1 },
        { x: (x1 + x2) / 2, y: y2 },
        { x: x1, y: (y1 + y2) / 2 },
        { x: x2, y: (y1 + y2) / 2 },
      ];
    }
    case "circle": {
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 16; i++) {
        const angle = (Math.PI * 2 * i) / 16;
        pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
      }
      return pts;
    }
    case "triangle":
      return [{ x: (start.x + end.x) / 2, y: start.y }, { x: start.x, y: end.y }, { x: end.x, y: end.y }];
  }
}

function firstPoint(obj: StrokeObject): { x: number; y: number } | undefined {
  if (obj.type === "stroke") return obj.points[0];
  if (obj.type === "text") return obj.position;
  if (obj.type === "raster") return { x: obj.x, y: obj.y };
  return obj.start;
}

function translateObject(obj: StrokeObject, dx: number, dy: number): StrokeObject {
  if (obj.type === "stroke") {
    return { ...obj, points: obj.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
  }
  if (obj.type === "text") {
    return { ...obj, position: { x: obj.position.x + dx, y: obj.position.y + dy } };
  }
  if (obj.type === "raster") {
    return { ...obj, x: obj.x + dx, y: obj.y + dy };
  }
  return {
    ...obj,
    start: { x: obj.start.x + dx, y: obj.start.y + dy },
    end: { x: obj.end.x + dx, y: obj.end.y + dy },
  };
}

/** Exact (unpadded) bounds of an object's own geometry — the correct
 * reference for resize math (anchor point + original size ratio). Kept
 * separate from getBoundingBox()'s padded version (used for drawing/
 * hit-testing the selection box) because using the padded box as the resize
 * anchor made every resize drag end with the object's true edge a few
 * pixels away from the pointer — small and easy to miss on a large
 * freehand stroke, but very visible on a small text object (see
 * getResizeAnchor() below, used for the actual scale-ratio math). */
function getUnpaddedBounds(obj: StrokeObject): { minX: number; minY: number; maxX: number; maxY: number } {
  const pts = representativePoints(obj);
  if (pts.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function getBoundingBox(obj: StrokeObject): { minX: number; minY: number; maxX: number; maxY: number } {
  const b = getUnpaddedBounds(obj);
  return { minX: b.minX - 8, minY: b.minY - 8, maxX: b.maxX + 8, maxY: b.maxY + 8 };
}

function scaleObject(
  obj: StrokeObject,
  scaleX: number,
  scaleY: number,
  origin: { x: number; y: number },
  measureText?: (text: string, sizePx: number) => { width: number; height: number }
): StrokeObject {
  if (obj.type === "stroke") {
    return {
      ...obj,
      points: obj.points.map((p) => ({
        ...p,
        x: origin.x + (p.x - origin.x) * scaleX,
        y: origin.y + (p.y - origin.y) * scaleY,
      })),
    };
  }
  if (obj.type === "text") {
    const scale = Math.max(0.2, (scaleX + scaleY) / 2);
    const size = Math.max(8, Math.round(obj.size * scale));
    // Re-measure at the new font size instead of independently scaling the
    // stored width/height by scaleX/scaleY — drawText() only ever uses
    // `size` to render, so scaling width/height on their own let the
    // selection box drift away from what was actually drawn on a
    // non-uniform drag (the "distorts" symptom). Re-measuring keeps the box
    // exactly matched to the real rendered text, same as addTextObject/
    // updateTextObject already do.
    const { width, height } = measureText
      ? measureText(obj.text, size)
      : { width: Math.max(10, Math.round(obj.width * scaleX)), height: Math.max(10, Math.round(obj.height * scaleY)) };
    return {
      ...obj,
      position: {
        x: origin.x + (obj.position.x - origin.x) * scaleX,
        y: origin.y + (obj.position.y - origin.y) * scaleY,
      },
      size,
      width,
      height,
    };
  }
  if (obj.type === "raster") {
    return {
      ...obj,
      x: origin.x + (obj.x - origin.x) * scaleX,
      y: origin.y + (obj.y - origin.y) * scaleY,
      width: Math.max(4, Math.round(obj.width * scaleX)),
      height: Math.max(4, Math.round(obj.height * scaleY)),
    };
  }
  return {
    ...obj,
    start: {
      x: origin.x + (obj.start.x - origin.x) * scaleX,
      y: origin.y + (obj.start.y - origin.y) * scaleY,
    },
    end: {
      x: origin.x + (obj.end.x - origin.x) * scaleX,
      y: origin.y + (obj.end.y - origin.y) * scaleY,
    },
  };
}

/** Renders one shape (committed or in-progress preview) onto a context.
 * Math ported from src/components/shared/WhiteboardCanvas.tsx's shape
 * branches — that component proved these paths out first; this reuses them
 * rather than re-deriving the geometry a second time. */
function drawShape(
  ctx: CanvasRenderingContext2D,
  obj: { shape: ShapeKind; color: string; size: number; start: { x: number; y: number }; end: { x: number; y: number }; fill?: string }
): void {
  const { start, end, shape, color, size, fill } = obj;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = size;

  if (shape === "line") {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  } else if (shape === "rectangle") {
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(start.x, start.y, end.x - start.x, end.y - start.y);
    }
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
  } else if (shape === "circle") {
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  } else if (shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo((start.x + end.x) / 2, start.y);
    ctx.lineTo(start.x, end.y);
    ctx.lineTo(end.x, end.y);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  } else if (shape === "arrow") {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLen = 8 + size * 2;
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 7), end.y - headLen * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 7), end.y - headLen * Math.sin(angle + Math.PI / 7));
    ctx.closePath();
    ctx.fillStyle = fill || color;
    ctx.fill();
  }
  ctx.restore();
}

function isInsideShape(obj: ShapeObject, pt: { x: number; y: number }): boolean {
  const { start, end, shape } = obj;
  if (shape === "rectangle") {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
  }
  if (shape === "circle") {
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    if (rx === 0 || ry === 0) return false;
    const normX = (pt.x - cx) / rx;
    const normY = (pt.y - cy) / ry;
    return normX * normX + normY * normY <= 1;
  }
  if (shape === "triangle") {
    const p1 = { x: (start.x + end.x) / 2, y: start.y };
    const p2 = { x: start.x, y: end.y };
    const p3 = { x: end.x, y: end.y };
    const d1 = (pt.x - p2.x) * (p1.y - p2.y) - (p1.x - p2.x) * (pt.y - p2.y);
    const d2 = (pt.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (pt.y - p3.y);
    const d3 = (pt.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (pt.y - p1.y);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }
  return false;
}

export function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255, a: 255 };
}

/**
 * Scanline flood fill over already-rendered canvas pixels — this is what
 * makes the bucket tool work on ANY closed region (freehand pen loops,
 * mixed strokes+shapes+text), not just the three shape primitives handled
 * separately in fillAtPoint(). Any non-matching pixel (a stroke, a shape
 * outline, a text glyph) acts as a boundary automatically; no separate
 * "is this a closed path" geometry check is needed.
 *
 * Mutates `imageData.data` in place for the pixels it fills. Returns the
 * bounding box of the filled region, or `null` if:
 *   - the clicked pixel is already the fill color (nothing to do), or
 *   - the fill "leaked" — it reached the canvas edge, or grew past
 *     `maxFillPixels` — meaning the region wasn't actually closed. Either
 *     way the caller should discard the (already-mutated) ImageData rather
 *     than use it, so an open boundary never silently colors the whole
 *     board and never runs long enough to freeze the tab.
 */
export function floodFillImageData(
  imageData: ImageData,
  startX: number,
  startY: number,
  fillColor: { r: number; g: number; b: number; a: number },
  tolerance = 32,
  // Not a "stay small" cap — the scanline fill below is O(pixels visited)
  // with cheap per-pixel work, so even filling the entire 1920x1080 canvas
  // in one pass is fast (tens of ms), not a freeze risk. This only exists
  // as a hard backstop against a truly pathological input; the real
  // open-boundary signal is `leaked` (the fill reaching any canvas edge),
  // checked independently below. Defaulting this to the full canvas size
  // means it should essentially never be the reason a fill is rejected.
  maxFillPixels = imageData.width * imageData.height
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const { width, height, data } = imageData;
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return null;

  const startIdx = (sy * width + sx) * 4;
  const tR = data[startIdx]!, tG = data[startIdx + 1]!, tB = data[startIdx + 2]!, tA = data[startIdx + 3]!;
  const dr0 = tR - fillColor.r, dg0 = tG - fillColor.g, db0 = tB - fillColor.b, da0 = tA - fillColor.a;
  if (Math.sqrt(dr0 * dr0 + dg0 * dg0 + db0 * db0 + da0 * da0) < 2) return null; // already this color

  const matches = (x: number, y: number): boolean => {
    const i = (y * width + x) * 4;
    const dr = data[i]! - tR, dg = data[i + 1]! - tG, db = data[i + 2]! - tB, da = data[i + 3]! - tA;
    return Math.sqrt(dr * dr + dg * dg + db * db + da * da) <= tolerance;
  };

  const visited = new Uint8Array(width * height);
  const fillPixel = (x: number, y: number) => {
    visited[y * width + x] = 1;
    const i = (y * width + x) * 4;
    data[i] = fillColor.r;
    data[i + 1] = fillColor.g;
    data[i + 2] = fillColor.b;
    data[i + 3] = fillColor.a;
  };

  let minX = sx, maxX = sx, minY = sy, maxY = sy;
  let filledCount = 0;
  let leaked = false;
  const stack: [number, number][] = [[sx, sy]];

  while (stack.length > 0) {
    const [x, y0] = stack.pop()!;
    if (y0 < 0 || y0 >= height || visited[y0 * width + x] || !matches(x, y0)) continue;

    // Extend left/right from (x, y0) to find this row's contiguous span.
    let xl = x;
    while (xl - 1 >= 0 && !visited[y0 * width + (xl - 1)] && matches(xl - 1, y0)) xl--;
    let xr = x;
    while (xr + 1 < width && !visited[y0 * width + (xr + 1)] && matches(xr + 1, y0)) xr++;

    for (let xi = xl; xi <= xr; xi++) fillPixel(xi, y0);
    filledCount += xr - xl + 1;
    if (xl < minX) minX = xl;
    if (xr > maxX) maxX = xr;
    if (y0 < minY) minY = y0;
    if (y0 > maxY) maxY = y0;
    if (xl === 0 || xr === width - 1 || y0 === 0 || y0 === height - 1) leaked = true;
    if (filledCount > maxFillPixels) {
      leaked = true;
      break;
    }

    // Queue one seed point per contiguous matching run on the row above and
    // below — the inner while-loop above will pick up the rest of each run.
    for (const ny of [y0 - 1, y0 + 1]) {
      if (ny < 0 || ny >= height) continue;
      let xi = xl;
      while (xi <= xr) {
        if (!visited[ny * width + xi] && matches(xi, ny)) {
          stack.push([xi, ny]);
          while (xi <= xr && matches(xi, ny)) xi++;
        } else {
          xi++;
        }
      }
    }
  }

  if (leaked || filledCount === 0) return null;
  return { minX, minY, maxX: maxX + 1, maxY: maxY + 1 };
}

export class CanvasEngine {
  private baseCanvas: HTMLCanvasElement;
  private activeCanvas: HTMLCanvasElement;
  private baseCtx: CanvasRenderingContext2D;
  private activeCtx: CanvasRenderingContext2D;

  public currentTool: CanvasTool = "pen";
  public currentColor = "#1A1A1A";
  public currentSize = 3;
  /** Active pen style id (PEN_STYLES); stamped onto each new pen stroke. */
  public currentPenStyle = "hard";
  /** Active eraser brush radius in virtual px (default = "M"). */
  public eraserRadius = 26;

  /** Set by the host component. Fired instead of starting a drag when the
   * "text" tool is active on pointerdown — the engine has no DOM to render
   * a text-entry overlay itself, so it hands the click point back to React,
   * which positions an HTML textarea and calls addTextObject()/
   * updateTextObject() on commit. */
  public onTextRequested?: (pt: { x: number; y: number }) => void;

  private isPointerDown = false;
  private activePoints: StrokePoint[] = [];
  private shapeStart: { x: number; y: number } | null = null;
  private shapeEnd: { x: number; y: number } | null = null;
  private objects: StrokeObject[] = [];
  private undoStack: StrokeObject[][] = [];
  private redoStack: StrokeObject[][] = [];

  /** Multi-selection. Single click puts one id here; the lasso puts many. */
  private selectedIds = new Set<string>();
  /** In-progress lasso polygon (select tool, dragging over empty canvas). */
  private lassoPath: { x: number; y: number }[] | null = null;
  /** Internal object clipboard for Copy / Paste / Duplicate. */
  private clipboard: StrokeObject[] = [];
  private dragOrigin: { x: number; y: number } | null = null;
  private dragSnapshot: StrokeObject[] | null = null;
  private resizeHandle: "tl" | "tr" | "br" | "bl" | null = null;
  private resizeOpposite: { x: number; y: number } | null = null;
  private resizeInitialBBox: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  private activePointerId: number | null = null;
  private activePointerType: string | null = null;

  private onCommit?: (objects: StrokeObject[]) => void;
  private onSelectionChange?: (ids: string[]) => void;
  /** Set by the host component. Fired for a transient, non-blocking notice
   * the engine can't show itself (e.g. the bucket tool hitting an open
   * boundary) — never thrown, so a slow/failed listener can't break
   * drawing. */
  public onNotice?: (message: string) => void;
  /** Decoded <img> per RasterObject.id, populated lazily in drawRaster()
   * since canvas drawImage() needs an already-loaded Image, not a raw data
   * URL, and renderBase() itself must stay synchronous. */
  private rasterImageCache = new Map<string, HTMLImageElement>();

  private get selectedId(): string | null {
    return this.selectedIds.size ? [...this.selectedIds][0]! : null;
  }
  private emitSelection(): void {
    this.onSelectionChange?.([...this.selectedIds]);
  }
  private selectionBBox(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    let box: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
    for (const o of this.objects) {
      if (!this.selectedIds.has(o.id)) continue;
      const b = getBoundingBox(o);
      box = box
        ? {
            minX: Math.min(box.minX, b.minX),
            minY: Math.min(box.minY, b.minY),
            maxX: Math.max(box.maxX, b.maxX),
            maxY: Math.max(box.maxY, b.maxY),
          }
        : b;
    }
    return box;
  }
  private rafPending = false;

  private boundDown = this.onPointerDown.bind(this);
  private boundMove = this.onPointerMove.bind(this);
  private boundUp = this.onPointerUp.bind(this);

  constructor(
    baseCanvas: HTMLCanvasElement,
    activeCanvas: HTMLCanvasElement,
    onCommit?: (objects: StrokeObject[]) => void,
    onSelectionChange?: (ids: string[]) => void,
    options?: { readOnly?: boolean }
  ) {
    this.baseCanvas = baseCanvas;
    this.activeCanvas = activeCanvas;
    const baseCtx = baseCanvas.getContext("2d", { alpha: true });
    const activeCtx = activeCanvas.getContext("2d", { alpha: true });
    if (!baseCtx || !activeCtx) throw new Error("2D canvas context unavailable");
    this.baseCtx = baseCtx;
    this.activeCtx = activeCtx;
    this.onCommit = onCommit;
    this.onSelectionChange = onSelectionChange;
    // Read-only mode (the student board-mirror view): skip attaching pointer
    // listeners entirely, so a student can never accidentally draw on their
    // own copy and mistake it for something that reached the teacher's
    // board — this is display-only, driven purely by loadObjects().
    if (!options?.readOnly) this.attach();
  }

  private attach(): void {
    const el = this.activeCanvas;
    el.addEventListener("pointerdown", this.boundDown);
    el.addEventListener("pointermove", this.boundMove);
    el.addEventListener("pointerup", this.boundUp);
    el.addEventListener("pointercancel", this.boundUp);
    el.addEventListener("pointerleave", this.boundUp);
  }

  public destroy(): void {
    const el = this.activeCanvas;
    el.removeEventListener("pointerdown", this.boundDown);
    el.removeEventListener("pointermove", this.boundMove);
    el.removeEventListener("pointerup", this.boundUp);
    el.removeEventListener("pointercancel", this.boundUp);
    el.removeEventListener("pointerleave", this.boundUp);
    if (this.laserRaf) cancelAnimationFrame(this.laserRaf);
    this.laserRaf = 0;
    this.laserActive = null;
    this.laserStrokes = [];
  }

  /** Resize the backing store to match the element's current CSS size at
   * the current devicePixelRatio. Call on mount and on window resize.
   *
   * Deliberately reads offsetWidth/offsetHeight, not getBoundingClientRect —
   * the former is the element's own (untransformed) layout box, the latter
   * includes any CSS transform an ancestor applies (e.g. the zoom control's
   * `transform: scale(...)` wrapper). Sizing the backing store off the
   * transformed rect would inflate resolution every time zoom changed and
   * desync it from the dpr-only ctx.setTransform below. getPoint() mirrors
   * this with a matching scale-factor conversion the other direction. */
  public syncSize(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = this.activeCanvas.offsetWidth || 1;
    const height = this.activeCanvas.offsetHeight || 1;
    for (const canvas of [this.baseCanvas, this.activeCanvas]) {
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    }
    const scaleX = (width * dpr) / VIRTUAL_WIDTH;
    const scaleY = (height * dpr) / VIRTUAL_HEIGHT;
    this.baseCtx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    this.activeCtx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    this.renderBase();
  }

  private getPoint(e: PointerEvent): StrokePoint {
    const rect = this.activeCanvas.getBoundingClientRect();
    const relX = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
    const relY = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0;
    return {
      x: relX * VIRTUAL_WIDTH,
      y: relY * VIRTUAL_HEIGHT,
      pressure: e.pressure && e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  private onPointerDown(e: PointerEvent): void {
    // Palm rejection: If pen input is active, reject simultaneous accidental touch inputs
    if (this.isPointerDown && this.activePointerType === "pen" && e.pointerType === "touch") {
      return;
    }
    // Palm rejection: reject broad touch blobs (e.g. resting palm or side of hand)
    if (e.pointerType === "touch" && (e.width > 35 || e.height > 35)) {
      return;
    }

    e.preventDefault();
    try {
      this.activeCanvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignored if capture unsupported
    }
    this.isPointerDown = true;
    this.activePointerId = e.pointerId;
    this.activePointerType = e.pointerType;
    const pt = this.getPoint(e);

    if (this.currentTool === "text") {
      this.isPointerDown = false;
      this.activePointerId = null;
      this.activePointerType = null;
      this.onTextRequested?.({ x: pt.x, y: pt.y });
      return;
    }

    if (this.currentTool === "fill") {
      this.isPointerDown = false;
      this.activePointerId = null;
      this.activePointerType = null;
      this.fillAtPoint(pt);
      return;
    }

    if (this.currentTool === "laser") {
      // Transient — never enters this.objects, undo, or export.
      this.laserActive = [{ x: pt.x, y: pt.y }];
      this.startLaserLoop();
      return;
    }

    if (this.currentTool === "pen" || this.currentTool === "highlighter") {
      this.activePoints = [pt];
      return;
    }

    if (isShapeTool(this.currentTool)) {
      this.shapeStart = { x: pt.x, y: pt.y };
      this.shapeEnd = { x: pt.x, y: pt.y };
      return;
    }

    if (this.currentTool === "stroke-eraser") {
      this.eraseAtPoint(pt);
      return;
    }

    if (this.currentTool === "object-eraser") {
      this.eraseObjectAt(pt);
      return;
    }

    if (this.currentTool === "select") {
      // Resize handles — only for a single selected object.
      if (this.selectedIds.size === 1) {
        const selectedObj = this.objects.find((o) => o.id === this.selectedId);
        if (selectedObj) {
          // Handles are drawn/grabbed at the padded box (a few px outside
          // the object, same as the visible selection outline), but the
          // opposite-corner anchor and original size used for the actual
          // scale math must be the object's exact, unpadded geometry — see
          // getUnpaddedBounds()'s doc comment for why using the padded box
          // there caused drift.
          const bbox = getBoundingBox(selectedObj);
          const unpadded = getUnpaddedBounds(selectedObj);
          const handleTolerance = 14;
          const handles: { handle: "tl" | "tr" | "br" | "bl"; corner: { x: number; y: number }; opposite: { x: number; y: number } }[] = [
            { handle: "tl", corner: { x: bbox.minX, y: bbox.minY }, opposite: { x: unpadded.maxX, y: unpadded.maxY } },
            { handle: "tr", corner: { x: bbox.maxX, y: bbox.minY }, opposite: { x: unpadded.minX, y: unpadded.maxY } },
            { handle: "br", corner: { x: bbox.maxX, y: bbox.maxY }, opposite: { x: unpadded.minX, y: unpadded.minY } },
            { handle: "bl", corner: { x: bbox.minX, y: bbox.maxY }, opposite: { x: unpadded.maxX, y: unpadded.minY } },
          ];
          const hitHandle = handles.find((h) => distance(h.corner, pt) < handleTolerance);
          if (hitHandle) {
            this.resizeHandle = hitHandle.handle;
            this.resizeOpposite = hitHandle.opposite;
            this.resizeInitialBBox = unpadded;
            this.dragSnapshot = this.cloneObjects();
            return;
          }
        }
      }

      // Click/drag inside the current selection's bounding box => move it all.
      const selBox = this.selectionBBox();
      if (
        this.selectedIds.size > 0 &&
        selBox &&
        pt.x >= selBox.minX - 6 &&
        pt.x <= selBox.maxX + 6 &&
        pt.y >= selBox.minY - 6 &&
        pt.y <= selBox.maxY + 6
      ) {
        this.dragOrigin = pt;
        this.dragSnapshot = this.cloneObjects();
        return;
      }

      const hit = this.hitTest(pt);
      if (hit) {
        this.selectedIds = new Set([hit.id]);
        this.dragOrigin = pt;
        this.dragSnapshot = this.cloneObjects();
        this.emitSelection();
        this.renderBase();
        return;
      }

      // Empty canvas => start a lasso.
      this.selectedIds.clear();
      this.emitSelection();
      this.lassoPath = [{ x: pt.x, y: pt.y }];
      this.renderBase();
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isPointerDown) return;
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;

    if (this.laserActive) {
      const p = this.getPoint(e);
      this.laserActive.push({ x: p.x, y: p.y });
      return;
    }

    // Read high-frequency coalesced events from pen tablet if available
    const events: PointerEvent[] = typeof (e as any).getCoalescedEvents === "function"
      ? (e as any).getCoalescedEvents()
      : [e];

    for (const evt of events) {
      const pt = this.getPoint(evt);

      if (this.currentTool === "pen" || this.currentTool === "highlighter") {
        this.activePoints.push(pt);
        continue;
      }

      if (isShapeTool(this.currentTool) && this.shapeStart) {
        this.shapeEnd = { x: pt.x, y: pt.y };
        continue;
      }

      if (this.currentTool === "stroke-eraser") {
        this.eraseAtPoint(pt);
        continue;
      }

      if (this.currentTool === "select" && this.lassoPath) {
        this.lassoPath.push({ x: pt.x, y: pt.y });
        this.drawLasso();
        continue;
      }

      if (this.currentTool === "select" && this.selectedIds.size > 0) {
        if (this.resizeHandle && this.resizeOpposite && this.resizeInitialBBox && this.selectedIds.size === 1) {
          const origW = Math.max(10, this.resizeInitialBBox.maxX - this.resizeInitialBBox.minX);
          const origH = Math.max(10, this.resizeInitialBBox.maxY - this.resizeInitialBBox.minY);
          const newW = Math.max(10, Math.abs(pt.x - this.resizeOpposite.x));
          const newH = Math.max(10, Math.abs(pt.y - this.resizeOpposite.y));
          const scaleX = newW / origW;
          const scaleY = newH / origH;
          const original = this.dragSnapshot?.find((o) => o.id === this.selectedId);
          if (original) {
            const idx = this.objects.findIndex((o) => o.id === this.selectedId);
            if (idx !== -1) {
              this.objects[idx] = scaleObject(original, scaleX, scaleY, this.resizeOpposite, this.measureText.bind(this));
              this.renderBase();
            }
          }
        } else if (this.dragOrigin) {
          const dx = pt.x - this.dragOrigin.x;
          const dy = pt.y - this.dragOrigin.y;
          for (const id of this.selectedIds) {
            const idx = this.objects.findIndex((o) => o.id === id);
            const original = this.dragSnapshot?.find((o) => o.id === id);
            if (idx !== -1 && original) this.objects[idx] = translateObject(original, dx, dy);
          }
          this.renderBase();
        }
      }
    }

    if (this.currentTool === "pen" || this.currentTool === "highlighter" || (isShapeTool(this.currentTool) && this.shapeStart)) {
      this.scheduleActiveRender();
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.isPointerDown) return;
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;

    if (this.laserActive) {
      if (this.laserActive.length > 1) {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        this.laserStrokes.push({ points: this.laserActive, born: now });
      }
      this.laserActive = null;
      this.isPointerDown = false;
      this.activePointerId = null;
      this.activePointerType = null;
      return;
    }

    this.isPointerDown = false;
    this.activePointerId = null;
    this.activePointerType = null;
    try {
      this.activeCanvas.releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released — safe to ignore
    }

    if (this.currentTool === "pen" || this.currentTool === "highlighter") {
      if (this.activePoints.length === 1) {
        // Single tap dot
        this.pushUndo();
        const pt = this.activePoints[0]!;
        const stroke: StrokeObject = {
          id: uid(),
          type: "stroke",
          tool: this.currentTool,
          color: this.currentColor,
          size: this.currentSize,
          points: [pt, { ...pt, x: pt.x + 0.1 }],
          penStyle: this.currentPenStyle,
        };
        this.objects.push(stroke);
        this.renderBase();
        this.onCommit?.(this.objects);
      } else if (this.activePoints.length > 1) {
        this.pushUndo();
        const stroke: StrokeObject = {
          id: uid(),
          type: "stroke",
          tool: this.currentTool,
          color: this.currentColor,
          size: this.currentSize,
          points: this.activePoints,
          penStyle: this.currentPenStyle,
        };
        this.objects.push(stroke);
        this.renderBase();
        this.onCommit?.(this.objects);
      }
    }

    if (isShapeTool(this.currentTool) && this.shapeStart && this.shapeEnd) {
      if (distance(this.shapeStart, this.shapeEnd) > MIN_SHAPE_DRAG) {
        this.pushUndo();
        const shape: StrokeObject = {
          id: uid(),
          type: "shape",
          shape: this.currentTool,
          color: this.currentColor,
          size: this.currentSize,
          start: this.shapeStart,
          end: this.shapeEnd,
        };
        this.objects.push(shape);
        this.renderBase();
        this.onCommit?.(this.objects);
      }
    }

    if (this.currentTool === "select" && this.lassoPath) {
      const poly = this.lassoPath;
      this.lassoPath = null;
      this.activeCtx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      if (poly.length >= 3) {
        const ids = this.objects
          .filter((o) => representativePoints(o).some((p) => pointInPolygon(p, poly)))
          .map((o) => o.id);
        this.selectedIds = new Set(ids);
        this.emitSelection();
      }
      this.renderBase();
    } else if (this.currentTool === "select" && this.selectedIds.size > 0) {
      if (this.resizeHandle) {
        this.pushUndo(this.dragSnapshot!);
        this.onCommit?.(this.objects);
      } else if (this.dragOrigin && this.dragSnapshot) {
        // Commit only if something actually moved.
        let moved = false;
        for (const id of this.selectedIds) {
          const before = this.dragSnapshot.find((o) => o.id === id);
          const after = this.objects.find((o) => o.id === id);
          const b = before && firstPoint(before);
          const a = after && firstPoint(after);
          if (b && a && (b.x !== a.x || b.y !== a.y)) {
            moved = true;
            break;
          }
        }
        if (moved) {
          this.pushUndo(this.dragSnapshot);
          this.onCommit?.(this.objects);
        }
      }
    }

    this.activePoints = [];
    this.dragOrigin = null;
    this.dragSnapshot = null;
    this.resizeHandle = null;
    this.resizeOpposite = null;
    this.resizeInitialBBox = null;
    this.shapeStart = null;
    this.shapeEnd = null;
    this.activeCtx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
  }

  private scheduleActiveRender(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.renderActiveStroke();
    });
  }

  private renderActiveStroke(): void {
    this.activeCtx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    if (isShapeTool(this.currentTool)) {
      if (this.shapeStart && this.shapeEnd) {
        drawShape(this.activeCtx, {
          shape: this.currentTool,
          color: this.currentColor,
          size: this.currentSize,
          start: this.shapeStart,
          end: this.shapeEnd,
        });
      }
      return;
    }

    if (this.activePoints.length < 2) return;
    this.strokePath(this.activeCtx, this.activePoints, this.currentColor, this.currentSize, this.currentTool === "highlighter", this.currentPenStyle);
  }

  private strokePath(
    ctx: CanvasRenderingContext2D,
    points: StrokePoint[],
    color: string,
    size: number,
    isHighlighter: boolean,
    penStyle: string = "hard"
  ): void {
    if (points.length === 0) return;
    if (points.length === 1) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha = isHighlighter ? 0.35 : penStyle === "graphite" ? 0.8 : 1;
      const r = (size * (isHighlighter ? 3.5 : 0.6 + points[0]!.pressure * 1.4)) / 2;
      ctx.beginPath();
      ctx.arc(points[0]!.x, points[0]!.y, Math.max(1, r), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.lineCap = penStyle === "chisel" ? "butt" : "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.globalAlpha = isHighlighter ? 0.35 : 1;
    ctx.globalCompositeOperation = "source-over";

    if (isHighlighter || points.length === 2) {
      ctx.beginPath();
      ctx.moveTo(points[0]!.x, points[0]!.y);
      if (points.length === 2) {
        ctx.lineTo(points[1]!.x, points[1]!.y);
      } else {
        for (let i = 1; i < points.length - 1; i++) {
          const p1 = points[i]!;
          const p2 = points[i + 1]!;
          const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
          ctx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y);
        }
        const last = points[points.length - 1]!;
        ctx.lineTo(last.x, last.y);
      }
      ctx.lineWidth = size * (isHighlighter ? 3.5 : 1);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // ---- Pen styles: each computes a per-segment width / alpha / glow so
    // the same test stroke renders visibly differently per pen. ----------
    const CHISEL_NIB = Math.PI / 4; // fixed 45° nib

    if (penStyle === "magic") {
      // Glowing (but still permanent) ink: a soft wide halo pass then a
      // bright core pass.
      ctx.shadowColor = color;
      for (const [pass, blur, widthMul, alpha] of [
        ["halo", size * 2.4, 2.6, 0.35] as const,
        ["core", size * 0.8, 0.9, 1] as const,
      ]) {
        void pass;
        ctx.shadowBlur = blur;
        ctx.globalAlpha = alpha;
        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i]!;
          const p2 = points[i + 1]!;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineWidth = Math.max(0.6, size * widthMul);
          ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1]! : points[0]!;
      const p1 = points[i]!;
      const p2 = points[i + 1]!;
      const startPt = i === 0 ? p1 : { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      const endPt = i === points.length - 2 ? p2 : { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const pressure = p1.pressure && p1.pressure > 0 ? p1.pressure : 0.5;

      let lineWidth: number;
      let alpha = 1;
      if (penStyle === "fountain") {
        lineWidth = Math.max(0.4, size * (0.15 + pressure * 2.4));
      } else if (penStyle === "chisel") {
        const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        lineWidth = Math.max(1, size * (0.3 + 1.5 * Math.abs(Math.sin(ang - CHISEL_NIB))));
      } else if (penStyle === "art") {
        // brush: wider, feathered via a soft self-glow + reduced opacity
        lineWidth = Math.max(1, size * (1.1 + pressure * 1.5));
        alpha = 0.7;
        ctx.shadowColor = color;
        ctx.shadowBlur = size * 0.9;
      } else if (penStyle === "graphite") {
        // pencil: thin + grainy alpha jitter
        lineWidth = Math.max(0.5, size * (0.35 + pressure * 0.7));
        alpha = 0.5 + Math.random() * 0.4;
      } else {
        // hard-tipped (default)
        lineWidth = Math.max(0.75, size * (0.45 + pressure * 1.35));
      }

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(startPt.x, startPt.y);
      ctx.quadraticCurveTo(p1.x, p1.y, endPt.x, endPt.y);
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- Transient laser overlay ------------------------------------------
  private laserActive: { x: number; y: number }[] | null = null;
  private laserStrokes: { points: { x: number; y: number }[]; born: number }[] = [];
  private laserRaf = 0;

  private startLaserLoop(): void {
    if (this.laserRaf) return;
    const tick = () => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      this.laserStrokes = this.laserStrokes.filter((s) => now - s.born < LASER_DURATION_MS);

      // Nothing left to animate and no permanent stroke mid-draw -> stop and
      // hand the active layer back.
      if (this.laserStrokes.length === 0 && !this.laserActive) {
        if (this.activePoints.length === 0) {
          this.activeCtx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
        }
        this.laserRaf = 0;
        return;
      }

      if (this.activePoints.length === 0) {
        this.activeCtx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      }
      for (const s of this.laserStrokes) {
        const age = now - s.born;
        const t = Math.min(1, age / LASER_DURATION_MS);
        this.drawLaser(s.points, laserOpacityAt(t));
      }
      if (this.laserActive) this.drawLaser(this.laserActive, 1);

      this.laserRaf = requestAnimationFrame(tick);
    };
    this.laserRaf = requestAnimationFrame(tick);
  }

  private drawLaser(pts: { x: number; y: number }[], opacity: number): void {
    if (pts.length < 1 || opacity <= 0) return;
    const ctx = this.activeCtx;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "lighter"; // additive => bright on white
    ctx.shadowColor = "rgba(255,60,60,0.95)";
    // outer halo
    ctx.strokeStyle = `rgba(255,80,80,${0.35 * opacity})`;
    ctx.shadowBlur = 26;
    ctx.lineWidth = 16;
    this.laserPath(ctx, pts);
    // mid glow
    ctx.strokeStyle = `rgba(255,120,120,${0.6 * opacity})`;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 8;
    this.laserPath(ctx, pts);
    // bright core
    ctx.strokeStyle = `rgba(255,255,255,${0.95 * opacity})`;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 3;
    this.laserPath(ctx, pts);
    ctx.restore();
  }

  private laserPath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]): void {
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0]!.x, pts[0]!.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mid = { x: (pts[i]!.x + pts[i + 1]!.x) / 2, y: (pts[i]!.y + pts[i + 1]!.y) / 2 };
      ctx.quadraticCurveTo(pts[i]!.x, pts[i]!.y, mid.x, mid.y);
    }
    ctx.lineTo(pts[pts.length - 1]!.x, pts[pts.length - 1]!.y);
    ctx.stroke();
  }

  public renderBase(): void {
    this.baseCtx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    for (const obj of this.objects) {
      if (obj.type === "stroke") {
        this.strokePath(this.baseCtx, obj.points, obj.color, obj.size, obj.tool === "highlighter", obj.penStyle);
      } else if (obj.type === "text") {
        this.drawText(this.baseCtx, obj);
      } else if (obj.type === "raster") {
        this.drawRaster(obj);
      } else {
        drawShape(this.baseCtx, obj);
      }
      if (this.selectedIds.has(obj.id)) {
        this.drawSelectionBox(obj);
      }
    }
    // One outer bounding box around a multi-selection so it reads as a group.
    if (this.selectedIds.size > 1) {
      const b = this.selectionBBox();
      if (b) {
        const ctx = this.baseCtx;
        ctx.save();
        ctx.setLineDash([12, 8]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#2563eb";
        ctx.strokeRect(b.minX - 8, b.minY - 8, b.maxX - b.minX + 16, b.maxY - b.minY + 16);
        ctx.restore();
      }
    }
  }

  private textFont(sizePx: number): string {
    return `${sizePx}px "Segoe UI", Arial, sans-serif`;
  }

  private drawText(ctx: CanvasRenderingContext2D, obj: TextObject): void {
    ctx.save();
    ctx.fillStyle = obj.color;
    ctx.textBaseline = "top";
    ctx.font = this.textFont(obj.size);
    const lineHeight = obj.size * 1.25;
    obj.text.split("\n").forEach((line, i) => {
      ctx.fillText(line, obj.position.x, obj.position.y + i * lineHeight);
    });
    ctx.restore();
  }

  /** Draws a bucket-fill patch. `<img>` decode is async, so a not-yet-loaded
   * image is skipped this frame (drawing a blank/transparent rect there is
   * fine — a fill is additive over whatever's already correctly on screen)
   * and triggers one renderBase() re-run the moment it finishes loading. */
  private drawRaster(obj: RasterObject): void {
    let img = this.rasterImageCache.get(obj.id);
    if (!img) {
      img = new Image();
      img.onload = () => this.renderBase();
      img.src = obj.dataUrl;
      this.rasterImageCache.set(obj.id, img);
    }
    if (img.complete && img.naturalWidth > 0) {
      this.baseCtx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
    }
  }

  /** Measures text with the same font renderBase()/drawText() will actually
   * draw with, so the stored width/height (used for hit-testing, the
   * selection box, and the eraser) always match what's on screen. */
  private measureText(text: string, sizePx: number): { width: number; height: number } {
    this.baseCtx.save();
    this.baseCtx.font = this.textFont(sizePx);
    const lines = text.split("\n");
    let maxWidth = 0;
    for (const line of lines) {
      const w = this.baseCtx.measureText(line.length > 0 ? line : " ").width;
      if (w > maxWidth) maxWidth = w;
    }
    this.baseCtx.restore();
    const lineHeight = sizePx * 1.25;
    return { width: Math.max(maxWidth, sizePx * 0.5), height: Math.max(lines.length, 1) * lineHeight };
  }

  /** Commits a brand-new text object — mirrors the exact commit pattern used
   * for strokes/shapes in onPointerUp (pushUndo → mutate → renderBase →
   * onCommit), just triggered from the host's textarea overlay instead of a
   * pointerup handler. Empty/whitespace-only text is a no-op, matching how
   * the freehand path silently drops a stroke with < 2 points. */
  public addTextObject(text: string, position: { x: number; y: number }, color: string, sizePx: number): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.pushUndo();
    const { width, height } = this.measureText(trimmed, sizePx);
    const obj: TextObject = { id: uid(), type: "text", text: trimmed, color, size: sizePx, position, width, height };
    this.objects.push(obj);
    this.renderBase();
    this.onCommit?.(this.objects);
  }

  /** Re-edits an existing text object in place (double-click via the select
   * tool). Clearing the text out entirely deletes the object, mirroring
   * deleteSelected() rather than leaving an empty ghost object around. */
  public updateTextObject(id: string, text: string): void {
    const idx = this.objects.findIndex((o) => o.id === id && o.type === "text");
    if (idx === -1) return;
    const existing = this.objects[idx] as TextObject;
    const trimmed = text.trim();
    this.pushUndo();
    if (!trimmed) {
      this.objects = this.objects.filter((o) => o.id !== id);
      if (this.selectedIds.has(id)) {
        this.selectedIds.clear();
        this.emitSelection();
      }
    } else {
      const { width, height } = this.measureText(trimmed, existing.size);
      this.objects[idx] = { ...existing, text: trimmed, width, height };
    }
    this.renderBase();
    this.onCommit?.(this.objects);
  }

  private drawSelectionBox(obj: StrokeObject): void {
    const pts = representativePoints(obj);
    if (pts.length === 0) return;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs) - 8;
    const minY = Math.min(...ys) - 8;
    const maxX = Math.max(...xs) + 8;
    const maxY = Math.max(...ys) + 8;
    this.baseCtx.save();
    this.baseCtx.strokeStyle = "#6366F1";
    this.baseCtx.setLineDash([4, 3]);
    this.baseCtx.lineWidth = 1.5;
    this.baseCtx.strokeRect(minX, minY, maxX - minX, maxY - minY);

    // Corner resize handles
    this.baseCtx.setLineDash([]);
    this.baseCtx.fillStyle = "#ffffff";
    this.baseCtx.strokeStyle = "#4F46E5";
    this.baseCtx.lineWidth = 2;
    const handleSize = 8;
    const corners = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ];
    for (const c of corners) {
      this.baseCtx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
      this.baseCtx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
    }
    this.baseCtx.restore();
  }

  private hitTest(pt: { x: number; y: number }): StrokeObject | null {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      // Non-null: i is always a valid index of this.objects in this loop.
      const obj = this.objects[i]!;
      // Text is naturally box-shaped and users expect click-anywhere-inside
      // to select it, not just near the outline like a stroke/shape.
      if (obj.type === "text") {
        const { x, y } = obj.position;
        if (pt.x >= x - 6 && pt.x <= x + obj.width + 6 && pt.y >= y - 6 && pt.y <= y + obj.height + 6) return obj;
        continue;
      }
      // A filled patch is a solid block, not an outline — click-anywhere-
      // inside should select it, same reasoning as text above.
      if (obj.type === "raster") {
        const { x, y, width, height } = obj;
        if (pt.x >= x - 6 && pt.x <= x + width + 6 && pt.y >= y - 6 && pt.y <= y + height + 6) return obj;
        continue;
      }
      if (representativePoints(obj).some((p) => distance(p, pt) < SELECT_HIT_RADIUS)) return obj;
    }
    return null;
  }

  /** Public wrapper so the host component can find the text object under a
   * double-click (to re-open it for editing) without engine internals. */
  public getTextObjectAt(pt: { x: number; y: number }): TextObject | null {
    const hit = this.hitTest(pt);
    return hit && hit.type === "text" ? hit : null;
  }

  private eraseObjectAt(pt: StrokePoint): void {
    const hit = this.hitTest(pt);
    if (!hit) return;
    this.pushUndo();
    this.objects = this.objects.filter((o) => o.id !== hit.id);
    this.renderBase();
    this.onCommit?.(this.objects);
  }

  /**
   * Paint Bucket / Color Fill tool:
   * Fills clicked shape or closed figure with `currentColor`, pushing an undo snapshot
   * and committing the change for real-time synchronization with all students.
   */
  /**
   * Paint-bucket. Fills the enclosed area of a *closed* shape (rectangle /
   * circle / triangle) with the current colour. It never recolours pen
   * strokes, text, or open paths (line / arrow) — clicking those, or empty
   * canvas, is a no-op. This is object-based fill, not pixel flood-fill:
   * the target shape gets a `fill` property, everything else is untouched.
   */
  private fillAtPoint(pt: { x: number; y: number }): void {
    const FILLABLE: ShapeKind[] = ["rectangle", "circle", "triangle"];
    const isFillableShape = (o: StrokeObject): o is ShapeObject =>
      o.type === "shape" && (FILLABLE as string[]).includes((o as ShapeObject).shape);

    // 1. Topmost fillable shape whose interior contains the click.
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i]!;
      if (isFillableShape(obj) && isInsideShape(obj, pt)) {
        this.pushUndo();
        this.objects[i] = { ...obj, fill: this.currentColor };
        this.renderBase();
        this.onCommit?.(this.objects);
        return;
      }
    }

    // 2. Clicked the outline/edge of a fillable shape (but not its inside).
    const hit = this.hitTest(pt);
    if (hit && isFillableShape(hit)) {
      this.pushUndo();
      const idx = this.objects.findIndex((o) => o.id === hit.id);
      if (idx !== -1) {
        this.objects[idx] = { ...(this.objects[idx] as ShapeObject), fill: this.currentColor };
        this.renderBase();
        this.onCommit?.(this.objects);
      }
      return;
    }

    // 3. Not a shape primitive — fall back to a real closed-region flood
    // fill against the rendered pixels (handles freehand pen loops, and
    // shapes/text used purely as boundaries rather than fillable objects).
    //
    // getImageData() always reads the canvas's actual physical pixel
    // buffer, which setTransform() in syncSize() has deliberately made
    // SMALLER than VIRTUAL_WIDTH/HEIGHT (backing-store size = CSS size *
    // devicePixelRatio; every draw call is then scaled up to fill virtual
    // space). `pt` here is in virtual coordinates, same as every other
    // object's geometry — so both the click point and the resulting
    // bounds must be converted through that same scale factor, or the
    // flood fill silently samples/writes the wrong physical pixels
    // relative to what's actually on screen at the virtual click point.
    this.renderBase();
    const transform = this.baseCtx.getTransform();
    const scaleX = transform.a || 1;
    const scaleY = transform.d || 1;
    const bufferW = this.baseCanvas.width;
    const bufferH = this.baseCanvas.height;
    const imageData = this.baseCtx.getImageData(0, 0, bufferW, bufferH);
    const physPt = { x: pt.x * scaleX, y: pt.y * scaleY };
    const bounds = floodFillImageData(imageData, physPt.x, physPt.y, hexToRgba(this.currentColor));
    if (!bounds) {
      this.onNotice?.("This area isn't fully closed — bucket fill needs a closed boundary.");
      return;
    }

    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const patchCanvas = document.createElement("canvas");
    patchCanvas.width = w;
    patchCanvas.height = h;
    const patchCtx = patchCanvas.getContext("2d");
    if (!patchCtx) return;
    // ImageData's constructor needs its own buffer slice, not a live view
    // into the full-canvas array — copy just the patch's rows out.
    const patchData = patchCtx.createImageData(w, h);
    for (let row = 0; row < h; row++) {
      const srcStart = ((bounds.minY + row) * bufferW + bounds.minX) * 4;
      patchData.data.set(imageData.data.subarray(srcStart, srcStart + w * 4), row * w * 4);
    }
    patchCtx.putImageData(patchData, 0, 0);

    this.pushUndo();
    // The patch bitmap itself is physical-pixel resolution; its placement
    // (x/y/width/height) goes back through objects/renderBase() and must
    // be in virtual coordinates like everything else, so divide back down
    // by the same scale factors used above.
    const raster: RasterObject = {
      id: uid(),
      type: "raster",
      dataUrl: patchCanvas.toDataURL("image/png"),
      x: bounds.minX / scaleX,
      y: bounds.minY / scaleY,
      width: w / scaleX,
      height: h / scaleY,
    };
    this.objects.push(raster);
    this.renderBase();
    this.onCommit?.(this.objects);
  }

  /** Partial/stroke eraser — removes only the points within the eraser
   * radius of the current pointer position, splitting a stroke into two
   * separate strokes if the erased region is in the middle rather than
   * deleting the whole thing. Shapes aren't point-clouds, so touching a
   * shape here removes it wholesale instead — same outcome as the object
   * eraser for that one object, which matches how most whiteboard tools
   * treat "drag the eraser over a shape". */
  private eraseAtPoint(pt: StrokePoint): void {
    let changed = false;
    const next: StrokeObject[] = [];

    for (const obj of this.objects) {
      if (obj.type === "shape" || obj.type === "text" || obj.type === "raster") {
        if (representativePoints(obj).some((p) => distance(p, pt) < this.eraserRadius)) {
          changed = true;
          continue;
        }
        next.push(obj);
        continue;
      }

      const segments: StrokePoint[][] = [[]];
      for (const p of obj.points) {
        if (distance(p, pt) < this.eraserRadius) {
          changed = true;
          // Non-null: segments starts as [[]] and only ever grows via
          // push([]), so the last element always exists.
          if (segments[segments.length - 1]!.length > 0) segments.push([]);
        } else {
          segments[segments.length - 1]!.push(p);
        }
      }

      for (const seg of segments) {
        if (seg.length === 0) continue;
        if (seg.length === 1) {
          // Keep a single dot: duplicate the lone point so strokePath can
          // draw a tiny segment instead of dropping it entirely.
          next.push({
            id: uid(),
            type: "stroke",
            points: [seg[0]!, { ...seg[0]!, x: seg[0]!.x + 0.1 }],
            color: obj.color,
            size: obj.size,
            tool: obj.tool,
          });
        } else {
          next.push({
            id: uid(),
            type: "stroke",
            points: seg,
            color: obj.color,
            size: obj.size,
            tool: obj.tool,
          });
        }
      }
    }

    if (!changed) return;
    this.pushUndo();
    this.objects = next;
    this.renderBase();
    this.onCommit?.(this.objects);
  }

  /** Removes handwriting/shapes but nothing else — the important guarantee
   * for teaching over a PDF/NCERT background once that layer exists: this
   * only ever touches `objects` (ink), never a background image layer. */
  public clearInk(): void {
    if (this.objects.length === 0) return;
    this.pushUndo();
    this.objects = [];
    this.selectedIds.clear();
    this.renderBase();
    this.onCommit?.(this.objects);
  }

  public setTool(tool: CanvasTool): void {
    this.currentTool = tool;
    this.lassoPath = null;
    if (tool !== "select") {
      this.selectedIds.clear();
      this.emitSelection();
      this.renderBase();
    }
  }

  /** How many objects are currently selected — drives the action bar's enabled state. */
  public getSelectionCount(): number {
    return this.selectedIds.size;
  }

  public deleteSelected(): void {
    if (this.selectedIds.size === 0) return;
    this.pushUndo();
    this.objects = this.objects.filter((o) => !this.selectedIds.has(o.id));
    this.selectedIds.clear();
    this.emitSelection();
    this.renderBase();
    this.onCommit?.(this.objects);
  }

  /** Copy selection into the internal clipboard (no OS clipboard). */
  public copySelected(): void {
    const picked = this.objects.filter((o) => this.selectedIds.has(o.id));
    this.clipboard = picked.map((o) => JSON.parse(JSON.stringify(o)) as StrokeObject);
  }

  /** Paste the internal clipboard back, offset so the copy is visible, and
   * leave the new objects selected. Goes through pushUndo/onCommit. */
  public pasteClipboard(): void {
    if (this.clipboard.length === 0) return;
    this.pushUndo();
    const clones = this.clipboard.map((o) => {
      const moved = translateObject(JSON.parse(JSON.stringify(o)) as StrokeObject, 24, 24);
      return { ...moved, id: uid() } as StrokeObject;
    });
    this.objects.push(...clones);
    this.selectedIds = new Set(clones.map((c) => c.id));
    this.emitSelection();
    this.renderBase();
    this.onCommit?.(this.objects);
  }

  /** Copy + paste in one step. */
  public duplicateSelected(): void {
    if (this.selectedIds.size === 0) return;
    this.copySelected();
    this.pasteClipboard();
  }

  private drawLasso(): void {
    if (!this.lassoPath || this.lassoPath.length < 2) return;
    const ctx = this.activeCtx;
    ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#3b82f6";
    ctx.fillStyle = "rgba(59,130,246,0.08)";
    ctx.beginPath();
    ctx.moveTo(this.lassoPath[0]!.x, this.lassoPath[0]!.y);
    for (let i = 1; i < this.lassoPath.length; i++) {
      ctx.lineTo(this.lassoPath[i]!.x, this.lassoPath[i]!.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private cloneObjects(): StrokeObject[] {
    return this.objects.map((o) => {
      if (o.type === "stroke") return { ...o, points: o.points.map((p) => ({ ...p })) };
      if (o.type === "text") return { ...o, position: { ...o.position } };
      if (o.type === "raster") return { ...o };
      return { ...o, start: { ...o.start }, end: { ...o.end } };
    });
  }

  private pushUndo(snapshot?: StrokeObject[]): void {
    this.undoStack.push(snapshot ?? this.cloneObjects());
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }

  public undo(): void {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(this.cloneObjects());
    this.objects = this.undoStack.pop()!;
    this.renderBase();
    this.onCommit?.(this.objects);
  }

  public redo(): void {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(this.cloneObjects());
    this.objects = this.redoStack.pop()!;
    this.renderBase();
    this.onCommit?.(this.objects);
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public loadObjects(objects: StrokeObject[]): void {
    // Check if objects are from legacy unnormalized coordinate system (e.g. max coords < 1250)
    let maxX = 0;
    let maxY = 0;
    for (const obj of objects) {
      for (const p of representativePoints(obj)) {
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }

    // If strokes were created in legacy ~1000x560 canvas, scale them up to VIRTUAL 1920x1080
    if (objects.length > 0 && maxX > 0 && maxX < 1250 && maxY < 750) {
      const scaleX = VIRTUAL_WIDTH / 1000;
      const scaleY = VIRTUAL_HEIGHT / 562.5;
      this.objects = objects.map((obj) => {
        if (obj.type === "stroke") {
          return {
            ...obj,
            points: obj.points.map((p) => ({
              ...p,
              x: p.x * scaleX,
              y: p.y * scaleY,
            })),
          };
        } else if (obj.type === "text") {
          // Text objects didn't exist when the legacy ~1000x560 format was
          // in use, so this branch is currently unreachable in practice —
          // handled anyway so the map stays exhaustive and type-safe.
          return {
            ...obj,
            position: { x: obj.position.x * scaleX, y: obj.position.y * scaleY },
            size: obj.size * scaleX,
            width: obj.width * scaleX,
            height: obj.height * scaleY,
          };
        } else if (obj.type === "raster") {
          // Raster (bucket-fill patch) objects are newer than this legacy
          // format too — unreachable in practice, handled for exhaustiveness.
          return {
            ...obj,
            x: obj.x * scaleX,
            y: obj.y * scaleY,
            width: obj.width * scaleX,
            height: obj.height * scaleY,
          };
        } else {
          return {
            ...obj,
            start: { x: obj.start.x * scaleX, y: obj.start.y * scaleY },
            end: { x: obj.end.x * scaleX, y: obj.end.y * scaleY },
          };
        }
      });
    } else {
      this.objects = objects;
    }

    this.undoStack = [];
    this.redoStack = [];
    this.selectedIds.clear();
    this.renderBase();
  }

  public getObjects(): StrokeObject[] {
    return this.objects;
  }

  public isEmpty(): boolean {
    return this.objects.length === 0;
  }
}
