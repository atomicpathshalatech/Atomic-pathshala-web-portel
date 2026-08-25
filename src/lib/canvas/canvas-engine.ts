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

export type StrokeObject = FreehandObject | ShapeObject;

export type CanvasTool =
  | "pen"
  | "highlighter"
  | "stroke-eraser"
  | "object-eraser"
  | "select"
  | ShapeKind;

const SHAPE_TOOLS: ShapeKind[] = ["line", "rectangle", "circle", "triangle", "arrow"];
function isShapeTool(tool: CanvasTool): tool is ShapeKind {
  return (SHAPE_TOOLS as string[]).includes(tool);
}

// Below this drag distance (px), a shape commit is treated as an accidental
// click rather than an intentional zero-size shape — mirrors the freehand
// path's `activePoints.length > 1` guard, just for the shape tools.
const MIN_SHAPE_DRAG = 3;

const ERASER_RADIUS = 14;
const SELECT_HIT_RADIUS = 10;

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
  return obj.type === "stroke" ? obj.points[0] : obj.start;
}

function translateObject(obj: StrokeObject, dx: number, dy: number): StrokeObject {
  if (obj.type === "stroke") {
    return { ...obj, points: obj.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
  }
  return {
    ...obj,
    start: { x: obj.start.x + dx, y: obj.start.y + dy },
    end: { x: obj.end.x + dx, y: obj.end.y + dy },
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
    const width = this.activeCanvas.offsetWidth;
    const height = this.activeCanvas.offsetHeight;
    for (const canvas of [this.baseCanvas, this.activeCanvas]) {
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    }
    this.baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.activeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderBase();
  }

  private getPoint(e: PointerEvent): StrokePoint {
    // rect is the live, transform-inclusive visual box (so it shrinks/grows
    // with zoom); offsetWidth/Height is the fixed logical box syncSize()
    // sized the backing store against. Scaling by their ratio converts a
    // real screen-space pointer position back into that fixed logical space
    // regardless of the current zoom level — same pattern WhiteboardCanvas.
    // tsx uses for devicePixelRatio, just driven by CSS transform here too.
    const rect = this.activeCanvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? this.activeCanvas.offsetWidth / rect.width : 1;
    const scaleY = rect.height > 0 ? this.activeCanvas.offsetHeight / rect.height : 1;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure && e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.pointerType === "touch" && this.currentTool === "select") {
      // allow pinch/two-finger pan gestures to pass through to the parent
      // when in select mode with no single point drag in progress
    }
    e.preventDefault();
    this.activeCanvas.setPointerCapture(e.pointerId);
    this.isPointerDown = true;
    const pt = this.getPoint(e);

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
    const pt = this.getPoint(e);

    if (this.currentTool === "pen" || this.currentTool === "highlighter") {
      this.activePoints.push(pt);
      this.scheduleActiveRender();
      return;
    }

    if (isShapeTool(this.currentTool) && this.shapeStart) {
      this.shapeEnd = { x: pt.x, y: pt.y };
      this.scheduleActiveRender();
      return;
    }

    if (this.currentTool === "stroke-eraser") {
      this.eraseAtPoint(pt);
      return;
    }

    if (this.currentTool === "select" && this.selectedId && this.dragOrigin) {
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

  private onPointerUp(e: PointerEvent): void {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    try {
      this.activeCanvas.releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released — safe to ignore
    }

    if ((this.currentTool === "pen" || this.currentTool === "highlighter") && this.activePoints.length > 1) {
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

    if (this.currentTool === "select" && this.dragOrigin && this.selectedId) {
      // If it actually moved, the drag already mutated `objects` in place —
      // just commit. If it didn't move, nothing changed, no-op commit skipped.
      const moved = this.dragSnapshot?.find((o) => o.id === this.selectedId);
      const now = this.objects.find((o) => o.id === this.selectedId);
      const movedOrigin = moved && firstPoint(moved);
      const nowOrigin = now && firstPoint(now);
      if (movedOrigin && nowOrigin && (movedOrigin.x !== nowOrigin.x || movedOrigin.y !== nowOrigin.y)) {
        this.pushUndo(this.dragSnapshot!);
        this.onCommit?.(this.objects);
      }
    }

    this.activePoints = [];
    this.dragOrigin = null;
    this.dragSnapshot = null;
    this.shapeStart = null;
    this.shapeEnd = null;
    this.activeCtx.clearRect(0, 0, this.activeCanvas.width, this.activeCanvas.height);
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
    const rect = this.activeCanvas.getBoundingClientRect();
    this.activeCtx.clearRect(0, 0, rect.width, rect.height);

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
    if (points.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.globalAlpha = isHighlighter ? 0.35 : 1;
    ctx.globalCompositeOperation = "source-over";

    // Quadratic-through-midpoints smoothing — cheap and looks natural for
    // handwriting without needing a full spline library.
    ctx.beginPath();
    // Non-null throughout: guarded above by `points.length < 2` returning
    // early, and the loop bound (i < points.length - 1) keeps i/i+1 in range.
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i]!;
      const p2 = points[i + 1]!;
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      ctx.lineWidth = size * (isHighlighter ? 3 : 0.6 + p1.pressure * 1.4);
      ctx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y);
    }
    const last = points[points.length - 1]!;
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
  }

  public renderBase(): void {
    const rect = this.baseCanvas.getBoundingClientRect();
    this.baseCtx.clearRect(0, 0, rect.width, rect.height);
    for (const obj of this.objects) {
      if (obj.type === "stroke") {
        this.strokePath(this.baseCtx, obj.points, obj.color, obj.size, obj.tool === "highlighter");
      } else {
        drawShape(this.baseCtx, obj);
      }
      if (obj.id === this.selectedId) {
        this.drawSelectionBox(obj);
      }
    }
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
    this.baseCtx.restore();
  }

  private hitTest(pt: StrokePoint): StrokeObject | null {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      // Non-null: i is always a valid index of this.objects in this loop.
      const obj = this.objects[i]!;
      if (representativePoints(obj).some((p) => distance(p, pt) < SELECT_HIT_RADIUS)) return obj;
    }
    return null;
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
      if (obj.type === "shape") {
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
        if (seg.length > 1) {
          next.push({ ...obj, id: seg === segments[0] ? obj.id : uid(), points: seg });
        }
      }
    }

    if (changed) {
      this.objects = next;
      this.renderBase();
      this.onCommit?.(this.objects);
    }
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
    return this.objects.map((o) =>
      o.type === "stroke"
        ? { ...o, points: o.points.map((p) => ({ ...p })) }
        : { ...o, start: { ...o.start }, end: { ...o.end } }
    );
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
    this.objects = objects;
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
