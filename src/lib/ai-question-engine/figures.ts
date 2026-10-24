import "server-only";
import path from "node:path";
import { existsSync } from "node:fs";

/**
 * Figures for AI-generated visual questions. The model never draws pixels:
 * it describes the figure as data, and the figure is drawn here —
 *   graph       axes + data points (curves are drawn from the points, so the
 *               picture matches what the question says about it)
 *   structures  chemical structures from SMILES (openchemlib depiction)
 *   diagram     a simple labelled schematic (apparatus, cell, circuit, flow)
 *               as a small SVG, checked and redrawn from an allow-list
 * and saved as a PNG (no script can live in a PNG). Labels on figures are
 * English letters/symbols; Hindi stays in the question text.
 */

export type GraphFigure = {
  kind: "graph";
  title?: string;
  xLabel: string;
  yLabel: string;
  series: { label?: string; points: [number, number][]; style?: "line" | "curve" | "points" }[];
  markers?: { x: number; y: number; label: string }[];
  xTicks?: boolean;
  yTicks?: boolean;
};
export type StructuresFigure = { kind: "structures"; items: { label: string; smiles: string }[] };
export type DiagramFigure = { kind: "diagram"; svg: string };
export type FigureSpec = (GraphFigure | StructuresFigure | DiagramFigure) & { caption?: string };

const W = 640;
const H = 400;
const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const DEVANAGARI = /[ऀ-ॿ]/;
const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);

/** Reads the model's figure object; null when there is none. Problems are returned, never hidden. */
export function parseFigure(raw: unknown): { figure: FigureSpec | null; problem?: string } {
  if (!raw || typeof raw !== "object") return { figure: null };
  const f = raw as Record<string, any>;
  const caption = typeof f.caption === "string" ? f.caption.slice(0, 200) : undefined;
  if (f.kind === "graph") {
    const series = Array.isArray(f.series) ? f.series : [];
    const clean = series
      .map((s: any) => ({
        label: typeof s?.label === "string" ? s.label.slice(0, 40) : undefined,
        style: ["line", "curve", "points"].includes(s?.style) ? s.style : "curve",
        points: (Array.isArray(s?.points) ? s.points : [])
          .map((p: any) => (Array.isArray(p) ? [Number(p[0]), Number(p[1])] : [Number(p?.x), Number(p?.y)]))
          .filter((p: number[]) => finite(p[0]) && finite(p[1]))
          .slice(0, 200) as [number, number][],
      }))
      .filter((s: any) => s.points.length >= 2)
      .slice(0, 5);
    if (!clean.length) return { figure: null, problem: "The graph has no usable data points." };
    const markers = (Array.isArray(f.markers) ? f.markers : [])
      .filter((m: any) => finite(Number(m?.x)) && finite(Number(m?.y)) && typeof m?.label === "string")
      .slice(0, 8)
      .map((m: any) => ({ x: Number(m.x), y: Number(m.y), label: String(m.label).slice(0, 12) }));
    const g: GraphFigure = {
      kind: "graph",
      title: typeof f.title === "string" ? f.title.slice(0, 80) : undefined,
      xLabel: String(f.xLabel ?? "x").slice(0, 50),
      yLabel: String(f.yLabel ?? "y").slice(0, 50),
      series: clean,
      markers,
      xTicks: f.xTicks !== false,
      yTicks: f.yTicks !== false,
    };
    const labels = [g.title, g.xLabel, g.yLabel, ...clean.map((s: any) => s.label), ...markers.map((m: any) => m.label)].join(" ");
    if (DEVANAGARI.test(labels)) return { figure: null, problem: "Figure labels must be in English/symbols (Hindi goes in the question text)." };
    return { figure: { ...g, caption } };
  }
  if (f.kind === "structures") {
    const items = (Array.isArray(f.items) ? f.items : [])
      .filter((i: any) => typeof i?.smiles === "string" && i.smiles.trim())
      .slice(0, 6)
      .map((i: any, n: number) => ({ label: String(i.label ?? `(${String.fromCharCode(65 + n)})`).slice(0, 10), smiles: String(i.smiles).trim().slice(0, 300) }));
    if (!items.length) return { figure: null, problem: "The structure figure has no SMILES." };
    return { figure: { kind: "structures", items, caption } };
  }
  if (f.kind === "diagram") {
    if (typeof f.svg !== "string" || !f.svg.includes("<svg")) return { figure: null, problem: "The diagram has no SVG." };
    if (DEVANAGARI.test(f.svg)) return { figure: null, problem: "Figure labels must be in English/symbols (Hindi goes in the question text)." };
    return { figure: { kind: "diagram", svg: f.svg.slice(0, 20000), caption } };
  }
  return { figure: null, problem: `Unknown figure kind "${String(f.kind)}".` };
}

// ------------------------------------------------------------------ graph
function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 3) return `M${pts.map((p) => p.join(",")).join(" L")}`;
  // Catmull-Rom through the points (passes through every given point).
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function graphSvg(g: GraphFigure): string {
  const L = 78;
  const R = 24;
  const T = g.title ? 44 : 24;
  const B = 62;
  const all = g.series.flatMap((s) => s.points).concat((g.markers ?? []).map((m) => [m.x, m.y] as [number, number]));
  let xMin = Math.min(...all.map((p) => p[0]));
  let xMax = Math.max(...all.map((p) => p[0]));
  let yMin = Math.min(0, ...all.map((p) => p[1]));
  let yMax = Math.max(...all.map((p) => p[1]));
  if (xMin === xMax) xMax = xMin + 1;
  if (yMin === yMax) yMax = yMin + 1;
  yMax += (yMax - yMin) * 0.08;
  const sx = (x: number) => L + ((x - xMin) / (xMax - xMin)) * (W - L - R);
  const sy = (y: number) => H - B - ((y - yMin) / (yMax - yMin)) * (H - T - B);
  const dashes = ["", "8 5", "2 5", "12 4 2 4", "4 4"];
  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
  if (g.title) parts.push(`<text x="${W / 2}" y="26" text-anchor="middle" font-size="17" font-weight="bold">${esc(g.title)}</text>`);
  // axes with arrows
  parts.push(`<line x1="${L}" y1="${H - B}" x2="${W - R + 6}" y2="${H - B}" stroke="#111" stroke-width="2"/>`);
  parts.push(`<line x1="${L}" y1="${H - B}" x2="${L}" y2="${T - 8}" stroke="#111" stroke-width="2"/>`);
  parts.push(`<path d="M${W - R + 6},${H - B} l-10,-5 v10 z M${L},${T - 8} l-5,10 h10 z" fill="#111"/>`);
  if (g.xTicks) for (const t of niceTicks(xMin, xMax)) parts.push(`<line x1="${sx(t)}" y1="${H - B}" x2="${sx(t)}" y2="${H - B + 6}" stroke="#111"/><text x="${sx(t)}" y="${H - B + 22}" text-anchor="middle" font-size="13">${esc(String(t))}</text>`);
  if (g.yTicks) for (const t of niceTicks(yMin, yMax)) parts.push(`<line x1="${L - 6}" y1="${sy(t)}" x2="${L}" y2="${sy(t)}" stroke="#111"/><text x="${L - 10}" y="${sy(t) + 4}" text-anchor="end" font-size="13">${esc(String(t))}</text>`);
  parts.push(`<text x="${(L + W - R) / 2}" y="${H - 14}" text-anchor="middle" font-size="15">${esc(g.xLabel)}</text>`);
  parts.push(`<text x="20" y="${(T + H - B) / 2}" text-anchor="middle" font-size="15" transform="rotate(-90 20 ${(T + H - B) / 2})">${esc(g.yLabel)}</text>`);
  g.series.forEach((s, i) => {
    const pts = [...s.points].sort((a, b) => a[0] - b[0]).map((p) => [Number(sx(p[0]).toFixed(1)), Number(sy(p[1]).toFixed(1))] as [number, number]);
    if (s.style === "points") pts.forEach((p) => parts.push(`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#111"/>`));
    else parts.push(`<path d="${s.style === "line" ? `M${pts.map((p) => p.join(",")).join(" L")}` : smoothPath(pts)}" fill="none" stroke="#111" stroke-width="2.5"${dashes[i] ? ` stroke-dasharray="${dashes[i]}"` : ""}/>`);
    if (s.label) {
      const last = pts[pts.length - 1]!;
      parts.push(`<text x="${Math.min(last[0] + 6, W - R - 4)}" y="${last[1] - 8}" font-size="14" text-anchor="${last[0] > W - 120 ? "end" : "start"}">${esc(s.label)}</text>`);
    }
  });
  for (const m of g.markers ?? []) parts.push(`<circle cx="${sx(m.x)}" cy="${sy(m.y)}" r="5" fill="#111"/><text x="${sx(m.x) + 8}" y="${sy(m.y) - 8}" font-size="15" font-weight="bold">${esc(m.label)}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Liberation Sans, Arial, sans-serif">${parts.join("")}</svg>`;
}

// ------------------------------------------------------------------ structures
export async function structuresSvg(f: StructuresFigure): Promise<{ svg: string; problem?: string }> {
  const OCL = (await import("openchemlib")).default ?? (await import("openchemlib"));
  const cell = 260;
  const cols = f.items.length === 4 ? 2 : Math.min(3, f.items.length);
  const rows = Math.ceil(f.items.length / cols);
  const width = cols * cell;
  const height = rows * (cell + 30);
  const parts = [`<rect width="${width}" height="${height}" fill="#ffffff"/>`];
  const bad: string[] = [];
  f.items.forEach((item, i) => {
    let inner = "";
    try {
      const mol = (OCL as any).Molecule.fromSmiles(item.smiles);
      if (!mol.getAllAtoms()) throw new Error("empty");
      // No E/Z or chirality written in the SMILES: draw plain bonds, not "unknown stereo" crosses.
      if (!/[\/\\@]/.test(item.smiles)) mol.stripStereoInformation();
      inner = mol.toSVG(cell - 10, cell - 10, `m${i}`, { noImplicitAtomLabelColors: true, suppressChiralText: true, suppressCIPParity: true, autoCrop: true, autoCropMargin: 6, factorTextSize: 1.2 });
    } catch {
      bad.push(item.label);
      return;
    }
    // Place the molecule's own <svg> inside the grid cell.
    const x = (i % cols) * cell + 5;
    const y = Math.floor(i / cols) * (cell + 30) + 5;
    const head = inner.match(/^<svg[^>]*>/)?.[0] ?? "";
    const vb = head.match(/viewBox="([^"]+)"/)?.[1] ?? `0 0 ${cell - 10} ${cell - 10}`;
    const body = inner.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    // The cropped drawing is scaled up to fill its cell (small molecules came out tiny).
    parts.push(`<svg x="${x + 15}" y="${y + 15}" width="${cell - 40}" height="${cell - 40}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${body}</svg>`);
    parts.push(`<text x="${x + (cell - 10) / 2}" y="${y + cell + 6}" text-anchor="middle" font-size="20" font-weight="bold">${esc(item.label)}</text>`);
  });
  if (bad.length === f.items.length) return { svg: "", problem: "None of the structures could be drawn (invalid SMILES)." };
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Liberation Sans, Arial, sans-serif">${parts.join("")}</svg>`,
    problem: bad.length ? `Structure(s) ${bad.join(", ")} could not be drawn (invalid SMILES).` : undefined,
  };
}

// ------------------------------------------------------------------ diagram (allow-listed SVG)
const TAGS = new Set(["svg", "g", "line", "rect", "circle", "ellipse", "polyline", "polygon", "path", "text", "tspan"]);
const ATTRS = new Set([
  "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "points", "d", "viewBox",
  "fill", "stroke", "stroke-width", "stroke-dasharray", "font-size", "font-weight", "text-anchor", "transform", "opacity",
  "dx", "dy",
]);

/**
 * Rebuilds the model's SVG from allowed elements/attributes only (no scripts,
 * links, images, styles or event handlers), so only shapes and text remain.
 */
export function sanitizeDiagramSvg(svg: string): { svg: string; problem?: string } {
  const tokens = svg.match(/<\/?[a-zA-Z][^>]*>|[^<]+/g) ?? [];
  const out: string[] = [];
  const stack: string[] = [];
  let skipping = 0;
  let shapes = 0;
  let vb = "0 0 640 400";
  for (const tok of tokens) {
    if (!tok.startsWith("<")) {
      if (!skipping && stack[stack.length - 1] && ["text", "tspan"].includes(stack[stack.length - 1]!)) out.push(esc(tok.replace(/&[a-z#0-9]+;/gi, (m) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">" })[m] ?? "")));
      continue;
    }
    const close = tok.startsWith("</");
    const name = (tok.match(/^<\/?([a-zA-Z][\w:-]*)/)?.[1] ?? "").toLowerCase();
    const selfClosing = /\/>$/.test(tok);
    if (!TAGS.has(name)) {
      if (!selfClosing) skipping += close ? -1 : 1;
      skipping = Math.max(0, skipping);
      continue;
    }
    if (skipping) continue;
    if (close) {
      if (stack[stack.length - 1] === name) {
        stack.pop();
        if (name !== "svg") out.push(`</${name}>`);
      }
      continue;
    }
    const attrs: string[] = [];
    for (const m of tok.matchAll(/([a-zA-Z][\w:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
      const key = m[1]!;
      const val = (m[3] ?? m[4] ?? "").trim();
      if (!ATTRS.has(key) && key !== "viewbox") continue;
      if (/url\(|javascript:|expression|@import|&#/i.test(val)) continue;
      if (key === "transform" && !/^[\s\d.,\-a-z()]*$/i.test(val)) continue;
      if (name === "svg") {
        if (key.toLowerCase() === "viewbox") vb = val;
        continue;
      }
      attrs.push(`${key}="${esc(val)}"`);
    }
    if (name === "svg") {
      stack.push("svg");
      continue;
    }
    shapes++;
    out.push(`<${name}${attrs.length ? ` ${attrs.join(" ")}` : ""}${selfClosing ? "/>" : ">"}`);
    if (!selfClosing) stack.push(name);
  }
  while (stack.length) {
    const n = stack.pop()!;
    if (n !== "svg") out.push(`</${n}>`);
  }
  const nums = vb.split(/[\s,]+/).map(Number);
  const [bx, by, bw, bh] = nums.length === 4 && nums.every(finite) && nums[2]! > 0 && nums[3]! > 0 ? nums : [0, 0, 640, 400];
  // A margin round the drawing so labels at the edge are not cut off.
  const pad = Math.max(bw!, bh!) * 0.12;
  const [vx, vy, vw, vh] = [bx! - pad, by! - pad, bw! + pad * 2, bh! + pad * 2];
  if (shapes < 3) return { svg: "", problem: "The diagram is empty." };
  const width = 640;
  const height = Math.round((640 * vh!) / vw!);
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${vx} ${vy} ${vw} ${vh}" font-family="Liberation Sans, Arial, sans-serif"><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#ffffff"/>${out.join("")}</svg>`,
  };
}

// ------------------------------------------------------------------ PNG
let fontsReady = false;
function registerFonts(GlobalFonts: any) {
  if (fontsReady) return;
  // The server has no system fonts: use the Liberation Sans shipped with pdf.js.
  const dir = path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts");
  for (const f of ["LiberationSans-Regular.ttf", "LiberationSans-Bold.ttf", "LiberationSans-Italic.ttf"]) {
    const p = path.join(dir, f);
    if (existsSync(p)) GlobalFonts.registerFromPath(p, "Liberation Sans");
  }
  fontsReady = true;
}

export async function svgToPng(svg: string, scale = 2): Promise<Buffer> {
  const { createCanvas, loadImage, GlobalFonts } = await import("@napi-rs/canvas");
  registerFonts(GlobalFonts);
  const img = await loadImage(Buffer.from(svg));
  const canvas = createCanvas(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toBuffer("image/png");
}

/** Draws a figure; a problem means it could not be drawn as described (never a blank picture). */
export async function renderFigure(f: FigureSpec): Promise<{ png?: Buffer; svg?: string; problem?: string }> {
  try {
    let svg = "";
    let problem: string | undefined;
    if (f.kind === "graph") svg = graphSvg(f);
    else if (f.kind === "structures") ({ svg, problem } = await structuresSvg(f));
    else ({ svg, problem } = sanitizeDiagramSvg(f.svg));
    if (!svg) return { problem: problem ?? "The figure could not be drawn." };
    return { png: await svgToPng(svg), svg, problem };
  } catch (err) {
    return { problem: `The figure could not be drawn (${err instanceof Error ? err.message : String(err)}).` };
  }
}

/** What the figure shows, in words — the answer checker cannot see pictures. */
export function describeFigure(f: FigureSpec): string {
  if (f.kind === "graph") {
    const series = f.series.map((s) => `${s.label ? `${s.label}: ` : ""}${s.points.map((p) => `(${p[0]}, ${p[1]})`).join(" ")}`).join("; ");
    const markers = (f.markers ?? []).map((m) => `${m.label} at (${m.x}, ${m.y})`).join(", ");
    return `Graph${f.title ? ` "${f.title}"` : ""}: x-axis "${f.xLabel}", y-axis "${f.yLabel}". Data ${series}.${markers ? ` Marked points: ${markers}.` : ""}`;
  }
  if (f.kind === "structures") return `Chemical structures: ${f.items.map((i) => `${i.label} = SMILES ${i.smiles}`).join("; ")}.`;
  const labels = Array.from(f.svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)).map((m) => m[1]!.trim()).filter(Boolean);
  // Labels alone hide the geometry (which corner has the 30°?): give the drawing itself.
  const drawing = sanitizeDiagramSvg(f.svg).svg.replace(/<rect x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*" fill="#ffffff"\/>/, "").slice(0, 4000);
  return `Labelled diagram${f.caption ? ` (${f.caption})` : ""}. Labels: ${labels.join(", ") || "none"}. SVG drawing (y grows downwards; a <text> sits next to the point or angle it labels): ${drawing}`;
}
