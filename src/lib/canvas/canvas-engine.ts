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

export type StrokeObject = FreehandObject | ShapeObject | TextObject;

export type CanvasTool =
  | "pen"
  | "highlighter"
  | "stroke-eraser"
  | "object-eraser"
  | "select"
  | "text"
  | ShapeKind;

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

const ERASER_RADIUS = 24;
const SELECT_HIT_RADIUS = 18;

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Points used for hit-testing, selection bounding boxes, and the partial
 * eraser. For freehand strokes this is every recorded point; for shapes it's
 * a small set of boundary samples — enough to click/erase near the outline,
 * though (like the freehand eraser) it's an outline test, not a fill test. */
function representativePoints(obj: StrokeObject): { x: number; y: number }[] {
  if (obj.type === "stroke") return obj.points;
  if (obj.type === "text") {
    const { x, y } = obj.position;
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
  return obj.start;
}

function translateObject(obj: StrokeObject, dx: number, dy: number): StrokeObject {
  if (obj.type === "stroke") {
    return { ...obj, points: obj.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
  }
  if (obj.type === "text") {
    return { ...obj, position: { x: obj.position.x + dx, y: obj.position.y + dy } };
  }
  return {
    ...obj,
    start: { x: obj.start.x + dx, y: obj.start.y + dy },
    end: { x: obj.end.x + dx, y: obj.end.y + dy },
  };
}

function getBoundingBox(obj: StrokeObject): { minX: number; minY: number; maxX: number; maxY: number } {
  const pts = representativePoints(obj);
  if (pts.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    minX: Math.min(...xs) - 8,
    minY: Math.min(...ys) - 8,
    maxX: Math.max(...xs) + 8,
    maxY: Math.max(...ys) + 8,
  };
}

function scaleObject(obj: StrokeObject, scaleX: number, scaleY: number, origin: { x: number; y: number }): StrokeObject {
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
    return {
      ...obj,
      position: {
        x: origin.x + (obj.position.x - origin.x) * scaleX,
        y: origin.y + (obj.position.y - origin.y) * scaleY,
      },
      size: Math.max(8, Math.round(obj.size * scale)),
      width: Math.max(10, Math.round(obj.width * scaleX)),
      height: Math.max(10, Math.round(obj.height * scaleY)),
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
  obj: { shape: ShapeKind; color: string; size: number; start: { x: number; y: number }; end: { x: number; y: number } }
): void {
  const { start, end, shape, color, size } = obj;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size;

  if (shape === "line") {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  } else if (shape === "rectangle") {
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
  } else if (shape === "circle") {
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo((start.x + end.x) / 2, start.y);
    ctx.lineTo(start.x, end.y);
    ctx.lineTo(end.x, end.y);
    ctx.closePath();
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
    ctx.fill();
  }
  ctx.restore();
}

export class CanvasEngine {
  private baseCanvas: HTMLCanvasElement;
  private activeCanvas: HTMLCanvasElement;
  private baseCtx: CanvasRenderingContext2D;
  private activeCtx: CanvasRenderingContext2D;

  public currentTool: CanvasTool = "pen";
  public currentColor = "#1A1A1A";
  public currentSize = 3;

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

  private selectedId: string | null = null;
  private dragOrigin: { x: number; y: number } | null = null;
  private dragSnapshot: StrokeObject[] | null = null;
  private resizeHandle: "tl" | "tr" | "br" | "bl" | null = null;
  private resizeOpposite: { x: number; y: number } | null = null;
  private resizeInitialBBox: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  private activePointerId: number | null = null;
  private activePointerType: string | null = null;

  private onCommit?: (objects: StrokeObject[]) => void;
  private onSelectionChange?: (id: string | null) => void;
  private rafPending = false;

  private boundDown = this.onPointerDown.bind(this);
  private boundMove = this.onPointerMove.bind(this);
  private boundUp = this.onPointerUp.bind(this);

  constructor(
    baseCanvas: HTMLCanvasElement,
    activeCanvas: HTMLCanvasElement,
    onCommit?: (objects: StrokeObject[]) => void,
    onSelectionChange?: (id: string | null) => void,
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
      if (this.selectedId) {
        const selectedObj = this.objects.find((o) => o.id === this.selectedId);
        if (selectedObj) {
          const bbox = getBoundingBox(selectedObj);
          const handleTolerance = 14;
          const handles: { handle: "tl" | "tr" | "br" | "bl"; corner: { x: number; y: number }; opposite: { x: number; y: number } }[] = [
            { handle: "tl", corner: { x: bbox.minX, y: bbox.minY }, opposite: { x: bbox.maxX, y: bbox.maxY } },
            { handle: "tr", corner: { x: bbox.maxX, y: bbox.minY }, opposite: { x: bbox.minX, y: bbox.maxY } },
            { handle: "br", corner: { x: bbox.maxX, y: bbox.maxY }, opposite: { x: bbox.minX, y: bbox.minY } },
            { handle: "bl", corner: { x: bbox.minX, y: bbox.maxY }, opposite: { x: bbox.maxX, y: bbox.minY } },
          ];

          const hitHandle = handles.find((h) => distance(h.corner, pt) < handleTolerance);
          if (hitHandle) {
            this.resizeHandle = hitHandle.handle;
            this.resizeOpposite = hitHandle.opposite;
            this.resizeInitialBBox = bbox;
            this.dragSnapshot = this.cloneObjects();
            return;
          }
        }
      }

      const hit = this.hitTest(pt);
      this.selectedId = hit?.id ?? null;
      this.onSelectionChange?.(this.selectedId);
      if (hit) {
        this.dragOrigin = pt;
        this.dragSnapshot = this.cloneObjects();
      }
      this.renderBase();
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isPointerDown) return;
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;

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

      if (this.currentTool === "select" && this.selectedId) {
        if (this.resizeHandle && this.resizeOpposite && this.resizeInitialBBox) {
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
              this.objects[idx] = scaleObject(original, scaleX, scaleY, this.resizeOpposite);
              this.renderBase();
            }
          }
        } else if (this.dragOrigin) {
          const dx = pt.x - this.dragOrigin.x;
          const dy = pt.y - this.dragOrigin.y;
          const idx = this.objects.findIndex((o) => o.id === this.selectedId);
          const original = this.dragSnapshot?.find((o) => o.id === this.selectedId);
          if (idx !== -1 && original) {
            this.objects[idx] = translateObject(original, dx, dy);
            this.renderBase();
          }
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

    if (this.currentTool === "select" && this.selectedId) {
      if (this.resizeHandle) {
        this.pushUndo(this.dragSnapshot!);
        this.onCommit?.(this.objects);
      } else if (this.dragOrigin) {
        const moved = this.dragSnapshot?.find((o) => o.id === this.selectedId);
        const now = this.objects.find((o) => o.id === this.selectedId);
        const movedOrigin = moved && firstPoint(moved);
        const nowOrigin = now && firstPoint(now);
        if (movedOrigin && nowOrigin && (movedOrigin.x !== nowOrigin.x || movedOrigin.y !== nowOrigin.y)) {
          this.pushUndo(this.dragSnapshot!);
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
    this.strokePath(this.activeCtx, this.activePoints, this.currentColor, this.currentSize, this.currentTool === "highlighter");
  }

  private strokePath(
    ctx: CanvasRenderingContext2D,
    points: StrokePoint[],
    color: string,
    size: number,
    isHighlighter: boolean
  ): void {
    if (points.length === 0) return;
    if (points.length === 1) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha = isHighlighter ? 0.35 : 1;
      const r = (size * (isHighlighter ? 3.5 : 0.6 + points[0]!.pressure * 1.4)) / 2;
      ctx.beginPath();
      ctx.arc(points[0]!.x, points[0]!.y, Math.max(1, r), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.lineCap = "round";
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
    } else {
      // Smooth pressure-modulated Bézier segments for pen tablet writing
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = i > 0 ? points[i - 1]! : points[0]!;
        const p1 = points[i]!;
        const p2 = points[i + 1]!;

        const startPt = i === 0 ? p1 : { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const endPt = i === points.length - 2 ? p2 : { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

        ctx.beginPath();
        ctx.moveTo(startPt.x, startPt.y);
        ctx.quadraticCurveTo(p1.x, p1.y, endPt.x, endPt.y);

        const pressure = p1.pressure && p1.pressure > 0 ? p1.pressure : 0.5;
        ctx.lineWidth = Math.max(0.75, size * (0.45 + pressure * 1.35));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  public renderBase(): void {
    this.baseCtx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    for (const obj of this.objects) {
      if (obj.type === "stroke") {
        this.strokePath(this.baseCtx, obj.points, obj.color, obj.size, obj.tool === "highlighter");
      } else if (obj.type === "text") {
        this.drawText(this.baseCtx, obj);
      } else {
        drawShape(this.baseCtx, obj);
      }
      if (obj.id === this.selectedId) {
        this.drawSelectionBox(obj);
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
      if (this.selectedId === id) {
        this.selectedId = null;
        this.onSelectionChange?.(null);
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
      if (obj.type === "shape" || obj.type === "text") {
        if (representativePoints(obj).some((p) => distance(p, pt) < ERASER_RADIUS)) {
          changed = true;
          continue;
        }
        next.push(obj);
        continue;
      }

      const segments: StrokePoint[][] = [[]];
      for (const p of obj.points) {
        if (distance(p, pt) < ERASER_RADIUS) {
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
    this.selectedId = null;
    this.renderBase();
    this.onCommit?.(this.objects);
  }

  public setTool(tool: CanvasTool): void {
    this.currentTool = tool;
    if (tool !== "select") {
      this.selectedId = null;
      this.onSelectionChange?.(null);
      this.renderBase();
    }
  }

  public deleteSelected(): void {
    if (!this.selectedId) return;
    this.pushUndo();
    this.objects = this.objects.filter((o) => o.id !== this.selectedId);
    this.selectedId = null;
    this.onSelectionChange?.(null);
    this.renderBase();
    this.onCommit?.(this.objects);
  }

  private cloneObjects(): StrokeObject[] {
    return this.objects.map((o) => {
      if (o.type === "stroke") return { ...o, points: o.points.map((p) => ({ ...p })) };
      if (o.type === "text") return { ...o, position: { ...o.position } };
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
    this.selectedId = null;
    this.renderBase();
  }

  public getObjects(): StrokeObject[] {
    return this.objects;
  }

  public isEmpty(): boolean {
    return this.objects.length === 0;
  }
}
