/**
 * Chemistry structure renderers for the live whiteboard.
 *
 * Rather than hand-drawing ~50 unique structures, this builds a handful of
 * parameterized skeletal-formula primitives (zigzag carbon chain, ring
 * polygon, bond-order line, bond-to-label) and generates the full structure
 * library by calling them with different parameters. Adding a new structure
 * later is a one-line registry entry (see registry.ts), not a new canvas
 * function — this is what the "must be easy to add more structures later
 * without rewriting the canvas" requirement is actually asking for.
 *
 * All renderers draw within the axis-aligned box defined by start/end, same
 * as shapes/general-shapes.ts.
 */
import type { Pt, ShapeRenderArgs, ShapeRenderer } from "./general-shapes";
import { box, drawDoubleArrow } from "./general-shapes";

function withStroke(ctx: CanvasRenderingContext2D, color: string, size: number, fn: () => void) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.7);
  fn();
  ctx.restore();
}

function drawVertexDot(ctx: CanvasRenderingContext2D, p: Pt, color: string, r: number) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawLabelAt(ctx: CanvasRenderingContext2D, p: Pt, text: string, color: string, fontPx: number, align: CanvasTextAlign = "left") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `700 ${fontPx}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, p.x, p.y);
  ctx.restore();
}

/** Offsets a line segment perpendicular to its own direction — the basis
 * for double/triple bond lines (parallel strokes) and wedge/dash bonds. */
function perpOffset(a: Pt, b: Pt, dist: number): { x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (-dy / len) * dist, y: (dx / len) * dist };
}

// ---- carbon chains ----------------------------------------------------------

interface ChainOptions {
  carbons: number;
  doubleBondAt?: number; // 0-based segment index rendered as a double bond
  tripleBondAt?: number;
  openEnd?: boolean; // draw a short unlabeled stub at the end (alkyl group)
  branchAt?: number; // 0-based vertex index to sprout one branch bond from
}

function chainVertices(b: ReturnType<typeof box>, carbons: number): Pt[] {
  const n = Math.max(1, carbons);
  if (n === 1) return [{ x: b.cx, y: b.cy }];
  const pts: Pt[] = [];
  const amplitude = b.h * 0.32;
  for (let i = 0; i < n; i++) {
    const x = b.x1 + (b.w * i) / (n - 1);
    const y = i % 2 === 0 ? b.cy + amplitude / 2 : b.cy - amplitude / 2;
    pts.push({ x, y });
  }
  return pts;
}

function drawChainSegment(ctx: CanvasRenderingContext2D, a: Pt, c: Pt, color: string, order: 1 | 2 | 3) {
  if (order === 1) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    return;
  }
  const gap = 4;
  const offsets = order === 2 ? [-gap / 2, gap / 2] : [-gap, 0, gap];
  for (const d of offsets) {
    const o = perpOffset(a, c, d);
    ctx.beginPath();
    ctx.moveTo(a.x + o.x, a.y + o.y);
    ctx.lineTo(c.x + o.x, c.y + o.y);
    ctx.stroke();
  }
}

export function drawCarbonChain(args: ShapeRenderArgs, opts: ChainOptions): void {
  const { ctx, start, end, color, size } = args;
  const b = box(start, end);
  withStroke(ctx, color, size, () => {
    if (opts.carbons <= 1) {
      // Methane: a central vertex with four short bonds radiating out —
      // skeletal shorthand for a tetrahedral CH4 center (H atoms implied,
      // same convention as every other skeletal structure here).
      const stubs: Pt[] = [
        { x: b.cx - b.w * 0.3, y: b.cy - b.h * 0.35 },
        { x: b.cx + b.w * 0.3, y: b.cy - b.h * 0.35 },
        { x: b.cx - b.w * 0.3, y: b.cy + b.h * 0.35 },
        { x: b.cx + b.w * 0.3, y: b.cy + b.h * 0.35 },
      ];
      for (const s of stubs) drawChainSegment(ctx, { x: b.cx, y: b.cy }, s, color, 1);
      drawVertexDot(ctx, { x: b.cx, y: b.cy }, color, size * 0.6);
      return;
    }

    const verts = chainVertices(b, opts.carbons);
    for (let i = 0; i < verts.length - 1; i++) {
      const order: 1 | 2 | 3 = i === opts.tripleBondAt ? 3 : i === opts.doubleBondAt ? 2 : 1;
      drawChainSegment(ctx, verts[i]!, verts[i + 1]!, color, order);
    }
    for (const v of verts) drawVertexDot(ctx, v, color, size * 0.4);

    const branchVertex = opts.branchAt != null ? verts[opts.branchAt] : undefined;
    if (branchVertex) {
      const branchTip = { x: branchVertex.x, y: branchVertex.y - b.h * 0.45 };
      drawChainSegment(ctx, branchVertex, branchTip, color, 1);
      drawVertexDot(ctx, branchTip, color, size * 0.4);
    }

    if (opts.openEnd && verts.length > 0) {
      const last = verts[verts.length - 1]!;
      const prev = verts.length > 1 ? verts[verts.length - 2]! : undefined;
      const dir = prev ? { x: last.x - prev.x, y: last.y - prev.y } : { x: 1, y: 0 };
      const len = Math.hypot(dir.x, dir.y) || 1;
      const tip = { x: last.x + (dir.x / len) * b.w * 0.15, y: last.y + (dir.y / len) * b.h * 0.3 };
      drawChainSegment(ctx, last, tip, color, 1);
    }
  });
}

// ---- rings --------------------------------------------------------------------

interface RingOptions {
  sides: number;
  aromatic?: "circle" | "alt-bonds";
  substituent?: string;
}

export function drawRing(args: ShapeRenderArgs, opts: RingOptions): void {
  const { ctx, start, end, color, size } = args;
  const b = box(start, end);
  const rx = (Math.min(b.w, b.h) / 2) * 0.9;
  const cx = b.cx;
  const cy = b.cy;
  const rotation = -Math.PI / 2 + (opts.sides % 2 === 0 ? Math.PI / opts.sides : 0);
  const verts: Pt[] = [];
  for (let i = 0; i < opts.sides; i++) {
    const angle = rotation + (Math.PI * 2 * i) / opts.sides;
    verts.push({ x: cx + rx * Math.cos(angle), y: cy + rx * Math.sin(angle) });
  }

  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(verts[0]!.x, verts[0]!.y);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i]!.x, verts[i]!.y);
    ctx.closePath();
    ctx.stroke();

    if (opts.aromatic === "circle") {
      ctx.beginPath();
      ctx.arc(cx, cy, rx * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    } else if (opts.aromatic === "alt-bonds") {
      for (let i = 0; i < verts.length; i += 2) {
        const a = verts[i]!;
        const c = verts[(i + 1) % verts.length]!;
        const mid = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
        const inward = { x: cx - mid.x, y: cy - mid.y };
        const len = Math.hypot(inward.x, inward.y) || 1;
        const pull = rx * 0.18;
        const a2 = { x: a.x + (inward.x / len) * pull, y: a.y + (inward.y / len) * pull };
        const c2 = { x: c.x + (inward.x / len) * pull, y: c.y + (inward.y / len) * pull };
        ctx.beginPath();
        ctx.moveTo(a2.x, a2.y);
        ctx.lineTo(c2.x, c2.y);
        ctx.stroke();
      }
    }

    if (opts.substituent) {
      const tipVertex = verts[0]!;
      const outward = { x: tipVertex.x - cx, y: tipVertex.y - cy };
      const len = Math.hypot(outward.x, outward.y) || 1;
      const stubEnd = { x: tipVertex.x + (outward.x / len) * rx * 0.5, y: tipVertex.y + (outward.y / len) * rx * 0.5 };
      ctx.beginPath();
      ctx.moveTo(tipVertex.x, tipVertex.y);
      ctx.lineTo(stubEnd.x, stubEnd.y);
      ctx.stroke();
      const labelPos = { x: stubEnd.x + (outward.x / len) * 6, y: stubEnd.y + (outward.y / len) * 6 };
      drawLabelAt(ctx, labelPos, opts.substituent, color, Math.max(14, rx * 0.32), outward.x >= 0 ? "left" : "right");
    }
  });
}

// ---- bond types -----------------------------------------------------------------

export type BondType = "single" | "double" | "triple" | "wedge" | "dash";

export function drawBond(args: ShapeRenderArgs, type: BondType): void {
  const { ctx, start, end, color, size } = args;
  withStroke(ctx, color, size, () => {
    if (type === "single") {
      drawChainSegment(ctx, start, end, color, 1);
    } else if (type === "double") {
      drawChainSegment(ctx, start, end, color, 2);
    } else if (type === "triple") {
      drawChainSegment(ctx, start, end, color, 3);
    } else if (type === "wedge") {
      // Solid filled triangle, narrow at `start` widening toward `end` —
      // standard "bond coming toward the viewer" notation.
      const perp = perpOffset(start, end, size * 1.8);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x + perp.x, end.y + perp.y);
      ctx.lineTo(end.x - perp.x, end.y - perp.y);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else if (type === "dash") {
      // Hashed wedge — a series of perpendicular ticks that grow from a
      // point at `start` to full width at `end`, standard "bond going away
      // from the viewer" notation.
      const steps = 6;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const p = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
        const perp = perpOffset(start, end, size * 1.6 * t);
        ctx.beginPath();
        ctx.moveTo(p.x - perp.x, p.y - perp.y);
        ctx.lineTo(p.x + perp.x, p.y + perp.y);
        ctx.stroke();
      }
    }
  });
}

export function drawResonanceArrow(args: ShapeRenderArgs): void {
  drawDoubleArrow(args);
}

// ---- inorganic / common lab equipment -----------------------------------------

export const drawFlask: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  const b = box(start, end);
  const neckW = b.w * 0.22;
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(b.cx - neckW / 2, b.y1);
    ctx.lineTo(b.cx - neckW / 2, b.cy);
    ctx.lineTo(b.x1, b.y2);
    ctx.lineTo(b.x2, b.y2);
    ctx.lineTo(b.cx + neckW / 2, b.cy);
    ctx.lineTo(b.cx + neckW / 2, b.y1);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.cx - neckW / 2, b.y1);
    ctx.lineTo(b.cx + neckW / 2, b.y1);
    ctx.stroke();
  });
};

export const drawAtomModel: ShapeRenderer = ({ ctx, start, end, color, size }) => {
  const b = box(start, end);
  const nucleusR = Math.min(b.w, b.h) * 0.08;
  withStroke(ctx, color, size, () => {
    for (const rot of [0, Math.PI / 3, (Math.PI * 2) / 3]) {
      ctx.save();
      ctx.translate(b.cx, b.cy);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, b.w / 2, b.h / 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  });
  ctx.beginPath();
  ctx.arc(b.cx, b.cy, nucleusR, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
};

export const drawTestTube: ShapeRenderer = ({ ctx, start, end, color, size, fill }) => {
  const b = box(start, end);
  const r = b.w / 2;
  withStroke(ctx, color, size, () => {
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x1, b.y2 - r);
    ctx.arc(b.cx, b.y2 - r, r, Math.PI, 0, false);
    ctx.lineTo(b.x2, b.y1);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y1);
    ctx.stroke();
  });
};

// ---- functional groups: a bond ending in (or centered on) a text label ------------

export function drawFunctionalGroup(args: ShapeRenderArgs, label: string, labelPosition: "end" | "middle" = "end"): void {
  const { ctx, start, end, color, size } = args;
  const fontPx = Math.max(16, size * 5);
  withStroke(ctx, color, size, () => {
    if (labelPosition === "middle") {
      // e.g. an ether's central -O-: draw two short bond stubs with the
      // label sitting in the gap between them, rather than one continuous
      // line running under the text.
      const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      const gap = Math.max(20, fontPx * 0.9);
      const dir = { x: end.x - start.x, y: end.y - start.y };
      const len = Math.hypot(dir.x, dir.y) || 1;
      const unit = { x: dir.x / len, y: dir.y / len };
      const gapStart = { x: mid.x - unit.x * (gap / 2), y: mid.y - unit.y * (gap / 2) };
      const gapEnd = { x: mid.x + unit.x * (gap / 2), y: mid.y + unit.y * (gap / 2) };
      drawChainSegment(ctx, start, gapStart, color, 1);
      drawChainSegment(ctx, gapEnd, end, color, 1);
      drawLabelAt(ctx, mid, label, color, fontPx, "center");
    } else {
      drawChainSegment(ctx, start, end, color, 1);
      const dir = { x: end.x - start.x, y: end.y - start.y };
      const len = Math.hypot(dir.x, dir.y) || 1;
      const labelPos = { x: end.x + (dir.x / len) * 6, y: end.y + (dir.y / len) * 6 };
      drawLabelAt(ctx, labelPos, label, color, fontPx, dir.x >= 0 ? "left" : "right");
    }
  });
}

// ---- registry-facing renderer factory -----------------------------------------------

const RING = (sides: number, aromatic?: RingOptions["aromatic"], substituent?: string): ShapeRenderer => (args) =>
  drawRing(args, { sides, aromatic, substituent });

const CHAIN = (opts: ChainOptions): ShapeRenderer => (args) => drawCarbonChain(args, opts);

const BOND = (type: BondType): ShapeRenderer => (args) => drawBond(args, type);

const FG = (label: string, labelPosition: "end" | "middle" = "end"): ShapeRenderer => (args) =>
  drawFunctionalGroup(args, label, labelPosition);

export const CHEMISTRY_SHAPE_RENDERERS: Record<string, ShapeRenderer> = {
  // Carbon chains
  methane: CHAIN({ carbons: 1 }),
  ethane: CHAIN({ carbons: 2 }),
  propane: CHAIN({ carbons: 3 }),
  butane: CHAIN({ carbons: 4 }),
  pentane: CHAIN({ carbons: 5 }),
  hexane: CHAIN({ carbons: 6 }),
  heptane: CHAIN({ carbons: 7 }),
  "straight-chain": CHAIN({ carbons: 5 }),
  "branched-chain": CHAIN({ carbons: 4, branchAt: 1 }),
  "alkyl-group": CHAIN({ carbons: 3, openEnd: true }),

  // Bond types
  "bond-single": BOND("single"),
  "bond-double": BOND("double"),
  "bond-triple": BOND("triple"),
  "bond-wedge": BOND("wedge"),
  "bond-dash": BOND("dash"),
  "bond-resonance": drawResonanceArrow,

  // Functional groups
  "fg-alcohol": FG("OH"),
  "fg-phenol": FG("OH"),
  "fg-ether": FG("O", "middle"),
  "fg-aldehyde": FG("CHO"),
  "fg-ketone": FG("C=O", "middle"),
  "fg-carboxylic-acid": FG("COOH"),
  "fg-ester": FG("COO", "middle"),
  "fg-amine": FG("NH2"),
  "fg-amide": FG("CONH2"),
  "fg-nitrile": FG("C≡N"),
  "fg-nitro": FG("NO2"),
  "fg-halo": FG("X"),

  // Hydrocarbon classes
  alkane: CHAIN({ carbons: 4 }),
  alkene: CHAIN({ carbons: 4, doubleBondAt: 1 }),
  alkyne: CHAIN({ carbons: 4, tripleBondAt: 1 }),
  cycloalkane: RING(6),
  "cyclic-structure": RING(5),

  // Aromatic structures
  benzene: RING(6, "alt-bonds"),
  "benzene-circle": RING(6, "circle"),
  toluene: RING(6, "alt-bonds", "CH3"),
  "aromatic-phenol": RING(6, "alt-bonds", "OH"),
  aniline: RING(6, "alt-bonds", "NH2"),
  chlorobenzene: RING(6, "alt-bonds", "Cl"),
  nitrobenzene: RING(6, "alt-bonds", "NO2"),
  benzaldehyde: RING(6, "alt-bonds", "CHO"),
  "benzoic-acid": RING(6, "alt-bonds", "COOH"),

  // Common rings
  cyclopropane: RING(3),
  cyclobutane: RING(4),
  cyclopentane: RING(5),
  cyclohexane: RING(6),
  "five-ring-aromatic": RING(5, "alt-bonds"),

  // Inorganic / common lab equipment
  flask: drawFlask,
  "atom-model": drawAtomModel,
  "test-tube": drawTestTube,
};

/** All chemistry ids draw a closed-enough region that bucket fill's
 * object-fill fast path can reasonably target their outline; the raster
 * flood-fill fallback in canvas-engine.ts still covers anything not listed
 * here, so this is an optimization list, not a correctness requirement. */
export const CHEMISTRY_FILLABLE_IDS = [
  "cycloalkane",
  "cyclic-structure",
  "benzene",
  "benzene-circle",
  "toluene",
  "aromatic-phenol",
  "aniline",
  "chlorobenzene",
  "nitrobenzene",
  "benzaldehyde",
  "benzoic-acid",
  "cyclopropane",
  "cyclobutane",
  "cyclopentane",
  "cyclohexane",
  "five-ring-aromatic",
  "flask",
  "test-tube",
];
