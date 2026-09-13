/**
 * General-purpose shape renderers for the live whiteboard.
 *
 * Every renderer draws within the axis-aligned box defined by `start`/`end`
 * (the same drag-rectangle interaction every shape tool already uses) — this
 * keeps the existing click-drag UX unchanged while swapping in real,
 * distinct geometry per shape id instead of the old "one of 5 primitives"
 * aliasing. See shapes/registry.ts for how these are wired into the canvas
 * engine's render/hit-test dispatch.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface ShapeRenderArgs {
  ctx: CanvasRenderingContext2D;
  start: Pt;
  end: Pt;
  color: string;
  size: number;
  fill?: string;
}

export type ShapeRenderer = (args: ShapeRenderArgs) => void;

export function box(start: Pt, end: Pt) {
  const x1 = Math.min(start.x, end.x);
  const y1 = Math.min(start.y, end.y);
  const x2 = Math.max(start.x, end.x);
  const y2 = Math.max(start.y, end.y);
  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}

function withStroke(ctx: CanvasRenderingContext2D, color: string, size: number, fn: () => void) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  fn();
  ctx.restore();
}

function drawArrowHead(ctx: CanvasRenderingContext2D, tip: Pt, angle: number, size: number, color: string) {
  const headLen = 8 + size * 2;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - headLen * Math.cos(angle - Math.PI / 7), tip.y - headLen * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(tip.x - headLen * Math.cos(angle + Math.PI / 7), tip.y - headLen * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function regularPolygonPoints(cx: number, cy: number, rx: number, ry: number, sides: number, rotation = -Math.PI / 2): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (Math.PI * 2 * i) / sides;
    pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return pts;
}

function strokePolygon(ctx: CanvasRenderingContext2D, pts: Pt[], close = true) {
  if (pts.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  if (close) ctx.closePath();
  ctx.stroke();
}

// ---- line family ----------------------------------------------------------

export const drawLine: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  });
};

export const drawDashedLine: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  withStroke(ctx, color, size, () => {
    ctx.setLineDash([size * 3, size * 2]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  });
};

export const drawDottedLine: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  withStroke(ctx, color, size, () => {
    ctx.setLineDash([1, size * 2.2]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  });
};

export const drawArrow: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    drawArrowHead(ctx, end, Math.atan2(end.y - start.y, end.x - start.x), size, color);
  });
};

export const drawDoubleArrow: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    drawArrowHead(ctx, end, angle, size, color);
    drawArrowHead(ctx, start, angle + Math.PI, size, color);
  });
};

export const drawCurvedArrow: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  withStroke(ctx, color, size, () => {
    // Control point bowed perpendicular to the start->end line so the curve
    // reads as a deliberate arc rather than a straight line with an
    // arrowhead — bow amount scales with the drag distance.
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;
    const bow = dist * 0.25;
    const ctrl = { x: (start.x + end.x) / 2 + nx * bow, y: (start.y + end.y) / 2 + ny * bow };
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(ctrl.x, ctrl.y, end.x, end.y);
    ctx.stroke();
    const tangentAngle = Math.atan2(end.y - ctrl.y, end.x - ctrl.x);
    drawArrowHead(ctx, end, tangentAngle, size, color);
  });
};

export const drawArc: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  const b = box(start, end);
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.ellipse(b.cx, b.y2, b.w / 2, b.h, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  });
};

// ---- filled/outline primitives ---------------------------------------------

export const drawCircle: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  const b = box(start, end);
  // True circle: uses the smaller of width/height as a shared radius so it
  // never silently becomes an ellipse — Ellipse (below) is the free-aspect
  // version, kept as a separate tool per the shape library spec.
  const r = Math.min(b.w, b.h) / 2;
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.ellipse(b.cx, b.cy, r, r, 0, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  });
};

export const drawEllipse: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  const b = box(start, end);
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.ellipse(b.cx, b.cy, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  });
};

export const drawRectangle: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  withStroke(ctx, color, size, () => {
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(start.x, start.y, end.x - start.x, end.y - start.y);
    }
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
  });
};

export const drawSquare: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  const b = box(start, end);
  const s = Math.min(b.w, b.h);
  const x = start.x <= end.x ? b.x1 : b.x1 + (b.w - s);
  const y = start.y <= end.y ? b.y1 : b.y1 + (b.h - s);
  withStroke(ctx, color, size, () => {
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, s, s);
    }
    ctx.strokeRect(x, y, s, s);
  });
};

export const drawRoundedRectangle: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  const b = box(start, end);
  const radius = Math.min(24, b.w / 4, b.h / 4);
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(b.x1, b.y1, b.w, b.h, radius);
    } else {
      const r = Math.max(0, radius);
      ctx.moveTo(b.x1 + r, b.y1);
      ctx.arcTo(b.x2, b.y1, b.x2, b.y2, r);
      ctx.arcTo(b.x2, b.y2, b.x1, b.y2, r);
      ctx.arcTo(b.x1, b.y2, b.x1, b.y1, r);
      ctx.arcTo(b.x1, b.y1, b.x2, b.y1, r);
      ctx.closePath();
    }
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  });
};

export const drawTriangle: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  withStroke(ctx, color, size, () => {
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
  });
};

export const drawRightTriangle: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  const b = box(start, end);
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x1, b.y2);
    ctx.lineTo(b.x2, b.y2);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  });
};

export const drawDiamond: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  const b = box(start, end);
  withStroke(ctx, color, size, () => {
    strokePolygon(ctx, [
      { x: b.cx, y: b.y1 },
      { x: b.x2, y: b.cy },
      { x: b.cx, y: b.y2 },
      { x: b.x1, y: b.cy },
    ]);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  });
};

export const drawPolygon: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  const b = box(start, end);
  withStroke(ctx, color, size, () => {
    const pts = regularPolygonPoints(b.cx, b.cy, b.w / 2, b.h / 2, 6);
    strokePolygon(ctx, pts);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  });
};

export const drawStar: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  const b = box(start, end);
  const outerRx = b.w / 2;
  const outerRy = b.h / 2;
  const points = 5;
  const pts: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = -Math.PI / 2 + (Math.PI * i) / points;
    const scale = i % 2 === 0 ? 1 : 0.42;
    pts.push({ x: b.cx + outerRx * scale * Math.cos(angle), y: b.cy + outerRy * scale * Math.sin(angle) });
  }
  withStroke(ctx, color, size, () => {
    strokePolygon(ctx, pts);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  });
};

// ---- bracket family ---------------------------------------------------------

export const drawBracket: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  const b = box(start, end);
  const tick = Math.max(6, b.w * 0.3);
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(b.x2, b.y1);
    ctx.lineTo(b.x1, b.y1);
    ctx.lineTo(b.x1, b.y2);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    void tick;
  });
};

export const drawCurlyBracket: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  const b = box(start, end);
  const midY = b.cy;
  const bow = Math.max(6, b.w * 0.6);
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(b.x2, b.y1);
    ctx.quadraticCurveTo(b.x1, b.y1, b.x1, (b.y1 + midY) / 2);
    ctx.quadraticCurveTo(b.x1 - bow * 0.4, midY, b.x1, (midY + b.y2) / 2);
    ctx.quadraticCurveTo(b.x1, b.y2, b.x2, b.y2);
    ctx.stroke();
  });
};

// ---- annotation marks --------------------------------------------------------

export const drawCheckMark: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  const b = box(start, end);
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(b.x1, b.cy);
    ctx.lineTo(b.x1 + b.w * 0.35, b.y2);
    ctx.lineTo(b.x2, b.y1);
    ctx.stroke();
  });
};

export const drawCrossMark: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  const b = box(start, end);
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.moveTo(b.x2, b.y1);
    ctx.lineTo(b.x1, b.y2);
    ctx.stroke();
  });
};

function drawGlyph(ctx: CanvasRenderingContext2D, box_: ReturnType<typeof box>, color: string, glyph: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `900 ${Math.max(18, box_.h)}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, box_.cx, box_.cy);
  ctx.restore();
}

export const drawQuestionMark: ShapeRenderer = ({ ctx, start, end, color }) => drawGlyph(ctx, box(start, end), color, "?");
export const drawExclamationMark: ShapeRenderer = ({ ctx, start, end, color }) => drawGlyph(ctx, box(start, end), color, "!");

export const drawHighlightArea: ShapeRenderer = ({ ctx, start, end, color }) => {
  const b = box(start, end);
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = color;
  ctx.fillRect(b.x1, b.y1, b.w, b.h);
  ctx.restore();
};

export const drawCallout: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  const b = box(start, end);
  const radius = Math.min(16, b.w / 5, b.h / 4);
  const tailW = Math.min(b.w * 0.2, 20);
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(b.x1, b.y1, b.w, b.h * 0.8, radius);
    } else {
      ctx.rect(b.x1, b.y1, b.w, b.h * 0.8);
    }
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
    // Tail, drawn as its own closed path so it fills/strokes cleanly against
    // the rounded body above it.
    ctx.beginPath();
    ctx.moveTo(b.x1 + b.w * 0.2, b.y1 + b.h * 0.8);
    ctx.lineTo(b.x1 + b.w * 0.2 - tailW * 0.4, b.y2);
    ctx.lineTo(b.x1 + b.w * 0.2 + tailW, b.y1 + b.h * 0.8);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  });
};

export const drawSpeechBubble: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  const b = box(start, end);
  const rx = b.w / 2;
  const ry = (b.h * 0.8) / 2;
  const cx = b.cx;
  const cy = b.y1 + ry;
  const tailW = Math.min(b.w * 0.18, 18);
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - tailW, cy + ry * 0.7);
    ctx.lineTo(cx - tailW * 0.3, b.y2);
    ctx.lineTo(cx + tailW * 0.6, cy + ry * 0.85);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  });
};

/**
 * "Freehand Shape" — a quick closed organic blob, not true point-by-point
 * freehand tracing (that's what the pen tool is for). Approximated as a
 * smooth closed spline through points nudged randomly-but-deterministically
 * off the bounding ellipse, so repeated placements of the same size don't
 * all look identical while staying reproducible for a given start/end.
 */
export const drawFreehandShape: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  const b = box(start, end);
  const rx = b.w / 2;
  const ry = b.h / 2;
  const nodes = 8;
  const pts: Pt[] = [];
  for (let i = 0; i < nodes; i++) {
    const angle = (Math.PI * 2 * i) / nodes;
    // Deterministic pseudo-noise from the index — no Math.random(), so the
    // exact same drag always reproduces the exact same blob.
    const wobble = 0.82 + 0.18 * Math.sin(i * 2.4 + 1.3) * Math.cos(i * 1.7);
    pts.push({ x: b.cx + rx * wobble * Math.cos(angle), y: b.cy + ry * wobble * Math.sin(angle) });
  }
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo((pts[0]!.x + pts[nodes - 1]!.x) / 2, (pts[0]!.y + pts[nodes - 1]!.y) / 2);
    for (let i = 0; i < nodes; i++) {
      const cur = pts[i]!;
      const next = pts[(i + 1) % nodes]!;
      const mid = { x: (cur.x + next.x) / 2, y: (cur.y + next.y) / 2 };
      ctx.quadraticCurveTo(cur.x, cur.y, mid.x, mid.y);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  });
};

export const GENERAL_SHAPE_RENDERERS: Record<string, ShapeRenderer> = {
  line: drawLine,
  arrow: drawArrow,
  "double-arrow": drawDoubleArrow,
  "curved-arrow": drawCurvedArrow,
  circle: drawCircle,
  ellipse: drawEllipse,
  rectangle: drawRectangle,
  square: drawSquare,
  "rounded-rectangle": drawRoundedRectangle,
  triangle: drawTriangle,
  "right-triangle": drawRightTriangle,
  polygon: drawPolygon,
  star: drawStar,
  diamond: drawDiamond,
  bracket: drawBracket,
  "curly-bracket": drawCurlyBracket,
  arc: drawArc,
  "freehand-shape": drawFreehandShape,
  "dashed-line": drawDashedLine,
  "dotted-line": drawDottedLine,
  "check-mark": drawCheckMark,
  "cross-mark": drawCrossMark,
  "question-mark": drawQuestionMark,
  "exclamation-mark": drawExclamationMark,
  "highlight-area": drawHighlightArea,
  callout: drawCallout,
  "speech-bubble": drawSpeechBubble,
};

/** Ids whose fillable geometry is a precise, simple region — used by the
 * bucket tool's object-fill fast path (see canvas-engine.ts's FILLABLE). */
export const GENERAL_FILLABLE_IDS = [
  "circle",
  "ellipse",
  "rectangle",
  "square",
  "rounded-rectangle",
  "triangle",
  "right-triangle",
  "polygon",
  "star",
  "diamond",
  "callout",
  "speech-bubble",
  "freehand-shape",
];
